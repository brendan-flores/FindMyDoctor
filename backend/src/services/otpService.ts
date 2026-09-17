import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorCodes } from '../utils/response';

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
 * This uses Supabase's built-in email OTP functionality
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
 * This verifies that the OTP was valid and creates a session
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
 * Create a user in Supabase Auth (for managing users)
 * This is used to create the user in Supabase after our backend creates them
 */
export async function createSupabaseUser(email: string, userId: string): Promise<void> {
  try {
    // We don't actually create the user in Supabase Auth for this flow
    // The OTP verification already creates a temporary user in Supabase
    // We just need to track that the user has been verified
    
    // Note: For our hybrid approach, we rely on the OTP flow for email verification
    // and our backend for actual user management
    console.log('User verification tracked for:', email, 'with backend user ID:', userId);
  } catch (err) {
    console.error('Error creating Supabase user:', err);
    // Non-fatal error - our backend user creation is the source of truth
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

/**
 * Delete a user from Supabase Auth (cleanup for failed registrations)
 */
export async function deleteSupabaseUser(email: string): Promise<void> {
  try {
    if (!supabaseAdmin) {
      return;
    }

    // Use listUsers to find user by email since getUserByEmail is not available
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.log('User not found in Supabase:', email);
      return;
    }

    if (userData && userData.users) {
      // Find user by email
      const user = userData.users.find(u => u.email === email);
      
      if (user) {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        console.log('Cleaned up Supabase user:', email);
      }
    }
  } catch (err) {
    console.error('Error cleaning up Supabase user:', err);
    // Non-fatal - cleanup is best-effort
  }
}