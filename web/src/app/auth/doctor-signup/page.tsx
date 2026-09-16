'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api/apiClient';

type Step = 'signup' | 'otp' | 'success';
type FormStatus = 'idle' | 'loading';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

export default function DoctorSignupOtp() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('signup');

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailStatus, setEmailStatus] = useState<FormStatus>('idle');

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpStatus, setOtpStatus] = useState<FormStatus>('idle');
  const [activeOtpIndex, setActiveOtpIndex] = useState(0);

  // Refs for OTP input boxes to enable direct focus
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendDisabled, setResendDisabled] = useState(false);

  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    contactNumber: '',
    specialty: '',
    credentials: '',
    prcLicenseNumber: '',
    clinic: '',
    password: '',
    confirmPassword: '',
  });

  const [otpExpiresIn, setOtpExpiresIn] = useState(600);

  const [successData, setSuccessData] = useState<{
    id: string;
    email: string;
    role: string;
  } | null>(null);

  // Container ref for scroll handling
  const containerRef = useRef<HTMLDivElement>(null);

  /*
   * ============================================================
   * OTP EXPIRATION TIMER
   * ============================================================
   */

  useEffect(() => {
    if (step !== 'otp') {
      return;
    }

    setOtpExpiresIn(600);

    const timer = setInterval(() => {
      setOtpExpiresIn((previous) => {
        if (previous <= 1) {
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  /*
   * ============================================================
   * RESEND COOLDOWN TIMER
   * ============================================================
   */

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

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
  }, [resendCooldown]);

  /*
   * ============================================================
   * VALIDATION
   * ============================================================
   */

  const validateSignupForm = (): string => {
    if (!formData.fullName.trim()) {
      return 'Full Name is required.';
    }

    if (!email.trim()) {
      return 'Email address is required.';
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      return 'Enter a valid email address.';
    }

    if (!formData.contactNumber.trim()) {
      return 'Contact Number is required.';
    }

    if (!formData.specialty.trim()) {
      return 'Specialty is required.';
    }

    if (!formData.credentials.trim()) {
      return 'Credentials are required.';
    }

    if (!formData.prcLicenseNumber.trim()) {
      return 'PRC License Number is required.';
    }

    if (!formData.clinic.trim()) {
      return 'Clinic is required.';
    }

    if (!formData.password) {
      return 'Password is required.';
    }

    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    if (!formData.confirmPassword) {
      return 'Confirm Password is required.';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  };

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

  // OTP input handlers
  const handleOtpChange = useCallback((index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    
    if (digit) {
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      setOtpError('');
      
      // Auto-focus next box if not last
      if (index < 5) {
        setActiveOtpIndex(index + 1);
        // Focus the next input after state update
        setTimeout(() => {
          otpInputRefs.current[index + 1]?.focus();
        }, 0);
      }
    } else {
      // Clear current box
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
    }
  }, [otp]);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    // Handle backspace - clear current and go to previous, or just go to previous
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // If current box is empty, clear previous box and focus it
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        setActiveOtpIndex(index - 1);
        
        // Focus the previous input after state update
        setTimeout(() => {
          otpInputRefs.current[index - 1]?.focus();
        }, 0);
      } else if (index > 0) {
        // If current box has value, just move focus to previous
        setActiveOtpIndex(index - 1);
        
        // Focus the previous input after state update
        setTimeout(() => {
          otpInputRefs.current[index - 1]?.focus();
        }, 0);
      }
    }
    
    // Handle left arrow - go to previous box
    if (e.key === 'ArrowLeft' && index > 0) {
      setActiveOtpIndex(index - 1);
      
      // Focus the previous input after state update
      setTimeout(() => {
        otpInputRefs.current[index - 1]?.focus();
      }, 0);
    }
    
    // Handle right arrow - go to next box
    if (e.key === 'ArrowRight' && index < 5) {
      setActiveOtpIndex(index + 1);
      
      // Focus the next input after state update
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

  /*
   * ============================================================
   * CREATE SUPABASE ACCOUNT + SEND OTP
   * ============================================================
   */

  const handleSignupSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setFormError('');
    setEmailError('');

    const validationError = validateSignupForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setEmailStatus('loading');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: formData.password,

        options: {
          data: {
            role: 'doctor',
            full_name: formData.fullName.trim(),
            contact_number: formData.contactNumber.trim(),
            specialty: formData.specialty.trim(),
            credentials: formData.credentials.trim(),
            prc_license_number: formData.prcLicenseNumber.trim(),
            clinic: formData.clinic.trim(),
          },
        },
      });

      if (error) {
        console.error('Supabase signup error:', error);
        setFormError(error.message);
        setEmailStatus('idle');
        return;
      }

      if (!data.user) {
        setFormError(
          'The account could not be created. Please try again.'
        );
        setEmailStatus('idle');
        return;
      }

      /*
       * Confirm email is enabled in Supabase.
       * Supabase now sends the confirmation OTP.
       */

      setOtp(['', '', '', '', '', '']);
      setOtpError('');
      setOtpExpiresIn(600);
      setResendCooldown(0);
      setResendDisabled(false);

      setStep('otp');
      setEmailStatus('idle');
    } catch (error) {
      console.error('Signup error:', error);

      setFormError(
        'Unable to create the account. Please try again.'
      );

      setEmailStatus('idle');
    }
  };

  /*
   * ============================================================
   * VERIFY OTP
   * ============================================================
   */

  const handleOtpSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setOtpError('');

    const validationError = validateOtp(otp);

    if (validationError) {
      setOtpError(validationError);
      return;
    }

    if (otpExpiresIn <= 0) {
      setOtpError(
        'This verification code has expired. Please request a new code.'
      );
      return;
    }

    setOtpStatus('loading');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: getOtpValue(),
        type: 'email',
      });

      if (error) {
        console.error('Supabase OTP verification error:', error);

        setOtpError(error.message);
        setOtpStatus('idle');
        return;
      }

      if (!data.user || !data.session) {
        setOtpError(
          'Email verification succeeded, but no login session was created.'
        );

        setOtpStatus('idle');
        return;
      }

      /*
       * Store the Supabase session.
       */

      localStorage.setItem(
        'token',
        data.session.access_token
      );

      if (data.session.refresh_token) {
        localStorage.setItem(
          'refreshToken',
          data.session.refresh_token
        );
      }

      localStorage.setItem(
        'user',
        JSON.stringify(data.user)
      );

      /*
       * Keep your existing API client synchronized.
       */

      apiClient.setToken(data.session.access_token);

      setSuccessData({
        id: data.user.id,
        email: data.user.email || email.trim(),
        role: 'doctor',
      });

      setStep('success');
      setOtpStatus('idle');
    } catch (error) {
      console.error('OTP verification error:', error);

      setOtpError(
        'OTP verification failed. Please check your code and try again.'
      );

      setOtpStatus('idle');
    }
  };

  /*
   * ============================================================
   * RESEND OTP
   * ============================================================
   */

  const handleResendOtp = async () => {
    if (resendDisabled) {
      return;
    }

    setOtpError('');
    setEmailStatus('loading');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });

      if (error) {
        console.error('Supabase resend error:', error);

        setOtpError(error.message);
        setEmailStatus('idle');
        return;
      }

      setOtp(['', '', '', '', '', '']);
      setOtpExpiresIn(600);

      setResendCooldown(60);
      setResendDisabled(true);

      setEmailStatus('idle');
    } catch (error) {
      console.error('Resend OTP error:', error);

      setOtpError(
        'Failed to resend the verification code. Please try again.'
      );

      setEmailStatus('idle');
    }
  };

  /*
   * ============================================================
   * GO BACK TO SIGNUP
   * ============================================================
   */

  const handleBackToSignup = () => {
    setStep('signup');

    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    setFormError('');

    setOtpStatus('idle');
    setEmailStatus('idle');
  };

  /*
   * ============================================================
   * ICONS
   * ============================================================
   */

  const MailIcon = () => (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        strokeWidth="1.8"
      />

      <path
        d="M3 5l9 6 9-6"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );

  const ShieldIcon = () => (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3l8 4v6c0 4-3.5 7-8 9-4.5-2-8-5-8-9V7l8-4z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />

      <path
        d="M9 12l2 2 4-4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );

  const CheckIcon = () => (
    <svg
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        strokeWidth="1.8"
      />

      <path
        d="M8 12l2.5 2.5L16 9"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );

  const ArrowLeftIcon = () => (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M19 12H5"
        strokeLinecap="round"
        strokeWidth="1.8"
      />

      <path
        d="M12 19l-7-7 7-7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );

  /*
   * ============================================================
   * SIGNUP STEP
   * ============================================================
   */

  if (step === 'signup') {
    return (
      <div className="min-h-screen bg-[#F3F5F9]">
        <div className="px-4 py-8 overflow-y-auto" style={{ height: '100vh' }}>
          <div className="w-full max-w-[560px] mx-auto">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2.5 mb-1.5">

              <div className="w-12 h-12 bg-[#1A62CD] rounded-2xl flex items-center justify-center shadow-sm">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <line
                    x1="12"
                    x2="12"
                    y1="5"
                    y2="19"
                  />

                  <line
                    x1="5"
                    x2="19"
                    y1="12"
                    y2="12"
                  />
                </svg>
              </div>

              <span className="text-4xl font-extrabold tracking-tight text-[#165CBE]">
                FiDo
              </span>
            </div>

            <span className="text-[11px] font-bold text-[#8392A5] tracking-[0.18em] uppercase">
              FIND A DOCTOR
            </span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-lg border border-[#E2E8F0] p-8">

            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-[#0F172A]">
                Create Doctor Account
              </h1>

              <p className="text-[#64748B] mt-2 text-[15px]">
                Complete all required information. A 6-digit verification
                code will be sent to your email.
              </p>
            </div>

            <form onSubmit={handleSignupSubmit}>

              {/* Full Name */}
              <div className="mb-5">
                <label
                  htmlFor="fullName"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Full Name
                </label>

                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      fullName: event.target.value,
                    });

                    setFormError('');
                  }}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Email */}
              <div className="mb-5">
                <label
                  htmlFor="email"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Email Address
                </label>

                <div className="relative">

                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                    <MailIcon />
                  </div>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError('');
                      setFormError('');
                    }}
                    placeholder="doctor@example.com"
                    autoComplete="email"
                    className={`block w-full rounded-2xl border ${
                      emailError
                        ? 'border-red-500'
                        : 'border-[#E2E8F0]'
                    } bg-white py-3.5 pl-12 pr-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all`}
                  />

                </div>
              </div>

              {/* Contact Number */}
              <div className="mb-5">
                <label
                  htmlFor="contactNumber"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Contact Number
                </label>

                <input
                  id="contactNumber"
                  type="tel"
                  value={formData.contactNumber}
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      contactNumber: event.target.value,
                    });

                    setFormError('');
                  }}
                  placeholder="09XXXXXXXXX"
                  autoComplete="tel"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Specialty */}
              <div className="mb-5">
                <label
                  htmlFor="specialty"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Specialty
                </label>

                <input
                  id="specialty"
                  type="text"
                  value={formData.specialty}
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      specialty: event.target.value,
                    });

                    setFormError('');
                  }}
                  placeholder="e.g. Cardiology"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Credentials */}
              <div className="mb-5">
                <label
                  htmlFor="credentials"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Credentials
                </label>

                <input
                  id="credentials"
                  type="text"
                  value={formData.credentials}
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      credentials: event.target.value,
                    });

                    setFormError('');
                  }}
                  placeholder="e.g. MD, FPCP"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* PRC License Number */}
              <div className="mb-5">
                <label
                  htmlFor="prcLicenseNumber"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  PRC License Number
                </label>

                <input
                  id="prcLicenseNumber"
                  type="text"
                  value={formData.prcLicenseNumber}
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      prcLicenseNumber: event.target.value,
                    });

                    setFormError('');
                  }}
                  placeholder="Enter your PRC license number"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Clinic */}
              <div className="mb-5">
                <label
                  htmlFor="clinic"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Clinic
                </label>

                <input
                  id="clinic"
                  type="text"
                  value={formData.clinic}
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      clinic: event.target.value,
                    });

                    setFormError('');
                  }}
                  placeholder="Enter clinic or hospital name"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Password */}
              <div className="mb-5">
                <label
                  htmlFor="password"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      password: event.target.value,
                    });

                    setFormError('');
                  }}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />

                <p className="text-[12px] text-[#94A3B8] mt-1.5">
                  Minimum 6 characters
                </p>
              </div>

              {/* Confirm Password */}
              <div className="mb-6">
                <label
                  htmlFor="confirmPassword"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      confirmPassword: event.target.value,
                    });

                    setFormError('');
                  }}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Error */}
              {(formError || emailError) && (
                <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-red-600 text-[14px]">
                    {formError || emailError}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={emailStatus === 'loading'}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailStatus === 'loading'
                  ? 'Creating Account...'
                  : 'Create Doctor Account'}
              </button>

            </form>

            <div className="mt-6 text-center">
              <p className="text-[15px] text-[#64748B]">
                Already have an account?{' '}

                <a
                  href="/auth/login"
                  className="font-bold text-[#1967D2] hover:text-[#0D3B75] transition-colors"
                >
                  Log In
                </a>
              </p>
            </div>

          </div>

          <p className="text-center text-[13px] text-[#94A3B8] mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>

        </div>
      </div>
    </div>
    );
  }

  /*
   * ============================================================
   * OTP STEP
   * ============================================================
   */

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-[#F3F5F9]">
        <div className="px-4 py-8 overflow-y-auto" style={{ height: '100vh' }}>
          <div className="w-full max-w-[460px] mx-auto">

          <div className="text-center mb-6">

            <button
              type="button"
              onClick={handleBackToSignup}
              className="flex items-center gap-2 text-[#64748B] hover:text-[#0D3B75] transition-colors mb-4"
            >
              <ArrowLeftIcon />

              <span className="text-[15px]">
                Back to signup
              </span>
            </button>

            <h1 className="text-2xl font-bold text-[#0F172A]">
              Verify Your Email
            </h1>

            <p className="text-[#64748B] mt-2 text-[15px]">
              Enter the 6-digit code sent to{' '}
              <strong>{email}</strong>
            </p>

            <p className="text-[#94A3B8] text-[13px] mt-1">
              OTP expires in{' '}
              {Math.floor(otpExpiresIn / 60)}:
              {String(otpExpiresIn % 60).padStart(2, '0')}
            </p>

          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-[#E2E8F0] p-8">

            <form onSubmit={handleOtpSubmit}>

              <div className="mb-6">

                <label
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Verification Code
                </label>

                <div className="flex justify-center gap-3">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onFocus={() => handleOtpFocus(index)}
                      placeholder="•"
                      maxLength={1}
                      className={`w-14 h-16 text-center text-[28px] font-bold rounded-2xl border-2 ${
                        otpError
                          ? 'border-red-500 bg-red-50'
                          : activeOtpIndex === index
                            ? 'border-[#1A62CD] bg-white ring-2 ring-[#1A62CD]/20'
                            : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                      } text-gray-900 placeholder-[#CBD5E1] focus:outline-none focus:border-[#1A62CD] transition-all duration-150`}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-red-500 text-[14px] mt-3 text-center">
                    {otpError}
                  </p>
                )}

              </div>

              <button
                type="submit"
                disabled={otpStatus === 'loading'}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {otpStatus === 'loading'
                  ? 'Verifying...'
                  : 'Verify & Create Account'}
              </button>

            </form>

            <div className="text-center mt-6">

              <p className="text-[15px] text-[#64748B]">
                Didn't receive the code?{' '}

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={
                    resendDisabled ||
                    emailStatus === 'loading'
                  }
                  className="font-bold text-[#1967D2] hover:text-[#0D3B75] transition-colors disabled:text-[#94A3B8] disabled:cursor-not-allowed"
                >
                  {emailStatus === 'loading'
                    ? 'Sending...'
                    : resendDisabled
                      ? `Resend in ${resendCooldown}s`
                      : 'Resend OTP'}
                </button>
              </p>

            </div>

          </div>

          <p className="text-center text-[13px] text-[#94A3B8] mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>

        </div>
      </div>
    </div>
    );
  }

  /*
   * ============================================================
   * SUCCESS STEP
   * ============================================================
   */

  if (step === 'success' && successData) {
    return (
      <div className="min-h-screen bg-[#F3F5F9]">
        <div className="px-4 py-8 overflow-y-auto" style={{ height: '100vh' }}>
          <div className="w-full max-w-[460px] mx-auto text-center">

          <div className="bg-white rounded-3xl shadow-lg border border-[#E2E8F0] p-8">

            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckIcon />
            </div>

            <h1 className="text-2xl font-bold text-[#0F172A]">
              Account Created!
            </h1>

            <p className="text-[#64748B] mt-2 text-[15px]">
              Welcome, <strong>{successData.email}</strong>
            </p>

            <p className="text-[#64748B] text-[15px] mt-2">
              Your email has been verified successfully.
            </p>

            <div className="mt-8">

              <button
                type="button"
                onClick={() => router.push('/doctor/dashboard')}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors"
              >
                Go to Dashboard
              </button>

            </div>

            <div className="mt-6 text-center">

              <p className="text-[15px] text-[#64748B]">
                Need to log in again?{' '}

                <a
                  href="/auth/login"
                  className="font-bold text-[#1967D2] hover:text-[#0D3B75] transition-colors"
                >
                  Sign In
                </a>
              </p>

            </div>

          </div>

        </div>
      </div>
    </div>
    );
  }

  return null;
}