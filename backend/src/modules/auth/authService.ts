import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../../database/connection';
import { config } from '../../config';
import { ErrorCodes } from '../../utils/response';

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
}

export interface DoctorRegistrationData {
  email: string;
  password: string;
  fullName: string;
  specialty: string;
  prcLicenseNumber: string;
  clinic: string;
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

  // Create user
  const userResult = await query(
    `INSERT INTO users (email, password_hash, role, must_change_password) 
     VALUES ($1, $2, $3, false) 
     RETURNING id, email, role, must_change_password, created_at`,
    [email, passwordHash, role]
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
  const { email, password } = data;

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
      
      if (approvalStatus === 'REJECTED') {
        throw { 
          code: ErrorCodes.DOCTOR_REJECTED, 
          message: 'Your doctor account has not been approved and you cannot sign in' 
        };
      }
    }
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

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  // Get user
  const userResult = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw { code: ErrorCodes.NOT_FOUND, message: 'User not found' };
  }

  const user = userResult.rows[0];

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isValidPassword) {
    throw { code: ErrorCodes.INVALID_CREDENTIALS, message: 'Current password is incorrect' };
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Update password
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
    [newPasswordHash, userId]
  );

  return { success: true };
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

    // Create the user account
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, must_change_password)
       VALUES ($1, $2, 'DOCTOR', false)
       RETURNING id, email, role`,
      [email, passwordHash]
    );

    const user = userResult.rows[0];

    // Create the doctor profile (auto-approved)
    const doctorResult = await client.query(
      `INSERT INTO doctors (
         user_id, first_name, last_name, specialty, credentials,
         prc_license_number, practice_name, practice_phone, practice_email, is_approved
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING id, first_name, last_name, specialty, credentials, prc_license_number,
                 practice_name, practice_phone, practice_email, is_approved, created_at`,
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

export function generateAccessToken(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as any
  );
}

export function generateRefreshToken(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn } as any
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, config.jwt.secret);
}