'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { passwordResetApi } from '@/lib/api/authApi';
import Toast from '@/components/ui/Toast';
import OtpInput from '@/components/ui/OtpInput';

export default function SecretaryResetPassword() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Two-step verification state
  const [isVerified, setIsVerified] = useState(false);
  const [resetToken, setResetToken] = useState('');

  // Password requirement indicators
  const [hasMinLength, setHasMinLength] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [hasUppercase, setHasUppercase] = useState(false);

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const router = useRouter();

  useEffect(() => {
    // Start resend cooldown on mount
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Validate password requirements
    setHasMinLength(newPassword.length >= 8);
    setHasNumber(/[0-9]/.test(newPassword));
    setHasUppercase(/[A-Z]/.test(newPassword));
  }, [newPassword]);

  const handleResendCode = async () => {
    if (!canResend || !email) return;

    try {
      const response = await passwordResetApi.requestPasswordReset({ email });

      if (response.success) {
        setResendSuccess(true);
        setError('');
        // Reset cooldown
        setResendCooldown(60);
        setCanResend(false);
        setTimeout(() => setResendSuccess(false), 3000);
      } else {
        setError(response.error || 'Failed to resend code');
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await passwordResetApi.verifyResetCode({ email, otp });

      if (response.success && response.data?.resetToken) {
        setResetToken(response.data.resetToken);
        setIsVerified(true);
        setVerifySuccess(true);
        setError('');
        setTimeout(() => setVerifySuccess(false), 4000);
      } else {
        setError(response.error || 'Invalid or expired verification code');
      }
    } catch (err) {
      setError('An error occurred during verification. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);

    // Validate password requirements
    if (!hasMinLength || !hasNumber || !hasUppercase) {
      setError('Password does not meet all requirements');
      setIsLoading(false);
      return;
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await passwordResetApi.resetPassword({
        email,
        resetToken,
        newPassword,
      });

      if (response.success) {
        setSuccess(true);
        setError('');
        // Navigate back to login after delay
        setTimeout(() => {
          router.push('/secretary-login');
        }, 2000);
      } else {
        setError(response.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F5F9] px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[460px] flex flex-col items-center">
        <div className="flex flex-col items-center mb-8 text-center">
          <img
            src="/images/findmydoctor_logo.png"
            alt="FindMyDoctor Logo"
            className="h-20 w-auto mb-2"
          />
        </div>

        <div className="text-center mb-7 w-full">
          <h1 className="text-[34px] font-black tracking-tight text-[#0D1829] mb-2 leading-tight">
            Reset Password
          </h1>
          <p className="text-[15px] text-[#718096] font-normal leading-relaxed">
            {isVerified
              ? 'Enter your new password below.'
              : `Enter the code sent to ${email}`}
          </p>
        </div>

        {error && (
          <div className="w-full mb-5">
            <Toast message={error} type="error" onClose={() => setError('')} />
          </div>
        )}

        {resendSuccess && (
          <div className="w-full mb-5">
            <Toast
              message="Reset code sent successfully"
              type="success"
              onClose={() => setResendSuccess(false)}
            />
          </div>
        )}

        {verifySuccess && (
          <div className="w-full mb-5">
            <Toast
              message="Code verified successfully! Please enter your new password."
              type="success"
              onClose={() => setVerifySuccess(false)}
            />
          </div>
        )}

        {success && (
          <div className="w-full mb-5">
            <Toast
              message="Password reset successfully!"
              type="success"
              onClose={() => setSuccess(false)}
            />
          </div>
        )}

        {!isVerified ? (
          /* Step 1: Verification code only */
          <form onSubmit={handleVerifyCode} className="w-full space-y-5">
            <OtpInput
              value={otp}
              onChange={setOtp}
              onComplete={handleVerifyCode}
              disabled={isVerifying}
              error={!!error}
            />

            {/* Resend Code Button */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={!canResend || isVerifying}
                className="text-[14px] font-bold text-[#1967D2] hover:text-[#0D3B75] transition-colors disabled:text-[#94A3B8] disabled:cursor-not-allowed"
              >
                {canResend ? 'Resend Code' : `Resend Code (${resendCooldown}s)`}
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: New password and confirm password (after successful verification) */
          <form onSubmit={handleResetPassword} className="w-full space-y-5">
            <div className="space-y-2">
              <label htmlFor="newPassword" className="block text-[15px] font-bold text-[#1A202C]">
                New Password
              </label>
              <div className="relative rounded-2xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect height="11" rx="2" ry="2" strokeWidth="1.8" width="16" x="4" y="11"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                  </svg>
                </div>
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                  disabled={isLoading}
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-12 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#94A3B8] hover:text-[#64748B] focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      ></path>
                      <path
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      ></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      ></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="space-y-1 pl-1">
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 ${hasMinLength ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {hasMinLength ? (
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  ) : (
                    <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
                  )}
                </svg>
                <span className={`text-[13px] ${hasMinLength ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}>
                  At least 8 characters
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 ${hasNumber ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {hasNumber ? (
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  ) : (
                    <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
                  )}
                </svg>
                <span className={`text-[13px] ${hasNumber ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}>
                  At least 1 number
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 ${hasUppercase ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {hasUppercase ? (
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  ) : (
                    <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
                  )}
                </svg>
                <span className={`text-[13px] ${hasUppercase ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}>
                  At least 1 uppercase letter
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-[15px] font-bold text-[#1A202C]">
                Confirm Password
              </label>
              <div className="relative rounded-2xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect height="11" rx="2" ry="2" strokeWidth="1.8" width="16" x="4" y="11"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                  </svg>
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                  disabled={isLoading}
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-12 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#94A3B8] hover:text-[#64748B] focus:outline-none"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      ></path>
                      <path
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      ></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      ></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push('/secretary-login')}
            className="text-[15px] text-[#64748B] font-normal hover:text-[#1A202C] transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
