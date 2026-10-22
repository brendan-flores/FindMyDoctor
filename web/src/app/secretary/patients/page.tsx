'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { secretaryApi, Patient } from '@/lib/api/secretaryApi';

export default function SecretaryPatients() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPatients();
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

  const fetchPatients = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await secretaryApi.searchPatients({});

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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Patients</p>
              <p className="text-2xl font-bold text-slate-800">{patients.length}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">people</span>
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
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Patients List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            <p className="mt-4 text-slate-600">Loading patients...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => fetchPatients()}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
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
                className="p-6 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/secretary/patients/${patient.id}`)}
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
                    <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
