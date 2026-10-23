import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, getClient } from '../../database/connection';
import { config } from '../../config';
import { ErrorCodes } from '../../utils/response';
import * as otpService from '../../services/otpService';
import {
  buildSessionResponse,
  getSessionPolicy,
  isAdminRole,
  isStaffRole,
  remainingAbsoluteSeconds,
} from './sessionPolicy';

export interface RegisterData {
  email: string;
  password: string;
  role: 'PATIENT' | 'DOCTOR' | 'SECRETARY' | 'ADMIN';
  firstName?: string;
  lastName?: string;
}

export interface LoginData {
  email: string;
  password: string;
  expectedRole: 'PATIENT' | 'DOCTOR' | 'SECRETARY' | 'ADMIN';
  /** @deprecated Remember Me was replaced by the explicit device-trust prompt. */
  rememberMe?: boolean;
  trustedBrowserToken?: string;
  deviceInfo?: string;
}

export interface DoctorRegistrationData {
  email: string;
  password: string;
  fullName: string;
  specialty: string;
  prcLicenseNumber: string;
  clinic: string;
  roomNumber?: string;
  credentials?: string;
  contactNumber?: string;
}

export async function register(data: RegisterData) {
  const { email, password, role, firstName, lastName } = data;

  // Prevent public Admin registration
  if (role === 'ADMIN') {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Admin registration is not allowed through public endpoint' };
  }

  // Check if email already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw { code: ErrorCodes.EMAIL_ALREADY_EXISTS, message: 'Email already registered' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Generate username from email (part before @)
  const username = email.split('@')[0];

  // Create user
  const userResult = await query(
    `INSERT INTO users (email, password_hash, role, must_change_password, username)
     VALUES ($1, $2, $3, false, $4)
     RETURNING id, email, role, must_change_password, created_at`,
    [email, passwordHash, role, username]
  );

  const user = userResult.rows[0];

  // Create role-specific profile
  if (role === 'PATIENT' && firstName && lastName) {
    await query(
      `INSERT INTO patients (user_id, first_name, last_name)
       VALUES ($1, $2, $3)`,
      [user.id, firstName, lastName]
    );
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
    accessToken,
    refreshToken,
  };
}

