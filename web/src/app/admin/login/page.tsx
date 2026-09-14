'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/authApi';
import { apiClient } from '@/lib/api/apiClient';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.login({ email, password });

      if (response.success && response.data) {
        // Store token in localStorage
        localStorage.setItem('token', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // Set token in API client
        apiClient.setToken(response.data.accessToken);

        // Verify backend-returned role is ADMIN
        if (response.data.user.role === 'ADMIN') {
          router.push('/admin/dashboard');
        } else {
          setError('Access denied. Admin access required.');
          // Clear credentials on role mismatch
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F5F9] px-4 sm:px-6 lg:px-8">
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

        {/* Title Section */}
        <div className="text-center mb-7 w-full">
          <h1 className="text-[34px] font-black tracking-tight text-[#0D1829] mb-2 leading-tight">
            Welcome back
          </h1>
          <p className="text-[15px] text-[#718096] font-normal leading-relaxed">
            Please enter your administrator credentials to sign in.
          </p>
        </div>

        {/* Admin Role Badge */}
        <div className="w-full bg-[#EAEFF5] p-1 rounded-full mb-7">
          <div className="w-full bg-white rounded-full py-2.5 px-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 text-center transition-all">
            <svg className="w-4 h-4 text-[#1A62CD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <span className="text-[#1A62CD] font-bold text-[15px] tracking-wide">Administrator Access</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Email Field */}
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
                placeholder="admin@example.com"
                required
                className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-[15px] font-bold text-[#1A202C]">
                Password
              </label>
              <a href="#" className="text-[14px] font-bold text-[#1967D2] hover:text-[#0D3B75] transition-colors">
                Forgot Password?
              </a>
            </div>
            <div className="relative rounded-2xl shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
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
                className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-12 text-[15px] tracking-wider text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#94A3B8] hover:text-[#64748B] focus:outline-none"
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

          {/* Remember Me */}
          <div className="flex items-center pt-1">
            <label className="flex items-center cursor-pointer select-none" htmlFor="remember-me">
              <input
                id="remember-me"
                type="checkbox"
                defaultChecked
                className="h-5 w-5 rounded-md border-[#CBD5E1] text-[#0D3B75] focus:ring-[#0D3B75] focus:ring-offset-0 transition duration-150 cursor-pointer"
              />
              <span className="ml-2.5 text-[15px] font-normal text-[#64748B]">Remember me</span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
