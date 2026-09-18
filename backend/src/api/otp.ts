import { Router, Request, Response } from 'express';
import { sendDoctorSignupOtp, verifyOtpToken, checkEmailVerificationStatus } from '../services/otpService';
import { success, error, ErrorCodes } from '../utils/response';
import { query, getClient } from '../database/connection';
import bcrypt from 'bcryptjs';
import { config } from '../config';

/*
 * Doctor sign-up OTP flow
 *
 * Order of operations:
 *   1. POST /send   -> validate the sign-up form, stage it in PostgreSQL and ask
 *                      Supabase to email the OTP. No account is created yet.
 *   2. POST /verify -> verify the OTP with Supabase and, only when it succeeds,
 *                      create the `users` account and `doctors` profile in PostgreSQL.
 *
 * PostgreSQL is the single source of truth for doctor accounts, credentials and
 * profile data. Supabase is used only to send and verify the email OTP - no
 * application account or profile data is ever written to Supabase.
 */

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRC_LICENSE_PATTERN = /^\d{7}$/;
const OTP_PATTERN = /^\d{6}$/;

// How long a staged sign-up stays valid while the doctor enters the OTP
const PENDING_SIGNUP_TTL_MINUTES = 15;

interface ValidatedDoctorSignup {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  specialty: string;
  credentials: string | null;
  prcLicenseNumber: string;
  clinic: string;
}

/**
 * Validates the doctor sign-up payload before any OTP is sent.
 * These are the same rules enforced by the PostgreSQL registration service
 * (backend/src/modules/auth/authService.ts).
 */
function validateDoctorSignupPayload(body: any): ValidatedDoctorSignup {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const contactNumber = typeof body?.contactNumber === 'string' ? body.contactNumber.trim() : '';
  const specialty = typeof body?.specialty === 'string' ? body.specialty.trim() : '';
  const credentials = typeof body?.credentials === 'string' ? body.credentials.trim() : '';
  const prcLicenseNumber = typeof body?.prcLicenseNumber === 'string' ? body.prcLicenseNumber.trim() : '';
  const clinic = typeof body?.clinic === 'string' ? body.clinic.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

  if (
    !email ||
    !fullName ||
    !contactNumber ||
    !specialty ||
    !credentials ||
    !prcLicenseNumber ||
    !clinic ||
    !password ||
    !confirmPassword
  ) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'All fields are required' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid email address' };
  }

  if (password.length < 8) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must be at least 8 characters' };
  }

  if (password !== confirmPassword) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Passwords do not match' };
  }

  if (!PRC_LICENSE_PATTERN.test(prcLicenseNumber)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'PRC license number must be 7 digits' };
  }

  const nameParts = fullName.split(/\s+/).filter(Boolean);

  if (nameParts.length < 2) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Full name must include a first and last name' };
  }

  return {
    email,
    password,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' '),
    contactNumber,
    specialty,
    credentials: credentials || null,
    prcLicenseNumber,
    clinic,
  };
}

/**
 * Step 1: validate the sign-up form, stage it in PostgreSQL and send the OTP.
 * The doctor account is NOT created here.
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const payload = validateDoctorSignupPayload(req.body);
    const { email, prcLicenseNumber } = payload;

    // The application account only ever lives in PostgreSQL
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Email is already registered'));
    }

    const existingLicense = await query(
      'SELECT id FROM doctors WHERE prc_license_number = $1',
      [prcLicenseNumber]
    );

    if (existingLicense.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'PRC license number is already registered'));
    }

    // Another in-flight sign-up (different email) must not stage the same license
    const stagedLicense = await query(
      `SELECT id FROM pending_doctor_signups
        WHERE prc_license_number = $1 AND email <> $2 AND expires_at > CURRENT_TIMESTAMP`,
      [prcLicenseNumber, email]
    );

    if (stagedLicense.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'PRC license number is already registered'));
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    // Clean up abandoned sign-ups, then stage this one. The password is stored
    // hashed so plaintext is never persisted anywhere.
    await query('DELETE FROM pending_doctor_signups WHERE expires_at < CURRENT_TIMESTAMP');

    await query(
      `INSERT INTO pending_doctor_signups (
         email, password_hash, first_name, last_name, specialty, credentials,
         prc_license_number, practice_name, practice_phone, expires_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         CURRENT_TIMESTAMP + ($10::int * INTERVAL '1 minute')
       )
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         specialty = EXCLUDED.specialty,
         credentials = EXCLUDED.credentials,
         prc_license_number = EXCLUDED.prc_license_number,
         practice_name = EXCLUDED.practice_name,
         practice_phone = EXCLUDED.practice_phone,
         expires_at = EXCLUDED.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      [
        email,
        passwordHash,
        payload.firstName,
        payload.lastName,
        payload.specialty,
        payload.credentials,
        payload.prcLicenseNumber,
        payload.clinic,
        payload.contactNumber,
        PENDING_SIGNUP_TTL_MINUTES,
      ]
    );

    const result = await sendDoctorSignupOtp(email);

    return res.status(200).json(success(null, result.message));
  } catch (err: any) {
    console.error('OTP send error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to send OTP';

    if (errorCode === ErrorCodes.VALIDATION_ERROR) return res.status(400).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.CONFLICT) return res.status(409).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.RATE_LIMIT) return res.status(429).json(error(errorCode, errorMessage));

    return res.status(500).json(error(errorCode, errorMessage));
  }
});

/**
 * Step 2: verify the OTP with Supabase and, only when it succeeds, create the
 * doctor account and profile in PostgreSQL.
 */
