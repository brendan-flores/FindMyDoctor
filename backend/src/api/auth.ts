import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  registerDoctor,
  login,
  changePassword,
  verifyLoginOtp,
  sendLoginOtpForLogin,
  hashChallengeToken,
  hashTrustedBrowserToken,
  refreshAccessToken,
  listTrustedBrowsers,
  revokeTrustedBrowser,
  revokeTrustedBrowserById,
  revokeAllUserSessions,
  trustCurrentBrowser,
} from '../modules/auth/authService';
import { success, error, ErrorCodes } from '../utils/response';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { getSessionPolicy, buildSessionResponse } from '../modules/auth/sessionPolicy';
import {
  ROLE_PREFIXES,
  clearSessionCookies,
  clearTrustedBrowserCookie,
  clearTrustedCookies,
  cookieNamesForRole,
  rolePrefixForRole,
  setSessionCookies,
  setTrustedBrowserCookie,
} from '../modules/auth/cookies';
import { query } from '../database/connection';

const router = Router();

// Token validation endpoints are rate limited independently of the global
// limiter. Failures are logged without the token value.
const tokenValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many attempts. Please try again later.' } },
});

function roleFromRequest(req: Request): string {
  const bodyRole = typeof req.body?.role === 'string' ? req.body.role.toUpperCase() : '';
  if (['DOCTOR', 'SECRETARY', 'ADMIN', 'SUPERADMIN', 'PATIENT'].includes(bodyRole)) {
    return bodyRole;
  }

  const headerRole = String(req.headers['x-portal-role'] || '').toLowerCase();
  const headerMap: Record<string, string> = {
    doctor: 'DOCTOR',
    secretary: 'SECRETARY',
    admin: 'ADMIN',
    patient: 'PATIENT',
  };
  if (headerMap[headerRole]) {
    return headerMap[headerRole];
  }

  const path = (req.originalUrl || '').split('?')[0].toLowerCase();
  if (path.includes('doctor')) return 'DOCTOR';
  if (path.includes('secretary')) return 'SECRETARY';
  if (path.includes('admin')) return 'ADMIN';
  if (path.includes('patient')) return 'PATIENT';

  return '';
}

function deviceInfoFromRequest(req: Request): string | undefined {
  const userAgent = req.headers['user-agent'];
  return typeof userAgent === 'string' ? userAgent.slice(0, 500) : undefined;
}

function trustedBrowserTokenFromRequest(req: Request, role: string): string | undefined {
  // The trusted-browser token is only ever read from its HttpOnly cookie.
  // It must never be accepted from a request body, localStorage, or JS.
  const names = cookieNamesForRole(role);
  const cookieToken = req.cookies?.[names.trustedBrowser] || req.cookies?.trustedBrowser;

  return cookieToken && cookieToken !== 'undefined' && cookieToken !== 'null'
    ? cookieToken
    : undefined;
}

function refreshTokenFromRequest(req: Request, role: string): string | undefined {
  const bodyToken =
    typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;

  if (bodyToken && bodyToken !== 'undefined' && bodyToken !== 'null') {
    return bodyToken;
  }

  const cookieCandidates = role
    ? [cookieNamesForRole(role).refreshToken]
    : ROLE_PREFIXES.map((prefix) => `${prefix}_refreshToken`);

  for (const cookieName of cookieCandidates) {
    const cookieToken = req.cookies?.[cookieName];
    if (cookieToken && cookieToken !== 'undefined' && cookieToken !== 'null') {
      return cookieToken;
    }
  }

  const globalCookieToken = req.cookies?.refreshToken;
  return globalCookieToken && globalCookieToken !== 'undefined' && globalCookieToken !== 'null'
    ? globalCookieToken
    : undefined;
}

/**
 * Apply the role policy cookies after a successful authentication. The trusted
 * browser token is only ever sent back as an HttpOnly cookie.
 */
