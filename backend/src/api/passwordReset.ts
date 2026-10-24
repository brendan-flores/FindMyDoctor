import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { success, error, ErrorCodes } from '../utils/response';
import { query } from '../database/connection';
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

    // Check if user exists in PostgreSQL
    const userResult = await query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email.toLowerCase()]
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
      await ensureUserSupabaseIdentity(email, user.role);
    } catch (err) {
      console.error(`Failed to ensure Supabase identity for ${user.role}:`, err);
      // Fallback inside sendPasswordResetOtp will also attempt identity creation if needed
    }

    // Send OTP via Supabase
    await sendPasswordResetOtp(email, user.role);

    console.log('🟢 Password reset OTP sent to:', email);

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
 * POST /api/v1/auth/password-reset/reset
 * Verify OTP and update password
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate inputs
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Valid email is required')
      );
    }

    if (!otp || typeof otp !== 'string' || otp.length !== 6) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Valid 6-digit OTP is required')
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

    // Check if user exists
    const userResult = await query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json(
        error(ErrorCodes.NOT_FOUND, 'User not found')
      );
    }

    const user = userResult.rows[0];

    // Verify OTP with Supabase
    const otpVerification = await verifyPasswordResetOtp(email, otp);

    if (!otpVerification.verified) {
      return res.status(400).json(
        error(ErrorCodes.INVALID_CREDENTIALS, otpVerification.error || 'Invalid or expired OTP code')
      );
    }

    // Hash new password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in PostgreSQL
    // Also clear must_change_password flag if present
    await query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = false,
           session_version = session_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    console.log('🟢 Password reset successful for user:', email);

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
