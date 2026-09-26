import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorCodes } from '../utils/response';

/*
 * Supabase Auth is used for OTP generation, email delivery, and verification for patient signup.
 * 
 * It never stores the patient's application account, credentials or profile data.
 * The patient account (`users`) and patient profile (`patients`) are created in
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
 * Send OTP to email for patient signup
 *
 * Uses Supabase Auth to generate and send the OTP email.
 * Supabase handles OTP generation, email delivery, and expiration.
 */
export async function sendPatientSignupOtp(email: string): Promise<{ success: boolean; message: string }> {
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
 * The patient account is created in PostgreSQL after verification succeeds.
 */
export async function verifyPatientOtpToken(email: string, token: string): Promise<{ verified: boolean; error?: string }> {
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