'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi, Visit } from '@/lib/api/doctorApi';

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
}

export default function DoctorAppointments() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('TODAY');
  const [showRecordVisitModal, setShowRecordVisitModal] = useState(false);
  const [showViewVisitModal, setShowViewVisitModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [isLoadingVisit, setIsLoadingVisit] = useState(false);

  const [visitFormData, setVisitFormData] = useState({
    reasonForVisit: '',
    diagnosis: '',
    notes: '',
    bloodPressure: '',
    weight: '',
    height: '',
    temperature: '',
  });

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
        return 'bg-emerald-100 text-emerald-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'NO_SHOW':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case 'TODAY':
        return 'Today';
      case 'THIS_WEEK':
        return 'This Week';
      case 'THIS_MONTH':
        return 'This Month';
      case 'ALL_TIME':
        return 'All Time';
      default:
        return 'Today';
    }
  };

  const handleRecordVisit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setVisitFormData({
      reasonForVisit: '',
      diagnosis: '',
      notes: '',
      bloodPressure: '',
      weight: '',
      height: '',
      temperature: '',
    });
    setShowRecordVisitModal(true);
    setRecordError(null);
  };

  const handleViewVisit = async (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsLoadingVisit(true);
    setShowViewVisitModal(true);

    try {
      // Fetch visit record for this appointment
      const response = await apiClient.get<Visit>(`/visits/appointment/${appointment.id}`);
      if (response.success && response.data) {
        setSelectedVisit(response.data);
      } else {
        setSelectedVisit(null);
      }
    } catch (err) {
      console.error('Error fetching visit:', err);
      setSelectedVisit(null);
    } finally {
      setIsLoadingVisit(false);
    }
  };

  const handleSaveVisit = async () => {
    if (!selectedAppointment) return;

    setIsRecording(true);
    setRecordError(null);

    try {
      const response = await doctorApi.recordVisit({
        appointmentId: selectedAppointment.id,
        reasonForVisit: visitFormData.reasonForVisit || undefined,
        diagnosis: visitFormData.diagnosis || undefined,
        notes: visitFormData.notes || undefined,
        bloodPressure: visitFormData.bloodPressure || undefined,
        weight: visitFormData.weight ? parseFloat(visitFormData.weight) : undefined,
        height: visitFormData.height ? parseFloat(visitFormData.height) : undefined,
        temperature: visitFormData.temperature ? parseFloat(visitFormData.temperature) : undefined,
      });

      if (response.success) {
        setShowRecordVisitModal(false);
        setSelectedAppointment(null);
        setVisitFormData({
          reasonForVisit: '',
          diagnosis: '',
          notes: '',
          bloodPressure: '',
          weight: '',
          height: '',
          temperature: '',
        });
        // Refresh appointments to show updated status
        fetchAppointments();
      } else {
        setRecordError(response.error || 'Failed to record visit');
      }
    } catch (err) {
      setRecordError('Network error occurred');
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total</p>
              <p className="text-2xl font-bold text-slate-800">{appointments.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-2xl">calendar_month</span>
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="ALL_TIME">All Time</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white'
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
            <button
              onClick={() => setStatusFilter('NO_SHOW')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'NO_SHOW'
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              No Show
            </button>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-slate-600">Loading appointments...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchAppointments}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300">event_busy</span>
            <p className="mt-4 text-slate-600">No appointments found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {appointments.map((appointment) => (
              <div key={appointment.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {(statusFilter === 'ALL' || statusFilter !== appointment.status) && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(appointment.status)}`}>
                          {appointment.status.replace('_', ' ')}
                        </span>
                      )}
                      {appointment.queue_number && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                          Queue #{appointment.queue_number}
                        </span>
                      )}
                      {appointment.queue_status && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          appointment.queue_status === 'IN_CHECKUP'
                            ? 'bg-green-100 text-green-800'
                            : appointment.queue_status === 'CALLED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {appointment.queue_status.replace('_', ' ')}
                        </span>
                      )}
                      {appointment.registration_source && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          appointment.registration_source === 'WALK_IN'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {appointment.registration_source === 'WALK_IN' ? 'Walk-in' : 'Online'}
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
                    <button
                      onClick={() => router.push(`/doctor/appointments/${appointment.id}`)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    {(appointment.status === 'COMPLETED' || (appointment.status === 'SCHEDULED' && (appointment.queue_status === 'IN_CHECKUP' || appointment.queue_status === 'CALLED'))) && (
                      <button
                        onClick={() => handleRecordVisit(appointment)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Record Visit"
                      >
                        <span className="material-symbols-outlined">play_arrow</span>
                      </button>
                    )}
                    {appointment.status === 'COMPLETED' && (
                      <button
                        onClick={() => handleViewVisit(appointment)}
                        className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="View Visit"
                      >
                        <span className="material-symbols-outlined">description</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Visit Modal */}
      {showRecordVisitModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Record Visit</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedAppointment.patient_first_name} {selectedAppointment.patient_last_name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRecordVisitModal(false);
                    setSelectedAppointment(null);
                    setRecordError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {recordError && (
              <div className="p-4 bg-red-50 border border-red-200 mx-6 mt-4 rounded-lg">
                <p className="text-red-600 text-sm">{recordError}</p>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Reason for Visit</label>
                <input
                  type="text"
                  value={visitFormData.reasonForVisit}
                  onChange={(e) => setVisitFormData({ ...visitFormData, reasonForVisit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Acute respiratory infection"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={visitFormData.diagnosis}
                  onChange={(e) => setVisitFormData({ ...visitFormData, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Upper respiratory tract infection"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 mb-1">Notes</label>
                <textarea
                  value={visitFormData.notes}
                  onChange={(e) => setVisitFormData({ ...visitFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Clinical notes..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={visitFormData.bloodPressure}
                    onChange={(e) => setVisitFormData({ ...visitFormData, bloodPressure: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 120/80"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={visitFormData.weight}
                    onChange={(e) => setVisitFormData({ ...visitFormData, weight: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 70"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={visitFormData.height}
                    onChange={(e) => setVisitFormData({ ...visitFormData, height: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 170"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    value={visitFormData.temperature}
                    onChange={(e) => setVisitFormData({ ...visitFormData, temperature: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 37.5"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRecordVisitModal(false);
                  setSelectedAppointment(null);
                  setRecordError(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                disabled={isRecording}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVisit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isRecording}
              >
                {isRecording ? 'Saving...' : 'Save Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Visit Modal */}
      {showViewVisitModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Visit Record</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedAppointment.patient_first_name} {selectedAppointment.patient_last_name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowViewVisitModal(false);
                    setSelectedAppointment(null);
                    setSelectedVisit(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {isLoadingVisit ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-slate-600">Loading visit record...</p>
                </div>
              ) : selectedVisit ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">Visit Date</label>
                      <p className="text-slate-800 font-medium">{formatDate(selectedVisit.visit_date)}</p>
                    </div>
                    {selectedVisit.appointment_date && (
                      <div>
                        <label className="block text-sm text-slate-500 mb-1">Appointment Date</label>
                        <p className="text-slate-800 font-medium">{formatDate(selectedVisit.appointment_date)}</p>
                      </div>
                    )}
                  </div>

                  {selectedVisit.reason_for_visit && (
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">Reason for Visit</label>
                      <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{selectedVisit.reason_for_visit}</p>
                    </div>
                  )}

                  {selectedVisit.diagnosis && (
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">Diagnosis</label>
                      <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{selectedVisit.diagnosis}</p>
                    </div>
                  )}

                  {selectedVisit.notes && (
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">Notes</label>
                      <p className="text-slate-800 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">{selectedVisit.notes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedVisit.blood_pressure && (
                      <div>
                        <label className="block text-sm text-slate-500 mb-1">Blood Pressure</label>
                        <p className="text-slate-800 font-medium">{selectedVisit.blood_pressure}</p>
                      </div>
                    )}
                    {selectedVisit.weight && (
                      <div>
                        <label className="block text-sm text-slate-500 mb-1">Weight</label>
                        <p className="text-slate-800 font-medium">{selectedVisit.weight} kg</p>
                      </div>
                    )}
                    {selectedVisit.height && (
                      <div>
                        <label className="block text-sm text-slate-500 mb-1">Height</label>
                        <p className="text-slate-800 font-medium">{selectedVisit.height} cm</p>
                      </div>
                    )}
                    {selectedVisit.temperature && (
                      <div>
                        <label className="block text-sm text-slate-500 mb-1">Temperature</label>
                        <p className="text-slate-800 font-medium">{selectedVisit.temperature} °C</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-6xl text-slate-300">description</span>
                  <p className="mt-4 text-slate-600">No visit record found</p>
                  <p className="text-sm text-slate-400 mt-2">Use the Record Visit button to create one</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setShowViewVisitModal(false);
                  setSelectedAppointment(null);
                  setSelectedVisit(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
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
