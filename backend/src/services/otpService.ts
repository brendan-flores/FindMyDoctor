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
