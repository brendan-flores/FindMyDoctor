'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { secretaryApi, Patient, UpdatePatientRequest } from '@/lib/api/secretaryApi';

export default function SecretaryPatientDetail() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<UpdatePatientRequest>({
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

  useEffect(() => {
    fetchPatientDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const fetchPatientDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await secretaryApi.getPatientById(patientId);

      if (response.success && response.data) {
        setPatient(response.data);
        // Initialize form data with patient data
        setFormData({
          firstName: response.data.first_name || '',
          lastName: response.data.last_name || '',
          dateOfBirth: response.data.date_of_birth || '',
          sex: response.data.sex || 'MALE',
          phone: response.data.phone || '',
          address: response.data.address || '',
          middleName: response.data.middle_name || '',
          emergencyContactName: response.data.emergency_contact_name || '',
          emergencyContactPhone: response.data.emergency_contact_phone || '',
          medicalHistory: response.data.medical_history || '',
          allergies: response.data.allergies || '',
          currentMedications: response.data.current_medications || '',
        });
      } else {
        setError(response.error || 'Failed to fetch patient details');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    // Client-side validation
    if (!formData.firstName.trim()) {
      setSaveError('First name is required');
      return;
    }
    if (!formData.lastName.trim()) {
      setSaveError('Last name is required');
      return;
    }
    if (!formData.dateOfBirth) {
      setSaveError('Date of birth is required');
      return;
    }
    if (!formData.phone.trim()) {
      setSaveError('Phone is required');
      return;
    }
    if (!formData.address.trim()) {
      setSaveError('Address is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await secretaryApi.updatePatient(patientId, formData);

      if (response.success && response.data) {
        setPatient(response.data);
        setIsEditMode(false);
      } else {
        setSaveError(response.error || 'Failed to update patient');
      }
    } catch (err) {
      setSaveError('Network error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original patient data
    if (patient) {
      setFormData({
        firstName: patient.first_name || '',
        lastName: patient.last_name || '',
        dateOfBirth: patient.date_of_birth || '',
        sex: patient.sex || 'MALE',
        phone: patient.phone || '',
        address: patient.address || '',
        middleName: patient.middle_name || '',
        emergencyContactName: patient.emergency_contact_name || '',
        emergencyContactPhone: patient.emergency_contact_phone || '',
        medicalHistory: patient.medical_history || '',
        allergies: patient.allergies || '',
        currentMedications: patient.current_medications || '',
      });
    }
    setIsEditMode(false);
    setSaveError(null);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getFullName = (patient: Patient) => {
    return `${patient.first_name} ${patient.middle_name ? patient.middle_name + ' ' : ''}${patient.last_name}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-white">Patient Details</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-slate-600">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-white">Patient Details</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <p className="text-red-600">{error || 'Patient not found'}</p>
          <button
            onClick={() => router.push('/secretary/patients')}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/secretary/patients')}
              className="text-emerald-100 hover:text-white mb-2 flex items-center gap-2"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Patients
            </button>
            <h1 className="text-2xl font-bold text-white">{getFullName(patient)}</h1>
            <p className="text-emerald-100 mt-1">{patient.email || 'No email on file'}</p>
          </div>
          {!isEditMode && (
            <button
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 font-medium"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600">{saveError}</p>
        </div>
      )}

      {/* Demographics Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">person</span>
            Demographics
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {isEditMode ? (
            <>
              <div>
                <label className="block text-sm text-slate-500 mb-1">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Sex *</label>
                <select
                  name="sex"
                  value={formData.sex}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="NOT_SPECIFIED">Not Specified</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-slate-500 mb-1">Full Name</p>
                <p className="text-slate-800 font-medium">{getFullName(patient)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Date of Birth</p>
                <p className="text-slate-800 font-medium">{formatDate(patient.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Sex</p>
                <p className="text-slate-800 font-medium">{patient.sex || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Address</p>
                <p className="text-slate-800 font-medium">{patient.address || 'Not specified'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contact Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">contact_phone</span>
            Contact Information
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {isEditMode ? (
            <>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  value={patient.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Phone *</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-slate-500 mb-1">Email</p>
                <p className="text-slate-800 font-medium">{patient.email || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Phone</p>
                <p className="text-slate-800 font-medium">{patient.phone || 'Not specified'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Medical Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">medical_services</span>
            Medical Information
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {isEditMode ? (
            <>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Medical History</label>
                <textarea
                  name="medicalHistory"
                  value={formData.medicalHistory || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty to clear this field</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Allergies</label>
                <textarea
                  name="allergies"
                  value={formData.allergies || ''}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty to clear this field</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Current Medications</label>
                <textarea
                  name="currentMedications"
                  value={formData.currentMedications || ''}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty to clear this field</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-slate-500 mb-1">Medical History</p>
                <p className="text-slate-800 font-medium whitespace-pre-wrap">
                  {patient.medical_history || 'None on file'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Allergies</p>
                <p className="text-slate-800 font-medium whitespace-pre-wrap">
                  {patient.allergies || 'None on file'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Current Medications</p>
                <p className="text-slate-800 font-medium whitespace-pre-wrap">
                  {patient.current_medications || 'None on file'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Emergency Contact Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">emergency</span>
            Emergency Contact
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {isEditMode ? (
            <>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  name="emergencyContactName"
                  value={formData.emergencyContactName || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty to clear this field</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Emergency Contact Phone</label>
                <input
                  type="text"
                  name="emergencyContactPhone"
                  value={formData.emergencyContactPhone || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty to clear this field</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-slate-500 mb-1">Emergency Contact Name</p>
                <p className="text-slate-800 font-medium">
                  {patient.emergency_contact_name || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Emergency Contact Phone</p>
                <p className="text-slate-800 font-medium">
                  {patient.emergency_contact_phone || 'Not specified'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Mode Actions */}
      {isEditMode && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-6 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
