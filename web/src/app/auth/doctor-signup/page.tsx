'use client';

import { useEffect, useState } from 'react';

type FieldName =
  | 'fullName'
  | 'specialty'
  | 'credentials'
  | 'prcLicenseNumber'
  | 'clinic'
  | 'email'
  | 'contactNumber'
  | 'password'
  | 'confirmPassword';

type FormValues = Record<FieldName, string>;
type FormErrors = Partial<Record<FieldName, string>>;
type FormStatus = 'idle' | 'submitting' | 'success';

const FIELD_ORDER: FieldName[] = [
  'fullName',
  'specialty',
  'credentials',
  'prcLicenseNumber',
  'clinic',
  'email',
  'contactNumber',
  'password',
  'confirmPassword',
];

const EMPTY_FORM: FormValues = {
  fullName: '',
  specialty: '',
  credentials: '',
  prcLicenseNumber: '',
  clinic: '',
  email: '',
  contactNumber: '',
  password: '',
  confirmPassword: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_PATTERN = /^[0-9+\-\s()]{7,}$/;
const PRC_PATTERN = /^\d{7}$/;

/**
 * Prototype-only validation. This mirrors the field rules documented for doctor
 * accounts (password minimum length) but performs no PRC verification and no
 * backend registration.
 */
function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  } else if (values.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  }

  if (!values.specialty.trim()) {
    errors.specialty = 'Specialty is required.';
  }

  if (!values.credentials.trim()) {
    errors.credentials = 'Credentials are required.';
  }

  if (!values.prcLicenseNumber.trim()) {
    errors.prcLicenseNumber = 'PRC license number is required.';
  } else if (!PRC_PATTERN.test(values.prcLicenseNumber.trim())) {
    errors.prcLicenseNumber = 'PRC license number must be 7 digits.';
  }

  if (!values.clinic.trim()) {
    errors.clinic = 'Clinic is required.';
  }

  if (!values.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.contactNumber.trim()) {
    errors.contactNumber = 'Contact number is required.';
  } else if (!CONTACT_PATTERN.test(values.contactNumber.trim())) {
    errors.contactNumber = 'Enter a valid contact number.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

/* Icons kept visually identical to the existing /auth/login page: 20px, 1.8 stroke. */

function UserIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" strokeWidth="1.8"></circle>
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function SpecialtyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M3 12h4l2-5 3 10 2-5h7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function CredentialsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M3 9l9-4 9 4-9 4-9-4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
      <path d="M7 11.5V16c0 1.1 2.2 2.5 5 2.5s5-1.4 5-2.5v-4.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function LicenseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect height="14" rx="2" strokeWidth="1.8" width="18" x="3" y="5"></rect>
      <circle cx="9" cy="11" r="2" strokeWidth="1.8"></circle>
      <path d="M14 9.5h4M14 13h4M6.5 16c.7-1 1.6-1.5 2.5-1.5s1.8.5 2.5 1.5" strokeLinecap="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function ClinicIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M4 20.5V6.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
      <path d="M16 10h2a2 2 0 0 1 2 2v8.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
      <path d="M8 8h2M8 12h2M8 16h2" strokeLinecap="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect height="16" rx="3" strokeWidth="1.8" width="20" x="2" y="4"></rect>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" strokeLinecap="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M3.5 5.5c0-.8.7-1.5 1.5-1.5h2.2c.7 0 1.3.5 1.5 1.2l.6 2.4c.1.6-.1 1.2-.6 1.5l-1 .7a12.5 12.5 0 0 0 5.5 5.5l.7-1c.4-.5 1-.7 1.5-.6l2.4.6c.7.2 1.2.8 1.2 1.5v2.2c0 .8-.7 1.5-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect height="11" rx="2" ry="2" strokeWidth="1.8" width="16" x="4" y="11"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth="1.8"></circle>
      <path d="M12 8v4.5M12 16h.01" strokeLinecap="round" strokeWidth="1.8"></path>
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth="1.8"></circle>
      <path d="m8.5 12.5 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
    </svg>
  );
}

