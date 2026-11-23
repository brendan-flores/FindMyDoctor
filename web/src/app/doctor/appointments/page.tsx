'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import Select from '@/components/ui/Select';

interface Appointment {
  id: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_id?: string;
  appointment_date: string;
  status: string;
  reason_for_visit?: string;
  queue_number?: number;
  queue_status?: string;
  practice_name?: string;
  registration_source?: string;
  visit_id?: string | null;
  visit_status?: 'DRAFT' | 'ISSUED' | null;
  doctor_finished_at?: string | null;
}

export default function DoctorAppointments() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('TODAY');

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter, dateFilter]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = '/appointments';

      const response = await apiClient.get<Appointment[]>(endpoint);

      if (response.success && response.data) {
        setAllAppointments(response.data);
      } else {
        setError(response.error || 'Failed to fetch appointments');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = [...allAppointments];

    // Filter by status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(appointment => appointment.status === statusFilter);
    }

    // Filter by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    switch (dateFilter) {
      case 'TODAY':
        filtered = filtered.filter(appointment => {
          const appointmentDate = new Date(appointment.appointment_date);
          return appointmentDate >= today && appointmentDate <= endOfToday;
        });
        break;
      case 'THIS_WEEK':
        filtered = filtered.filter(appointment => {
          const appointmentDate = new Date(appointment.appointment_date);
          return appointmentDate >= startOfWeek && appointmentDate <= endOfWeek;
        });
        break;
      case 'THIS_MONTH':
        filtered = filtered.filter(appointment => {
          const appointmentDate = new Date(appointment.appointment_date);
          return appointmentDate >= startOfMonth && appointmentDate <= endOfMonth;
        });
        break;
      case 'ALL_TIME':
        // No date filtering
        break;
    }

    setAppointments(filtered);
  };

  useEffect(() => {
    filterAppointments();
  }, [allAppointments, statusFilter, dateFilter]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-success-100 text-success-800';
      case 'COMPLETED':
        return 'bg-primary-100 text-primary-800';
      case 'CANCELLED':
        return 'bg-error-100 text-error-800';
      case 'NO_SHOW':
        return 'bg-neutral-100 text-neutral-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const openConsultation = (appointment: Appointment) => {
    router.push(`/doctor/appointments/${appointment.id}`);
  };

  const consultationAction = (appointment: Appointment): { label: string; highlight: boolean } => {
    if (appointment.queue_status === 'IN_CHECKUP') {
      if (appointment.doctor_finished_at) return { label: 'View consultation', highlight: false };
      if (appointment.visit_status === 'DRAFT') return { label: 'Continue consultation', highlight: true };
      return { label: 'Start consultation', highlight: true };
    }
    if (appointment.status === 'COMPLETED' || appointment.visit_id) {
      return { label: 'View consultation', highlight: false };
    }
    return { label: 'View details', highlight: false };
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 font-medium">Total</p>
              <p className="text-2xl font-bold text-neutral-800">{appointments.length}</p>
            </div>
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-600 text-2xl">calendar_month</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 font-medium">Scheduled</p>
              <p className="text-2xl font-bold text-success-600">
                {appointments.filter(a => a.status === 'SCHEDULED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-success-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-success-600 text-2xl">event_available</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 font-medium">Completed</p>
              <p className="text-2xl font-bold text-primary-600">
                {appointments.filter(a => a.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-600 text-2xl">check_circle</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 font-medium">Cancelled</p>
              <p className="text-2xl font-bold text-error-600">
                {appointments.filter(a => a.status === 'CANCELLED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-error-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-error-600 text-2xl">cancel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Date:</span>
            <Select
              className="w-36"
              triggerClassName="px-3 py-2 text-sm"
              value={dateFilter}
              onChange={setDateFilter}
              options={[
                { value: 'TODAY', label: 'Today' },
                { value: 'THIS_WEEK', label: 'This Week' },
                { value: 'THIS_MONTH', label: 'This Month' },
                { value: 'ALL_TIME', label: 'All Time' },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('SCHEDULED')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'SCHEDULED'
                  ? 'bg-success-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'COMPLETED'
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'CANCELLED'
                  ? 'bg-error-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Cancelled
            </button>
            <button
              onClick={() => setStatusFilter('NO_SHOW')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'NO_SHOW'
                  ? 'bg-neutral-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              No Show
            </button>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-neutral-600">Loading appointments...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-error-600">{error}</p>
            <button
              onClick={fetchAppointments}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Retry
            </button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-neutral-300">event_busy</span>
            <p className="mt-4 text-neutral-600">No appointments found</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {appointments.map((appointment) => {
              const action = consultationAction(appointment);
              return (
                <div key={appointment.id} className="p-6 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        {(statusFilter === 'ALL' || statusFilter !== appointment.status) && (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(appointment.status)}`}>
                            {appointment.status.replace('_', ' ')}
                          </span>
                        )}
                        {appointment.queue_number && (
                          <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">
                            Queue #{appointment.queue_number}
                          </span>
                        )}
                        {appointment.queue_status && (
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              appointment.queue_status === 'IN_CHECKUP'
                                ? 'bg-primary-100 text-primary-800'
                                : appointment.queue_status === 'CALLED'
                                ? 'bg-primary-100 text-primary-800'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {appointment.queue_status.replace('_', ' ')}
                          </span>
                        )}
                        {appointment.doctor_finished_at && (
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-success-800">
                            Doctor finished
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                        {appointment.patient_first_name} {appointment.patient_last_name}
                      </h3>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-neutral-600">
                          <span className="material-symbols-outlined text-lg">calendar_today</span>
                          <span>{formatDate(appointment.appointment_date)}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-neutral-600">
                          <span className="material-symbols-outlined text-lg">schedule</span>
                          <span>{formatTime(appointment.appointment_date)}</span>
                        </div>

                        {appointment.reason_for_visit && (
                          <div className="flex items-center gap-2 text-sm text-neutral-600">
                            <span className="material-symbols-outlined text-lg">description</span>
                            <span>{appointment.reason_for_visit}</span>
                          </div>
                        )}

                        {appointment.practice_name && (
                          <div className="flex items-center gap-2 text-sm text-neutral-600">
                            <span className="material-symbols-outlined text-lg">location_on</span>
                            <span>{appointment.practice_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => openConsultation(appointment)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          action.highlight
                            ? 'bg-primary-600 text-white hover:bg-primary-700'
                            : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {action.label}
                      </button>
                      <button
                        onClick={() => openConsultation(appointment)}
                        className="text-sm text-neutral-500 hover:text-primary-600 font-medium"
                      >
                        View details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
