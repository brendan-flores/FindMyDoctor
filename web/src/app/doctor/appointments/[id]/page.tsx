'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi, Prescription } from '@/lib/api/doctorApi';

interface AppointmentDetail {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason_for_visit?: string;
  queue_number?: number;
  queue_status?: string;
  practice_name?: string;
  patient_first_name: string;
  patient_last_name: string;
}

interface PatientDetail {
  id: string;
  user_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth?: string;
  sex?: string;
  phone?: string;
  address?: string;
  email?: string;
}

export default function AppointmentDetail() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;

  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prescriptionsError, setPrescriptionsError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointmentDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const fetchAppointmentDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch appointment details
      const appointmentResponse = await apiClient.get<AppointmentDetail>(`/appointments/${appointmentId}`);

      if (appointmentResponse.success && appointmentResponse.data) {
        setAppointment(appointmentResponse.data);

        // Fetch patient details
        const patientResponse = await doctorApi.getPatientById(appointmentResponse.data.patient_id);
        if (patientResponse.success && patientResponse.data) {
          setPatient(patientResponse.data);
        }

        // Fetch patient prescriptions
        const prescriptionsResponse = await doctorApi.getPatientPrescriptions(appointmentResponse.data.patient_id);
        if (prescriptionsResponse.success && prescriptionsResponse.data) {
          setPrescriptions(prescriptionsResponse.data);
        } else {
          setPrescriptionsError(prescriptionsResponse.error || 'Failed to fetch prescriptions');
        }
      } else {
        setError(appointmentResponse.error || 'Failed to fetch appointment details');
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

  const getFullName = (patient: PatientDetail) => {
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
          <h1 className="text-2xl font-bold text-white">Appointment Details</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-white">Appointment Details</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <p className="text-red-600">{error || 'Appointment not found or access denied'}</p>
          <button
            onClick={() => router.push('/doctor/appointments')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/doctor/appointments')}
            className="text-slate-600 hover:text-slate-900 mb-2 flex items-center gap-2"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Appointments
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Appointment Details</h1>
          <p className="text-slate-500 mt-1">{formatDateTime(appointment.appointment_date)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              appointment.status
            )}`}
          >
            {appointment.status.replace('_', ' ')}
          </span>
          {appointment.queue_number && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              Queue #{appointment.queue_number}
            </span>
          )}
        </div>
      </div>

      {/* Patient Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">person</span>
            Patient Information
          </h2>
        </div>
        {patient ? (
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
              <p className="text-sm text-slate-500 mb-1">Email</p>
              <p className="text-slate-800 font-medium">{patient.email || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Phone</p>
              <p className="text-slate-800 font-medium">{patient.phone || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Address</p>
              <p className="text-slate-800 font-medium">{patient.address || 'Not specified'}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500">
            Patient information not available
          </div>
        )}
      </div>

      {/* Appointment Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">event</span>
            Appointment Information
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Date & Time</p>
            <p className="text-slate-800 font-medium">{formatDateTime(appointment.appointment_date)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Status</p>
            <p className="text-slate-800 font-medium">{appointment.status.replace('_', ' ')}</p>
          </div>
          {appointment.queue_number && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Queue Number</p>
              <p className="text-slate-800 font-medium">#{appointment.queue_number}</p>
            </div>
          )}
          {appointment.queue_status && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Queue Status</p>
              <p className="text-slate-800 font-medium">{appointment.queue_status.replace('_', ' ')}</p>
            </div>
          )}
          {appointment.practice_name && (
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500 mb-1">Location</p>
              <p className="text-slate-800 font-medium">{appointment.practice_name}</p>
            </div>
          )}
          {appointment.reason_for_visit && (
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500 mb-1">Reason for Visit</p>
              <p className="text-slate-800 font-medium whitespace-pre-wrap">{appointment.reason_for_visit}</p>
            </div>
          )}
        </div>
      </div>

      {/* Prescription History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">medical_services</span>
            Prescription History
          </h2>
        </div>
        <div className="p-6">
          {prescriptionsError ? (
            <div className="p-4 bg-red-50 rounded-lg text-red-600 text-sm">
              {prescriptionsError}
            </div>
          ) : prescriptions.length === 0 ? (
            <p className="text-slate-500 text-sm">No prescriptions found for this patient</p>
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
