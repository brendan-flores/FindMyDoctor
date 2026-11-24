'use client';

import { useState, useEffect } from 'react';
import { secretaryApi, QueueEntry, SecretaryProfile } from '@/lib/api/secretaryApi';
import Toast from '@/components/ui/Toast';
import BillingPanel from '@/components/BillingPanel';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/DatePicker';



type TabType = 'all' | 'waiting' | 'in-consultation' | 'completed' | 'skipped' | 'to-collect';

const QUEUE_STATUS_COLORS: Record<string, string> = {
  WAITING: 'bg-primary-50 text-primary-700 border-primary-200',
  CALLED: 'bg-warning-50 text-warning-700 border-warning-200',
  IN_CHECKUP: 'bg-success-50 text-success-700 border-success-200',
  COMPLETED: 'bg-neutral-50 text-neutral-600 border-neutral-200',
  NOT_PRESENT: 'bg-error-50 text-error-700 border-error-200',
  SKIPPED: 'bg-warning-50 text-warning-700 border-warning-200',
  CANCELLED: 'bg-neutral-50 text-neutral-600 border-neutral-200',
  NO_SHOW: 'bg-neutral-50 text-neutral-600 border-neutral-200',
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

// Money values may arrive as strings from the API (PostgreSQL DECIMAL), so
// coerce defensively before formatting with toFixed().
const toAmount = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const [showBillingPanel, setShowBillingPanel] = useState(false);
  const [billingPanelData, setBillingPanelData] = useState<{
    paymentId: string;
    appointmentId?: string;
    queueNumber?: number;
  } | null>(null);

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

      console.log('=== Complete Checkup Debug ===');
      console.log('Queue Entry:', queueEntry);
      console.log('Has appointment_id:', !!queueEntry?.appointment_id);
      console.log('Appointment ID:', queueEntry?.appointment_id);

      if (queueEntry) {
        // Both walk-in and booked patients should have appointment_id
        if (queueEntry.appointment_id) {
          // Try to fetch payment ID for this appointment
          try {
            const paymentResponse = await secretaryApi.getPayment(queueEntry.appointment_id);
            console.log('Payment Response:', paymentResponse);
            if (paymentResponse.success && paymentResponse.data) {
              // Payment exists, open Billing Panel
              setBillingPanelData({
                paymentId: paymentResponse.data.id,
                appointmentId: queueEntry.appointment_id,
                queueNumber: queueEntry.queue_number,
              });
              setShowBillingPanel(true);
            } else {
              // Payment doesn't exist, create one first
              const consultationFee = toAmount(queueEntry.consultation_fee) || 500; // Default fee if not set
              console.log('Creating payment with consultation fee:', consultationFee);
              const createPaymentResponse = await secretaryApi.recordPayment({
                appointmentId: queueEntry.appointment_id,
                paymentMethod: 'CASH', // Default to CASH, can be changed in Billing Panel
                consultationFee,
                additionalCharges: [],
              });
              console.log('Create Payment Response:', createPaymentResponse);
              if (createPaymentResponse.success && createPaymentResponse.data?.paymentId) {
                // Payment created, open Billing Panel
                setBillingPanelData({
                  paymentId: createPaymentResponse.data.paymentId,
                  appointmentId: queueEntry.appointment_id,
                  queueNumber: queueEntry.queue_number,
                });
                setShowBillingPanel(true);
              } else {
                setError(createPaymentResponse.error || 'Failed to create payment record');
                fetchQueue();
              }
            }
          } catch (e) {
            console.error('Failed to handle payment for queue entry:', e);
            setError('Failed to load billing information');
            fetchQueue();
          }
        } else {
          // appointment_id is null - this shouldn't happen for walk-ins, but handle gracefully
          console.error('Queue entry missing appointment_id:', queueEntry);
          setError('Appointment information not found for this queue entry');
          fetchQueue();
        }
      } else {
        // Queue entry not found
        setError('Queue entry not found');
        fetchQueue();
      }
    } else {
      setError(response.error || 'Failed to complete checkup');
    }
    setActionLoading(false);
  };

  const handleBillingPanelClose = () => {
    setShowBillingPanel(false);
    setBillingPanelData(null);
    // Refresh queue to show updated payment status
    fetchQueue();
  };

  const handleBillingPaymentComplete = () => {
    // Refresh queue to show updated payment status
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


  // Calculate metrics
  const totalQueue = queueEntries.length;
  const waitingInLobby = queueEntries.filter(e => e.status === 'WAITING' || e.status === 'CALLED').length;
  const inConsultation = queueEntries.filter(e => e.status === 'IN_CHECKUP').length;
  const completed = queueEntries.filter(e => e.status === 'COMPLETED').length;
  const skippedNoShow = queueEntries.filter(e => e.status === 'SKIPPED' || e.status === 'NO_SHOW' || e.status === 'NOT_PRESENT').length;
  const toCollect = queueEntries.filter(e => e.status === 'COMPLETED' && e.payment_status && e.payment_status !== 'PAID').length;
  const activeQueueEntries = queueEntries.filter(entry => entry.status !== 'COMPLETED');
  const activeQueueCount = activeQueueEntries.length;

  const entriesForActiveTab = activeTab === 'completed' || activeTab === 'to-collect'
    ? queueEntries
    : activeQueueEntries;
  const filteredEntries = entriesForActiveTab.filter(entry => {
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
      case 'to-collect':
        statusMatch = entry.status === 'COMPLETED' && !!entry.payment_status && entry.payment_status !== 'PAID';
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

  const getTimeAgo = (timestamp: string | null | undefined) => {
    if (!timestamp) return '';
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins > 0 ? `(${diffMins}m)` : '';
  };

  if (loading && !secretary) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100">
          <h1 className="text-lg font-bold text-neutral-900">Daily Queue</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Manage the daily patient queue and call patients</p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-md border border-neutral-100 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="text-neutral-600 mt-3">Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start">
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
        <div className="flex gap-3">
          <button
            onClick={handleCallNext}
            disabled={actionLoading || waitingInLobby === 0 || !isToday(selectedDate)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
          >
            <span className="material-symbols-outlined text-[18px]">notifications_active</span>
            Call Next Patient
          </button>
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-sm text-neutral-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] text-neutral-500">refresh</span>
            Refresh List
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">groups</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
              {isToday(selectedDate) ? 'Total Queue Today' : 'Total Queue'}
            </span>
            <span className="text-2xl font-bold text-neutral-800">{totalQueue}</span>
            <span className="text-xs text-neutral-400">Patients</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">event_seat</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Waiting in Lobby</span>
            <span className="text-2xl font-bold text-neutral-800">{waitingInLobby}</span>
            <span className="text-xs text-neutral-400">{waitingInLobby > 0 ? `#${queueEntries.find(e => e.status === 'WAITING')?.queue_number} Next` : 'Patients'}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success-500 to-success-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">medical_services</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">In Consultation</span>
            <span className="text-2xl font-bold text-neutral-800">{inConsultation}</span>
            <span className="text-xs text-neutral-400">{inConsultation > 0 ? `${secretary?.room_number || 'Room 101'} • Dr. ${secretary?.doctor_first_name} ${secretary?.doctor_last_name}` : 'Patient'}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neutral-500 to-neutral-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">check_circle</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Completed Checkups</span>
            <span className="text-2xl font-bold text-neutral-800">{completed}</span>
            <span className="text-xs text-neutral-400">Completed</span>
          </div>
        </div>
      </div>

      {/* Status Filter Bar and Search - Combined */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
        {/* Status Filter Tabs */}
        <nav className="flex overflow-x-auto gap-1 p-2 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Active Queue ({activeQueueCount})
          </button>
          <button
            onClick={() => setActiveTab('waiting')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'waiting'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Waiting in Lobby ({waitingInLobby})
          </button>
          <button
            onClick={() => setActiveTab('in-consultation')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'in-consultation'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            In Consultation ({inConsultation})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'completed'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Completed ({completed})
          </button>
          <button
            onClick={() => setActiveTab('skipped')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'skipped'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Skipped / No-Show ({skippedNoShow})
          </button>
          <button
            onClick={() => setActiveTab('to-collect')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'to-collect'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            To Collect ({toCollect})
          </button>
        </nav>

        {/* Search and Filters */}
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-neutral-400">search</span>
              <input
                type="text"
                placeholder="Search by patient name, Queue #, MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
            </div>
            <Select
              className="w-56"
              triggerClassName="px-4 py-2.5 text-sm"
              value={secretary?.doctor_id || ''}
              disabled
              onChange={() => {}}
              options={[{ value: secretary?.doctor_id || '', label: `Doctor: Dr. ${secretary?.doctor_first_name} ${secretary?.doctor_last_name}` }]}
            />
            <Select
              className="w-44"
              triggerClassName="px-4 py-2.5 text-sm"
              value={sourceFilter}
              onChange={(value) => setSourceFilter(value as 'all' | 'ONLINE' | 'WALK_IN')}
              options={[
                { value: 'all', label: 'Source: All Sources' },
                { value: 'ONLINE', label: 'Source: Online' },
                { value: 'WALK_IN', label: 'Source: Walk-in' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Queue Data Table */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-md overflow-hidden">
        {!isToday(selectedDate) && (
          <div className="bg-warning-50 border-b border-warning-200 px-4 py-3">
            <div className="flex items-center gap-2 text-warning-700 text-sm">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span className="font-medium">View Only Mode</span>
              <span>•</span>
              <span>Actions are disabled for past and future dates</span>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="text-neutral-600 mt-3">Loading queue...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-neutral-300">hourglass_empty</span>
            <p className="text-neutral-600 mt-3">No patients in queue for this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-100 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-bold text-neutral-600 uppercase tracking-wider">Queue #</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-neutral-600 uppercase tracking-wider">Patient</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-neutral-600 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-neutral-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-neutral-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredEntries.map((entry) => {
                  return (
                    <tr key={entry.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary-600 text-white font-bold text-sm">
                          Q-{String(entry.queue_number).padStart(2, '0')}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3 justify-center">
                          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-bold text-sm">
                            {entry.patient_first_name[0]}{entry.patient_last_name[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-neutral-900">
                              {entry.patient_first_name} {entry.patient_last_name}
                            </div>
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {entry.patient_email || 'No email'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                          entry.registration_source === 'ONLINE'
                            ? 'bg-primary-50 text-primary-700'
                            : 'bg-success-50 text-success-700'
                        }`}>
                          {entry.registration_source === 'ONLINE' ? 'Online' : 'Walk-in'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2 items-center">
                          {/* Queue Status */}
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                            entry.status === 'IN_CHECKUP' ? 'bg-success-50 text-success-700' :
                            entry.status === 'CALLED' ? 'bg-warning-50 text-warning-700' :
                            entry.status === 'WAITING' ? 'bg-primary-50 text-primary-700' :
                            entry.status === 'COMPLETED' ? 'bg-neutral-100 text-neutral-600' :
                            'bg-neutral-100 text-neutral-600'
                          }`}>
                            {QUEUE_STATUS_LABELS[entry.status] || entry.status}
                            {entry.status !== 'COMPLETED' && getTimeAgo(entry.called_at)}
                          </span>
                          {entry.status === 'IN_CHECKUP' && entry.doctor_finished && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-800">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Doctor finished
                            </span>
                          )}
                          {/* Payment Status (only for completed and not PAID) */}
                          {entry.status === 'COMPLETED' && entry.payment_status && entry.payment_status !== 'PAID' && (() => {
                            const ps = entry.payment_status === 'PENDING_VERIFICATION' ? 'FOR_REVIEW' : entry.payment_status;
                            const chipClass =
                              ps === 'PARTIAL' ? 'bg-primary-100 text-primary-800' :
                              ps === 'FOR_REVIEW' ? 'bg-warning-100 text-warning-800' :
                              ps === 'OVERPAID' ? 'bg-primary-100 text-primary-800' :
                              ps === 'UNPAID' ? 'bg-neutral-100 text-neutral-800' :
                              'bg-neutral-100 text-neutral-800';
                            const chipText =
                              ps === 'UNPAID' ? `Unpaid ₱${toAmount(entry.payment_balance ?? entry.consultation_fee).toFixed(2)}` :
                              ps === 'PARTIAL' ? `Partial ₱${toAmount(entry.payment_balance).toFixed(2)} left` :
                              ps === 'FOR_REVIEW' ? 'For review' :
                              ps === 'OVERPAID' ? 'Overpaid' : ps;
                            return (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${chipClass}`}>
                                {chipText}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                          {entry.status === 'IN_CHECKUP' && (
                            <button
                              onClick={() => handleCompleteCheckup(entry.id)}
                              disabled={actionLoading || !isToday(selectedDate)}
                              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                              title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                            >
                              Complete Checkup
                            </button>
                          )}
                          {entry.status === 'CALLED' && (
                            <>
                              <button
                                onClick={() => handleStartCheckup(entry.id)}
                                disabled={actionLoading || !isToday(selectedDate)}
                                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                                title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                              >
                                Start Checkup
                              </button>
                              <button
                                onClick={() => handleNotPresent(entry.id)}
                                disabled={actionLoading || !isToday(selectedDate)}
                                className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
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
                                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                                title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                              >
                                Call Next Patient
                              </button>
                              <button
                                onClick={() => handleSkip(entry.id)}
                                disabled={actionLoading || !isToday(selectedDate)}
                                className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
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
                              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                              title={!isToday(selectedDate) ? 'Actions only available for today\'s queue' : ''}
                            >
                              Start Checkup
                            </button>
                          )}
                          <button
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                          >
                            View Patient
                          </button>
                          {entry.status === 'COMPLETED' && entry.appointment_id && entry.payment_status && entry.payment_status !== 'PAID' && (
                            <button
                              onClick={async () => {
                                try {
                                  const paymentResponse = await secretaryApi.getPayment(entry.appointment_id || '');
                                  if (paymentResponse.success && paymentResponse.data) {
                                    setBillingPanelData({
                                      paymentId: paymentResponse.data.id,
                                      appointmentId: entry.appointment_id || undefined,
                                      queueNumber: entry.queue_number,
                                    });
                                    setShowBillingPanel(true);
                                  }
                                } catch (e) {
                                  console.error('Failed to fetch payment:', e);
                                  setError('Failed to load billing information');
                                }
                              }}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                            >
                              Bill
                            </button>
                          )}
                          {entry.status === 'COMPLETED' && entry.payment_status === 'PAID' && (
                            <button
                              onClick={async () => {
                                try {
                                  const paymentResponse = await secretaryApi.getPayment(entry.appointment_id || '');
                                  if (paymentResponse.success && paymentResponse.data) {
                                    setBillingPanelData({
                                      paymentId: paymentResponse.data.id,
                                      appointmentId: entry.appointment_id || undefined,
                                      queueNumber: entry.queue_number,
                                    });
                                    setShowBillingPanel(true);
                                  }
                                } catch (e) {
                                  console.error('Failed to fetch payment:', e);
                                  setError('Failed to load billing information');
                                }
                              }}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                            >
                              {entry.payment_invoice_number ? 'View Invoice' : 'Issue Invoice'}
                            </button>
                          )}
                          {entry.status === 'COMPLETED' && entry.payment_status === 'PAID' && !entry.payment_invoice_number && (
                            <span className="text-[10px] text-warning-700 bg-warning-50 border border-warning-200 rounded px-2 py-1">
                              No active invoice
                            </span>
                          )}
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
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-md">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-700">FiDo Clinical Platform</span>
            <span>•</span>
            <span>Secretary Terminal 01A</span>
            <span>•</span>
            <span>Desk A</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
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

      {/* Billing Panel */}
      {showBillingPanel && billingPanelData && (
        <BillingPanel
          isOpen={showBillingPanel}
          onClose={handleBillingPanelClose}
          paymentId={billingPanelData.paymentId}
          appointmentId={billingPanelData.appointmentId}
          queueNumber={billingPanelData.queueNumber}
          onPaymentComplete={handleBillingPaymentComplete}
        />
      )}
    </div>
  );
}