function applySessionCookies(
  res: Response,
  result: {
    role: string;
    rememberMe: boolean;
    accessToken: string;
    refreshToken: string;
    trustedBrowserToken?: string | null;
    trustedBrowserRevoked?: boolean;
  }
) {
  const policy = getSessionPolicy(result.role, result.rememberMe);

  setSessionCookies(
    res,
    result.role,
    { accessToken: result.accessToken, refreshToken: result.refreshToken },
    policy
  );

  if (result.trustedBrowserToken) {
    setTrustedBrowserCookie(res, result.role, result.trustedBrowserToken);
  } else if (!result.rememberMe || result.trustedBrowserRevoked) {
    // An untrusted browser session must not keep a stale trusted-device cookie.
    clearTrustedBrowserCookie(res, result.role);
  }
}

function sessionPayload(result: {
  role: string;
  rememberMe: boolean;
  accessToken: string;
  refreshToken: string;
  isTrustedBrowser?: boolean;
  requiresTrustPrompt?: boolean;
}) {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    rememberMe: result.rememberMe,
    isTrustedBrowser: result.isTrustedBrowser === true,
    requiresTrustPrompt: result.requiresTrustPrompt === true,
    session: buildSessionResponse(result.role, result.rememberMe),
  };
}

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, role, firstName, lastName } = req.body;

    console.log('🟢 Register request received:', { email, role, firstName, lastName });

    // Basic validation
    if (!email || !password || !role) {
      console.log('🔴 Validation failed: missing required fields');
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Email, password, and role are required')
      );
    }

    if (!['PATIENT', 'DOCTOR', 'SECRETARY', 'ADMIN'].includes(role)) {
      console.log('🔴 Validation failed: invalid role');
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid role')
      );
    }

    if (role === 'PATIENT' && (!firstName || !lastName)) {
      console.log('🔴 Validation failed: missing name for patient');
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'First name and last name are required for patients')
      );
    }

    const result = await register({ email, password, role, firstName, lastName });

    console.log('🟢 Registration successful, result:', result);

    const response = success(result, 'Registration successful');
    console.log('🟢 Sending response:', JSON.stringify(response));

    res.status(201).json(response);
  } catch (err: any) {
    console.log('🔴 Registration error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Registration failed';

    if (errorCode === ErrorCodes.EMAIL_ALREADY_EXISTS) {
      return res.status(409).json(error(errorCode, errorMessage));
    }

    res.status(500).json(error(errorCode, errorMessage));
  }
});

// Register doctor (self-registration, auto-approved)
router.post('/register/doctor', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, specialty, credentials, prcLicenseNumber, clinic, contactNumber } = req.body;

    const result = await registerDoctor({
      email,
      password,
      fullName,
      specialty,
      credentials,
      prcLicenseNumber,
      clinic,
      contactNumber,
    });

    return res.status(201).json(success(result, 'Doctor account created successfully'));
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Doctor registration failed';

    if (errorCode === ErrorCodes.VALIDATION_ERROR) {
      return res.status(400).json(error(errorCode, errorMessage));
    }

    if (errorCode === ErrorCodes.EMAIL_ALREADY_EXISTS || errorCode === ErrorCodes.CONFLICT) {
      return res.status(409).json(error(errorCode, errorMessage));
    }

    // Unique constraint violation (email or PRC license number)
    if (errorCode === '23505') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Email or PRC license number is already registered'));
    }

    return res.status(500).json(error(errorCode, errorMessage));
  }
});

