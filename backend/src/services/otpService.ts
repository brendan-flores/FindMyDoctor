import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorCodes } from '../utils/response';

/*
 * Supabase Auth is used for OTP generation, email delivery, and verification.
 *
 * It never stores the doctor's application account, credentials or profile data.
 * The doctor account (`users`) and doctor profile (`doctors`) are created in
 * PostgreSQL, and only after the OTP has been verified.
 *
 * Supabase Auth may create a temporary identity for OTP delivery. This temporary
 * identity is used for passwordless OTP authentication only and must NEVER become
 * the FindMyDoctor application account source of truth.
 *
 * PostgreSQL users table is the source of truth for FindMyDoctor application accounts.
 */

const supabaseAdmin = config.supabase.url && config.supabase.serviceRoleKey
  ? createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null;

/**
 * Send OTP to email for doctor signup
 *
 * Uses Supabase Auth to generate and send the OTP email.
 * Supabase handles OTP generation, email delivery, and expiration.
 */
export async function sendDoctorSignupOtp(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!supabaseAdmin) {
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.' };
    }

    console.log('Attempting to send OTP via Supabase Auth to:', email);

    // Use Supabase Auth to send OTP email
    // Supabase will automatically create a temporary Auth user if the email doesn't exist
    // This temporary user is used for passwordless OTP authentication only
    const { data, error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: undefined, // No redirect link needed - user enters OTP manually
        data: {
          auth_flow: 'doctor_signup'
        }
      }
    });

    if (error) {
      console.error('Supabase Auth OTP send error:', error);
      throw { code: ErrorCodes.SERVER_ERROR, message: error.message || 'Failed to send OTP' };
    }

    console.log('OTP sent successfully via Supabase Auth to:', email);
    return {
      success: true,
      message: 'OTP sent successfully. Please check your email.',
    };
  } catch (err: any) {
    console.error('Error sending OTP:', err);
    throw err;
  }
}

/**
 * Verify OTP token using Supabase Auth
 *
 * This verifies the OTP that was sent via Supabase Auth.
 * The doctor account is created in PostgreSQL after verification succeeds.
 */
export async function verifyOtpToken(email: string, token: string): Promise<{ verified: boolean; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return { verified: false, error: 'Supabase is not configured' };
    }

    console.log('Verifying OTP via Supabase Auth for:', email);

    // Verify the OTP with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) {
      console.log('Supabase Auth OTP verification failed:', error);
      return { verified: false, error: error.message || 'Invalid or expired OTP code' };
    }

    console.log('OTP verified successfully via Supabase Auth for:', email);
    return { verified: true };
  } catch (err: any) {
    console.error('Error verifying OTP:', err);
    return { verified: false, error: 'OTP verification failed' };
  }
}

/**
 * Check if email has a valid OTP session
 *
 * MANDATORY REQUIREMENT: Use PostgreSQL pending_doctor_signups only.
 * Do NOT use Supabase Auth user existence, Auth sessions, listUsers(), getUserById(),
 * or any other Supabase Auth identity/session check to determine whether an OTP was successfully sent.
 *
 * Reason: A Supabase Auth user/session does NOT reliably prove that the OTP email was
 * successfully delivered. User existence and OTP email delivery are separate states.
 *
 * Implementation using PostgreSQL only:
 * 1. If email exists in PostgreSQL users table:
 *    Return { isRegistered: true, isVerified: <users.email_verified value> }
 * 2. If email does NOT exist in users table:
 *    Check pending_doctor_signups for active record:
 *    WHERE email = $1 AND expires_at > CURRENT_TIMESTAMP
 * 3. If active pending signup exists:
 *    Return { isRegistered: false, isVerified: true }
 * 4. If no active pending signup exists:
 *    Return { isRegistered: false, isVerified: false }
 *
 * NOTE: The frontend does NOT call this endpoint. The function exists for API completeness
 * but is not used in the current doctor signup flow.
 *
 * No new database columns, no new persistent state, no OTP delivery tracking mechanism.
 */
