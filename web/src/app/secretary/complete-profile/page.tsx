'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { secretaryApi } from '@/lib/api/secretaryApi';
import {
  clearSecretarySession,
  isInvalidSecretarySessionStatus,
} from '@/lib/auth/secretarySession';
import Toast from '@/components/ui/Toast';
import {
  formatPhoneFieldInput,
  phoneFieldValueFromStored,
  phoneFormatErrorMessage,
  storedPhoneWarningFor,
  toStaffContactDomestic,
} from '@/lib/phone';

export default function SecretaryCompleteProfile() {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [contactWarning, setContactWarning] = useState<string | null>(null);
  const [contactError, setContactError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    // This page can be reached directly, so it must verify the session on its
    // own. A token with no secretary row (deleted account, or a session from a
    // previous database) is still accepted by the API, but there is no profile
    // to complete: send the user back to the sign-in page.
    secretaryApi.getProfile()
      .then((response) => {
        if (!active) return;

        if (!response.success) {
          if (isInvalidSecretarySessionStatus(response.httpStatus)) {
            clearSecretarySession();
            router.replace('/secretary-login');
            return;
          }

          // Transient failure: render the form; submitting will surface the error.
          setIsCheckingAccess(false);
          return;
        }

        const profile = response.data;
        const firstName = profile?.first_name?.trim() ?? '';
        const lastName = profile?.last_name?.trim() ?? '';
        const contactNumber = profile?.contact_number?.trim() ?? '';
        const isComplete =
          firstName !== '' &&
          lastName !== '' &&
          toStaffContactDomestic(contactNumber) !== null;

        // Password changes come first; the layout owns that redirect.
        if (isComplete && profile?.must_change_password !== true) {
          router.replace('/secretary/dashboard');
          return;
        }

        // Keep whatever the profile already has so the user only fills the blanks.
        setFirstName(firstName);
        setMiddleName(profile?.middle_name ?? '');
        setLastName(lastName);
        setContactNumber(phoneFieldValueFromStored(profile?.contact_number, { allowLandline: true }));
        setContactWarning(storedPhoneWarningFor(profile?.contact_number, { allowLandline: true }));
        setIsCheckingAccess(false);
      })
      .catch(() => {
        // Do not strand the page on a network failure; the form still validates.
        if (active) {
          setIsCheckingAccess(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

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

    const domesticContact = toStaffContactDomestic(contactNumber);
    if (!domesticContact) {
      setContactError('Enter a valid Philippine contact number');
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.put('/secretaries/me', {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        contactNumber: domesticContact,
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

  if (isCheckingAccess) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-[460px] w-full">
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
              <Toast message={error} type="error" onClose={() => setError('')} />
            )}

            <div className="space-y-2">
              <label htmlFor="firstName" className="block text-[15px] font-bold text-[#1A202C]">
                First Name
              </label>
              <div className="relative rounded-2xl shadow-md">
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
              <div className="relative rounded-2xl shadow-md">
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
              <div className="relative rounded-2xl shadow-md">
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
              <div className="relative rounded-2xl shadow-md">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[15px] font-medium text-[#94A3B8]">
                  +63
                </div>
                <input
                  id="contactNumber"
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => {
                    const result = formatPhoneFieldInput(e.target.value, contactNumber, { allowLandline: true });
                    setContactNumber(result.value);
                    setContactError(result.error ? phoneFormatErrorMessage(result.error) : '');
                    if (!result.error) setContactWarning(null);
                  }}
                  placeholder="9171234567"
                  required
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 pl-12 pr-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150"
                />
              </div>
              {contactWarning && <p className="text-xs text-amber-600">{contactWarning}</p>}
              {contactError && <p className="text-xs text-red-600">{contactError}</p>}
              <p className="text-xs text-[#64748B]">Enter the number without +63 (mobile 10 digits, landline 9 digits).</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-2xl shadow-md text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Profile Completed Successfully!</h3>
            <p className="text-sm text-slate-600 mb-6">Your profile has been updated. You can now proceed to the dashboard.</p>
            <button
              onClick={() => router.push('/secretary/dashboard')}
              className="w-full py-3 px-4 rounded-2xl text-sm font-semibold text-white bg-[#0D3B75] hover:bg-[#092B57] transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </>
  );
}
