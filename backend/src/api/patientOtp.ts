import { Router, Request, Response } from 'express';
import { sendPatientSignupOtp, verifyPatientOtpToken } from '../services/patientOtpService';
import { success, error, ErrorCodes } from '../utils/response';
import { query, getClient } from '../database/connection';
import bcrypt from 'bcryptjs';
import { generateAccessToken } from '../modules/auth/authService';

/*
 * Patient sign-up OTP flow
 *
 * Order of operations:
 *   1. POST /send   -> validate the sign-up form, stage it in PostgreSQL and ask
 *                      Supabase to email the OTP. No account is created yet.
 *   2. POST /verify -> verify the OTP with Supabase and, only when it succeeds,
 *                      create the `users` account and `patients` profile in PostgreSQL.
 *
 * PostgreSQL is the single source of truth for patient accounts, credentials and
 * profile data. Supabase is used only to send and verify the email OTP - no
 * application account or profile data is ever written to Supabase.
 */

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;
const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SEX_VALUES = ['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'];

// Mobile number regex (Philippine and international formats) - matches patients.ts
const MOBILE_REGEX = /^[\d\s\-\+\(\)]+$/;

// How long a staged sign-up stays valid while the patient enters the OTP
const PENDING_SIGNUP_TTL_MINUTES = 15;

interface ValidatedPatientSignup {
  email: string;
  password: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  address: string;
  username: string;
}

/**
 * Validates the patient sign-up payload before any OTP is sent.
 */
function validatePatientSignupPayload(body: any): ValidatedPatientSignup {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

  // Prefer the explicit name components captured by the sign-up form. Fall back
  // to splitting fullName to keep the original contract backward compatible.
  let firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
  let middleName = typeof body?.middleName === 'string' ? body.middleName.trim() : '';
  let lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';

  if (!firstName && !lastName) {
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
    const nameParts = fullName.split(/\s+/).filter(Boolean);

    if (nameParts.length < 2) {
      throw { code: ErrorCodes.VALIDATION_ERROR, message: 'First name and last name are required' };
    }

    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(' ');
  }

  const dateOfBirth = typeof body?.dateOfBirth === 'string' ? body.dateOfBirth.trim() : '';
  const sex = typeof body?.sex === 'string' ? body.sex.trim().toUpperCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body?.address === 'string' ? body.address.trim() : '';

  if (!email || !firstName || !lastName || !username || !password || !confirmPassword) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'All required fields must be provided' };
  }

  if (!dateOfBirth || !sex || !phone || !address) {
    throw {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Date of birth, sex, mobile number, and address are required',
    };
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid email address' };
  }

  if (firstName.length > 100) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'First name must be 1-100 characters' };
  }

  if (lastName.length > 100) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Last name must be 1-100 characters' };
  }

  if (middleName.length > 100) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Middle name must be maximum 100 characters' };
  }

  if (username.length < 3) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Username must be at least 3 characters' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Username can only contain letters, numbers, and underscores' };
  }

  if (password.length < 8) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must be at least 8 characters' };
  }

  if (password !== confirmPassword) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Passwords do not match' };
  }

  if (!VALID_SEX_VALUES.includes(sex)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Sex must be one of: MALE, FEMALE, OTHER, NOT_SPECIFIED' };
  }

  if (phone.length > 20) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Mobile number must be 1-20 characters' };
  }

  if (!MOBILE_REGEX.test(phone)) {
    throw {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Mobile number must contain only digits, spaces, hyphens, plus sign, or parentheses',
    };
  }

  if (!DATE_OF_BIRTH_PATTERN.test(dateOfBirth)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Date of birth must be in YYYY-MM-DD format' };
  }

  const [yearStr, monthStr, dayStr] = dateOfBirth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const dob = new Date(Date.UTC(year, month - 1, day));

  if (
    dob.getUTCFullYear() !== year ||
    dob.getUTCMonth() !== month - 1 ||
    dob.getUTCDate() !== day
  ) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid date of birth' };
  }

  if (year < 1900 || year > 2100) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Date of birth year must be between 1900 and 2100' };
  }

  const now = new Date();
  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dob > nowUtc) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Date of birth cannot be in the future' };
  }

  return {
    email,
    password,
    firstName,
    middleName: middleName || null,
    lastName,
    dateOfBirth,
    sex,
    phone,
    address,
    username,
  };
}