export async function checkEmailVerificationStatus(email: string): Promise<{ isVerified: boolean }> {
  try {
    // Import query function here to avoid circular dependency
    const { query } = await import('../database/connection');

    // Step 1: Check if email exists in PostgreSQL users table
    const existingUser = await query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      // Email is registered - return its verification status
      return { isVerified: existingUser.rows[0].email_verified === true };
    }

    // Step 2: Email not in users table - check pending_doctor_signups
    const pendingSignup = await query(
      `SELECT id FROM pending_doctor_signups
       WHERE email = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [email]
    );

    if (pendingSignup.rows.length > 0) {
      // Email has a pending signup awaiting OTP verification
      return { isVerified: true };
    }

    // Step 3: No pending signup found
    return { isVerified: false };
  } catch (err) {
    console.error('Error checking verification status:', err);
    return { isVerified: false };
  }
}

/**
 * Send OTP to email for login
 *
 * Uses Supabase Auth to generate and send the OTP email.
 * IMPORTANT: Uses shouldCreateUser: false to prevent Supabase from creating a new user.
 * PostgreSQL users table remains the source of truth for application accounts.
 * Supabase is used only for OTP delivery and verification.
 */
export async function sendLoginOtp(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!supabaseAdmin) {
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.' };
    }

    console.log('Sending login OTP via Supabase Auth to:', email);

    // Use Supabase only for OTP delivery - do NOT create Supabase user
    const { data, error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: undefined, // No redirect
        shouldCreateUser: false, // CRITICAL: Do not create Supabase user for login OTP
        data: {
          auth_flow: 'login'
        }
      }
    });

    if (error) {
      console.error('Supabase Auth OTP send error:', error);
      if (error.message?.includes('security purposes') || error.status === 429 || error.message?.includes('rate limit')) {
        throw { code: ErrorCodes.RATE_LIMIT, message: error.message };
      }
      throw { code: ErrorCodes.SERVER_ERROR, message: error.message || 'Failed to send OTP' };
    }

    console.log('Login OTP sent successfully via Supabase Auth to:', email);
    return {
      success: true,
      message: 'OTP sent successfully. Please check your email.',
    };
  } catch (err: any) {
    console.error('Error sending login OTP:', err);
    throw err;
  }
}

/**
 * Verify OTP token for login using Supabase Auth
 *
 * This verifies the OTP that was sent via Supabase Auth.
 * CRITICAL: After successful verification, the Supabase session is ignored/discarded.
 * The FindMyDoctor application must generate its own accessToken and refreshToken.
 */
export async function verifyLoginOtp(email: string, token: string): Promise<{ verified: boolean; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return { verified: false, error: 'Supabase is not configured' };
    }

    console.log('Verifying login OTP via Supabase Auth for:', email);

    // Verify with Supabase
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) {
      console.log('Supabase Auth OTP verification failed:', error);
      return { verified: false, error: error.message || 'Invalid or expired OTP code' };
    }

    console.log('Login OTP verified successfully via Supabase Auth for:', email);

    // CRITICAL: Ignore/discard Supabase session for application authorization
    // Do NOT use Supabase session as application access token
    // Generate FindMyDoctor accessToken and refreshToken instead

    return { verified: true };
  } catch (err: any) {
    console.error('Error verifying login OTP:', err);
    return { verified: false, error: 'OTP verification failed' };
  }
}

/**
 * Ensure a regular Admin has a Supabase Auth identity for mandatory OTP
 *
 * This function is called when creating regular Admin accounts to ensure they have a
 * Supabase Auth user identity. This is required because login OTP uses
 * shouldCreateUser: false, which means the user must already exist in Supabase Auth.
 *
 * This function is idempotent - it will not create duplicate identities.
 *
 * IMPORTANT: This is server-side only. We create a Supabase Auth user but we do NOT
 * set a password in Supabase Auth. The PostgreSQL users table remains the source of
 * truth for authentication. Supabase Auth is used only for OTP delivery.
 */
export async function ensureAdminSupabaseIdentity(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!supabaseAdmin) {
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.' };
    }

    console.log('Ensuring Supabase Auth identity for Admin:', email);

    // Check if user already exists in Supabase Auth
    // Use pagination with high perPage to ensure we don't miss existing users
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listError) {
      console.error('Supabase Auth listUsers error:', listError);
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Failed to check Supabase users' };
    }

    const users = data?.users || [];
    const existingUser = users.find((user: any) => user.email === email);

    if (existingUser) {
      console.log('Supabase Auth user already exists for:', email);
      return { success: true, message: 'Supabase identity already exists' };
    }

    // Create Supabase Auth user without password (passwordless OTP only)
    // We use admin.createUser to create the user without sending an email
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email so OTP can be sent immediately
      user_metadata: {
        role: 'ADMIN',
        created_via: 'admin_provisioning'
      }
    });

    if (createError) {
      console.error('Supabase Auth createUser error:', createError);
      // If error is "duplicate key" or similar, user already exists (race condition)
      if (createError.message?.includes('duplicate') || createError.message?.includes('already exists')) {
        console.log('Supabase Auth user already exists (race condition):', email);
        return { success: true, message: 'Supabase identity already exists' };
      }
      throw { code: ErrorCodes.SERVER_ERROR, message: createError.message || 'Failed to create Supabase identity' };
    }

    console.log('Supabase Auth identity created for Admin:', email);
    return { success: true, message: 'Supabase identity created successfully' };
  } catch (err: any) {
    console.error('Error ensuring Supabase identity:', err);
    throw err;
  }
}

/**
 * Ensure Secretary has Supabase Auth identity for optional 2FA
 *
 * This function is called when creating Secretary accounts to ensure they have a
 * Supabase Auth user identity. This is required because login OTP uses
 * shouldCreateUser: false, which means the user must already exist in Supabase Auth.
 *
 * This function is idempotent - it will not create duplicate identities.
 *
 * IMPORTANT: This is server-side only. We create a Supabase Auth user but we do NOT
 * set a password in Supabase Auth. The PostgreSQL users table remains the source of
 * truth for authentication. Supabase Auth is used only for OTP delivery.
 */
export async function ensureSecretarySupabaseIdentity(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!supabaseAdmin) {
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.' };
    }

    console.log('Ensuring Supabase Auth identity for Secretary:', email);

    // Check if user already exists in Supabase Auth
    // Use pagination with high perPage to ensure we don't miss existing users
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listError) {
      console.error('Supabase Auth listUsers error:', listError);
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Failed to check Supabase users' };
    }

    const users = data?.users || [];
    const existingUser = users.find((user: any) => user.email === email);

    if (existingUser) {
      console.log('Supabase Auth user already exists for:', email);
      return { success: true, message: 'Supabase identity already exists' };
    }

    // Create Supabase Auth user without password (passwordless OTP only)
    // We use admin.createUser to create the user without sending an email
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email so OTP can be sent immediately
      user_metadata: {
        role: 'SECRETARY',
        created_via: 'admin_provisioning'
      }
    });

    if (createError) {
      console.error('Supabase Auth createUser error:', createError);
      // If error is "duplicate key" or similar, user already exists (race condition)
      if (createError.message?.includes('duplicate') || createError.message?.includes('already exists')) {
        console.log('Supabase Auth user already exists (race condition):', email);
        return { success: true, message: 'Supabase identity already exists' };
      }
      throw { code: ErrorCodes.SERVER_ERROR, message: createError.message || 'Failed to create Supabase identity' };
    }

    console.log('Supabase Auth identity created for Secretary:', email);
    return { success: true, message: 'Supabase identity created successfully' };
  } catch (err: any) {
    console.error('Error ensuring Supabase identity:', err);
    throw err;
  }
}

/**
 * Ensure Doctor has Supabase Auth identity for mandatory OTP
 *
 * This function is called when creating Doctor accounts to ensure they have a
 * Supabase Auth user identity. This is required because login OTP uses
 * shouldCreateUser: false, which means the user must already exist in Supabase Auth.
 *
 * This function is idempotent - it will not create duplicate identities.
 *
 * IMPORTANT: This is server-side only. We create a Supabase Auth user but we do NOT
 * set a password in Supabase Auth. The PostgreSQL users table remains the source of
 * truth for authentication. Supabase Auth is used only for OTP delivery.
 */
export async function ensureDoctorSupabaseIdentity(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!supabaseAdmin) {
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.' };
    }

    console.log('Ensuring Supabase Auth identity for Doctor:', email);

    // Check if user already exists in Supabase Auth
    // Use pagination with high perPage to ensure we don't miss existing users
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listError) {
      console.error('Supabase Auth listUsers error:', listError);
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Failed to check Supabase users' };
    }

    const users = data?.users || [];
    const existingUser = users.find((user: any) => user.email === email);

    if (existingUser) {
      console.log('Supabase Auth user already exists for:', email);
      return { success: true, message: 'Supabase identity already exists' };
    }

    // Create Supabase Auth user without password (passwordless OTP only)
    // We use admin.createUser to create the user without sending an email
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email so OTP can be sent immediately
      user_metadata: {
        role: 'DOCTOR',
        created_via: 'admin_provisioning'
      }
    });

    if (createError) {
      console.error('Supabase Auth createUser error:', createError);
      // If error is "duplicate key" or similar, user already exists (race condition)
      if (createError.message?.includes('duplicate') || createError.message?.includes('already exists')) {
        console.log('Supabase Auth user already exists (race condition):', email);
        return { success: true, message: 'Supabase identity already exists' };
      }
      throw { code: ErrorCodes.SERVER_ERROR, message: createError.message || 'Failed to create Supabase identity' };
    }

    console.log('Supabase Auth identity created for Doctor:', email);
    return { success: true, message: 'Supabase identity created successfully' };
  } catch (err: any) {
    console.error('Error ensuring Supabase identity:', err);
    throw err;
  }
}