// Login
router.post('/login', tokenValidationLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, expectedRole, trustedBrowserToken } = req.body;

    if (!email || !password || !['PATIENT', 'DOCTOR', 'SECRETARY', 'ADMIN'].includes(expectedRole)) {
      return res.status(400).json(
        error(ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials or account role.')
      );
    }

    const result = await login({
      email,
      password,
      expectedRole,
      trustedBrowserToken: trustedBrowserTokenFromRequest(req, expectedRole),
      deviceInfo: deviceInfoFromRequest(req),
    });

    // If OTP is required, send OTP and return the opaque challenge.
    if (result.requiresOtp) {
      try {
        await sendLoginOtpForLogin(email);
        console.log('🟢 Login OTP required for:', email);
      } catch (otpErr: any) {
        if (otpErr.code === ErrorCodes.RATE_LIMIT) {
          console.warn('⚠️ Supabase rate limited OTP resend, proceeding with challengeId using existing OTP:', email);
        } else {
          throw otpErr;
        }
      }

      return res.json(
        success(
          {
            requiresOtp: true,
            challengeId: result.challengeId,
            rememberMe: result.rememberMe,
            requiresTrustPrompt: result.requiresTrustPrompt,
            session: buildSessionResponse(result.role, result.rememberMe),
          },
          'OTP required'
        )
      );
    }

    const authResult = result as {
      user: any;
      accessToken: string;
      refreshToken: string;
      role: string;
      rememberMe: boolean;
      isTrustedBrowser: boolean;
      requiresTrustPrompt: boolean;
      trustedBrowserToken: string | null;
      trustedBrowserRevoked: boolean;
    };

    applySessionCookies(res, authResult);

    res.json(
      success(
        {
          user: authResult.user,
          ...sessionPayload(authResult),
        },
        'Login successful'
      )
    );
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Login failed';

    if (errorCode === ErrorCodes.INVALID_CREDENTIALS) {
      return res.status(401).json(error(errorCode, errorMessage));
    }
    if (errorCode === ErrorCodes.DOCTOR_PENDING_APPROVAL) {
      return res.status(401).json(error(errorCode, errorMessage));
    }
    if (errorCode === ErrorCodes.RATE_LIMIT) {
      return res.status(429).json(error(errorCode, errorMessage));
    }

    res.status(500).json(error(errorCode, errorMessage));
  }
});

// Verify login OTP
router.post('/verify-login-otp', tokenValidationLimiter, async (req: Request, res: Response) => {
  try {
    const { challengeId, otp } = req.body;

    if (!challengeId || !otp) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Challenge ID and OTP are required')
      );
    }

    const result = await verifyLoginOtp(challengeId, otp);

    console.log('🟢 Login OTP verified for user:', result.user.email);

    applySessionCookies(res, result);

    res.json(
      success(
        {
          user: result.user,
          ...sessionPayload(result),
        },
        'Login successful'
      )
    );
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'OTP verification failed';

    if (errorCode === ErrorCodes.INVALID_CREDENTIALS) {
      return res.status(401).json(error(errorCode, errorMessage));
    }

    res.status(500).json(error(errorCode, errorMessage));
  }
});

// Resend login OTP
router.post('/resend-login-otp', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.body;

    if (!challengeId) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Challenge ID is required')
      );
    }

    const challengeTokenHash = hashChallengeToken(challengeId);

    // Use transaction with row locking to prevent race conditions
    const client = await (await import('../database/connection')).getClient();

    try {
      await client.query('BEGIN');

      // Lock the challenge row for update to prevent concurrent resends
      const lockResult = await client.query(
        `SELECT id, user_id, email, last_otp_sent_at FROM login_otp_challenges
         WHERE challenge_token_hash = $1
         AND expires_at > CURRENT_TIMESTAMP
         AND used_at IS NULL
         FOR UPDATE`,
        [challengeTokenHash]
      );

      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Invalid or expired login challenge'));
      }

      const { id: currentChallengeId, user_id, email, last_otp_sent_at } = lockResult.rows[0];

      // SERVER-SIDE: Enforce resend cooldown (60 seconds) - checked within transaction
      const cooldownMs = 60 * 1000; // 60 seconds
      const timeSinceLastSend = Date.now() - new Date(last_otp_sent_at).getTime();

      if (timeSinceLastSend < cooldownMs) {
        await client.query('ROLLBACK');
        client.release();
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
        return res.status(429).json(
          error(ErrorCodes.RATE_LIMIT, `Please wait ${remainingSeconds} seconds before resending`)
        );
      }

      // SAFETY: Invalidate ALL previous unused challenges for this user
      // This ensures only the newest challenge can complete the login
      await client.query(
        `UPDATE login_otp_challenges
         SET used_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         AND used_at IS NULL
         AND id != $2`,
        [user_id, currentChallengeId]
      );

      console.log('🟢 Previous challenges invalidated for user:', user_id);

      // Create new challenge (within transaction)
      const { createLoginOtpChallenge } = await import('../modules/auth/authService');
      const newChallengeToken = await createLoginOtpChallenge(user_id, email);

      // Update last OTP sent timestamp for the new challenge (within transaction)
      const newChallengeTokenHash = hashChallengeToken(newChallengeToken);
      await client.query(
        `UPDATE login_otp_challenges
         SET last_otp_sent_at = CURRENT_TIMESTAMP
         WHERE challenge_token_hash = $1 AND used_at IS NULL`,
        [newChallengeTokenHash]
      );

      await client.query('COMMIT');
      client.release();

      // Send new OTP for the new challenge (after transaction commits)
      await sendLoginOtpForLogin(email);

      console.log('🟢 Login OTP resent for:', email);

      res.json(success({ challengeId: newChallengeToken }, 'OTP resent successfully'));
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to resend OTP';

    if (errorCode === ErrorCodes.NOT_FOUND) {
      return res.status(404).json(error(errorCode, errorMessage));
    }

    res.status(500).json(error(errorCode, errorMessage));
  }
});