interface FieldProps {
  id: FieldName;
  label: string;
  value: string;
  placeholder: string;
  icon: React.ReactNode;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  trailing?: React.ReactNode;
}

function Field({
  id,
  label,
  value,
  placeholder,
  icon,
  onChange,
  error,
  type = 'text',
  autoComplete,
  trailing,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[15px] font-bold text-[#1A202C]">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative rounded-2xl shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
          {icon}
        </div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`block w-full rounded-2xl border bg-white py-3.5 pl-12 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 transition-all duration-150 ${
            trailing ? 'pr-12' : 'pr-4'
          } ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
              : 'border-[#E2E8F0] focus:border-[#1A62CD] focus:ring-[#1A62CD]/20'
          }`}
        />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[13px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

interface PasswordFieldProps {
  id: FieldName;
  label: string;
  value: string;
  placeholder: string;
  autoComplete?: string;
  onChange: (value: string) => void;
  error?: string;
}

function PasswordField({ id, label, value, placeholder, autoComplete, onChange, error }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field
      id={id}
      label={label}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      onChange={onChange}
      error={error}
      type={visible ? 'text' : 'password'}
      icon={<LockIcon />}
      trailing={
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#94A3B8] hover:text-[#64748B] focus:outline-none"
        >
          {visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      }
    />
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold text-[#8392A5] tracking-[0.18em] uppercase whitespace-nowrap">
          {title}
        </span>
        <span className="h-px flex-1 bg-[#E2E8F0]" />
      </div>
      <div className="mt-4 space-y-5">{children}</div>
    </div>
  );
}

export default function DoctorSignUp() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<FormStatus>('idle');

  // Prototype only: simulates submitting the request, then shows the success state.
  useEffect(() => {
    if (status !== 'submitting') return;
    const timer = window.setTimeout(() => setStatus('success'), 900);
    return () => window.clearTimeout(timer);
  }, [status]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleChange = (field: FieldName, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    const firstInvalidField = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalidField) {
      document.getElementById(firstInvalidField)?.focus();
      return;
    }

    setStatus('submitting');
  };

  const handleBackToForm = () => {
    setValues(EMPTY_FORM);
    setErrors({});
    setStatus('idle');
  };

  return (
    <div className="h-screen overflow-y-auto bg-[#F3F5F9] px-4 sm:px-6 lg:px-8">
      <div className="min-h-full flex justify-center py-10">
        <div className="w-full max-w-[460px] flex flex-col items-center">
          {/* Brand Header */}
          <div className="flex flex-col items-center mb-8 text-center">
            {/* FiDo Logo */}
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-12 h-12 bg-[#1A62CD] rounded-2xl flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
                  <line x1="12" x2="12" y1="5" y2="19"></line>
                  <line x1="5" x2="19" y1="12" y2="12"></line>
                </svg>
              </div>
              <span className="text-4xl font-extrabold tracking-tight text-[#165CBE]">FiDo</span>
            </div>
            <span className="text-[11px] font-bold text-[#8392A5] tracking-[0.18em] uppercase pl-0.5">
              FIND A DOCTOR
            </span>
          </div>

          {status === 'success' ? (
            /* Prototype success state - no account is created */
            <div className="w-full rounded-2xl border border-[#E2E8F0] bg-white px-6 py-8 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <SuccessIcon />
              </div>
              <h1 className="text-[26px] font-black tracking-tight text-[#0D1829] mb-2 leading-tight">
                Registration Complete
              </h1>
              <p className="text-[15px] text-[#718096] font-normal leading-relaxed">
                Your doctor account request has been submitted.
              </p>
              <p className="mt-3 text-[13px] text-[#8392A5] font-normal leading-relaxed">
                Prototype screen only. No account was created, no data was saved, and no API request was made.
              </p>
              <div className="mt-7 space-y-3">
                <a
                  href="/auth/login"
                  className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150"
                >
                  Return to Login
                </a>
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl border border-[#E2E8F0] bg-white text-[16px] font-bold text-[#1967D2] hover:bg-[#F5F7FA] hover:text-[#0D3B75] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-colors duration-150"
                >
                  Back to Sign Up
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Title Section */}
              <div className="text-center mb-7 w-full">
                <h1 className="text-[34px] font-black tracking-tight text-[#0D1829] mb-2 leading-tight">
                  Create Doctor Account
                </h1>
                <p className="text-[15px] text-[#718096] font-normal leading-relaxed">
                  Please provide your professional and account details.
                </p>
              </div>

              {/* Sign Up Form */}
              <form onSubmit={handleSubmit} noValidate className="w-full space-y-6">
                {/* Required Fields Note */}
                <p className="text-[13px] text-[#718096] font-normal">
                  Fields marked with <span className="font-bold text-red-500">*</span> are required.
                </p>

                {/* Error Message */}
                {hasErrors && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5">
                    <AlertIcon />
                    <span>Please correct the highlighted fields and try again.</span>
                  </div>
                )}

                {/* Doctor Information */}
                <FormSection title="Doctor Information">
                  <Field
                    id="fullName"
                    label="Full Name"
                    value={values.fullName}
                    onChange={(value) => handleChange('fullName', value)}
                    placeholder="Dr. Juan Dela Cruz"
                    autoComplete="name"
                    icon={<UserIcon />}
                    error={errors.fullName}
                  />
                  <Field
                    id="specialty"
                    label="Specialty"
                    value={values.specialty}
                    onChange={(value) => handleChange('specialty', value)}
                    placeholder="Cardiology"
                    icon={<SpecialtyIcon />}
                    error={errors.specialty}
                  />
                  <Field
                    id="credentials"
                    label="Credentials"
                    value={values.credentials}
                    onChange={(value) => handleChange('credentials', value)}
                    placeholder="MD, FPCP"
                    icon={<CredentialsIcon />}
                    error={errors.credentials}
                  />
                  <Field
                    id="prcLicenseNumber"
                    label="PRC License Number"
                    value={values.prcLicenseNumber}
                    onChange={(value) => handleChange('prcLicenseNumber', value)}
                    placeholder="1234567"
                    icon={<LicenseIcon />}
                    error={errors.prcLicenseNumber}
                  />
                  <Field
                    id="clinic"
                    label="Clinic"
                    value={values.clinic}
                    onChange={(value) => handleChange('clinic', value)}
                    placeholder="FiDo Medical Center"
                    icon={<ClinicIcon />}
                    error={errors.clinic}
                  />
                </FormSection>

                {/* Contact Information */}
                <FormSection title="Contact Information">
                  <Field
                    id="email"
                    label="Email Address"
                    value={values.email}
                    onChange={(value) => handleChange('email', value)}
                    placeholder="doctor@example.com"
                    type="email"
                    autoComplete="email"
                    icon={<MailIcon />}
                    error={errors.email}
                  />
                  <Field
                    id="contactNumber"
                    label="Contact Number"
                    value={values.contactNumber}
                    onChange={(value) => handleChange('contactNumber', value)}
                    placeholder="+63 912 345 6789"
                    type="tel"
                    autoComplete="tel"
                    icon={<PhoneIcon />}
                    error={errors.contactNumber}
                  />
                </FormSection>

                {/* Account Security */}
                <FormSection title="Account Security">
                  <PasswordField
                    id="password"
                    label="Password"
                    value={values.password}
                    onChange={(value) => handleChange('password', value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    error={errors.password}
                  />
                  <PasswordField
                    id="confirmPassword"
                    label="Confirm Password"
                    value={values.confirmPassword}
                    onChange={(value) => handleChange('confirmPassword', value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    error={errors.confirmPassword}
                  />
                </FormSection>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'submitting' ? 'Creating account...' : 'Create Doctor Account'}
                  </button>
                </div>
              </form>

              {/* Log In Link */}
              <div className="mt-6 text-center">
                <p className="text-[15px] text-[#64748B] font-normal">
                  Already have an account?{' '}
                  <a
                    href="/auth/login"
                    className="font-bold text-[#1967D2] hover:text-[#0D3B75] transition-colors"
                  >
                    Log In
                  </a>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