export async function login(data: LoginData) {
  const { email, password, expectedRole, trustedBrowserToken } = data;

  // Find user by email or username
  const userResult = await query(
    `SELECT * FROM users
     WHERE (email = $1 OR username = $1)
     AND is_active = true`,
    [email]
  );

  if (userResult.rows.length === 0) {
    throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid credentials' };
  }

  const user = userResult.rows[0];

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid credentials' };
  }

  const roleMatchesLoginPage = expectedRole === 'ADMIN'
    ? user.role === 'ADMIN' || user.role === 'SUPERADMIN'
    : user.role === expectedRole;

  if (!roleMatchesLoginPage) {
    throw {
      code: ErrorCodes.INVALID_CREDENTIALS,
      message: 'Invalid credentials or account role.',
    };
  }

  // Check doctor approval status
  if (user.role === 'DOCTOR') {
    const doctorResult = await query(
      'SELECT approval_status FROM doctors WHERE user_id = $1',
      [user.id]
    );

    if (doctorResult.rows.length > 0) {
      const approvalStatus = doctorResult.rows[0].approval_status;

      if (approvalStatus === 'PENDING') {
        throw {
          code: ErrorCodes.DOCTOR_PENDING_APPROVAL,
          message: 'Your account is awaiting administrator approval'
        };
      }

      // REJECTED doctors are allowed to authenticate to correct and resubmit their profile
      // They will be routed to /doctor-profile based on their approval_status
    }
  }

  // Trusted devices are only available to staff portals. Admin/SuperAdmin
  // always require OTP and never use trusted devices. The trusted-device
  // cookie is the single source of truth: a valid cookie skips OTP and grants a
  // persistent 30-day session. New browsers receive a short session and are
  // asked to trust the device only after authentication succeeds.
  const staff = isStaffRole(user.role);
  let isTrustedBrowser = false;
  let trustedBrowserTokenToSet: string | null = null;

  if (staff && trustedBrowserToken) {
    // Rotate the trusted-device token on every successful use.
    const trusted = await checkTrustedBrowser(user.id, trustedBrowserToken);
    if (trusted) {
      isTrustedBrowser = true;
      trustedBrowserTokenToSet = trusted.token;
    }
  }

  const sessionRemember = staff ? isTrustedBrowser : false;
  const requiresTrustPrompt = staff && !isTrustedBrowser;

  // Server-side OTP requirement:
  // - Admin/SuperAdmin: always mandatory.
  // - Doctor/Secretary: only when 2FA is enabled and this is not a trusted device.
  let requiresOtp = false;
  if (isAdminRole(user.role)) {
    requiresOtp = true;
  } else if (staff) {
    const twoFactorEnabled = await isTwoFactorEnabled(user);
    requiresOtp = twoFactorEnabled && !isTrustedBrowser;
  }

  // OTP verification always issues a short staff session. The browser is
  // trusted later through the explicit post-login prompt, so completing the
  // current OTP can never be bypassed by choosing "trust this device".
  if (requiresOtp) {
    const challengeToken = await createLoginOtpChallenge(user.id, user.email, false);

    return {
      requiresOtp: true,
      challengeId: challengeToken,
      role: user.role,
      rememberMe: false,
      isTrustedBrowser: false,
      requiresTrustPrompt,
      trustedBrowserRevoked: false,
    };
  }

  // Normal login without OTP (2FA disabled, a trusted device, or a patient).
  const session = { rememberMe: sessionRemember, sessionStartMs: Date.now() };
  const accessToken = generateAccessToken(user, session);
  const refreshToken = generateRefreshToken(user, session);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
    accessToken,
    refreshToken,
    role: user.role,
    rememberMe: sessionRemember,
    isTrustedBrowser,
    requiresTrustPrompt,
    trustedBrowserToken: trustedBrowserTokenToSet,
    trustedBrowserRevoked: false,
    session: buildSessionResponse(user.role, sessionRemember),
  };
}

async function isTwoFactorEnabled(user: any): Promise<boolean> {
  if (user.role === 'DOCTOR') {
    const result = await query(
      'SELECT two_factor_enabled FROM doctors WHERE user_id = $1',
      [user.id]
    );
    return result.rows.length > 0 && result.rows[0].two_factor_enabled === true;
  }

  if (user.role === 'SECRETARY') {
    const result = await query(
      'SELECT two_factor_enabled FROM secretaries WHERE user_id = $1',
      [user.id]
    );
    return result.rows.length > 0 && result.rows[0].two_factor_enabled === true;
  }

  return false;
}

export async function changePassword(
  userId: string,
  currentPassword: string | undefined,
  newPassword: string,
  mustChangePassword: boolean = false,
  session?: SessionTokenContext
) {
  // Get user
  const userResult = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw { code: ErrorCodes.NOT_FOUND, message: 'User not found' };
  }

  const user = userResult.rows[0];

  // Verify the current password unless this is a forced first-login change
  // with no current password supplied (walk-in accounts). If a current password
  // is supplied, it must always be correct.
  if (!mustChangePassword || currentPassword) {
    if (!currentPassword) {
      throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Current password is required' };
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValidPassword) {
      throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Current password is incorrect' };
    }
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Update password and clear must_change_password flag
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
    [newPasswordHash, userId]
  );

  // Invalidate every refresh token issued before this password change.
  await query(
    'UPDATE users SET session_version = session_version + 1 WHERE id = $1',
    [userId]
  );

  // Revoke all trusted browsers for this user (security best practice)
  await revokeAllTrustedBrowsers(userId);

  // Fetch updated user record to generate new token with current state
  const updatedUserResult = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  if (updatedUserResult.rows.length === 0) {
    throw { code: ErrorCodes.NOT_FOUND, message: 'User not found after update' };
  }

  const updatedUser = updatedUserResult.rows[0];

  // Issue a fresh token pair for the current session. All other devices were
  // invalidated by the session_version increment above.
  const tokenContext = session || { rememberMe: false, sessionStartMs: Date.now() };
  const newAccessToken = generateAccessToken(updatedUser, tokenContext);
  const newRefreshToken = generateRefreshToken(updatedUser, tokenContext);

  return {
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      mustChangePassword: updatedUser.must_change_password,
    },
    rememberMe: tokenContext.rememberMe,
  };
}

