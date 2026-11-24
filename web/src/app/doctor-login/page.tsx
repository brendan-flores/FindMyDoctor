'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api/authApi';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi } from '@/lib/api/doctorApi';
import OtpVerification from '@/components/auth/OtpVerification';
import Toast from '@/components/ui/Toast';

export default function DoctorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();

  // An existing valid session must skip the login form and resume the normal
  // portal routing: password-change and approval/profile rules are enforced by
  // the destination pages, while an untrusted (non-persistent) session returns
  // to the device-trust step first, matching post-login behavior.
  useEffect(() => {
    const restoreExistingSession = async () => {
      if (!apiClient.getStoredToken()) {
        setIsCheckingSession(false);
        return;
      }

      try {
        const response = await doctorApi.getProfile({ skipCache: true });

        if (response.success && response.data) {
          let storedUser: any = null;
          try {
            storedUser = JSON.parse(localStorage.getItem('doctor_user') || 'null');
          } catch {
            storedUser = null;
          }

          if (storedUser?.mustChangePassword === true) {
            router.replace('/doctor/settings');
          } else {
            if (response.data.approval_status === 'REJECTED') {
              // Rejected doctors can no longer authenticate. Clear the stale
              // session and let the login form be shown.
              apiClient.clearToken();
              localStorage.removeItem('doctor_user');
            } else {
              // Corrective flows (rejection review, onboarding) skip the
              // device-trust prompt; it is only offered when entering the portal.
              const needsProfileCorrection =
                response.data.approval_status === 'PENDING' &&
                response.data.profile_completion_status !== 'SUBMITTED';
              if (needsProfileCorrection) {
                router.replace('/doctor-profile');
              } else {
                const session = apiClient.getSessionMetadata();
                const isPersistent =
                  session?.persistent === true || session?.rememberMe === true;
                router.replace(isPersistent ? '/doctor/dashboard' : '/doctor/trust-device');
              }
            }
          }
        } else {
          apiClient.clearToken();
        }
      } catch {
        apiClient.clearToken();
      } finally {
        setIsCheckingSession(false);
      }
    };

    restoreExistingSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.login({
        email,
        password,
        expectedRole: 'DOCTOR',
        // The trusted-device token is an HttpOnly cookie and is sent
        // automatically by the browser; it is never read from JavaScript.
      });

      if (response.success && response.data) {
        // Check if OTP is required
        if ('requiresOtp' in response.data && response.data.requiresOtp) {
          setShowOtp(true);
          setChallengeId(response.data.challengeId);
          setIsLoading(false);
          return;
        }

        // Type guard: this is now AuthResponse (not LoginOtpRequiredResponse)
        const authData = response.data as {
          user: any;
          accessToken: string;
          refreshToken: string;
          requiresTrustPrompt?: boolean;
          session?: any;
        };

        // Store the user profile and start the session watchdog.
        localStorage.setItem('doctor_user', JSON.stringify(authData.user));
        apiClient.setToken(authData.accessToken, authData.refreshToken, authData.session || null, false, 'DOCTOR');

        if (authData.user.role === 'DOCTOR') {
          await routeBasedOnApprovalStatus(authData.requiresTrustPrompt === true);
        } else {
          setError('Invalid username or password.');
          localStorage.removeItem('doctor_user');
          apiClient.clearToken();
        }
      } else {
        setError(response.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerifySuccess = async (data: any) => {
    if (data.user.role === 'DOCTOR') {
      localStorage.setItem('doctor_user', JSON.stringify(data.user));
      apiClient.setToken(data.accessToken, data.refreshToken, data.session || null, false, 'DOCTOR');

      await routeBasedOnApprovalStatus(data.requiresTrustPrompt === true);
    } else {
      setError('Invalid username or password.');
      localStorage.removeItem('doctor_user');
      apiClient.clearToken();
    }
  };

  const handleOtpVerifyError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleOtpCancel = () => {
    setShowOtp(false);
    setChallengeId('');
    setError('');
  };

  const handleChallengeIdUpdate = (newChallengeId: string) => {
    setChallengeId(newChallengeId);
  };

  const routeBasedOnApprovalStatus = async (requiresTrustPrompt: boolean) => {
    try {
      const response = await doctorApi.getProfile();

      if (response.success && response.data) {
        const approvalStatus = response.data.approval_status;

        // Rejected doctors can no longer authenticate. If a stale session
        // survived the rejection, clear it and show a generic error instead of
        // routing to a protected page.
        if (approvalStatus === 'REJECTED') {
          setError('Invalid email or password.');
          localStorage.removeItem('doctor_user');
          apiClient.clearToken();
          return;
        }

        // The device-trust prompt is only offered when the login leads into
        // the portal dashboard. Corrective flows — a pending doctor finishing
        // onboarding — go straight to /doctor-profile instead.
        const needsProfileCorrection =
          approvalStatus === 'PENDING' &&
          response.data.profile_completion_status !== 'SUBMITTED';

        if (needsProfileCorrection) {
          router.push('/doctor-profile');
        } else if (approvalStatus === 'ACTIVE') {
          router.push(requiresTrustPrompt ? '/doctor/trust-device' : '/doctor/dashboard');
        } else if (approvalStatus === 'PENDING') {
          // PENDING + SUBMITTED is rejected by the login endpoint, so reaching
          // this branch means the account is awaiting administrator approval.
          setError('Your account is awaiting administrator approval');
          localStorage.removeItem('doctor_user');
          apiClient.clearToken();
        } else {
          setError('Invalid account status');
          localStorage.removeItem('doctor_user');
          apiClient.clearToken();
        }
      } else {
        setError('Failed to fetch profile');
        localStorage.removeItem('doctor_user');
        apiClient.clearToken();
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('An error occurred while fetching your profile');
      localStorage.removeItem('doctor_user');
      apiClient.clearToken();
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/images/findmydoctor_logo.png"
            alt="FindMyDoctor Logo"
            className="h-16 w-auto"
          />
          <p className="text-sm font-medium text-neutral-500">Checking your session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[460px] flex flex-col items-center">
        <div className="flex flex-col items-center mb-8 text-center">
          <img
            src="/images/findmydoctor_logo.png"
            alt="FindMyDoctor Logo"
            className="h-20 w-auto mb-2"
          />
        </div>

        {!showOtp && (
          <>
            <div className="text-center mb-7 w-full">
              <h1 className="text-[34px] font-black tracking-tight text-neutral-900 mb-2 leading-tight">
                Doctor Portal
              </h1>
              <p className="text-[15px] text-neutral-500 font-normal leading-relaxed">
                Please enter your doctor credentials to sign in.
              </p>
            </div>

            <div className="w-full bg-neutral-100 p-1 rounded-full mb-7">
              <div className="w-full bg-white rounded-full py-2.5 px-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 text-center transition-all">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
                <span className="text-primary-600 font-bold text-[15px] tracking-wide">Doctor Access</span>
              </div>
            </div>
          </>
        )}

        {!showOtp ? (
          <form onSubmit={handleSubmit} className="w-full space-y-5">
            {error && (
              <Toast message={error} type="error" onClose={() => setError('')} />
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-[15px] font-bold text-neutral-900">
                Email Address
              </label>
              <div className="relative rounded-2xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-neutral-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect height="16" rx="3" strokeWidth="1.8" width="20" x="2" y="4"></rect>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" strokeLinecap="round" strokeWidth="1.8"></path>
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  required
                  className="block w-full rounded-2xl border border-neutral-200 bg-white py-3.5 pl-12 pr-4 text-[15px] text-neutral-900 placeholder-neutral-400 focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 transition-all duration-150"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-[15px] font-bold text-neutral-900">
                  Password
                </label>
                <Link href="/doctor/forgot-password" className="text-[14px] font-bold text-primary-600 hover:text-primary-800 transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative rounded-2xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-neutral-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect height="11" rx="2" ry="2" strokeWidth="1.8" width="16" x="4" y="11"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full rounded-2xl border border-neutral-200 bg-white py-3.5 pl-12 pr-12 text-[15px] tracking-wider text-neutral-900 placeholder-neutral-400 focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-neutral-400 hover:text-neutral-500 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        ) : (
          <OtpVerification
            email={email}
            challengeId={challengeId}
            onVerifySuccess={handleOtpVerifySuccess}
            onVerifyError={handleOtpVerifyError}
            onCancel={handleOtpCancel}
            onChallengeIdUpdate={handleChallengeIdUpdate}
          />
        )}

        {!showOtp && (
          <div className="mt-6 text-center">
            <p className="text-[15px] text-neutral-500 font-normal">
              Don&apos;t have an account?{' '}
              <a
                href="/doctor-signup"
                className="font-bold text-primary-600 hover:text-primary-800 transition-colors"
              >
                Create an Account
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
