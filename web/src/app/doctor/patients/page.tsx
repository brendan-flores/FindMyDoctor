'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doctorApi, Patient, AssociatePatientRequest } from '@/lib/api/doctorApi';

export default function DoctorPatients() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addFormData, setAddFormData] = useState<AssociatePatientRequest>({
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    sex: 'MALE',
    phone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    medicalHistory: '',
    allergies: '',
    currentMedications: '',
  });

  useEffect(() => {
    fetchDoctorProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = patients.filter(patient =>
        patient.first_name?.toLowerCase().includes(term) ||
        patient.last_name?.toLowerCase().includes(term) ||
        patient.email?.toLowerCase().includes(term) ||
        patient.phone?.toLowerCase().includes(term)
      );
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [searchTerm, patients]);

  const fetchDoctorProfile = async () => {
    try {
      const response = await doctorApi.getProfile();
      if (response.success && response.data) {
        setDoctorId(response.data.id);
        fetchPatients(response.data.id);
      } else {
        setError(response.error || 'Failed to fetch doctor profile');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Network error occurred');
      setIsLoading(false);
    }
  };

  const fetchPatients = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await doctorApi.getPatients(id);

      if (response.success && response.data) {
        setPatients(response.data);
        setFilteredPatients(response.data);
      } else {
        setError(response.error || 'Failed to fetch patients');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Patients</h1>
        <p className="text-blue-100 mt-1">Manage your patient records and consultation history</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Patients</p>
              <p className="text-2xl font-bold text-slate-800">{patients.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-2xl">people</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Active Patients</p>
              <p className="text-2xl font-bold text-emerald-600">
                {patients.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">person_check</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Filtered Results</p>
              <p className="text-2xl font-bold text-blue-600">
                {filteredPatients.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-2xl">filter_list</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Search Active</p>
              <p className="text-2xl font-bold text-purple-600">
                {searchTerm ? 'Yes' : 'No'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-600 text-2xl">search</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Patient Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          Add Patient
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Patients List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-slate-600">Loading patients...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => fetchDoctorProfile()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300">person_search</span>
            <p className="mt-4 text-slate-600">
              {searchTerm ? 'No patients match your search' : 'No patients found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="p-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {getFullName(patient)}
                    </h3>

                    <div className="mt-2 space-y-1">
                      {patient.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-lg">email</span>
                          <span>{patient.email}</span>
                        </div>
                      )}

                      {patient.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-lg">phone</span>
                          <span>{patient.phone}</span>
                        </div>
                      )}

                      {patient.date_of_birth && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-lg">cake</span>
                          <span>Date of Birth: {formatDate(patient.date_of_birth)}</span>
                        </div>
                      )}

                      {patient.sex && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-lg">wc</span>
                          <span>Sex: {patient.sex}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    <button
                      onClick={() => router.push(`/doctor/patients/${patient.id}`)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">Add Patient</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setAddError(null);
                    setAddFormData({
                      email: '',
                      firstName: '',
                      middleName: '',
                      lastName: '',
                      dateOfBirth: '',
                      sex: 'MALE',
                      phone: '',
                      address: '',
                      emergencyContactName: '',
                      emergencyContactPhone: '',
                      medicalHistory: '',
                      allergies: '',
                      currentMedications: '',
                    });
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Enter the patient&apos;s email to associate them with your practice. The patient must have an existing account.
              </p>
            </div>

            {addError && (
              <div className="p-4 bg-red-50 border border-red-200 mx-6 mt-4 rounded-lg">
                <p className="text-red-600 text-sm">{addError}</p>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Email *</label>
                <input
                  type="email"
                  value={addFormData.email}
                  onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="patient@example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={addFormData.firstName}
                    onChange={(e) => setAddFormData({ ...addFormData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={addFormData.middleName}
                    onChange={(e) => setAddFormData({ ...addFormData, middleName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={addFormData.lastName}
                  onChange={(e) => setAddFormData({ ...addFormData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={addFormData.dateOfBirth}
                    onChange={(e) => setAddFormData({ ...addFormData, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Sex *</label>
                  <select
                    value={addFormData.sex}
                    onChange={(e) => setAddFormData({ ...addFormData, sex: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="NOT_SPECIFIED">Not Specified</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Phone *</label>
                <input
                  type="text"
                  value={addFormData.phone}
                  onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="09123456789"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Address *</label>
                <input
                  type="text"
                  value={addFormData.address}
                  onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={addFormData.emergencyContactName}
                    onChange={(e) => setAddFormData({ ...addFormData, emergencyContactName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Emergency Contact Phone</label>
                  <input
                    type="text"
                    value={addFormData.emergencyContactPhone}
                    onChange={(e) => setAddFormData({ ...addFormData, emergencyContactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Medical History</label>
                <textarea
                  value={addFormData.medicalHistory}
                  onChange={(e) => setAddFormData({ ...addFormData, medicalHistory: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Allergies</label>
                <textarea
                  value={addFormData.allergies}
                  onChange={(e) => setAddFormData({ ...addFormData, allergies: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Current Medications</label>
                <textarea
                  value={addFormData.currentMedications}
                  onChange={(e) => setAddFormData({ ...addFormData, currentMedications: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddError(null);
                  setAddFormData({
                    email: '',
                    firstName: '',
                    middleName: '',
                    lastName: '',
                    dateOfBirth: '',
                    sex: 'MALE',
                    phone: '',
                    address: '',
                    emergencyContactName: '',
                    emergencyContactPhone: '',
                    medicalHistory: '',
                    allergies: '',
                    currentMedications: '',
                  });
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                disabled={isAdding}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Client-side validation
                  if (!addFormData.email.trim()) {
                    setAddError('Email is required');
                    return;
                  }
                  if (!addFormData.firstName.trim()) {
                    setAddError('First name is required');
                    return;
                  }
                  if (!addFormData.lastName.trim()) {
                    setAddError('Last name is required');
                    return;
                  }
                  if (!addFormData.dateOfBirth) {
                    setAddError('Date of birth is required');
                    return;
                  }
                  if (!addFormData.phone.trim()) {
                    setAddError('Phone is required');
                    return;
                  }
                  if (!addFormData.address.trim()) {
                    setAddError('Address is required');
                    return;
                  }

                  setIsAdding(true);
                  setAddError(null);

                  try {
                    const response = await doctorApi.associatePatient(addFormData);

                    if (response.success && response.data) {
                      setShowAddModal(false);
                      setAddError(null);
                      setAddFormData({
                        email: '',
                        firstName: '',
                        middleName: '',
                        lastName: '',
                        dateOfBirth: '',
                        sex: 'MALE',
                        phone: '',
                        address: '',
                        emergencyContactName: '',
                        emergencyContactPhone: '',
                        medicalHistory: '',
                        allergies: '',
                        currentMedications: '',
                      });
                      // Refresh patient list
                      if (doctorId) {
                        fetchPatients(doctorId);
                      }
                    } else {
                      setAddError(response.error || 'Failed to add patient');
                    }
                  } catch (err) {
                    setAddError('Network error occurred');
                  } finally {
                    setIsAdding(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isAdding}
              >
                {isAdding ? 'Adding...' : 'Add Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}