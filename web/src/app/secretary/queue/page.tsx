'use client';

import { useState, useEffect } from 'react';
import { secretaryApi, QueueEntry, SecretaryProfile } from '@/lib/api/secretaryApi';
import Toast from '@/components/ui/Toast';
import PaymentModal from '@/components/PaymentModal';



type TabType = 'all' | 'waiting' | 'in-consultation' | 'completed' | 'skipped';

const QUEUE_STATUS_COLORS: Record<string, string> = {
  WAITING: 'bg-blue-50 text-blue-700 border-blue-200',
  CALLED: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_CHECKUP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-slate-50 text-slate-600 border-slate-200',
  NOT_PRESENT: 'bg-red-50 text-red-700 border-red-200',
  SKIPPED: 'bg-orange-50 text-orange-700 border-orange-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
  NO_SHOW: 'bg-slate-50 text-slate-600 border-slate-200',
};

const QUEUE_STATUS_LABELS: Record<string, string> = {
  WAITING: 'Waiting',
  CALLED: 'Called',
  IN_CHECKUP: 'In Checkup',
  COMPLETED: 'Completed',
  NOT_PRESENT: 'Not Present',
  SKIPPED: 'Skipped',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

export default function SecretaryQueue() {
  const [secretary, setSecretary] = useState<SecretaryProfile | null>(null);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Get current date in Asia/Manila timezone (same as backend getClinicDate)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  });
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ONLINE' | 'WALK_IN'>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<{
    appointmentId: string;
    consultationFee: number;
    patientName: string;
    initialPaymentMethod?: 'CASH' | 'GCASH';
    isWalkIn: boolean;
  } | null>(null);
  const [paidAppointmentIds, setPaidAppointmentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSecretaryProfile();
  }, []);

  useEffect(() => {
    if (secretary) {
      fetchQueue();
    }
  }, [secretary, selectedDate]);

  const fetchSecretaryProfile = async () => {
    setLoading(true);
    const response = await secretaryApi.getProfile();
    if (response.success && response.data) {
      setSecretary(response.data);
    } else {
      setError(response.error || 'Failed to fetch secretary profile');
    }
    setLoading(false);
  };

  const fetchQueue = async () => {
    if (!secretary) return;

    setLoading(true);
    setError(null);

    const response = await secretaryApi.getQueue(selectedDate);
    if (response.success && response.data) {
      setQueueEntries(response.data);
    } else {
      setError(response.error || 'Failed to fetch queue');
    }
    setLoading(false);
  };

  const handleCallNext = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const response = await secretaryApi.callNextPatient(selectedDate);

    if (response.success) {
      setSuccess('Next patient called successfully');
      fetchQueue();
    } else {
      setError(response.error || 'Failed to call next patient');
    }
    setActionLoading(false);
  };

  const handleStartCheckup = async (queueId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const response = await secretaryApi.startCheckup(queueId);

    if (response.success) {
      setSuccess('Checkup started successfully');
      fetchQueue();
    } else {
      setError(response.error || 'Failed to start checkup');
    }
    setActionLoading(false);
  };

  const handleCompleteCheckup = async (queueId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const response = await secretaryApi.completeCheckup(queueId);

    if (response.success) {
      // Find the queue entry to check if it's a walk-in or booked patient
      const queueEntry = queueEntries.find(entry => entry.id === queueId);

      if (queueEntry && queueEntry.appointment_id) {
        // Check if payment is already processed
        if (paidAppointmentIds.has(queueEntry.appointment_id)) {
          setSuccess('Checkup already completed and payment processed');
          fetchQueue();
          setActionLoading(false);
          return;
        }

        // Show payment modal for both walk-in and booked patients
        const consultationFee = queueEntry.consultation_fee !== null && queueEntry.consultation_fee !== undefined
          ? queueEntry.consultation_fee
          : 0;

        if (consultationFee > 0) {
          const isWalkIn = queueEntry.registration_source === 'WALK_IN';
          let initialPaymentMethod: 'CASH' | 'GCASH' | undefined;

          // For booked patients, fetch their initial payment method and balance
          if (!isWalkIn) {
            try {
              const paymentResponse = await secretaryApi.getPayment(queueEntry.appointment_id);
              if (paymentResponse.success && paymentResponse.data) {
                initialPaymentMethod = paymentResponse.data.payment_method as 'CASH' | 'GCASH';
              }
            } catch (e) {
              // If payment fetch fails, default to no initial payment method
              console.error('Failed to fetch payment for booked patient:', e);
            }
          }

          setPaymentModalData({
            appointmentId: queueEntry.appointment_id,
            consultationFee: consultationFee,
            patientName: `${queueEntry.patient_first_name} ${queueEntry.patient_last_name}`,
            initialPaymentMethod,
            isWalkIn,
          });
          setShowPaymentModal(true);
        } else {
          // Consultation fee not configured - show error
          setError('Cannot record payment: Doctor consultation fee is not configured. Please contact administrator.');
          fetchQueue();
        }
      } else {
        // If data is missing, show success message
        setSuccess('Checkup completed successfully');
        fetchQueue();
      }
    } else {
      setError(response.error || 'Failed to complete checkup');
    }
    setActionLoading(false);
  };

  const handlePaymentSuccess = () => {
    setSuccess('Payment recorded successfully');
    // Add the appointment ID to the paid set to prevent reopening payment modal
    if (paymentModalData) {
      setPaidAppointmentIds(prev => new Set(prev).add(paymentModalData.appointmentId));
    }
    // Also mark the queue entry as completed since payment is done
    fetchQueue();
  };

  const handleSkip = async (queueId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const response = await secretaryApi.skipPatient(queueId);

    if (response.success) {
      setSuccess('Patient skipped successfully');
      fetchQueue();
    } else {
      setError(response.error || 'Failed to skip patient');
    }
    setActionLoading(false);
  };

  const handleNotPresent = async (queueId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const response = await secretaryApi.markNotPresent(queueId);

    if (response.success) {
      setSuccess('Patient marked as not present');
      fetchQueue();
    } else {
      setError(response.error || 'Failed to mark patient as not present');
    }
    setActionLoading(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Select date';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isToday = (dateString: string) => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = formatter.format(now);
    return dateString === today;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const DatePicker = () => {
    const currentDate = selectedDate ? (() => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      return new Date(year, month - 1, day);
    })() : new Date();
    const [viewMonth, setViewMonth] = useState(currentDate.getMonth());
    const [viewYear, setViewYear] = useState(currentDate.getFullYear());

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const handleDateClick = (day: number) => {
      const formattedDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setSelectedDate(formattedDate);
      setShowDatePicker(false);
    };

    const previousMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(viewYear - 1);
      } else {
        setViewMonth(viewMonth - 1);
      }
    };

    const nextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(viewYear + 1);
      } else {
        setViewMonth(viewMonth + 1);
      }
    };

    return (
      <div className="dropdown-container relative">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700"
        >
          <span className="material-symbols-outlined text-[18px] text-slate-500">calendar_today</span>
          <span>{formatDate(selectedDate)}</span>
          <span className="material-symbols-outlined text-[18px] text-slate-400">expand_more</span>
        </button>

        {showDatePicker && (
          <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4 z-50 w-72">
            <div className="flex items-center justify-between mb-4">
              <button onClick={previousMonth} className="p-1 hover:bg-slate-100 rounded">
                <span className="material-symbols-outlined text-[20px] text-slate-600">chevron_left</span>
              </button>
              <span className="font-semibold text-slate-900">{monthNames[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded">
                <span className="material-symbols-outlined text-[20px] text-slate-600">chevron_right</span>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="font-medium text-slate-500 py-1">{day}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="py-1"></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const formattedDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = formattedDate === selectedDate;
                return (
                  <button
                    key={day}
                    onClick={() => handleDateClick(day)}
                    className={`py-1 rounded hover:bg-slate-100 transition-colors ${
                      isSelected ? 'bg-purple-600 text-white hover:bg-purple-700' : 'text-slate-700'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Calculate metrics
  const totalQueue = queueEntries.length;
  const waitingInLobby = queueEntries.filter(e => e.status === 'WAITING' || e.status === 'CALLED').length;
  const inConsultation = queueEntries.filter(e => e.status === 'IN_CHECKUP').length;
  const completed = queueEntries.filter(e => e.status === 'COMPLETED').length;
  const skippedNoShow = queueEntries.filter(e => e.status === 'SKIPPED' || e.status === 'NO_SHOW' || e.status === 'NOT_PRESENT').length;

  // Filter queue entries based on tab and search
  const filteredEntries = queueEntries.filter(entry => {
    // Tab filter
    let statusMatch = true;
    switch (activeTab) {
      case 'waiting':
        statusMatch = entry.status === 'WAITING' || entry.status === 'CALLED';
        break;
      case 'in-consultation':
        statusMatch = entry.status === 'IN_CHECKUP';
        break;
      case 'completed':
        statusMatch = entry.status === 'COMPLETED';
        break;
      case 'skipped':
        statusMatch = entry.status === 'SKIPPED' || entry.status === 'NO_SHOW' || entry.status === 'NOT_PRESENT';
        break;
      case 'all':
      default:
        statusMatch = true;
    }

    // Source filter
    const sourceMatch = sourceFilter === 'all' || entry.registration_source === sourceFilter;

    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const searchMatch = !searchQuery || 
      entry.patient_first_name.toLowerCase().includes(searchLower) ||
      entry.patient_last_name.toLowerCase().includes(searchLower) ||
      entry.queue_number.toString().includes(searchLower);

    return statusMatch && sourceMatch && searchMatch;
  });

  if (loading && !secretary) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Daily Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage the daily patient queue and call patients</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="text-slate-600 mt-3">Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start">
        <DatePicker />
        <div className="flex gap-3">
          <button
            onClick={handleCallNext}
            disabled={actionLoading || waitingInLobby === 0 || !isToday(selectedDate)}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
          >
            <span className="material-symbols-outlined text-[18px]">notifications_active</span>
            Call Next Patient
          </button>
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] text-slate-500">refresh</span>
            Refresh List
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isToday(selectedDate) ? 'Total Queue Today' : 'Total Queue'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">groups</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{totalQueue}</span>
            <span className="text-xs text-slate-400">Patients</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Waiting in Lobby</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">event_seat</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{waitingInLobby}</span>
            <span className="text-xs text-slate-400">Patients</span>
          </div>
          {waitingInLobby > 0 && (
            <div className="mt-2 text-xs text-blue-600 font-medium">
              {queueEntries.find(e => e.status === 'WAITING')?.queue_number} Next in Line
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">In Consultation</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">medical_services</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{inConsultation}</span>
            <span className="text-xs text-slate-400">Patient</span>
          </div>
          {inConsultation > 0 && (
            <div className="mt-2 text-xs text-emerald-600 font-medium">
              {secretary?.room_number || 'Room 101'} • Dr. {secretary?.doctor_first_name} {secretary?.doctor_last_name}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed Checkups</span>
            <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{completed}</span>
            <span className="text-xs text-slate-400">Completed</span>
          </div>
        </div>
      </div>

      {/* Status Filter Bar and Search - Combined */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Status Filter Tabs */}
        <nav className="flex overflow-x-auto gap-1 p-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({totalQueue})
          </button>
          <button
            onClick={() => setActiveTab('waiting')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'waiting'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Waiting in Lobby ({waitingInLobby})
          </button>
          <button
            onClick={() => setActiveTab('in-consultation')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'in-consultation'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            In Consultation ({inConsultation})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'completed'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Completed ({completed})
          </button>
          <button
            onClick={() => setActiveTab('skipped')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'skipped'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Skipped / No-Show ({skippedNoShow})
          </button>
        </nav>

        {/* Search and Filters */}
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
              <input
                type="text"
                placeholder="Search by patient name, Queue #, MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8] focus:border-transparent"
              />
            </div>
            <select
              value={secretary?.doctor_id || ''}
              disabled
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8] focus:border-transparent bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
            >
              <option value="">Doctor: Dr. {secretary?.doctor_first_name} {secretary?.doctor_last_name}</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'ONLINE' | 'WALK_IN')}
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8] focus:border-transparent bg-white"
            >
              <option value="all">Source: All Sources</option>
              <option value="ONLINE">Source: Online</option>
              <option value="WALK_IN">Source: Walk-in</option>
            </select>
          </div>
        </div>
      </div>

      {/* Queue Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {!isToday(selectedDate) && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-700 text-sm">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span className="font-medium">View Only Mode</span>
              <span>•</span>
              <span>Actions are disabled for past and future dates</span>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="text-slate-600 mt-3">Loading queue...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-slate-300">hourglass_empty</span>
            <p className="text-slate-600 mt-3">No patients in queue for this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Queue #</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Patient</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Queue Status</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEntries.map((entry) => {
                  const getTimeAgo = (timestamp: string | null | undefined) => {
                    if (!timestamp) return '';
                    const now = new Date();
                    const past = new Date(timestamp);
                    const diffMs = now.getTime() - past.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    return diffMins > 0 ? `(${diffMins}m)` : '';
                  };

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#1b5eb8] text-white font-bold text-sm">
                          Q-{String(entry.queue_number).padStart(2, '0')}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                            {entry.patient_first_name[0]}{entry.patient_last_name[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {entry.patient_first_name} {entry.patient_last_name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {entry.patient_email || 'No email'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                          entry.registration_source === 'ONLINE'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {entry.registration_source === 'ONLINE' ? 'Online' : 'Walk-in'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                          entry.status === 'IN_CHECKUP' ? 'bg-emerald-50 text-emerald-700' :
                          entry.status === 'CALLED' ? 'bg-amber-50 text-amber-700' :
                          entry.status === 'WAITING' ? 'bg-blue-50 text-blue-700' :
                          entry.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {QUEUE_STATUS_LABELS[entry.status] || entry.status} {getTimeAgo(entry.called_at)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.status === 'IN_CHECKUP' && (
                            <button
                              onClick={() => handleCompleteCheckup(entry.id)}
                              disabled={actionLoading || !isToday(selectedDate) || (entry.appointment_id && paidAppointmentIds.has(entry.appointment_id))}
                              className="px-3 py-1.5 bg-[#1b5eb8] text-white rounded-lg hover:bg-[#1550a0] disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                              title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : (entry.appointment_id && paidAppointmentIds.has(entry.appointment_id)) ? 'Payment already processed' : ''}
                            >
                              Complete Checkup
                            </button>
                          )}
                          {entry.status === 'CALLED' && (
                            <>
                              <button
                                onClick={() => handleStartCheckup(entry.id)}
                                disabled={actionLoading || !isToday(selectedDate)}
                                className="px-3 py-1.5 bg-[#1b5eb8] text-white rounded-lg hover:bg-[#1550a0] disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                                title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                              >
                                Start Checkup
                              </button>
                              <button
                                onClick={() => handleNotPresent(entry.id)}
                                disabled={actionLoading || !isToday(selectedDate)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                                title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                              >
                                Skip / Not Present
                              </button>
                            </>
                          )}
                          {entry.status === 'WAITING' && (
                            <>
                              <button
                                onClick={() => handleCallNext()}
                                disabled={actionLoading || !isToday(selectedDate)}
                                className="px-3 py-1.5 bg-[#1b5eb8] text-white rounded-lg hover:bg-[#1550a0] disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                                title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                              >
                                Call Next Patient
                              </button>
                              <button
                                onClick={() => handleSkip(entry.id)}
                                disabled={actionLoading || !isToday(selectedDate)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                                title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                              >
                                Skip / Not Present
                              </button>
                            </>
                          )}
                          {entry.status === 'SKIPPED' && (
                            <button
                              onClick={() => handleStartCheckup(entry.id)}
                              disabled={actionLoading || !isToday(selectedDate)}
                              className="px-3 py-1.5 bg-[#1b5eb8] text-white rounded-lg hover:bg-[#1550a0] disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                              title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                            >
                              Start Checkup
                            </button>
                          )}
                          <button
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                          >
                            View Patient
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">FiDo Clinical Platform</span>
            <span>•</span>
            <span>Secretary Terminal 01A</span>
            <span>•</span>
            <span>Desk A</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auto-sync active</span>
            <span>•</span>
            <span>{secretary?.practice_name || 'Central Medical Clinic'}</span>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {error && (
        <Toast
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}
      {success && (
        <Toast
          type="success"
          message={success}
          onClose={() => setSuccess(null)}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentModalData && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          appointmentId={paymentModalData.appointmentId}
          consultationFee={paymentModalData.consultationFee}
          patientName={paymentModalData.patientName}
          initialPaymentMethod={paymentModalData.initialPaymentMethod}
          isWalkIn={paymentModalData.isWalkIn}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}