/**
 * Doctor self-registration.
 * Creates the user account and the doctor profile in a single transaction.
 * Self-registered doctors are approved immediately, so they appear in the
 * public doctor search (GET /api/v1/doctors).
 */
export async function registerDoctor(data: DoctorRegistrationData) {
  const {
    email,
    password,
    fullName,
    specialty,
    prcLicenseNumber,
    clinic,
    roomNumber,
    credentials,
    contactNumber,
  } = data;

  // Validation
  if (!email || !password || !fullName || !specialty || !prcLicenseNumber || !clinic) {
    throw {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Email, password, full name, specialty, PRC license number, and clinic are required',
    };
  }

  if (password.length < 8) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must contain at least one special character' };
  }

  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length < 2) {
    throw {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Full name must include a first and last name',
    };
  }

  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');
  const licenseNumber = prcLicenseNumber.trim();

  if (!/^\d{7}$/.test(licenseNumber)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'PRC license number must be 7 digits' };
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Email must be unique across all users
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      throw { code: ErrorCodes.EMAIL_ALREADY_EXISTS, message: 'Email already registered' };
    }

    // A PRC license number may only be registered once
    const existingLicense = await client.query(
      'SELECT id FROM doctors WHERE prc_license_number = $1',
      [licenseNumber]
    );

    if (existingLicense.rows.length > 0) {
      throw { code: ErrorCodes.CONFLICT, message: 'PRC license number is already registered' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Generate username from email (part before @)
    const username = email.split('@')[0];

    // Create the user account
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, must_change_password, username)
       VALUES ($1, $2, 'DOCTOR', false, $3)
       RETURNING id, email, role`,
      [email, passwordHash, username]
    );

    const user = userResult.rows[0];

    // Ensure Supabase Auth identity for OTP delivery
    await otpService.ensureDoctorSupabaseIdentity(email);

    // Create the doctor profile (auto-approved)
    const doctorResult = await client.query(
      `INSERT INTO doctors (
         user_id, first_name, last_name, specialty, credentials,
         prc_license_number, practice_name, practice_phone, practice_email, room_number, is_approved
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
       RETURNING id, first_name, last_name, specialty, credentials, prc_license_number,
                 practice_name, practice_phone, practice_email, room_number, is_approved, created_at`,
      [
        user.id,
        firstName,
        lastName,
        specialty,
        credentials || null,
        licenseNumber,
        clinic,
        contactNumber || null,
        email,
        roomNumber || null,
      ]
    );

    await client.query('COMMIT');

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      doctor: doctorResult.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface SessionTokenContext {
  rememberMe: boolean;
  sessionStartMs: number;
}

function lifetimeFor(policyLifetimeSec: number, policyAbsoluteSec: number | null, sessionStartMs: number) {
  if (policyAbsoluteSec === null) {
    return policyLifetimeSec;
  }

  const elapsedSec = Math.floor((Date.now() - sessionStartMs) / 1000);
  const remainingSec = policyAbsoluteSec - elapsedSec;
  return Math.max(1, Math.min(policyLifetimeSec, remainingSec));
}

export function generateAccessToken(user: any, session?: SessionTokenContext) {
  const context = session || { rememberMe: false, sessionStartMs: Date.now() };
  const policy = getSessionPolicy(user.role, context.rememberMe);
  const expiresIn = lifetimeFor(
    policy.accessExpiresInSec,
    policy.absoluteTimeoutSec,
    context.sessionStartMs
  );

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
      typ: 'access',
      sv: user.session_version ?? 0,
      sst: context.sessionStartMs,
      remember: context.rememberMe,
    },
    config.jwt.secret,
    { expiresIn } as any
  );
}

export function generateRefreshToken(user: any, session?: SessionTokenContext) {
  const context = session || { rememberMe: false, sessionStartMs: Date.now() };
  const policy = getSessionPolicy(user.role, context.rememberMe);
  const expiresIn = lifetimeFor(
    policy.refreshExpiresInSec,
    policy.absoluteTimeoutSec,
    context.sessionStartMs
  );

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      typ: 'refresh',
      sv: user.session_version ?? 0,
      sst: context.sessionStartMs,
      remember: context.rememberMe,
    },
    config.jwt.secret,
    { expiresIn } as any
  );
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    // Verify the refresh token
    const decoded = verifyToken(refreshToken) as any;

    // Only refresh tokens may be used here. Access tokens are rejected.
    if (decoded.typ && decoded.typ !== 'refresh') {
      throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid refresh token' };
    }

    // Get the user from database
    const userResult = await query(
      `SELECT * FROM users WHERE id = $1 AND is_active = true`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid refresh token' };
    }

    const user = userResult.rows[0];
    const currentSessionVersion = Number(user.session_version ?? 0);
    const tokenSessionVersion = decoded.sv === undefined ? null : Number(decoded.sv);

    // Tokens issued before session versioning are only accepted while the
    // user has never had a revocation event.
    if (
      (tokenSessionVersion === null && currentSessionVersion > 0) ||
      (tokenSessionVersion !== null && tokenSessionVersion !== currentSessionVersion)
    ) {
      throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Revoked refresh token' };
    }

    const rememberMe = isStaffRole(user.role) ? decoded.remember === true : false;
    const policy = getSessionPolicy(user.role, rememberMe);

    if (policy.absoluteTimeoutSec !== null) {
      const sessionStartMs = Number(decoded.sst) || (Number(decoded.iat) * 1000) || Date.now();
      if (remainingAbsoluteSeconds(policy, sessionStartMs) <= 0) {
        throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Session limit reached' };
      }
    }

    const session: SessionTokenContext = {
      rememberMe,
      sessionStartMs: Number(decoded.sst) || (Number(decoded.iat) * 1000) || Date.now(),
    };

    // Generate new access and refresh tokens. For non-remembered staff this
    // slides the 8-hour idle window forward on each refresh.
    const newAccessToken = generateAccessToken(user, session);
    const newRefreshToken = generateRefreshToken(user, session);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      role: user.role,
      rememberMe,
      session: buildSessionResponse(user.role, rememberMe),
    };
  } catch (error) {
    throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid or expired refresh token' };
  }
}

export function verifyToken(token: string) {
  return jwt.verify(token, config.jwt.secret);
}

/**
 * Generate opaque cryptographically random challenge token
 * This is NOT a JWT - it's an opaque identifier for server-side challenge state
 */
export function generateChallengeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash challenge token for secure storage in PostgreSQL
 * We store only the hash, not the raw token
 */
export function hashChallengeToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate cryptographically random trusted-browser token
 * This is an opaque identifier stored in an HttpOnly cookie to recognize trusted browsers
 */
export function generateTrustedBrowserToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash trusted-browser token for secure storage in PostgreSQL
 * We store only the hash, not the raw token
 */
export function hashTrustedBrowserToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Check if a browser is trusted for a given user.
 * On success the token is rotated: the stored hash is replaced with a new
 * random token that must be sent back to the client in the HttpOnly cookie.
 */
export async function checkTrustedBrowser(
  userId: string,
  token: string
): Promise<{ record: any; token: string } | null> {
  const tokenHash = hashTrustedBrowserToken(token);

  const result = await query(
    `SELECT * FROM trusted_browsers
     WHERE user_id = $1
     AND token_hash = $2
     AND revoked_at IS NULL
     AND expires_at > CURRENT_TIMESTAMP`,
    [userId, tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Rotate the token on every use. Only the new hash is stored.
  const rotatedToken = generateTrustedBrowserToken();
  const rotatedHash = hashTrustedBrowserToken(rotatedToken);

  const updated = await query(
    `UPDATE trusted_browsers
     SET token_hash = $1, last_used_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND revoked_at IS NULL
     RETURNING *`,
    [rotatedHash, result.rows[0].id]
  );

  if (updated.rows.length === 0) {
    return null;
  }

  return { record: updated.rows[0], token: rotatedToken };
}

/**
 * Register a browser as trusted for a user.
 * Returns the raw token to be stored in an HttpOnly cookie.
 * Only the SHA-256 hash is persisted.
 */
export async function registerTrustedBrowser(userId: string, deviceInfo?: string): Promise<string> {
  const token = generateTrustedBrowserToken();
  const tokenHash = hashTrustedBrowserToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const safeDeviceInfo = deviceInfo ? deviceInfo.slice(0, 500) : null;

  await query(
    `INSERT INTO trusted_browsers (user_id, token_hash, device_info, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, safeDeviceInfo, expiresAt]
  );

  return token;
}

