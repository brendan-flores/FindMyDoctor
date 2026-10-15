'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doctorApi, Patient, Prescription } from '@/lib/api/doctorApi';
import { apiClient } from '@/lib/api/apiClient';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason_for_visit?: string;
  queue_number?: number;
  queue_status?: string;
  practice_name?: string;
}

export default function PatientDetail() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [prescriptionsError, setPrescriptionsError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatientDetails();
    fetchPatientAppointments();
    fetchPatientPrescriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const fetchPatientDetails = async () => {
    try {
      const response = await doctorApi.getPatientById(patientId);

      if (response.success && response.data) {
        setPatient(response.data);
      } else {
        setError(response.error || 'Failed to fetch patient details');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPatientAppointments = async () => {
    try {
      const response = await apiClient.get<Appointment[]>(`/appointments?patientId=${patientId}`);

      if (response.success && response.data) {
        setAppointments(response.data);
      } else {
        setAppointmentsError(response.error || 'Failed to fetch appointments');
      }
    } catch (err) {
      setAppointmentsError('Network error occurred');
    }
  };

  const fetchPatientPrescriptions = async () => {
    try {
      const response = await doctorApi.getPatientPrescriptions(patientId);

      if (response.success && response.data) {
        setPrescriptions(response.data);
      } else {
        setPrescriptionsError(response.error || 'Failed to fetch prescriptions');
      }
    } catch (err) {
      setPrescriptionsError('Network error occurred');
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFullName = (patient: Patient) => {
    return `${patient.first_name} ${patient.middle_name ? patient.middle_name + ' ' : ''}${patient.last_name}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-emerald-100 text-emerald-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-800';
      case 'NO_SHOW':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-white">Patient Details</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-white">Patient Details</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <p className="text-red-600">{error || 'Patient not found'}</p>
          <button
            onClick={() => router.push('/doctor/patients')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/doctor/patients')}
              className="text-blue-100 hover:text-white mb-2 flex items-center gap-2"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Patients
            </button>
            <h1 className="text-2xl font-bold text-white">{getFullName(patient)}</h1>
            <p className="text-blue-100 mt-1">{patient.email || 'No email on file'}</p>
          </div>
        </div>
      </div>

      {/* Demographics Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">person</span>
            Demographics
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      </div>

      {/* Contact Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">contact_phone</span>
            Contact Information
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Email</p>
            <p className="text-slate-800 font-medium">{patient.email || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Phone</p>
            <p className="text-slate-800 font-medium">{patient.phone || 'Not specified'}</p>
          </div>
        </div>
      </div>

      {/* Medical Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">medical_services</span>
            Medical Information
          </h2>
        </div>
        <div className="p-6 space-y-4">
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
        </div>
      </div>

      {/* Emergency Contact Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">emergency</span>
            Emergency Contact
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      </div>

      {/* Consultation History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">history</span>
            Consultation History
          </h2>
        </div>

        {/* Appointments */}
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-md font-semibold text-slate-700 mb-4">Appointments</h3>
          {appointmentsError ? (
            <div className="p-4 bg-red-50 rounded-lg text-red-600 text-sm">
              {appointmentsError}
            </div>
          ) : appointments.length === 0 ? (
            <p className="text-slate-500 text-sm">No appointments found</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 bg-slate-50 rounded-lg flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          appointment.status
                        )}`}
                      >
                        {appointment.status.replace('_', ' ')}
                      </span>
                      {appointment.queue_number && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                          Queue #{appointment.queue_number}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {formatDateTime(appointment.appointment_date)}
                    </p>
                    {appointment.reason_for_visit && (
                      <p className="text-sm text-slate-600 mt-1">
                        Reason: {appointment.reason_for_visit}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prescriptions */}
        <div className="p-6">
          <h3 className="text-md font-semibold text-slate-700 mb-4">Prescriptions</h3>
          {prescriptionsError ? (
            <div className="p-4 bg-red-50 rounded-lg text-red-600 text-sm">
              {prescriptionsError}
            </div>
          ) : prescriptions.length === 0 ? (
            <p className="text-slate-500 text-sm">No prescriptions found</p>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  className="p-4 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(prescription.prescription_date)}
                    </p>
                    {prescription.doctor_first_name && prescription.doctor_last_name && (
                      <p className="text-xs text-slate-500">
                        Dr. {prescription.doctor_first_name} {prescription.doctor_last_name}
                      </p>
                    )}
                  </div>
                  {prescription.notes && (
                    <p className="text-sm text-slate-600 mb-2">{prescription.notes}</p>
                  )}
                  {prescription.items && prescription.items.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {prescription.items.map((item) => (
                        <div
                          key={item.id}
                          className="text-xs text-slate-600 bg-white p-2 rounded"
                        >
                          <p className="font-medium">{item.medication_name}</p>
                          {item.dosage && <p>Dosage: {item.dosage}</p>}
                          {item.frequency && <p>Frequency: {item.frequency}</p>}
                          {item.duration && <p>Duration: {item.duration}</p>}
                          {item.instructions && <p>Instructions: {item.instructions}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
