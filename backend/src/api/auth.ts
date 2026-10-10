import { Router, Request, Response } from 'express';
import { register, registerDoctor, login, changePassword, verifyLoginOtp, sendLoginOtpForLogin, hashChallengeToken } from '../modules/auth/authService';
import { success, error, ErrorCodes } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../database/connection';

const router = Router();

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
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, expectedRole, rememberMe, trustedBrowserToken } = req.body;

    if (!email || !password || !['DOCTOR', 'SECRETARY', 'ADMIN'].includes(expectedRole)) {
      return res.status(400).json(
        error(ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials or account role.')
      );
    }

    const result = await login({ email, password, expectedRole, rememberMe, trustedBrowserToken });

    // If OTP is required, send OTP and return challenge
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
        success({ requiresOtp: true, challengeId: result.challengeId }, 'OTP required')
      );
    }

    // Otherwise, normal login - set HttpOnly cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined,
    });

    // If Remember Me is unchecked and browser was previously trusted, revoke trust
    if (!rememberMe && trustedBrowserToken) {
      const { revokeTrustedBrowser } = await import('../modules/auth/authService');
      await revokeTrustedBrowser(result.user.id, trustedBrowserToken);
      res.clearCookie('trustedBrowser', { path: '/' });
    } else if (result.isTrustedBrowser && trustedBrowserToken) {
      // Re-issue the trusted browser cookie for trusted browsers
      res.cookie('trustedBrowser', trustedBrowserToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    res.json(
      success({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }, 'Login successful')
    );
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Login failed';

    if (errorCode === ErrorCodes.INVALID_CREDENTIALS) {
      return res.status(401).json(error(errorCode, errorMessage));
    }
    if (errorCode === ErrorCodes.RATE_LIMIT) {
      return res.status(429).json(error(errorCode, errorMessage));
    }

    res.status(500).json(error(errorCode, errorMessage));
  }
});

// Verify login OTP
router.post('/verify-login-otp', async (req: Request, res: Response) => {
  try {
    const { challengeId, otp, rememberMe } = req.body;

    if (!challengeId || !otp) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Challenge ID and OTP are required')
      );
    }

    const result = await verifyLoginOtp(challengeId, otp, rememberMe);

    console.log('🟢 Login OTP verified for user:', result.user.email);

    // Set HttpOnly cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined,
    });

    // If Remember Me is checked, register this browser as trusted
    if (rememberMe && result.trustedBrowserToken) {
      res.cookie('trustedBrowser', result.trustedBrowserToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    res.json(
      success({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }, 'Login successful')
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
router.post('/refresh', (req: Request, res: Response) => {
  // For MVP, we'll just require re-login
  // In production, implement proper refresh token validation
  res.status(501).json(
    error(ErrorCodes.SERVER_ERROR, 'Token refresh not implemented')
  );
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('trustedBrowser');
  res.json(
    success(null, 'Logout successful')
  );
});

// Revoke trusted browser (called when user unchecks Remember Me)
router.post('/revoke-trusted-browser', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const trustedBrowserToken = req.cookies.trustedBrowser;

    if (trustedBrowserToken) {
      const { revokeTrustedBrowser } = await import('../modules/auth/authService');
      await revokeTrustedBrowser(userId, trustedBrowserToken);
    }

    res.clearCookie('trustedBrowser');
    res.json(
      success(null, 'Trusted browser revoked')
    );
  } catch (err: any) {
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

    if (!currentPassword || !newPassword) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Current password and new password are required')
      );
    }

    if (newPassword.length < 8) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'New password must be at least 8 characters')
      );
    }

    await changePassword(userId, currentPassword, newPassword);

    res.json(
      success(null, 'Password changed successfully')
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

    res.status(500).json(error(errorCode, errorMessage));
  }
});

export default router;