'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { otpApi } from '@/lib/api/authApi';
import { apiClient } from '@/lib/api/apiClient';
import { CEBU_FACILITIES } from '@/data/cebuFacilities';
import { MEDICAL_SPECIALTIES } from '@/data/medicalSpecialties';
import { MEDICAL_CREDENTIALS } from '@/data/medicalCredentials';
import SearchableSelect from '@/components/ui/SearchableSelect';
import SearchableMultiSelect from '@/components/ui/SearchableMultiSelect';

type Step = 'signup' | 'otp' | 'success';
type FormStatus = 'idle' | 'loading';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;
const PRC_LICENSE_PATTERN = /^\d{7}$/;

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
    roomNumber: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password requirement indicators
  const [hasMinLength, setHasMinLength] = useState(false);
  const [hasUppercase, setHasUppercase] = useState(false);
  const [hasLowercase, setHasLowercase] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [hasSpecialChar, setHasSpecialChar] = useState(false);

  const [otpExpiresIn, setOtpExpiresIn] = useState(600);

  // Cebu hospital and clinic options for dropdown with area sublabels
  const cebuFacilityOptions = useMemo(() => {
    return CEBU_FACILITIES.map((facility) => ({
      value: facility.name,
      label: facility.name,
      sublabel: `${facility.type} • ${facility.area}`,
      hasRoomNumber: facility.hasRoomNumber || false,
    }));
  }, []);

  // Check if selected facility has room number requirement
  const selectedFacility = useMemo(() => {
    return CEBU_FACILITIES.find(f => f.name === formData.clinic);
  }, [formData.clinic]);

  const showRoomNumberField = selectedFacility?.hasRoomNumber === true;

  // Container ref for scroll handling
  const containerRef = useRef<HTMLDivElement>(null);

  // Update password requirements in real-time
  useEffect(() => {
    const password = formData.password;
    setHasMinLength(password.length >= 8);
    setHasUppercase(/[A-Z]/.test(password));
    setHasLowercase(/[a-z]/.test(password));
    setHasNumber(/[0-9]/.test(password));
    setHasSpecialChar(/[!@#$%^&*(),.?":{}|<>]/.test(password));
  }, [formData.password]);

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

    if (!PRC_LICENSE_PATTERN.test(formData.prcLicenseNumber.trim())) {
      return 'PRC License Number must be 7 digits.';
    }

    if (!formData.clinic.trim()) {
      return 'Hospital/Clinic is required.';
    }

    // Validate room number if the selected facility requires it
    if (showRoomNumberField && !formData.roomNumber.trim()) {
      return 'Room/Clinic Number is required for this facility.';
    }

    if (!formData.password) {
      return 'Password is required.';
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (!/[A-Z]/.test(formData.password)) {
      return 'Password must contain at least one uppercase letter.';
    }

    if (!/[a-z]/.test(formData.password)) {
      return 'Password must contain at least one lowercase letter.';
    }

    if (!/[0-9]/.test(formData.password)) {
      return 'Password must contain at least one number.';
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      return 'Password must contain at least one special character.';
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
   * VALIDATE FORM + SEND OTP
   * ============================================================
   * The form is validated first and the sign-up data is staged
   * server-side (PostgreSQL). Supabase is only used to email the OTP.
   * No doctor account is created at this step.
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
      const response = await otpApi.sendOtp({
        email: email.trim(),
        fullName: formData.fullName.trim(),
        contactNumber: formData.contactNumber.trim(),
        specialty: formData.specialty.trim(),
        credentials: formData.credentials.trim(),
        prcLicenseNumber: formData.prcLicenseNumber.trim(),
        clinic: formData.clinic.trim(),
        roomNumber: formData.roomNumber.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (!response.success) {
        setFormError(
          response.error ||
            'Unable to send the verification code. Please try again.'
        );

        setEmailStatus('idle');
        return;
      }

      /*
       * The OTP was sent by Supabase. The doctor account is created in
       * PostgreSQL only after the code is verified.
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
        'Unable to send the verification code. Please try again.'
      );

      setEmailStatus('idle');
    }
  };

  /*
   * ============================================================
   * VERIFY OTP
   * ============================================================
   */

  /*
   * ============================================================
   * VERIFY OTP + CREATE POSTGRESQL ACCOUNT
   * ============================================================
   * The OTP is verified by the backend through Supabase. The
   * PostgreSQL doctor account is created only when verification
   * succeeds, and the backend returns the application JWT.
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
      const response = await otpApi.verifyOtp({
        email: email.trim(),
        otp: getOtpValue(),
      });

      if (!response.success || !response.data) {
        setOtpError(
          response.error || 'Invalid or expired OTP code.'
        );

        setOtpStatus('idle');
        return;
      }

      /*
       * The backend verified the OTP and created the doctor account in
       * PostgreSQL with PENDING status. Doctor must wait for admin approval.
       */

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
      const response = await otpApi.resendOtp(email.trim());

      if (!response.success) {
        setOtpError(
          response.error ||
            'Failed to resend the verification code. Please try again.'
        );

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

                <SearchableSelect
                  id="specialty"
                  value={formData.specialty}
                  onChange={(val) => {
                    setFormData({
                      ...formData,
                      specialty: val,
                    });
                    setFormError('');
                  }}
                  options={MEDICAL_SPECIALTIES}
                  placeholder="Search and select medical specialty..."
                  noResultsText="No matching medical specialties found"
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

                <SearchableMultiSelect
                  id="credentials"
                  value={
                    formData.credentials
                      ? formData.credentials.split(',').map((c) => c.trim()).filter(Boolean)
                      : []
                  }
                  onChange={(selectedList) => {
                    setFormData({
                      ...formData,
                      credentials: selectedList.join(', '),
                    });
                    setFormError('');
                  }}
                  options={MEDICAL_CREDENTIALS}
                  placeholder="Search & select credentials (e.g., MD, FPCP, FPSGS)..."
                  noResultsText="No matching physician credentials found"
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  value={formData.prcLicenseNumber}
                  onChange={(event) => {
                    // Allow only numeric input
                    const numericValue = event.target.value.replace(/\D/g, '');
                    setFormData({
                      ...formData,
                      prcLicenseNumber: numericValue,
                    });

                    setFormError('');
                  }}
                  placeholder="Enter your PRC license number"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Hospital/Clinic */}
              <div className="mb-5">
                <label
                  htmlFor="clinic"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Hospital/Clinic
                </label>

                <SearchableSelect
                  id="clinic"
                  value={formData.clinic}
                  onChange={(val) => {
                    setFormData({
                      ...formData,
                      clinic: val,
                      roomNumber: '', // Reset room number when clinic changes
                    });
                    setFormError('');
                  }}
                  options={cebuFacilityOptions}
                  placeholder="Search and select Cebu hospital or clinic..."
                  noResultsText="No matching hospital or clinic found in Cebu"
                />
              </div>

              {/* Room Number - Conditionally shown for facilities with room numbers */}
              {showRoomNumberField && (
                <div className="mb-5">
                  <label
                    htmlFor="roomNumber"
                    className="block text-[15px] font-semibold text-[#334155] mb-2"
                  >
                    Room/Clinic Number
                  </label>
                  <input
                    id="roomNumber"
                    type="text"
                    value={formData.roomNumber}
                    onChange={(event) => {
                      setFormData({
                        ...formData,
                        roomNumber: event.target.value,
                      });
                      setFormError('');
                    }}
                    placeholder="e.g., Room 406, Suite 302"
                    className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter your specific room or suite number at this facility
                  </p>
                </div>
              )}

              {/* Password */}
              <div className="mb-5">
                <label
                  htmlFor="password"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
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
                    className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 pr-12 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] p-0.5 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password Requirements Checklist */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[12px]">
                    {hasMinLength ? (
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#94A3B8] shrink-0" />
                    )}
                    <span className={hasMinLength ? 'text-green-600' : 'text-[#94A3B8]'}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    {hasUppercase ? (
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#94A3B8] shrink-0" />
                    )}
                    <span className={hasUppercase ? 'text-green-600' : 'text-[#94A3B8]'}>At least one uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    {hasLowercase ? (
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#94A3B8] shrink-0" />
                    )}
                    <span className={hasLowercase ? 'text-green-600' : 'text-[#94A3B8]'}>At least one lowercase letter</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    {hasNumber ? (
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#94A3B8] shrink-0" />
                    )}
                    <span className={hasNumber ? 'text-green-600' : 'text-[#94A3B8]'}>At least one number</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    {hasSpecialChar ? (
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#94A3B8] shrink-0" />
                    )}
                    <span className={hasSpecialChar ? 'text-green-600' : 'text-[#94A3B8]'}>At least one special character</span>
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="mb-6">
                <label
                  htmlFor="confirmPassword"
                  className="block text-[15px] font-semibold text-[#334155] mb-2"
                >
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
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
                    className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 pr-12 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] p-0.5 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
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
                  href="/doctor-login"
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
                Didn&apos;t receive the code?{' '}

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

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#F3F5F9]">
        <div className="px-4 py-8 overflow-y-auto" style={{ height: '100vh' }}>
          <div className="w-full max-w-[460px] mx-auto text-center">
            <div className="bg-white rounded-3xl shadow-lg border border-[#E2E8F0] p-8">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckIcon />
              </div>
              <h1 className="text-2xl font-bold text-[#0F172A]">
                Registration Submitted Successfully
              </h1>
              <p className="text-[#64748B] mt-2 text-[15px]">
                Your email address has been successfully verified and your doctor registration has been submitted for review.
              </p>
              <p className="text-[#64748B] text-[15px] mt-2">
                Our administrator will review your information and verify your account.
              </p>
              <p className="text-[#64748B] text-[15px] mt-2">
                Please wait for an email confirming that your account has been approved. You cannot sign in until your account has been approved.
              </p>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => router.push('/doctor-login')}
                  className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
