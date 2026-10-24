import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { success, error, ErrorCodes } from '../utils/response';
import { query } from '../database/connection';
import { config } from '../config';
import bcrypt from 'bcrypt';
import { sendPasswordResetOtp, verifyPasswordResetOtp, ensureUserSupabaseIdentity } from '../services/otpService';

const router = Router();

// Rate limiter for password reset requests: max 3 requests per 10 minutes per email
const passwordResetLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use email as the key for rate limiting
    return (req.body?.email as string) || req.ip;
  },
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many password reset attempts. Please try again later.' } },
});

// Rate limiter for verification attempts: max 5 attempts per 10 minutes per email
const passwordResetVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.body?.email as string) || req.ip;
  },
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many verification attempts. Please try again later.' } },
});

/**
 * POST /api/v1/auth/password-reset/request
 * Send OTP to user's email for password reset
 */
router.post('/request', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Valid email is required')
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists in PostgreSQL
    const userResult = await query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      // For security, don't reveal whether email exists
      // Return success message even if email not found
      return res.json(
        success(
          { message: 'If the email is registered, a reset code has been sent.' },
          'Password reset request processed'
        )
      );
    }

    const user = userResult.rows[0];

    // Ensure user has Supabase Auth identity for password reset across all roles
    // (Secretary, Doctor, Patient, Admin, SuperAdmin)
    try {
      await ensureUserSupabaseIdentity(normalizedEmail, user.role);
    } catch (err) {
      console.error(`Failed to ensure Supabase identity for ${user.role}:`, err);
      // Fallback inside sendPasswordResetOtp will also attempt identity creation if needed
    }

    // Send OTP via Supabase
    await sendPasswordResetOtp(normalizedEmail, user.role);

    console.log('🟢 Password reset OTP sent to:', normalizedEmail);

    res.json(
      success(
        { message: 'If the email is registered, a reset code has been sent.' },
        'Password reset request processed'
      )
    );
  } catch (err: any) {
    console.error('🔴 Password reset request error:', err);

    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to send reset code';

    if (errorCode === ErrorCodes.RATE_LIMIT) {
      return res.status(429).json(error(errorCode, errorMessage));
    }

    res.status(500).json(error(errorCode, errorMessage));
  }
});

/**
 * POST /api/v1/auth/password-reset/verify
 * Verify OTP code and return temporary password reset token
 */
router.post('/verify', passwordResetVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    // Validate inputs
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Valid email is required')
      );
    }

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Valid 6-digit verification code is required')
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const userResult = await query(
      'SELECT id, email, role, session_version FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json(
        error(ErrorCodes.NOT_FOUND, 'User not found')
      );
    }

    const user = userResult.rows[0];

    // Verify OTP with Supabase
    const otpVerification = await verifyPasswordResetOtp(normalizedEmail, otp.trim());

    if (!otpVerification.verified) {
      return res.status(400).json(
        error(ErrorCodes.INVALID_CREDENTIALS, otpVerification.error || 'Invalid or expired verification code')
      );
    }

    // Generate signed reset token valid for 15 minutes, tied to user and session_version
    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: normalizedEmail,
        sessionVersion: user.session_version,
        purpose: 'password_reset',
      },
      config.jwt.secret,
      { expiresIn: '15m' }
    );

    console.log('🟢 Password reset OTP verified for user:', normalizedEmail);

    res.json(
      success(
        {
          resetToken,
          message: 'Verification code verified successfully',
        },
        'Code verified successfully'
      )
    );
  } catch (err: any) {
    console.error('🔴 Password reset verification error:', err);

    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to verify code';

    if (errorCode === ErrorCodes.RATE_LIMIT) {
      return res.status(429).json(error(errorCode, errorMessage));
    }

    res.status(500).json(error(errorCode, errorMessage));
  }
});

/**
 * POST /api/v1/auth/password-reset/reset
 * Validate reset token and update password
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    // Validate inputs
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Valid email is required')
      );
    }

    if (!resetToken || typeof resetToken !== 'string') {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Verification token is required. Please verify your code first.')
      );
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'New password is required')
      );
    }

    if (newPassword.length < 8) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'New password must be at least 8 characters')
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify JWT reset token
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, config.jwt.secret);
    } catch (jwtErr: any) {
      return res.status(400).json(
        error(ErrorCodes.INVALID_CREDENTIALS, 'Invalid or expired reset token. Please verify your code again.')
      );
    }

    if (
      !decoded ||
      decoded.purpose !== 'password_reset' ||
      decoded.email?.toLowerCase().trim() !== normalizedEmail
    ) {
      return res.status(400).json(
        error(ErrorCodes.INVALID_CREDENTIALS, 'Invalid reset token. Please verify your code again.')
      );
    }

    // Check if user exists
    const userResult = await query(
      'SELECT id, email, role, session_version FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json(
        error(ErrorCodes.NOT_FOUND, 'User not found')
      );
    }

    const user = userResult.rows[0];

    // Ensure session_version matches (token single-use / invalidated on previous reset)
    if (user.session_version !== decoded.sessionVersion) {
      return res.status(400).json(
        error(ErrorCodes.INVALID_CREDENTIALS, 'Reset token has already been used or expired. Please request a new code.')
      );
    }

    // Hash new password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in PostgreSQL
    // Also clear must_change_password flag and increment session_version to invalidate tokens/sessions
    await query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = false,
           session_version = session_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    console.log('🟢 Password reset successful for user:', normalizedEmail);

    res.json(
      success(
        { message: 'Password has been reset successfully. You can now log in with your new password.' },
        'Password reset successful'
      )
    );
  } catch (err: any) {
    console.error('🔴 Password reset error:', err);

    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to reset password';

    res.status(500).json(error(errorCode, errorMessage));
  }
});

export default router;