// Refresh token
router.post('/refresh', tokenValidationLimiter, async (req: Request, res: Response) => {
  const role = roleFromRequest(req);

  try {
    const refreshToken = refreshTokenFromRequest(req, role);

    if (!refreshToken) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Refresh token is required')
      );
    }

    const result = await refreshAccessToken(refreshToken);

    const policy = getSessionPolicy(result.role, result.rememberMe);
    setSessionCookies(
      res,
      result.role,
      { accessToken: result.accessToken, refreshToken: result.refreshToken },
      policy
    );

    res.json(
      success(
        {
          user: result.user,
          ...sessionPayload(result),
        },
        'Token refreshed successfully'
      )
    );
  } catch (err: any) {
    // Clear the stale cookies for this portal so the client stops retrying with
    // a token that will never work again. Other portal sessions are untouched.
    clearSessionCookies(res, role || undefined);

    // The response deliberately does not reveal whether the token was revoked,
    // expired, or otherwise invalid.
    return res.status(401).json(
      error(ErrorCodes.UNAUTHORIZED, 'Your session has expired. Please sign in again.')
    );
  }
});

// Logout (scoped to the current portal so other role sessions keep working)
router.post('/logout', (req: Request, res: Response) => {
  const role = roleFromRequest(req);

  clearSessionCookies(res, role || undefined);

  // Trusted-browser cookies are intentionally preserved: trust is a device
  // setting and persists across sign-out until it is revoked or expires.
  res.json(success({ role: role || null }, 'Logout successful'));
});

// List the current user's trusted browsers
router.get('/trusted-browsers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Flag the row matching this request's trusted-browser cookie so the UI can
    // label it "This browser". No token or hash value is exposed.
    const role = roleFromRequest(req) || req.user!.role;
    const trustedBrowserToken = trustedBrowserTokenFromRequest(req, role);
    const browsers = await listTrustedBrowsers(
      req.user!.id,
      trustedBrowserToken ? hashTrustedBrowserToken(trustedBrowserToken) : undefined
    );
    return res.json(success({ browsers }, 'Trusted browsers loaded'));
  } catch (err) {
    return res.status(500).json(
      error(ErrorCodes.SERVER_ERROR, 'Failed to load trusted browsers')
    );
  }
});

// Describe the browser/device making the current request. Used by the
// post-login trust prompt. No token or secret is returned.
router.get(
  '/trusted-browsers/current-device',
  authenticate,
  authorize('DOCTOR', 'SECRETARY'),
  (req: AuthRequest, res: Response) => {
    return res.json(
      success(
        {
          deviceInfo: deviceInfoFromRequest(req) || null,
          capturedAt: new Date().toISOString(),
        },
        'Current device loaded'
      )
    );
  }
);

// Trust the current browser after the user has fully authenticated. This
// upgrades the current short session to the 30-day persistent policy and
// registers/rotates the trusted-device cookie.
router.post(
  '/trusted-browsers/trust-current',
  authenticate,
  authorize('DOCTOR', 'SECRETARY'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.mustChangePassword) {
        return res.status(403).json(
          error(ErrorCodes.MUST_CHANGE_PASSWORD, 'Password change required')
        );
      }

      const role = req.user!.role;
      const sessionStartMs =
        Number((req.user as any).sst) ||
        Number((req.user as any).iat) * 1000 ||
        Date.now();
      const existingTrustedBrowserToken = trustedBrowserTokenFromRequest(req, role);

      const result = await trustCurrentBrowser(
        req.user!.id,
        deviceInfoFromRequest(req),
        sessionStartMs,
        existingTrustedBrowserToken
      );

      applySessionCookies(res, result);

      return res.json(
        success(
          {
            user: result.user,
            ...sessionPayload(result),
          },
          'Device trusted'
        )
      );
    } catch (err: any) {
      const errorCode = err.code || ErrorCodes.SERVER_ERROR;

      if (errorCode === ErrorCodes.NOT_FOUND) {
        return res.status(404).json(error(errorCode, err.message || 'User not found'));
      }

      if (errorCode === ErrorCodes.FORBIDDEN) {
        return res.status(403).json(error(errorCode, err.message || 'Insufficient permissions'));
      }

      return res.status(500).json(
        error(ErrorCodes.SERVER_ERROR, 'Failed to trust this device')
      );
    }
  }
);

