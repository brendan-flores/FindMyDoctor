'use client';

import { useEffect, useState } from 'react';
import { secretaryApi, SecretaryProfile, DirectWalkInRegistrationRequest } from '@/lib/api/secretaryApi';
import DatePicker from '@/components/DatePicker';

type Step = 'form' | 'success';

export default function SecretaryWalkIns() {
  const [step, setStep] = useState<Step>('form');
  const [secretaryProfile, setSecretaryProfile] = useState<SecretaryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Direct registration form
  const [formData, setFormData] = useState<DirectWalkInRegistrationRequest>({
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    sex: 'MALE',
    phone: '',
    address: '',
  });
  const [isRegistering, setIsRegistering] = useState(false);

  // Success result
  const [registrationResult, setRegistrationResult] = useState<any>(null);

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Custom dropdown states
  const [isSexDropdownOpen, setIsSexDropdownOpen] = useState(false);

  useEffect(() => {
    fetchSecretaryProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSecretaryProfile = async () => {
    try {
      const response = await secretaryApi.getProfile();
      if (response.success && response.data) {
        setSecretaryProfile(response.data);
      } else {
        setError(response.error || 'Failed to fetch secretary profile');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectRegister = async () => {
    // Clear previous errors
    setFieldErrors({});
    setError(null);

    // Validate required fields
    if (!formData.email.trim() ||
        !formData.firstName.trim() ||
        !formData.lastName.trim() ||
        !formData.dateOfBirth ||
        !formData.phone.trim() ||
        !formData.address.trim()) {
      setError('All required fields must be filled');
      return;
    }

    // Validate Philippine mobile number format
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setFieldErrors({ phone: 'Mobile number must be 10 digits (excluding +63)' });
      return;
    }

    setIsRegistering(true);

    try {
      const response = await secretaryApi.directRegisterWalkIn(formData);

      if (response.success && response.data) {
        setRegistrationResult(response.data);
        setStep('success');
      } else {
        // Parse error message to identify field-level errors
        let errorMessage = 'Failed to register walk-in';
        
        // Handle nested error object format: { error: { code, message } }
        if (typeof response.error === 'object' && response.error !== null) {
          errorMessage = response.error.message || response.error.code || errorMessage;
        } else if (typeof response.error === 'string') {
          errorMessage = response.error;
        } else if (response.errorCode) {
          errorMessage = response.errorCode;
        }
        
        console.warn('Walk-in registration validation failed:', response);

        // Set field-level errors based on error message
        const newFieldErrors: Record<string, string> = {};
        const lowerError = errorMessage.toLowerCase();

        if (lowerError.includes('email')) {
          newFieldErrors.email = 'Email already registered';
          setError(null); // Clear global error when field error is set
        } else if (lowerError.includes('phone') || lowerError.includes('mobile')) {
          newFieldErrors.phone = errorMessage;
        } else if (lowerError.includes('name')) {
          newFieldErrors.firstName = errorMessage;
        }

        setFieldErrors(newFieldErrors);
        if (!newFieldErrors.email) {
          setError(errorMessage);
        }
      }
    } catch (err: any) {
      console.error('Network error:', err);
      // Handle axios/network errors
      let errorMessage = 'Network error occurred. Please check your connection.';
      
      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      const newFieldErrors: Record<string, string> = {};
      const lowerError = errorMessage.toLowerCase();

      if (lowerError.includes('email')) {
        newFieldErrors.email = 'Email already registered';
        setError(null);
      } else if (lowerError.includes('phone') || lowerError.includes('mobile')) {
        newFieldErrors.phone = errorMessage;
      } else if (lowerError.includes('name')) {
        newFieldErrors.firstName = errorMessage;
      }

      setFieldErrors(newFieldErrors);
      if (!newFieldErrors.email) {
        setError(errorMessage);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove all non-digit characters
    value = value.replace(/\D/g, '');
    
    // Limit to 10 digits (Philippine mobile number after +63)
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    
    setFormData(prev => ({ ...prev, phone: value }));
    if (fieldErrors.phone) {
      setFieldErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const handleReset = () => {
    setStep('form');
    setFormData({
      email: '',
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      sex: 'MALE',
      phone: '',
      address: '',
    });
    setRegistrationResult(null);
    setError(null);
    setFieldErrors({});
    setIsSexDropdownOpen(false);
  };

  const handleReturnToForm = () => {
    setError(null);
    // NOTE: Do NOT call handleReset() - preserve current step and form data
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is outside any dropdown button or dropdown content
      const isOutside = !target.closest('[data-dropdown]') && !target.closest('[data-dropdown-content]');
      
      if (isOutside) {
        setIsSexDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSexDropdownOpen]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Walk-ins</h1>
          <p className="text-xs text-slate-500 mt-0.5">Register walk-in patients and manage queue</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && step !== 'success') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Walk-ins</h1>
          <p className="text-xs text-slate-500 mt-0.5">Register walk-in patients and manage queue</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-600">{error}</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReturnToForm}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Return to form
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Direct Registration Form */}
      {step === 'form' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Register Walk-in Patient</h2>
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-sm text-slate-600 mb-2">Assigned Doctor</label>
              <input
                type="text"
                value={secretaryProfile ? `Dr. ${secretaryProfile.doctor_first_name} ${secretaryProfile.doctor_last_name}` : ''}
                disabled
                className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                  if (fieldErrors.email) {
                    setFieldErrors(prev => ({ ...prev, email: '' }));
                  }
                }}
                placeholder="Enter patient email"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  fieldErrors.email
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-200 focus:ring-emerald-500'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, firstName: e.target.value }));
                    if (fieldErrors.firstName) {
                      setFieldErrors(prev => ({ ...prev, firstName: '' }));
                    }
                  }}
                  placeholder="First name"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    fieldErrors.firstName
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.firstName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Middle Name</label>
                <input
                  type="text"
                  value={formData.middleName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.target.value }))}
                  placeholder="Middle name (optional)"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Last Name *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, lastName: e.target.value }));
                  if (fieldErrors.lastName) {
                    setFieldErrors(prev => ({ ...prev, lastName: '' }));
                  }
                }}
                placeholder="Last name"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  fieldErrors.lastName
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-200 focus:ring-emerald-500'
                }`}
              />
              {fieldErrors.lastName && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.lastName}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Date of Birth *</label>
                <DatePicker
                  value={formData.dateOfBirth}
                  onChange={(date) => setFormData(prev => ({ ...prev, dateOfBirth: date }))}
                  maxDate={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Sex *</label>
                <div className="relative">
                  <button
                    type="button"
                    data-dropdown
                    onClick={() => setIsSexDropdownOpen(!isSexDropdownOpen)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left flex items-center justify-between bg-white hover:border-emerald-300 transition-colors"
                  >
                    {formData.sex === 'MALE' ? 'Male' : formData.sex === 'FEMALE' ? 'Female' : formData.sex === 'OTHER' ? 'Other' : 'Not Specified'}
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isSexDropdownOpen && (
                    <div data-dropdown-content className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, sex: 'MALE' }));
                          setIsSexDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-emerald-50 hover:text-emerald-700 transition-colors first:rounded-t-lg"
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, sex: 'FEMALE' }));
                          setIsSexDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                      >
                        Female
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, sex: 'OTHER' }));
                          setIsSexDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                      >
                        Other
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, sex: 'NOT_SPECIFIED' }));
                          setIsSexDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-emerald-50 hover:text-emerald-700 transition-colors last:rounded-b-lg"
                      >
                        Not Specified
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Mobile Number *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">+63</span>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  placeholder="9123456789"
                  maxLength={10}
                  className={`w-full pl-14 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    fieldErrors.phone
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Address *</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
                placeholder="Address"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDirectRegister}
                disabled={isRegistering}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {isRegistering ? 'Registering...' : 'Register Walk-in'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && registrationResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-emerald-600 text-4xl">check_circle</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Registration Successful!</h2>
            <p className="text-slate-600 mb-6">
              Patient has been registered and added to the queue.
            </p>
            <div className="bg-emerald-50 rounded-lg p-4 mb-6">
              <p className="text-lg font-semibold text-emerald-800">
                Queue Number: {registrationResult.queueNumber}
              </p>
              <p className="text-sm text-emerald-600 mt-1">
                Total patients in queue: {registrationResult.totalPatients}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-slate-800 mb-2">Patient Information</h3>
              <p className="text-sm text-slate-600">
                <strong>Name:</strong> {registrationResult.patientName}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Email:</strong> {registrationResult.patientEmail}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Doctor:</strong> {registrationResult.doctorName}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Status:</strong> {registrationResult.registrationStatus}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-amber-800 mb-2">Temporary Password</p>
              <p className="text-lg font-mono text-amber-900">{registrationResult.temporaryPassword}</p>
              <p className="text-xs text-amber-600 mt-2">
                Please provide this to the patient. They will need to change it on first login.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Register Another Patient
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
