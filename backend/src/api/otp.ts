import { Router, Request, Response } from 'express';
import { sendDoctorSignupOtp, verifyOtpToken, checkEmailVerificationStatus } from '../services/otpService';
import { success, error, ErrorCodes } from '../utils/response';
import { query, getClient } from '../database/connection';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const router = Router();

router.post('/send', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email is required'));
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid email address'));
    }
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Email is already registered'));
    }
    const result = await sendDoctorSignupOtp(email);
    return res.status(200).json(success(null, result.message));
  } catch (err: any) {
    console.error('OTP send error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to send OTP';
    if (errorCode === ErrorCodes.CONFLICT) return res.status(409).json(error(errorCode, errorMessage));
    return res.status(500).json(error(errorCode, errorMessage));
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  const client = await getClient();
  try {
    const { email, otp, password, fullName, specialty, credentials, prcLicenseNumber, clinic, contactNumber } = req.body;
    if (!email || !otp || !password || !fullName || !specialty || !prcLicenseNumber || !clinic) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'All fields are required'));
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid email address'));
    }
    if (password.length < 8) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters'));
    }
    if (!/^\d{7}$/.test(prcLicenseNumber.trim())) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'PRC license number must be 7 digits'));
    }
    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Full name must include a first and last name'));
    }
    
    // Verify OTP with Supabase first
    const otpVerification = await verifyOtpToken(email, otp);
    if (!otpVerification.verified) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, otpVerification.error || 'Invalid or expired OTP code'));
    }
    
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw { code: ErrorCodes.EMAIL_ALREADY_EXISTS, message: 'Email already registered' };
    }
    const existingLicense = await client.query('SELECT id FROM doctors WHERE prc_license_number = $1', [prcLicenseNumber.trim()]);
    if (existingLicense.rows.length > 0) {
      throw { code: ErrorCodes.CONFLICT, message: 'PRC license number is already registered' };
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    const licenseNumber = prcLicenseNumber.trim();
    await client.query('BEGIN');
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, role, must_change_password) VALUES ($1, $2, \'DOCTOR\', false) RETURNING id, email, role',
      [email, passwordHash]
    );
    const user = userResult.rows[0];
    const doctorResult = await client.query(
      'INSERT INTO doctors (user_id, first_name, last_name, specialty, credentials, prc_license_number, practice_name, practice_phone, practice_email, is_approved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING *',
      [user.id, firstName, lastName, specialty, credentials || null, licenseNumber, clinic, contactNumber || null, email]
    );
    await client.query('COMMIT');
    const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role, mustChangePassword: user.must_change_password }, config.jwt.secret, { expiresIn: config.jwt.expiresIn as string });
    const refreshToken = jwt.sign({ id: user.id, email: user.email }, config.jwt.secret, { expiresIn: config.jwt.refreshExpiresIn as string });
    return res.status(201).json(success({ user: { id: user.id, email: user.email, role: user.role }, doctor: doctorResult.rows[0], accessToken, refreshToken }, 'Doctor account created and verified successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    console.error('OTP verification error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'OTP verification failed';
    if (errorCode === ErrorCodes.VALIDATION_ERROR) return res.status(400).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.EMAIL_ALREADY_EXISTS || errorCode === ErrorCodes.CONFLICT) return res.status(409).json(error(errorCode, errorMessage));
    return res.status(500).json(error(errorCode, errorMessage));
  }
});

router.post('/resend', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email is required'));
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid email address'));
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) return res.status(409).json(error(ErrorCodes.CONFLICT, 'Email is already registered'));
    const result = await sendDoctorSignupOtp(email);
    return res.status(200).json(success(null, result.message));
  } catch (err: any) {
    console.error('OTP resend error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to resend OTP';
    if (errorCode === ErrorCodes.CONFLICT) return res.status(409).json(error(errorCode, errorMessage));
    return res.status(500).json(error(errorCode, errorMessage));
  }
});

router.get('/status/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid email address'));
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(200).json(success({ isRegistered: true, isVerified: true }, 'Email is registered and verified'));
    }
    const status = await checkEmailVerificationStatus(email);
    return res.status(200).json(success({ isRegistered: false, isVerified: status.isVerified }, 'Email verification status retrieved'));
  } catch (err: any) {
    console.error('OTP status check error:', err);
    return res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to check verification status'));
  }
});

export default router;
