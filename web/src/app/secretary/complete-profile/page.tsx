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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
        // Show success modal
        setShowSuccessModal(true);
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
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-[460px] w-full">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-[28px] font-black tracking-tight text-[#0D1829] mb-2 leading-tight">
              Complete Your Profile
            </h2>
            <p className="text-[15px] text-[#718096] font-normal leading-relaxed">
              Please provide your details to continue.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Profile Completed Successfully!</h3>
            <p className="text-sm text-slate-600 mb-6">Your profile has been updated. You can now proceed to the dashboard.</p>
            <button
              onClick={() => router.push('/secretary/dashboard')}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#0D3B75] hover:bg-[#092B57] transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </>
  );
}
