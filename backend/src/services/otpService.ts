import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorCodes } from '../utils/response';

/*
 * Supabase is used ONLY as the email OTP service for doctor sign-up.
 *
 * It never stores the doctor's application account, credentials or profile data.
 * The doctor account (`users`) and doctor profile (`doctors`) are created in
 * PostgreSQL, and only after the OTP has been verified here.
 */

// Create Supabase admin client (using service role key for admin operations)
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

console.log('Supabase initialized:', !!supabaseAdmin);
console.log('Supabase URL:', config.supabase.url);

/**
 * Send OTP to email for doctor signup
 *
 * Supabase only sends the verification email. It does not create the doctor's
 * application account - that happens in PostgreSQL after verification succeeds.
 */
export async function sendDoctorSignupOtp(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!supabaseAdmin) {
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Supabase is not configured. Add the Supabase credentials to backend/.env.' };
    }

    console.log('Attempting to send OTP to:', email);
    console.log('Supabase URL:', config.supabase.url);

    // Send OTP via Supabase Auth using signInWithOtp (this actually sends emails)
    const { data, error: supabaseError } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'http://localhost:3001/auth/doctor-signup',
        // This will send an email with an OTP code
      },
    });

    console.log('Supabase response data:', data);
    console.log('Supabase error:', supabaseError);

    if (supabaseError) {
      console.error('Supabase OTP error:', supabaseError);
      
      // Handle specific Supabase errors
      if (supabaseError.message.includes('Email') && supabaseError.message.includes('already')) {
        throw { code: ErrorCodes.CONFLICT, message: 'Email is already registered' };
      }
      
      if (supabaseError.message.includes('rate limit') || supabaseError.message.includes('too many')) {
        throw { code: ErrorCodes.RATE_LIMIT, message: 'Too many OTP requests. Please try again later.' };
      }
      
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Failed to send OTP. Please try again.' };
    }

    // Supabase returns data with the OTP transaction details
    // The OTP is sent to the email automatically by Supabase
    console.log('OTP sent successfully to:', email);
    console.log('OTP response:', data);
    
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
 * Verify OTP token from Supabase
 *
 * This only verifies the OTP that Supabase emailed to the doctor. The Supabase
 * session it returns is intentionally discarded: the doctor authenticates with
 * the PostgreSQL-backed application account, not with Supabase Auth.
 */
export async function verifyOtpToken(email: string, token: string): Promise<{ verified: boolean; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return { verified: false, error: 'Supabase is not configured' };
    }

    // Verify the OTP using Supabase's verifyOtp method
    const { data, error: supabaseError } = await supabaseAdmin.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (supabaseError) {
      console.error('OTP verification error:', supabaseError);
      
      if (supabaseError.message.includes('Invalid') || supabaseError.message.includes('expired')) {
        return { verified: false, error: 'Invalid or expired OTP code' };
      }
      
      return { verified: false, error: 'OTP verification failed' };
    }

    if (data) {
      console.log('OTP verified successfully for:', email);
      return { verified: true };
    }

    return { verified: false, error: 'OTP verification failed' };
  } catch (err: any) {
    console.error('Error verifying OTP:', err);
    return { verified: false, error: 'OTP verification failed' };
  }
}

/**
 * Check if email has a valid OTP session
 */
export async function checkEmailVerificationStatus(email: string): Promise<{ isVerified: boolean }> {
  try {
    if (!supabaseAdmin) {
      return { isVerified: false };
    }

    // Use listUsers to find user by email since getUserByEmail is not available
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      // User not found in Supabase means no OTP was sent
      return { isVerified: false };
    }

    if (data && data.users) {
      // Find user by email
      const user = data.users.find(u => u.email === email);
      
      if (user) {
        // Check if email is confirmed
        const isConfirmed = user.email_confirmed_at !== null;
        return { isVerified: isConfirmed };
      }
    }

    return { isVerified: false };
  } catch (err) {
    console.error('Error checking verification status:', err);
    return { isVerified: false };
  }
}
