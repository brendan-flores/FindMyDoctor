'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import { authApi, ResendLoginOtpResponse } from '@/lib/api/authApi';

interface OtpVerificationProps {
  email: string;
  challengeId: string;
  onVerifySuccess: (data: any) => void;
  onVerifyError: (error: string) => void;
  onCancel?: () => void;
  onChallengeIdUpdate?: (newChallengeId: string) => void;
}

interface AuthResponse {
  user: any;
  accessToken: string;
  refreshToken: string;
}

const OTP_PATTERN = /^\d{6}$/;

export default function OtpVerification({ email, challengeId, onVerifySuccess, onVerifyError, onCancel, onChallengeIdUpdate }: OtpVerificationProps) {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeOtpIndex, setActiveOtpIndex] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [currentChallengeId, setCurrentChallengeId] = useState(challengeId);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setOtpInputRef = (index: number) => (el: HTMLInputElement | null) => {
    otpInputRefs.current[index] = el;
  };

  // Resend cooldown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown((previous) => {
        if (previous <= 1) {
          setResendDisabled(false);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Sync currentChallengeId with prop changes
  useEffect(() => {
    setCurrentChallengeId(challengeId);
  }, [challengeId]);

  const validateOtp = (value: string[]): string => {
    const otpString = value.join('');
    if (!otpString.trim()) {
      return 'OTP code is required.';
    }
    if (!OTP_PATTERN.test(otpString.trim())) {
      return 'Enter a valid 6-digit OTP code.';
    }
    return '';
  };

  const handleOtpChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    
    if (digit) {
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      setOtpError('');
      
      if (index < 5) {
        setActiveOtpIndex(index + 1);
        setTimeout(() => {
          otpInputRefs.current[index + 1]?.focus();
        }, 0);
      }
    } else {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
    }
  }, [otp]);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        setActiveOtpIndex(index - 1);
        setTimeout(() => {
          otpInputRefs.current[index - 1]?.focus();
        }, 0);
      } else if (index > 0) {
        setActiveOtpIndex(index - 1);
        setTimeout(() => {
          otpInputRefs.current[index - 1]?.focus();
        }, 0);
      }
    }
    
    if (e.key === 'ArrowLeft' && index > 0) {
      setActiveOtpIndex(index - 1);
      setTimeout(() => {
        otpInputRefs.current[index - 1]?.focus();
      }, 0);
    }
    
    if (e.key === 'ArrowRight' && index < 5) {
      setActiveOtpIndex(index + 1);
      setTimeout(() => {
        otpInputRefs.current[index + 1]?.focus();
      }, 0);
    }
  }, [otp]);

  const handleOtpFocus = (index: number) => {
    setActiveOtpIndex(index);
  };

  const getOtpValue = () => {
    return otp.join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setIsLoading(true);

    const validationError = validateOtp(otp);
    if (validationError) {
      setOtpError(validationError);
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.post('/auth/verify-login-otp', {
        challengeId: currentChallengeId,
        otp: getOtpValue(),
      });

      if (response.success && response.data) {
        // Type guard: this is AuthResponse
        const authData = response.data as AuthResponse;
        
        // Store tokens in localStorage
        localStorage.setItem('token', authData.accessToken);
        localStorage.setItem('refreshToken', authData.refreshToken);
        localStorage.setItem('user', JSON.stringify(authData.user));
        apiClient.setToken(authData.accessToken);
        
        onVerifySuccess(authData);
      } else {
        setOtpError(response.error || 'Invalid or expired OTP code');
      }
    } catch (err) {
      setOtpError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDisabled) {
      return;
    }

    setOtpError('');
    setIsLoading(true);

    try {
      const response = await authApi.resendLoginOtp({ challengeId: currentChallengeId });

      if (response.success) {
        // Update the challenge ID with the new one from the response
        const newChallengeId = (response.data as ResendLoginOtpResponse)?.challengeId;
        if (newChallengeId) {
          setCurrentChallengeId(newChallengeId);
          // Notify parent component of the new challenge ID
          if (onChallengeIdUpdate) {
            onChallengeIdUpdate(newChallengeId);
          }
        }

        setResendCooldown(60);
        setResendDisabled(true);
        setOtp(['', '', '', '', '', '']);
        // Reset OTP inputs
        otpInputRefs.current.forEach((ref, index) => {
          if (ref) {
            ref.value = '';
          }
        });
        setActiveOtpIndex(0);
        otpInputRefs.current[0]?.focus();
      } else {
        setOtpError(response.error || 'Failed to resend OTP');
      }
    } catch (err) {
      setOtpError('Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Enter Verification Code</h3>
        <p className="text-sm text-slate-600">
          We sent a 6-digit code to <span className="font-semibold text-slate-900">{email}</span>
        </p>
      </div>

      {otpError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {otpError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center gap-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={setOtpInputRef(index)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(index, e)}
              onFocus={() => handleOtpFocus(index)}
              className="w-12 h-14 text-center text-2xl font-bold text-slate-900 border-2 border-slate-300 rounded-lg focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendDisabled || isLoading}
            className="text-sm font-semibold text-[#1967D2] hover:text-[#0D3B75] disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {resendDisabled ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}
