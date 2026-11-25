'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import { usePresence } from '@/hooks/usePresence';
import { usePersistedState, buildPersistedStateKey } from '@/hooks/usePersistedState';

interface Appointment {
  id: string;
  patient_first_name: string;
  patient_last_name: string;
  appointment_date: string;
  status: string;
  reason_for_visit?: string;
  queue_number?: number;
  queue_status?: string;
  practice_name?: string;
  needs_attention?: boolean;
}

export default function SecretaryAppointments() {
  const [userId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('secretary_user') || localStorage.getItem('user');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.id ?? null;
    } catch {
      return null;
    }
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter, statusFilterReady] = usePersistedState<string>(
    buildPersistedStateKey({ role: 'secretary', route: '/secretary/appointments', userId, field: 'statusFilter' }),
    'ALL',
    (v): v is string => v === 'ALL' || v === 'SCHEDULED' || v === 'IN_PROGRESS' || v === 'COMPLETED' || v === 'CANCELLED'
  );
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const showDetailModal = selectedAppointment !== null;
  const detailModalPresent = usePresence(showDetailModal);

  useEffect(() => {
    if (statusFilterReady) {
      fetchAppointments();
    }
  }, [statusFilter, statusFilterReady]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = statusFilter === 'ALL' 
        ? '/appointments' 
        : `/appointments?status=${statusFilter}`;
      
      const response = await apiClient.get<Appointment[]>(endpoint);

      if (response.success && response.data) {
        setAppointments(response.data);
      } else {
        setError(response.error || 'Failed to fetch appointments');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

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
      case 'IN_PROGRESS':
        return 'bg-warning-100 text-warning-800';
      case 'NO_SHOW':
        return 'bg-neutral-100 text-neutral-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    if (statusFilter === 'ALL') return true;
    return appointment.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 font-medium">Total</p>
              <p className="text-2xl font-bold text-neutral-800">{appointments.length}</p>
            </div>
            <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-600 text-2xl">calendar_month</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 font-medium">Scheduled</p>
              <p className="text-2xl font-bold text-success-600">
                {appointments.filter(a => a.status === 'SCHEDULED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-success-50 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-success-600 text-2xl">event_available</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 font-medium">Completed</p>
              <p className="text-2xl font-bold text-primary-600">
                {appointments.filter(a => a.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-600 text-2xl">check_circle</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 font-medium">Cancelled</p>
              <p className="text-2xl font-bold text-error-600">
                {appointments.filter(a => a.status === 'CANCELLED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-error-50 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-error-600 text-2xl">cancel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-md border border-neutral-100">
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
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-warning-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            In Progress
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
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
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
        ) : filteredAppointments.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-neutral-300">event_busy</span>
            <p className="mt-4 text-neutral-600">No appointments found</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="p-6 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status.replace('_', ' ')}
                      </span>
                      {appointment.needs_attention && appointment.status !== 'CANCELLED' && appointment.status !== 'COMPLETED' && appointment.status !== 'NO_SHOW' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-warning-100 text-warning-800 border border-warning-200" title="The clinic changed the doctor's schedule. The clinic will contact this patient.">
                          <span className="material-symbols-outlined text-[16px]">warning</span>
                          Needs attention
                        </span>
                      )}
                      {appointment.queue_number && (
                        <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">
                          Queue #{appointment.queue_number}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-neutral-800">
                      {appointment.patient_first_name} {appointment.patient_last_name}
                    </h3>
                    
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <span className="material-symbols-outlined text-lg">calendar_today</span>
                        <span>{formatDate(appointment.appointment_date)}</span>
                        <span className="text-neutral-400">•</span>
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
                  
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => setSelectedAppointment(appointment)}
                      className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      aria-label="View appointment details"
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

      {/* Appointment Details Modal */}
      {detailModalPresent && selectedAppointment && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={showDetailModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            data-state={showDetailModal ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">Appointment Details</h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    {selectedAppointment.patient_first_name} {selectedAppointment.patient_last_name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Date</p>
                  <p className="text-sm font-medium text-neutral-900 mt-1">
                    {formatDate(selectedAppointment.appointment_date)}
                  </p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Time</p>
                  <p className="text-sm font-medium text-neutral-900 mt-1">
                    {formatTime(selectedAppointment.appointment_date)}
                  </p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</p>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedAppointment.status)}`}
                  >
                    {selectedAppointment.status.replace('_', ' ')}
                  </span>
                </div>
                {selectedAppointment.queue_number && (
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Queue</p>
                    <p className="text-sm font-medium text-neutral-900 mt-1">
                      #{selectedAppointment.queue_number}
                    </p>
                  </div>
                )}
              </div>
              {selectedAppointment.reason_for_visit && (
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Reason for Visit
                  </p>
                  <p className="text-sm text-neutral-700 mt-1">{selectedAppointment.reason_for_visit}</p>
                </div>
              )}
              {selectedAppointment.practice_name && (
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Practice
                  </p>
                  <p className="text-sm text-neutral-700 mt-1">{selectedAppointment.practice_name}</p>
                </div>
              )}
              {selectedAppointment.needs_attention && selectedAppointment.status !== 'CANCELLED' && selectedAppointment.status !== 'COMPLETED' && selectedAppointment.status !== 'NO_SHOW' && (
                <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-warning-800 uppercase tracking-wide mb-1">
                    Needs Attention
                  </p>
                  <p className="text-sm text-warning-700">
                    The clinic changed the doctor's schedule. The clinic will contact this patient.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <button
                onClick={() => setSelectedAppointment(null)}
                className="w-full px-5 py-2.5 text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
