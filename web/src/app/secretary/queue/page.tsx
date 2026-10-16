'use client';

import { useEffect, useState } from 'react';
import { secretaryApi, QueueEntry, SecretaryProfile } from '@/lib/api/secretaryApi';

export default function SecretaryQueue() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Get current date in Asia/Manila timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  });
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [secretaryProfile, setSecretaryProfile] = useState<SecretaryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchSecretaryProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (secretaryProfile) {
      fetchQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, secretaryProfile]);

  const fetchSecretaryProfile = async () => {
    try {
      const response = await secretaryApi.getProfile();
      if (response.success && response.data) {
        setSecretaryProfile(response.data);
      } else {
        setError(response.error || 'Failed to fetch secretary profile');
      }
    } catch (err) {
      setError('Network error occurred');
    }
  };

  const fetchQueue = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await secretaryApi.getQueue(selectedDate);

      if (response.success && response.data) {
        setQueueEntries(response.data);
      } else {
        setError(response.error || 'Failed to fetch queue');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallNext = async () => {
    setActionLoading('call-next');
    setError(null);

    try {
      const response = await secretaryApi.callNextPatient(selectedDate);

      if (response.success && response.data) {
        // Refresh queue to reflect the status change
        await fetchQueue();
      } else {
        setError(response.error || 'Failed to call next patient');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (queueId: string, newStatus: string) => {
    setActionLoading(queueId);
    setError(null);

    try {
      const response = await secretaryApi.updateQueueStatus(queueId, newStatus);

      if (response.success) {
        // Refresh queue to reflect the status change
        await fetchQueue();
      } else {
        setError(response.error || 'Failed to update queue status');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartCheckup = async (queueId: string) => {
    setActionLoading(queueId);
    setError(null);

    try {
      const response = await secretaryApi.startCheckup(queueId);

      if (response.success) {
        await fetchQueue();
      } else {
        setError(response.error || 'Failed to start checkup');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteCheckup = async (queueId: string) => {
    setActionLoading(queueId);
    setError(null);

    try {
      const response = await secretaryApi.completeCheckup(queueId);

      if (response.success) {
        await fetchQueue();
      } else {
        setError(response.error || 'Failed to complete checkup');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkipPatient = async (queueId: string) => {
    setActionLoading(queueId);
    setError(null);

    try {
      const response = await secretaryApi.skipPatient(queueId);

      if (response.success) {
        await fetchQueue();
      } else {
        setError(response.error || 'Failed to skip patient');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkNotPresent = async (queueId: string) => {
    setActionLoading(queueId);
    setError(null);

    try {
      const response = await secretaryApi.markNotPresent(queueId);

      if (response.success) {
        await fetchQueue();
      } else {
        setError(response.error || 'Failed to mark patient as not present');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'bg-blue-100 text-blue-800';
      case 'CALLED':
        return 'bg-amber-100 text-amber-800';
      case 'IN_CHECKUP':
        return 'bg-emerald-100 text-emerald-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'SKIPPED':
        return 'bg-slate-100 text-slate-800';
      case 'NOT_PRESENT':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      case 'NO_SHOW':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'Waiting';
      case 'CALLED':
        return 'Called';
      case 'IN_CHECKUP':
        return 'In Checkup';
      case 'COMPLETED':
        return 'Completed';
      case 'SKIPPED':
        return 'Skipped';
      case 'NOT_PRESENT':
        return 'Not Present';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No Show';
      default:
        return status;
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

  const getWaitingCount = () => {
    return queueEntries.filter(entry => entry.status === 'WAITING').length;
  };

  const getCompletedCount = () => {
    return queueEntries.filter(entry => entry.status === 'COMPLETED').length;
  };

  const getNextPatient = () => {
    return queueEntries.find(entry => entry.status === 'WAITING');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Daily Queue</h1>
        <p className="text-emerald-100 mt-1">Manage the daily patient queue and call patients</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Patients</p>
              <p className="text-2xl font-bold text-slate-800">{queueEntries.length}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">people</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Waiting</p>
              <p className="text-2xl font-bold text-blue-600">{getWaitingCount()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-2xl">schedule</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Completed</p>
              <p className="text-2xl font-bold text-green-600">{getCompletedCount()}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600 text-2xl">check_circle</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Doctor</p>
              <p className="text-sm font-bold text-slate-800 truncate">
                {secretaryProfile ? `Dr. ${secretaryProfile.doctor_first_name} ${secretaryProfile.doctor_last_name}` : 'Loading...'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-600 text-2xl">medical_services</span>
            </div>
          </div>
        </div>
      </div>

      {/* Date Selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-600 font-medium">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-sm text-slate-500">{formatDate(selectedDate)}</span>
        </div>
      </div>

      {/* Call Next Patient Button */}
      {getNextPatient() && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <button
            onClick={handleCallNext}
            disabled={actionLoading === 'call-next'}
            className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">next_plan</span>
            {actionLoading === 'call-next' ? 'Calling...' : 'Call Next Patient'}
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Queue List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            <p className="mt-4 text-slate-600">Loading queue...</p>
          </div>
        ) : queueEntries.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300">list_alt</span>
            <p className="mt-4 text-slate-600">No patients in queue for this date</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {queueEntries.map((entry) => (
              <div key={entry.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold text-emerald-600">#{entry.queue_number}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                        {getStatusLabel(entry.status)}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {entry.registration_source}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-slate-800">
                      {entry.patient_first_name} {entry.patient_last_name}
                    </h3>

                    <div className="mt-2 space-y-1">
                      {entry.patient_email && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-lg">email</span>
                          <span>{entry.patient_email}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="material-symbols-outlined text-lg">medical_services</span>
                        <span>Dr. {entry.doctor_first_name} {entry.doctor_last_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    {entry.status === 'WAITING' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(entry.id, 'CALLED')}
                          disabled={actionLoading === entry.id}
                          className="px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-lg">notifications_active</span>
                          Call
                        </button>
                        <button
                          onClick={() => handleMarkNotPresent(entry.id)}
                          disabled={actionLoading === entry.id}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-lg">person_cancel</span>
                          Not Present
                        </button>
                      </>
                    )}

                    {entry.status === 'CALLED' && (
                      <>
                        <button
                          onClick={() => handleStartCheckup(entry.id)}
                          disabled={actionLoading === entry.id}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-lg">play_arrow</span>
                          Start Checkup
                        </button>
                        <button
                          onClick={() => handleSkipPatient(entry.id)}
                          disabled={actionLoading === entry.id}
                          className="px-3 py-1.5 bg-slate-500 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-lg">skip_next</span>
                          Skip
                        </button>
                      </>
                    )}

                    {entry.status === 'IN_CHECKUP' && (
                      <button
                        onClick={() => handleCompleteCheckup(entry.id)}
                        disabled={actionLoading === entry.id}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        Complete
                      </button>
                    )}

                    {entry.status === 'SKIPPED' && (
                      <button
                        onClick={() => handleUpdateStatus(entry.id, 'WAITING')}
                        disabled={actionLoading === entry.id}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-lg">replay</span>
                        Re-queue
                      </button>
                    )}

                    {entry.status === 'NOT_PRESENT' && (
                      <button
                        onClick={() => handleUpdateStatus(entry.id, 'WAITING')}
                        disabled={actionLoading === entry.id}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-lg">replay</span>
                        Re-queue
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