/**
 * Trust the current browser after the user has fully authenticated.
 *
 * This issues a fresh 30-day persistent token pair for the current browser and
 * registers (or rotates) its trusted-device record. It must only be called from
 * an authenticated staff session; it never bypasses the login-time OTP.
 */
export async function trustCurrentBrowser(
  userId: string,
  deviceInfo: string | undefined,
  sessionStartMs: number,
  existingTrustedBrowserToken?: string
) {
  const userResult = await query(
    `SELECT * FROM users WHERE id = $1 AND is_active = true`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw { code: ErrorCodes.NOT_FOUND, message: 'User not found' };
  }

  const user = userResult.rows[0];

  if (!isStaffRole(user.role)) {
    throw {
      code: ErrorCodes.FORBIDDEN,
      message: 'Trusted devices are only available to doctors and secretaries',
    };
  }

  let trustedBrowserToken: string;

  if (existingTrustedBrowserToken) {
    const trusted = await checkTrustedBrowser(user.id, existingTrustedBrowserToken);
    trustedBrowserToken = trusted
      ? trusted.token
      : await registerTrustedBrowser(user.id, deviceInfo);
  } else {
    trustedBrowserToken = await registerTrustedBrowser(user.id, deviceInfo);
  }

  const session = { rememberMe: true, sessionStartMs };
  const accessToken = generateAccessToken(user, session);
  const refreshToken = generateRefreshToken(user, session);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
    accessToken,
    refreshToken,
    role: user.role,
    rememberMe: true,
    isTrustedBrowser: true,
    requiresTrustPrompt: false,
    trustedBrowserToken,
    session: buildSessionResponse(user.role, true),
  };
}

