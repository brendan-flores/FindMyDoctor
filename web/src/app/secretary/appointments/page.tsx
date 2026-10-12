'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';

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
}

export default function SecretaryAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter]);

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

  const filteredAppointments = appointments.filter(appointment => {
    if (statusFilter === 'ALL') return true;
    return appointment.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Appointments</h1>
        <p className="text-purple-100 mt-1">View and manage doctor's appointments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total</p>
              <p className="text-2xl font-bold text-slate-800">{appointments.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-600 text-2xl">calendar_month</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Scheduled</p>
              <p className="text-2xl font-bold text-emerald-600">
                {appointments.filter(a => a.status === 'SCHEDULED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">event_available</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Completed</p>
              <p className="text-2xl font-bold text-blue-600">
                {appointments.filter(a => a.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-2xl">check_circle</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Cancelled</p>
              <p className="text-2xl font-bold text-red-600">
                {appointments.filter(a => a.status === 'CANCELLED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-red-600 text-2xl">cancel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('SCHEDULED')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'SCHEDULED'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            In Progress
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'COMPLETED'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter('CANCELLED')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'CANCELLED'
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Cancelled
          </button>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-slate-600">Loading appointments...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchAppointments}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300">event_busy</span>
            <p className="mt-4 text-slate-600">No appointments found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status.replace('_', ' ')}
                      </span>
                      {appointment.queue_number && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                          Queue #{appointment.queue_number}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-slate-800">
                      {appointment.patient_first_name} {appointment.patient_last_name}
                    </h3>
                    
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="material-symbols-outlined text-lg">calendar_today</span>
                        <span>{formatDate(appointment.appointment_date)}</span>
                        <span className="text-slate-400">•</span>
                        <span>{formatTime(appointment.appointment_date)}</span>
                      </div>
                      
                      {appointment.reason_for_visit && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-lg">description</span>
                          <span>{appointment.reason_for_visit}</span>
                        </div>
                      )}
                      
                      {appointment.practice_name && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-lg">location_on</span>
                          <span>{appointment.practice_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex gap-2">
                    <button className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    {appointment.status === 'SCHEDULED' && (
                      <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">play_arrow</span>
                      </button>
                    )}
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
