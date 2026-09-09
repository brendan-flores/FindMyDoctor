import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../database/connection';
import { config } from '../../config';
import { error, ErrorCodes } from '../../utils/response';

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

export async function register(data: RegisterData) {
  const { email, password, role, firstName, lastName } = data;

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

  // Find user by email
  const userResult = await query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
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

export function generateAccessToken(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export function generateRefreshToken(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, config.jwt.secret);
}