/**
 * List a user's active trusted browsers (never returns token hashes).
 * When the hash of the making request's trusted-browser token is provided, the
 * matching row is flagged `is_current` so the UI can label "This browser".
 */
export async function listTrustedBrowsers(
  userId: string,
  currentTokenHash?: string
): Promise<any[]> {
  const result = await query(
    `SELECT id, device_info, created_at, last_used_at, expires_at,
            (token_hash = $2) AS is_current
     FROM trusted_browsers
     WHERE user_id = $1
     AND revoked_at IS NULL
     AND expires_at > CURRENT_TIMESTAMP
     ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
    [userId, currentTokenHash ?? null]
  );

  return result.rows;
}

/**
 * Revoke trust for a specific browser by token
 */
export async function revokeTrustedBrowser(userId: string, token: string): Promise<void> {
  const tokenHash = hashTrustedBrowserToken(token);

  await query(
    `UPDATE trusted_browsers
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     AND token_hash = $2
     AND revoked_at IS NULL`,
    [userId, tokenHash]
  );
}

/**
 * Revoke a specific browser row by id, scoped to the owner.
 * Returns true when an active row was revoked.
 */
export async function revokeTrustedBrowserById(userId: string, browserId: string): Promise<boolean> {
  const result = await query(
    `UPDATE trusted_browsers
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE id = $1
     AND user_id = $2
     AND revoked_at IS NULL
     RETURNING id`,
    [browserId, userId]
  );

  return result.rows.length > 0;
}

/**
 * Revoke all trusted browsers for a user (e.g., on password change)
 */
export async function revokeAllTrustedBrowsers(userId: string): Promise<void> {
  await query(
    `UPDATE trusted_browsers
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     AND revoked_at IS NULL`,
    [userId]
  );
}

/**
 * Revoke every session for a user: all trusted browsers and all refresh
 * tokens. Access tokens expire naturally on their own short lifetime.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await query(
    'UPDATE users SET session_version = session_version + 1 WHERE id = $1',
    [userId]
  );

  await revokeAllTrustedBrowsers(userId);
}

/**
 * Create LOGIN_OTP challenge in PostgreSQL
 * Stores server-side state for true one-time use guarantee
 */
export async function createLoginOtpChallenge(userId: string, email: string, rememberMe: boolean = false): Promise<string> {
  const challengeToken = generateChallengeToken();
  const challengeTokenHash = hashChallengeToken(challengeToken);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  const lastOtpSentAt = new Date(); // Track when OTP was last sent for this challenge

  await query(
    `INSERT INTO login_otp_challenges (challenge_token_hash, user_id, email, expires_at, last_otp_sent_at, remember_me)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [challengeTokenHash, userId, email, expiresAt, lastOtpSentAt, rememberMe]
  );

  return challengeToken;
}