/**
 * Step 1: validate the sign-up form, stage it in PostgreSQL and send the OTP.
 * The patient account is NOT created here.
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const payload = validatePatientSignupPayload(req.body);
    const { email } = payload;

    // The application account only ever lives in PostgreSQL
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Email is already registered'));
    }

    // Check username uniqueness up-front (after the email check, before staging)
    // so a taken username is reported on the sign-up form instead of only after
    // the OTP has been verified. The /verify transaction keeps its own check as
    // the backstop for concurrent sign-ups.
    const existingUsername = await query('SELECT id FROM users WHERE username = $1', [
      payload.username,
    ]);

    if (existingUsername.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Username already taken'));
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    // Clean up abandoned sign-ups, then stage this one. The password is stored
    // hashed so plaintext is never persisted anywhere.
    await query('DELETE FROM pending_patient_signups WHERE expires_at < CURRENT_TIMESTAMP');

    await query(
      `INSERT INTO pending_patient_signups (
         email, password_hash, first_name, middle_name, last_name,
         date_of_birth, sex, phone, address, username, expires_at
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6::date, $7, $8, $9, $10,
         CURRENT_TIMESTAMP + ($11::int * INTERVAL '1 minute')
       )
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         first_name = EXCLUDED.first_name,
         middle_name = EXCLUDED.middle_name,
         last_name = EXCLUDED.last_name,
         date_of_birth = EXCLUDED.date_of_birth,
         sex = EXCLUDED.sex,
         phone = EXCLUDED.phone,
         address = EXCLUDED.address,
         username = EXCLUDED.username,
         expires_at = EXCLUDED.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      [
        email,
        passwordHash,
        payload.firstName,
        payload.middleName,
        payload.lastName,
        payload.dateOfBirth,
        payload.sex,
        payload.phone,
        payload.address,
        payload.username,
        PENDING_SIGNUP_TTL_MINUTES,
      ]
    );

    const result = await sendPatientSignupOtp(email);

    return res.status(200).json(success(null, result.message));
  } catch (err: any) {
    console.error('Patient OTP send error:', err);
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
 * patient account and profile in PostgreSQL.
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
    const otpVerification = await verifyPatientOtpToken(email, otp);

    if (!otpVerification.verified) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, otpVerification.error || 'Invalid or expired OTP code')
      );
    }

    // Load the sign-up data staged before the OTP was sent. Format the date
    // as an explicit YYYY-MM-DD string so the value is not shifted by the
    // server timezone when it is inserted into the patients table.
    const pendingResult = await query(
      `SELECT id, email, password_hash, first_name, middle_name, last_name,
              to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
              sex, phone, address, username, expires_at
       FROM pending_patient_signups
       WHERE email = $1`,
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
      await query('DELETE FROM pending_patient_signups WHERE email = $1', [email]);

      return res.status(400).json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          'This sign-up request has expired. Please complete the sign-up form again.'
        )
      );
    }

    // OTP verified - now create the PostgreSQL account and patient profile
    client = await getClient();
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      throw { code: ErrorCodes.EMAIL_ALREADY_EXISTS, message: 'Email already registered' };
    }

    // Check username uniqueness inside the same transaction, mirroring the
    // email check above. The users.username UNIQUE constraint is the final
    // backstop for the race between this check and the INSERT below.
    const existingUsername = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [pending.username]
    );

    if (existingUsername.rows.length > 0) {
      throw { code: ErrorCodes.CONFLICT, message: 'Username already taken' };
    }

    // Application account (credentials) - bcrypt hash, verified email
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, must_change_password, email_verified, email_verified_at, username)
       VALUES ($1, $2, 'PATIENT', false, true, CURRENT_TIMESTAMP, $3)
       RETURNING id, email, role, must_change_password, email_verified, username`,
      [email, pending.password_hash, pending.username]
    );

    const user = userResult.rows[0];

    // Patient profile - every field captured by the sign-up page
    const patientResult = await client.query(
      `INSERT INTO patients (
         user_id, first_name, middle_name, last_name, date_of_birth, sex, phone, address
       )
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8)
       RETURNING id, user_id, first_name, middle_name, last_name, date_of_birth, sex, phone, address, created_at`,
      [
        user.id,
        pending.first_name,
        pending.middle_name,
        pending.last_name,
        pending.date_of_birth,
        pending.sex,
        pending.phone,
        pending.address,
      ]
    );

    // The staged data is no longer needed once the account exists
    await client.query('DELETE FROM pending_patient_signups WHERE email = $1', [email]);

    await client.query('COMMIT');

    // Return success message with access token - patient is automatically authenticated
    const accessToken = generateAccessToken(user);
    
    return res.status(201).json(
      success(
        {
          user: { id: user.id, email: user.email, role: user.role },
          patient: patientResult.rows[0],
          accessToken: accessToken,
        },
        'Patient account created successfully. You are now logged in.'
      )
    );
  } catch (err: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    console.error('Patient OTP verification error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'OTP verification failed';

    if (errorCode === ErrorCodes.VALIDATION_ERROR) return res.status(400).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.EMAIL_ALREADY_EXISTS || errorCode === ErrorCodes.CONFLICT || errorCode === '23505') {
      // A concurrent request can take the username between the in-transaction
      // check and the INSERT; the users.username UNIQUE violation (23505) is
      // surfaced with the same clear message instead of a raw DB error.
      const constraint = typeof err.constraint === 'string' ? err.constraint : '';
      const conflictMessage = constraint.includes('username')
        ? 'Username already taken'
        : errorMessage;
      return res.status(409).json(error(ErrorCodes.CONFLICT, conflictMessage));
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
      `SELECT id FROM pending_patient_signups
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

    const result = await sendPatientSignupOtp(email);

    return res.status(200).json(success(null, result.message));
  } catch (err: any) {
    console.error('Patient OTP resend error:', err);
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Failed to resend OTP';

    if (errorCode === ErrorCodes.VALIDATION_ERROR) return res.status(400).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.CONFLICT) return res.status(409).json(error(errorCode, errorMessage));
    if (errorCode === ErrorCodes.RATE_LIMIT) return res.status(429).json(error(errorCode, errorMessage));

    return res.status(500).json(error(errorCode, errorMessage));
  }
});

export default router;