router.post('/verify', async (req: Request, res: Response) => {
  let client: Awaited<ReturnType<typeof getClient>> | undefined;

  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

    if (!email || !otp) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email and OTP code are required'));
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid email address'));
    }

    if (!OTP_PATTERN.test(otp)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Enter a valid 6-digit OTP code'));
    }

    // Verify the OTP with Supabase (Supabase is only the OTP service)
    const otpVerification = await verifyOtpToken(email, otp);

    if (!otpVerification.verified) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, otpVerification.error || 'Invalid or expired OTP code')
      );
    }

    // Load the sign-up data staged before the OTP was sent
    const pendingResult = await query(
      'SELECT * FROM pending_doctor_signups WHERE email = $1',
      [email]
    );

    if (pendingResult.rows.length === 0) {
      return res.status(400).json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          'No sign-up request found for this email. Please complete the sign-up form again.'
        )
      );
    }

    const pending = pendingResult.rows[0];

    if (new Date(pending.expires_at).getTime() < Date.now()) {
      await query('DELETE FROM pending_doctor_signups WHERE email = $1', [email]);

      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'This sign-up request has expired. Please complete the sign-up form again.')
      );
    }

    // OTP verified - now create the PostgreSQL account and doctor profile
    client = await getClient();
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      throw { code: ErrorCodes.EMAIL_ALREADY_EXISTS, message: 'Email already registered' };
    }

    const existingLicense = await client.query(
      'SELECT id FROM doctors WHERE prc_license_number = $1',
      [pending.prc_license_number]
    );

    if (existingLicense.rows.length > 0) {
      throw { code: ErrorCodes.CONFLICT, message: 'PRC license number is already registered' };
    }

    // Application account (credentials) - bcrypt hash, verified email
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, must_change_password, email_verified, email_verified_at)
       VALUES ($1, $2, 'DOCTOR', false, true, CURRENT_TIMESTAMP)
       RETURNING id, email, role, must_change_password, email_verified`,
      [email, pending.password_hash]
    );

    const user = userResult.rows[0];

    // Doctor profile - every field captured by the sign-up page
    const doctorResult = await client.query(
      `INSERT INTO doctors (
         user_id, first_name, last_name, specialty, credentials,
         prc_license_number, practice_name, practice_phone, practice_email, is_approved, approval_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'PENDING')
       RETURNING id, first_name, last_name, specialty, credentials, prc_license_number,
                 practice_name, practice_phone, practice_email, is_approved, approval_status, created_at`,
      [
        user.id,
        pending.first_name,
        pending.last_name,
        pending.specialty,
        pending.credentials,
        pending.prc_license_number,
        pending.practice_name,
        pending.practice_phone,
        email,
      ]
    );

    // The staged data is no longer needed once the account exists
    await client.query('DELETE FROM pending_doctor_signups WHERE email = $1', [email]);

    await client.query('COMMIT');

    // Return success message - doctor must wait for admin approval
    return res.status(201).json(
      success(
        {
          user: { id: user.id, email: user.email, role: user.role },
          doctor: doctorResult.rows[0],
        },
        'Doctor account created successfully. Your registration is pending administrator approval.'
      )
    );
  } catch (err: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    console.error('OTP verification error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'OTP verification failed';

    if (errorCode === ErrorCodes.VALIDATION_ERROR) return res.status(400).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.EMAIL_ALREADY_EXISTS || errorCode === ErrorCodes.CONFLICT || errorCode === '23505') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, errorMessage));
    }

    return res.status(500).json(error(errorCode, errorMessage));
  } finally {
    if (client) {
      client.release();
    }
  }
});

/**
 * Resend the OTP for a sign-up that is already staged in PostgreSQL.
 */
router.post('/resend', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email is required'));
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid email address'));
    }

    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Email is already registered'));
    }

    const pendingSignup = await query(
      `SELECT id FROM pending_doctor_signups
        WHERE email = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [email]
    );

    if (pendingSignup.rows.length === 0) {
      return res.status(400).json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          'This sign-up request has expired. Please complete the sign-up form again.'
        )
      );
    }

    const result = await sendDoctorSignupOtp(email);

    return res.status(200).json(success(null, result.message));
  } catch (err: any) {
    console.error('OTP resend error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to resend OTP';

    if (errorCode === ErrorCodes.VALIDATION_ERROR) return res.status(400).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.CONFLICT) return res.status(409).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.RATE_LIMIT) return res.status(429).json(error(errorCode, errorMessage));

    return res.status(500).json(error(errorCode, errorMessage));
  }
});

router.get('/status/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid email address'));
    }

    // PostgreSQL is the source of truth for registered application accounts
    const existingUser = await query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(200).json(
        success(
          { isRegistered: true, isVerified: existingUser.rows[0].email_verified === true },
          'Email is registered'
        )
      );
    }

    const status = await checkEmailVerificationStatus(normalizedEmail);

    return res.status(200).json(
      success({ isRegistered: false, isVerified: status.isVerified }, 'Email verification status retrieved')
    );
  } catch (err: any) {
    console.error('OTP status check error:', err);
    return res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to check verification status'));
  }
});

export default router;