/**
 * Increment challenge attempt count on failed OTP verification
 */
export async function incrementChallengeAttempt(challengeToken: string): Promise<void> {
  const challengeTokenHash = hashChallengeToken(challengeToken);

  await query(
    `UPDATE login_otp_challenges
     SET attempt_count = attempt_count + 1
     WHERE challenge_token_hash = $1 AND used_at IS NULL`,
    [challengeTokenHash]
  );
}

/**
 * Send login OTP to user's email
 * Called when OTP is required for login
 */
export async function sendLoginOtpForLogin(email: string): Promise<void> {
  await otpService.sendLoginOtp(email);
}

/**
 * Verify login OTP and issue authenticated session
 * This is called after the user submits challengeId + OTP
 */
export async function verifyLoginOtp(
  challengeId: string,
  otp: string,
  _rememberMe?: boolean,
  _deviceInfo?: string
) {
  const challengeTokenHash = hashChallengeToken(challengeId);

  // First, verify OTP with Supabase (before consuming challenge)
  // Get the email from the challenge
  const challengeResult = await query(
    `SELECT * FROM login_otp_challenges
     WHERE challenge_token_hash = $1
     AND expires_at > CURRENT_TIMESTAMP
     AND used_at IS NULL
     AND attempt_count < 5`,
    [challengeTokenHash]
  );

  if (challengeResult.rows.length === 0) {
    throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid or expired login challenge' };
  }

  const challenge = challengeResult.rows[0];

  // Verify OTP with Supabase
  const otpVerification = await otpService.verifyLoginOtp(challenge.email, otp);

  if (!otpVerification.verified) {
    // Increment attempt count on failure
    await incrementChallengeAttempt(challengeId);
    throw {
      code: ErrorCodes.INVALID_CREDENTIALS,
      message: otpVerification.error || 'Invalid or expired OTP code'
    };
  }

  // OTP verified successfully - now atomically consume challenge
  const updateResult = await query(
    `UPDATE login_otp_challenges
     SET used_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND used_at IS NULL
     RETURNING id`,
    [challenge.id]
  );

  if (updateResult.rows.length === 0) {
    // Another request already consumed this challenge
    throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Login challenge already used' };
  }

  // Get user and generate tokens. The account must still be active.
  const userResult = await query(
    `SELECT * FROM users WHERE id = $1 AND is_active = true`,
    [challenge.user_id]
  );

  if (userResult.rows.length === 0) {
    throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid or expired login challenge' };
  }

  const user = userResult.rows[0];

  // OTP verification always issues a short staff session. The browser becomes
  // trusted only through the explicit post-login trust prompt, so a password
  // plus OTP can never silently create a trusted device.
  const staff = isStaffRole(user.role);
  const session = { rememberMe: false, sessionStartMs: Date.now() };
  const accessToken = generateAccessToken(user, session);
  const refreshToken = generateRefreshToken(user, session);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
    accessToken,
    refreshToken,
    role: user.role,
    rememberMe: false,
    isTrustedBrowser: false,
    requiresTrustPrompt: staff,
    trustedBrowserToken: null,
    session: buildSessionResponse(user.role, false),
  };
}