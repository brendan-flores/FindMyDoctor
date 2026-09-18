import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorCodes } from '../utils/response';

// Using require for nodemailer to avoid TypeScript import issues
const nodemailer = require('nodemailer');

// Email transporter for custom OTP emails
const emailTransporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.password,
  },
});

/*
 * Supabase is used ONLY for OTP verification (not email sending).
 *
 * It never stores the doctor's application account, credentials or profile data.
 * The doctor account (`users`) and doctor profile (`doctors`) are created in
 * PostgreSQL, and only after the OTP has been verified here.
 */

// Create Supabase admin client (using service role key for OTP verification only)
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

// Generate a 6-digit OTP code
function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP codes temporarily (in production, use Redis or database)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

/**
 * Send OTP to email for doctor signup
 *
 * Uses nodemailer to send a custom email with the OTP code.
 * The OTP is stored temporarily for verification.
 */
export async function sendDoctorSignupOtp(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!config.email.user || !config.email.password) {
      throw { code: ErrorCodes.SERVER_ERROR, message: 'Email is not configured. Add the email credentials to backend/.env.' };
    }

    console.log('Attempting to send OTP to:', email);

    // Generate a 6-digit OTP code
    const otpCode = generateOtpCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes expiration

    // Store the OTP code
    otpStore.set(email, { code: otpCode, expiresAt });

    // Clean up expired OTPs
    cleanupExpiredOtps();

    // Create custom email template matching the design
    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'FindMyDoctor Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
          <!-- Header with FindMyDoctor branding -->
          <div style="background-color: #0D3B75; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">FindMyDoctor</h1>
          </div>

          <!-- Main content -->
          <div style="background-color: white; padding: 30px; margin: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Thank you for signing up as a doctor on FindMyDoctor. We're excited to have you join our healthcare community!
            </p>

            <!-- Verification code section with teal background -->
            <div style="background-color: #008080; padding: 25px; border-radius: 8px; text-align: center; margin: 25px 0;">
              <p style="color: white; margin: 0 0 10px 0; font-size: 14px; font-weight: bold; letter-spacing: 1px;">
                YOUR VERIFICATION CODE
              </p>
              <p style="color: white; margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 4px;">
                ${otpCode}
              </p>
            </div>

            <!-- How to verify section -->
            <div style="margin-top: 30px;">
              <h3 style="color: #333; margin-bottom: 15px;">How to verify your account:</h3>
              <ol style="color: #666; line-height: 1.8; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Return to the FindMyDoctor signup page.</li>
                <li style="margin-bottom: 10px;">Enter the 6-digit code shown above.</li>
                <li>Complete your registration.</li>
              </ol>
            </div>

            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This code will expire in 15 minutes for your security.
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p style="margin: 0;">FindMyDoctor Healthcare Platform</p>
          </div>
        </div>
      `,
    };

    await emailTransporter.sendMail(mailOptions);
    console.log('Custom OTP email sent successfully to:', email);
    console.log('OTP code:', otpCode);

    return {
      success: true,
      message: 'OTP sent successfully. Please check your email.',
    };
  } catch (err: any) {
    console.error('Error sending OTP:', err);
    throw err;
  }
}

// Clean up expired OTPs
function cleanupExpiredOtps() {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}

/**
 * Verify OTP token from locally stored codes
 *
 * This verifies the OTP that was sent via email and stored temporarily.
 * The doctor account is created in PostgreSQL after verification succeeds.
 */
export async function verifyOtpToken(email: string, token: string): Promise<{ verified: boolean; error?: string }> {
  try {
    const storedData = otpStore.get(email);

    if (!storedData) {
      console.log('No OTP found for email:', email);
      return { verified: false, error: 'No OTP request found for this email. Please complete the sign-up form again.' };
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      console.log('OTP expired for email:', email);
      return { verified: false, error: 'This OTP has expired. Please request a new code.' };
    }

    // Verify the OTP code
    if (storedData.code !== token) {
      console.log('Invalid OTP for email:', email);
      return { verified: false, error: 'Invalid OTP code' };
    }

    // OTP is valid - remove it from store
    otpStore.delete(email);
    console.log('OTP verified successfully for:', email);
    return { verified: true };
  } catch (err: any) {
    console.error('Error verifying OTP:', err);
    return { verified: false, error: 'OTP verification failed' };
  }
}

/**
 * Check if email has a valid OTP session
 * Since we're using local OTP storage, this checks if an OTP was recently sent
 */
export async function checkEmailVerificationStatus(email: string): Promise<{ isVerified: boolean }> {
  try {
    const storedData = otpStore.get(email);

    if (!storedData) {
      return { isVerified: false };
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      return { isVerified: false };
    }

    // OTP exists and is still valid
    return { isVerified: true };
  } catch (err) {
    console.error('Error checking verification status:', err);
    return { isVerified: false };
  }
}
