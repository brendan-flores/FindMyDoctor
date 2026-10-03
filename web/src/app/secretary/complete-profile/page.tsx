'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';

export default function SecretaryCompleteProfile() {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Client-side validation
    if (!firstName || !lastName || !contactNumber) {
      setError('First name, last name, and contact number are required');
      setIsLoading(false);
      return;
    }

    if (firstName.trim().length === 0 || firstName.trim().length > 100) {
      setError('First name must be 1-100 characters');
      setIsLoading(false);
      return;
    }

    if (middleName && middleName.trim().length > 100) {
      setError('Middle name must be maximum 100 characters');
      setIsLoading(false);
      return;
    }

    if (lastName.trim().length === 0 || lastName.trim().length > 100) {
      setError('Last name must be 1-100 characters');
      setIsLoading(false);
      return;
    }

    if (contactNumber.trim().length === 0 || contactNumber.trim().length > 20) {
      setError('Contact number must be 1-20 characters');
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.put('/secretaries/me', {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        contactNumber: contactNumber.trim(),
      });

      if (response.success) {
        // Redirect to dashboard
        router.push('/secretary/dashboard');
      } else {
        setError(response.error || 'Profile update failed. Please try again.');
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
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-12 h-12 bg-[#1A62CD] rounded-2xl flex items-center justify-center shadow-sm">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
                <path d="M15 7h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h6" />
                <path d="M12 3v4m0 0l-3-3m3 3l3-3" />
              </svg>
            </div>
            <span className="text-4xl font-extrabold tracking-tight text-[#165CBE]">FiDo</span>
          </div>
          <span className="text-[11px] font-bold text-[#8392A5] tracking-[0.18em] uppercase pl-0.5">
            FIND A DOCTOR
          </span>
        </div>

        <div className="text-center mb-7 w-full">
          <h1 className="text-[34px] font-black tracking-tight text-[#0D1829] mb-2 leading-tight">
            Complete Your Profile
          </h1>
          <p className="text-[15px] text-[#718096] font-normal leading-relaxed">
            Please provide your details to continue.
          </p>
        </div>

        <div className="w-full bg-[#EAEFF5] p-1 rounded-full mb-7">
          <div className="w-full bg-white rounded-full py-2.5 px-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 text-center transition-all">
            <svg className="w-4 h-4 text-[#1A62CD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <span className="text-[#1A62CD] font-bold text-[15px] tracking-wide">Profile Completion Required</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="firstName" className="block text-[15px] font-bold text-[#1A202C]">
              First Name
            </label>
            <div className="relative rounded-2xl shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                </svg>
              </div>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                required
                maxLength={100}
                className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="middleName" className="block text-[15px] font-bold text-[#1A202C]">
              Middle Name <span className="text-[#94A3B8] font-normal">(Optional)</span>
            </label>
            <div className="relative rounded-2xl shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                </svg>
              </div>
              <input
                id="middleName"
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Enter your middle name"
                maxLength={100}
                className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="lastName" className="block text-[15px] font-bold text-[#1A202C]">
              Last Name
            </label>
            <div className="relative rounded-2xl shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                </svg>
              </div>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                required
                maxLength={100}
                className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="contactNumber" className="block text-[15px] font-bold text-[#1A202C]">
              Contact Number
            </label>
            <div className="relative rounded-2xl shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                </svg>
              </div>
              <input
                id="contactNumber"
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="09123456789"
                required
                maxLength={20}
                className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150"
              />
            </div>
            <p className="text-xs text-[#64748B]">Philippine mobile format: 09123456789</p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving Profile...' : 'Complete Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