// Revoke one trusted browser by id
router.delete('/trusted-browsers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const revoked = await revokeTrustedBrowserById(req.user!.id, req.params.id);

    if (!revoked) {
      return res.status(404).json(
        error(ErrorCodes.NOT_FOUND, 'Trusted browser not found')
      );
    }

    return res.json(success({ revoked: true }, 'Trusted browser revoked'));
  } catch (err) {
    return res.status(500).json(
      error(ErrorCodes.SERVER_ERROR, 'Failed to revoke trusted browser')
    );
  }
});

// Revoke every trusted browser and refresh token for the current user
router.post('/trusted-browsers/revoke-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role;
    await revokeAllUserSessions(req.user!.id);

    // Sign this browser out too and drop its trusted-browser cookie.
    clearSessionCookies(res, role);
    clearTrustedCookies(res, role);

    return res.json(success(null, 'Signed out of all devices'));
  } catch (err) {
    return res.status(500).json(
      error(ErrorCodes.SERVER_ERROR, 'Failed to sign out of all devices')
    );
  }
});

// Revoke the current trusted browser (also used when the user declines trust)
router.post('/revoke-trusted-browser', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = roleFromRequest(req) || req.user!.role;
    const trustedBrowserToken = trustedBrowserTokenFromRequest(req, role);

    if (trustedBrowserToken) {
      await revokeTrustedBrowser(userId, trustedBrowserToken);
    }

    clearTrustedCookies(res, role);

    res.json(success(null, 'Trusted browser revoked'));
  } catch (err) {
    res.status(500).json(
      error(ErrorCodes.SERVER_ERROR, 'Failed to revoke trusted browser')
    );
  }
});

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;
    const mustChangePassword = req.user!.mustChangePassword || false;

    // currentPassword is required only if must_change_password is false
    if (!mustChangePassword && !currentPassword) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Current password is required')
      );
    }

    if (!newPassword) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'New password is required')
      );
    }

    if (newPassword.length < 8) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'New password must be at least 8 characters')
      );
    }

    const sessionStartMs =
      Number((req.user as any).sst) || Number((req.user as any).iat) * 1000 || Date.now();
    const session = {
      rememberMe: req.user!.remember === true,
      sessionStartMs,
    };

    const result = await changePassword(
      userId,
      currentPassword,
      newPassword,
      mustChangePassword,
      session
    );

    // A password change revokes every trusted browser and refresh token. Issue a
    // fresh pair for this browser and drop the now-invalid trust cookie.
    const policy = getSessionPolicy(result.user.role, result.rememberMe);
    setSessionCookies(
      res,
      result.user.role,
      { accessToken: result.accessToken, refreshToken: result.refreshToken },
      policy
    );
    clearTrustedCookies(res, result.user.role);

    res.json(
      success(
        {
          user: result.user,
          ...sessionPayload({
            role: result.user.role,
            rememberMe: result.rememberMe,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          }),
        },
        'Password changed successfully'
      )
    );
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Password change failed';

    if (errorCode === ErrorCodes.INVALID_CREDENTIALS) {
      return res.status(401).json(error(errorCode, errorMessage));
    }

    if (errorCode === ErrorCodes.NOT_FOUND) {
      return res.status(404).json(error(errorCode, errorMessage));
    }

    if (errorCode === ErrorCodes.VALIDATION_ERROR) {
      return res.status(400).json(error(errorCode, errorMessage));
    }

    res.status(500).json(error(errorCode, errorMessage));
  }
});

export default router;