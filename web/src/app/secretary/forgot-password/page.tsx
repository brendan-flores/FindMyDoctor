'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { passwordResetApi } from '@/lib/api/authApi';
import Toast from '@/components/ui/Toast';

export default function SecretaryForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await passwordResetApi.requestPasswordReset({ email });

      if (response.success) {
        setSuccess(true);
        // Navigate to reset password page with email
        setTimeout(() => {
          router.push(`/secretary/reset-password?email=${encodeURIComponent(email)}`);
        }, 1500);
      } else {
        setError(response.error || 'Failed to send reset code. Please try again.');
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
            Forgot Password
          </h1>
          <p className="text-[15px] text-[#718096] font-normal leading-relaxed">
            Enter your email to receive a password reset code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {error && (
            <Toast message={error} type="error" onClose={() => setError('')} />
          )}

          {success && (
            <Toast
              message="Reset code sent successfully!"
              type="success"
              onClose={() => setSuccess(false)}
            />
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-[15px] font-bold text-[#1A202C]">
              Email Address
            </label>
            <div className="relative rounded-2xl shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
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
                placeholder="secretary@example.com"
                required
                disabled={isLoading}
                className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push('/secretary-login')}
            className="text-[15px] text-[#64748B] font-normal hover:text-[#1A202C] transition-colors"
          >
            Back to Login
          </button>
        </div>

        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              ></path>
            </svg>
            <span className="text-[13px] text-[#94A3B8]">Secure password reset</span>
          </div>
        </div>
      </div>
    </div>
  );
}
