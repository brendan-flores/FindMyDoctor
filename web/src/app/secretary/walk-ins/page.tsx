'use client';

import { useEffect, useState } from 'react';
import { secretaryApi, SecretaryProfile, DirectWalkInRegistrationRequest } from '@/lib/api/secretaryApi';

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

    setIsRegistering(true);
    setError(null);

    try {
      const response = await secretaryApi.directRegisterWalkIn(formData);

      if (response.success && response.data) {
        setRegistrationResult(response.data);
        setStep('success');
      } else {
        // Show detailed error message from backend
        const errorMessage = response.error || 'Failed to register walk-in';
        console.error('Walk-in registration failed:', response);
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error occurred. Please check your connection.');
    } finally {
      setIsRegistering(false);
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
  };

  const handleReturnToForm = () => {
    setError(null);
    // NOTE: Do NOT call handleReset() - preserve current step and form data
  };

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
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter patient email"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Date of Birth *</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Sex *</label>
                <select
                  value={formData.sex}
                  onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="NOT_SPECIFIED">Not Specified</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Mobile Number *</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Mobile number"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
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
