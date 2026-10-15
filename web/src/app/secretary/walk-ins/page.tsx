'use client';

import { useEffect, useState } from 'react';
import { secretaryApi, SecretaryProfile, WalkInPatientSearch, CreateWalkInAccountRequest, WalkInPatientDetailsRequest, WalkInRegistrationRequest } from '@/lib/api/secretaryApi';

type Step = 'search' | 'create-account' | 'patient-details' | 'appointment' | 'confirm' | 'success';

export default function SecretaryWalkIns() {
  const [step, setStep] = useState<Step>('search');
  const [secretaryProfile, setSecretaryProfile] = useState<SecretaryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Search
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<WalkInPatientSearch | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Step 2: Create Account
  const [newAccountData, setNewAccountData] = useState<CreateWalkInAccountRequest>({
    email: '',
    firstName: '',
    lastName: '',
    doctorId: '',
  });
  const [createdAccount, setCreatedAccount] = useState<any>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // Step 3: Patient Details
  const [patientDetails, setPatientDetails] = useState<WalkInPatientDetailsRequest>({
    patientId: '',
    doctorId: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    sex: 'MALE',
    phone: '',
    address: '',
    middleName: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    medicalHistory: '',
    allergies: '',
    currentMedications: '',
  });
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);

  // Step 4: Appointment
  const [appointmentData, setAppointmentData] = useState<WalkInRegistrationRequest>({
    patientId: '',
    doctorId: '',
    appointmentDate: '',
    reasonForVisit: '',
  });
  const [isRegistering, setIsRegistering] = useState(false);

  // Step 5: Success
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
        const doctorId = response.data.doctor_id || '';
        setNewAccountData(prev => ({ ...prev, doctorId }));
        setPatientDetails(prev => ({ ...prev, doctorId }));
        setAppointmentData(prev => ({ ...prev, doctorId }));
      } else {
        setError(response.error || 'Failed to fetch secretary profile');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      setError('Email is required');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await secretaryApi.searchWalkInPatient(searchEmail.trim());

      if (response.success && response.data) {
        const data = response.data;
        setSearchResult(data);
        setPatientDetails(prev => ({
          ...prev,
          patientId: data.patient_id!,
          firstName: data.first_name!,
          lastName: data.last_name!,
        }));
        setAppointmentData(prev => ({
          ...prev,
          patientId: data.patient_id!,
        }));
        setStep('patient-details');
      } else if (response.httpStatus === 404) {
        // Only offer account creation for confirmed 404
        setSearchResult(null);
        setNewAccountData(prev => ({
          ...prev,
          email: searchEmail.trim(),
        }));
        setStep('create-account');
      } else {
        // Any other error (500, network, 401, etc.) shows error and stays on search
        setError(response.error || 'Failed to search for patient');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountData.email.trim() || !newAccountData.firstName.trim() || !newAccountData.lastName.trim()) {
      setError('All fields are required');
      return;
    }

    setIsCreatingAccount(true);
    setError(null);

    try {
      const response = await secretaryApi.createWalkInAccount(newAccountData);

      if (response.success && response.data) {
        const data = response.data;
        setCreatedAccount(data);
        setPatientDetails(prev => ({
          ...prev,
          patientId: data.patient?.id || '',
          firstName: newAccountData.firstName,
          lastName: newAccountData.lastName,
        }));
        setAppointmentData(prev => ({
          ...prev,
          patientId: data.patient?.id || '',
        }));
        setStep('patient-details');
      } else {
        setError(response.error || 'Failed to create account');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleSubmitPatientDetails = async () => {
    if (!patientDetails.dateOfBirth || !patientDetails.phone.trim() || !patientDetails.address.trim()) {
      setError('Date of birth, phone, and address are required');
      return;
    }

    setIsSubmittingDetails(true);
    setError(null);

    try {
      const response = await secretaryApi.submitWalkInPatientDetails(patientDetails);

      if (response.success && response.data) {
        setStep('appointment');
      } else {
        setError(response.error || 'Failed to submit patient details');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsSubmittingDetails(false);
    }
  };

  const handleRegisterWalkIn = async () => {
    if (!appointmentData.appointmentDate) {
      setError('Appointment date is required');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      const response = await secretaryApi.registerWalkIn(appointmentData);

      if (response.success && response.data) {
        setRegistrationResult(response.data);
        setStep('success');
      } else {
        setError(response.error || 'Failed to register walk-in');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleReset = () => {
    setStep('search');
    setSearchEmail('');
    setSearchResult(null);
    setCreatedAccount(null);
    setPatientDetails({
      patientId: '',
      doctorId: secretaryProfile?.doctor_id || '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      sex: 'MALE',
      phone: '',
      address: '',
      middleName: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      medicalHistory: '',
      allergies: '',
      currentMedications: '',
    });
    setAppointmentData({
      patientId: '',
      doctorId: secretaryProfile?.doctor_id || '',
      appointmentDate: '',
      reasonForVisit: '',
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
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Walk-ins</h1>
        <p className="text-xs text-slate-500 mt-0.5">Register walk-in patients and manage queue</p>
      </div>

      {/* Step Progress Indicator */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {['search', 'create-account', 'patient-details', 'appointment', 'confirm'].map((s, index) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step === s ? 'bg-emerald-600 text-white' :
                ['search', 'create-account', 'patient-details', 'appointment', 'confirm'].indexOf(step) > index ? 'bg-emerald-600 text-white' :
                'bg-slate-200 text-slate-600'
              }`}>
                {index + 1}
              </div>
              {index < 4 && (
                <div className={`flex-1 h-1 mx-2 ${
                  ['search', 'create-account', 'patient-details', 'appointment', 'confirm'].indexOf(step) > index ? 'bg-emerald-600' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Search</span>
          <span>Create Account</span>
          <span>Details</span>
          <span>Appointment</span>
          <span>Confirm</span>
        </div>
      </div>

      {/* Step 1: Search Patient */}
      {step === 'search' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Search Patient by Email</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-2">Patient Email</label>
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter patient email"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search Patient'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Create Account */}
      {step === 'create-account' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Create New Patient Account</h2>
          <p className="text-sm text-slate-600 mb-4">
            No patient found with email <strong>{searchEmail}</strong>. Create a new account?
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-2">Email</label>
              <input
                type="email"
                value={newAccountData.email}
                disabled
                className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">First Name *</label>
              <input
                type="text"
                value={newAccountData.firstName}
                onChange={(e) => setNewAccountData(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Last Name *</label>
              <input
                type="text"
                value={newAccountData.lastName}
                onChange={(e) => setNewAccountData(prev => ({ ...prev, lastName: e.target.value }))}
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
                onClick={handleCreateAccount}
                disabled={isCreatingAccount}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {isCreatingAccount ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Patient Details */}
      {step === 'patient-details' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {searchResult ? 'Update Patient Details' : 'Complete Patient Profile'}
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">First Name</label>
                <input
                  type="text"
                  value={patientDetails.firstName}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Middle Name</label>
                <input
                  type="text"
                  value={patientDetails.middleName || ''}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, middleName: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Last Name</label>
              <input
                type="text"
                value={patientDetails.lastName}
                disabled
                className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Date of Birth *</label>
                <input
                  type="date"
                  value={patientDetails.dateOfBirth}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Sex *</label>
                <select
                  value={patientDetails.sex}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, sex: e.target.value }))}
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
              <label className="block text-sm text-slate-600 mb-2">Phone *</label>
              <input
                type="text"
                value={patientDetails.phone}
                onChange={(e) => setPatientDetails(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Address *</label>
              <textarea
                value={patientDetails.address}
                onChange={(e) => setPatientDetails(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Emergency Contact Name</label>
                <input
                  type="text"
                  value={patientDetails.emergencyContactName || ''}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Emergency Contact Phone</label>
                <input
                  type="text"
                  value={patientDetails.emergencyContactPhone || ''}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Medical History</label>
              <textarea
                value={patientDetails.medicalHistory || ''}
                onChange={(e) => setPatientDetails(prev => ({ ...prev, medicalHistory: e.target.value }))}
                rows={2}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Allergies</label>
                <textarea
                  value={patientDetails.allergies || ''}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, allergies: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Current Medications</label>
                <textarea
                  value={patientDetails.currentMedications || ''}
                  onChange={(e) => setPatientDetails(prev => ({ ...prev, currentMedications: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPatientDetails}
                disabled={isSubmittingDetails}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmittingDetails ? 'Submitting...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Appointment */}
      {step === 'appointment' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Schedule Appointment</h2>
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
              <label className="block text-sm text-slate-600 mb-2">Appointment Date *</label>
              <input
                type="date"
                value={appointmentData.appointmentDate}
                onChange={(e) => setAppointmentData(prev => ({ ...prev, appointmentDate: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Reason for Visit</label>
              <textarea
                value={appointmentData.reasonForVisit || ''}
                onChange={(e) => setAppointmentData(prev => ({ ...prev, reasonForVisit: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('patient-details')}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Confirm */}
      {step === 'confirm' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Confirm Registration</h2>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-slate-800 mb-2">Patient Information</h3>
              <p className="text-sm text-slate-600">
                <strong>Name:</strong> {patientDetails.firstName} {patientDetails.middleName} {patientDetails.lastName}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Date of Birth:</strong> {patientDetails.dateOfBirth}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Phone:</strong> {patientDetails.phone}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-medium text-slate-800 mb-2">Appointment Details</h3>
              <p className="text-sm text-slate-600">
                <strong>Doctor:</strong> {secretaryProfile ? `Dr. ${secretaryProfile.doctor_first_name} ${secretaryProfile.doctor_last_name}` : ''}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Date:</strong> {appointmentData.appointmentDate}
              </p>
              {appointmentData.reasonForVisit && (
                <p className="text-sm text-slate-600">
                  <strong>Reason:</strong> {appointmentData.reasonForVisit}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('appointment')}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={handleRegisterWalkIn}
                disabled={isRegistering}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {isRegistering ? 'Registering...' : 'Confirm & Register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Success */}
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
            {createdAccount && createdAccount.temporaryPassword && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-amber-800 mb-2">Temporary Password</p>
                <p className="text-lg font-mono text-amber-900">{createdAccount.temporaryPassword}</p>
                <p className="text-xs text-amber-600 mt-2">
                  Please provide this to the patient. They will need to change it on first login.
                </p>
              </div>
            )}
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
