'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';
import Select from '@/components/ui/Select';
import { usePresence } from '@/hooks/usePresence';
import DatePicker from '@/components/DatePicker';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface DoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  consultation_duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DoctorUnavailability {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UnavailabilityFormData {
  date: string;
  reason: string;
}

interface DoctorBreakPeriod {
  id: string;
  doctor_id: string;
  break_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BreakPeriodFormData {
  breakDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  reason: string;
}

interface DoctorCapacity {
  date: string;
  calculated_capacity: number;
  configured_capacity: number | null;
  final_capacity: number;
  registered_count: number;
  remaining_capacity: number;
  consultation_duration_minutes: number;
}

type TabType = 'working-hours' | 'exceptions' | 'breaks' | 'capacity';

export default function SecretarySchedule() {
  const [activeTab, setActiveTab] = useState<TabType>('working-hours');
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [unavailability, setUnavailability] = useState<DoctorUnavailability[]>([]);
  const [breakPeriods, setBreakPeriods] = useState<DoctorBreakPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const todayDateString = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Exception states
  const [showExceptionAddModal, setShowExceptionAddModal] = useState(false);
  const [showExceptionEditModal, setShowExceptionEditModal] = useState(false);
  const [editingException, setEditingException] = useState<DoctorUnavailability | null>(null);
  const [showExceptionDeleteModal, setShowExceptionDeleteModal] = useState(false);
  const [deletingException, setDeletingException] = useState<DoctorUnavailability | null>(null);
  const [exceptionFormData, setExceptionFormData] = useState<UnavailabilityFormData>({
    date: '',
    reason: '',
  });

  // Break period states
  const [showBreakAddModal, setShowBreakAddModal] = useState(false);
  const [showBreakEditModal, setShowBreakEditModal] = useState(false);
  const [editingBreak, setEditingBreak] = useState<DoctorBreakPeriod | null>(null);
  const [showBreakDeleteModal, setShowBreakDeleteModal] = useState(false);
  const [deletingBreak, setDeletingBreak] = useState<DoctorBreakPeriod | null>(null);
  const [breakFormData, setBreakFormData] = useState<BreakPeriodFormData>({
    breakDate: '',
    dayOfWeek: 1,
    startTime: '12:00',
    endTime: '13:00',
    reason: '',
  });
  const [showBreakStartPicker, setShowBreakStartPicker] = useState(false);
  const [showBreakEndPicker, setShowBreakEndPicker] = useState(false);
  const [showBreakDayPicker, setShowBreakDayPicker] = useState(false);
  const [showBreakEditDayPicker, setShowBreakEditDayPicker] = useState(false);

  const exceptionEditModalOpen = showExceptionEditModal && !!editingException;
  const exceptionDeleteModalOpen = showExceptionDeleteModal && !!deletingException;
  const breakEditModalOpen = showBreakEditModal && !!editingBreak;
  const breakDeleteModalOpen = showBreakDeleteModal && !!deletingBreak;
  const exceptionAddModalPresent = usePresence(showExceptionAddModal);
  const exceptionEditModalPresent = usePresence(exceptionEditModalOpen);
  const exceptionDeleteModalPresent = usePresence(exceptionDeleteModalOpen);
  const breakAddModalPresent = usePresence(showBreakAddModal);
  const breakEditModalPresent = usePresence(breakEditModalOpen);
  const breakDeleteModalPresent = usePresence(breakDeleteModalOpen);

  // Capacity states
  const [capacityData, setCapacityData] = useState<DoctorCapacity | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [configuredCapacity, setConfiguredCapacity] = useState<number | ''>('');
  const [capacityLoading, setCapacityLoading] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchUnavailability();
    fetchBreakPeriods();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeAllDropdowns = () => {
    setShowBreakStartPicker(false);
    setShowBreakEndPicker(false);
    setShowBreakDayPicker(false);
    setShowBreakEditDayPicker(false);
  };

  const fetchSchedules = async () => {
    setLoading(true);
    const response = await apiClient.get<DoctorSchedule[]>('/secretaries/managed-doctors/schedules');
    if (response.success && response.data) {
      setSchedules(response.data);
    } else {
      setError(response.error || 'Failed to fetch schedules');
    }
    setLoading(false);
  };

  const fetchUnavailability = async () => {
    const response = await apiClient.get<DoctorUnavailability[]>('/secretaries/managed-doctors/unavailability?includeInactive=true');
    if (response.success && response.data) {
      setUnavailability(response.data);
    } else {
      setError(response.error || 'Failed to fetch exceptions');
    }
  };

  const fetchBreakPeriods = async () => {
    const response = await apiClient.get<DoctorBreakPeriod[]>('/secretaries/managed-doctors/break-periods?includeInactive=true');
    if (response.success && response.data) {
      setBreakPeriods(response.data);
    } else {
      setError(response.error || 'Failed to fetch break periods');
    }
  };

  const calculateDuration = (startTime: string, endTime: string): number => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60); // hours
  };

  const calculateKPIs = () => {
    const activeSchedules = schedules.filter(s => s.is_active);
    const activeDays = new Set(activeSchedules.map(s => s.day_of_week)).size;
    const totalHours = activeSchedules.reduce((sum, s) => sum + calculateDuration(s.start_time, s.end_time), 0);
    const activeShifts = activeSchedules.length;

    return { activeDays, totalHours, activeShifts };
  };

  const { activeDays, totalHours, activeShifts } = calculateKPIs();

  const getSchedulesForDay = (dayValue: number) => {
    return schedules.filter(s => s.day_of_week === dayValue).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const isDayActive = (dayValue: number) => {
    return schedules.some(s => s.day_of_week === dayValue && s.is_active);
  };

  // Exception handlers
  const handleExceptionAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!exceptionFormData.date) {
      setError('Please select a date for the exception.');
      return;
    }
    if (exceptionFormData.date < todayDateString) {
      setError('Exceptions cannot be scheduled for a past date.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      startDate: exceptionFormData.date,
      endDate: exceptionFormData.date,
      reason: exceptionFormData.reason,
    };

    const response = await apiClient.post<DoctorUnavailability>('/secretaries/managed-doctors/unavailability', payload);
    if (response.success && response.data) {
      setSuccess('Exception created successfully');
      setShowExceptionAddModal(false);
      setExceptionFormData({ date: '', reason: '' });
      setUnavailability((prev) => [...prev, response.data as DoctorUnavailability]);
    } else {
      setError(response.error || 'Failed to create exception');
    }
    setSaving(false);
  };

  const handleExceptionEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editingException || saving) return;
    setSaving(true);

    const payload = {
      startDate: exceptionFormData.date,
      endDate: exceptionFormData.date,
      reason: exceptionFormData.reason,
    };

    const response = await apiClient.put<DoctorUnavailability>(`/secretaries/managed-doctors/unavailability/${editingException.id}`, payload);
    if (response.success && response.data) {
      setSuccess('Exception updated successfully');
      setShowExceptionEditModal(false);
      setEditingException(null);
      setUnavailability((prev) => prev.map((u) => (u.id === editingException.id ? (response.data as DoctorUnavailability) : u)));
    } else {
      setError(response.error || 'Failed to update exception');
    }
    setSaving(false);
  };

  const handleExceptionDelete = async () => {
    if (!deletingException || saving) return;
    setSaving(true);

    setError(null);
    setSuccess(null);

    const response = await apiClient.delete<DoctorUnavailability>(`/secretaries/managed-doctors/unavailability/${deletingException.id}`);
    if (response.success && response.data) {
      setSuccess('Exception deleted successfully');
      setShowExceptionDeleteModal(false);
      setDeletingException(null);
      setUnavailability((prev) => prev.filter((u) => u.id !== deletingException.id));
    } else {
      setError(response.error || 'Failed to delete exception');
    }
    setSaving(false);
  };

  const openExceptionEditModal = (exception: DoctorUnavailability) => {
    setEditingException(exception);
    setExceptionFormData({
      date: exception.start_date.split('T')[0],
      reason: exception.reason || '',
    });
    setShowExceptionEditModal(true);
  };

  const openExceptionDeleteModal = (exception: DoctorUnavailability) => {
    setDeletingException(exception);
    setShowExceptionDeleteModal(true);
  };

  // Break period handlers
  const handleBreakAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const today = new Date();
    const currentDay = today.getDay();
    const targetDay = breakFormData.dayOfWeek;
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    const breakDate = new Date(today);
    breakDate.setDate(today.getDate() + daysUntilTarget);
    const breakDateStr = breakDate.toISOString().split('T')[0];

    const payload = {
      breakDate: breakDateStr,
      startTime: breakFormData.startTime,
      endTime: breakFormData.endTime,
      reason: breakFormData.reason,
    };

    const response = await apiClient.post<DoctorBreakPeriod>('/secretaries/managed-doctors/break-periods', payload);
    if (response.success && response.data) {
      setSuccess('Break period created successfully');
      setShowBreakAddModal(false);
      setBreakFormData({ breakDate: '', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', reason: '' });
      setBreakPeriods((prev) => [...prev, response.data as DoctorBreakPeriod]);
    } else {
      setError(response.error || 'Failed to create break period');
    }
    setSaving(false);
  };

  const handleBreakEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editingBreak || saving) return;
    setSaving(true);

    const today = new Date();
    const currentDay = today.getDay();
    const targetDay = breakFormData.dayOfWeek;
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    const breakDate = new Date(today);
    breakDate.setDate(today.getDate() + daysUntilTarget);
    const breakDateStr = breakDate.toISOString().split('T')[0];

    const payload = {
      breakDate: breakDateStr,
      startTime: breakFormData.startTime,
      endTime: breakFormData.endTime,
      reason: breakFormData.reason,
    };

    const response = await apiClient.put<DoctorBreakPeriod>(`/secretaries/managed-doctors/break-periods/${editingBreak.id}`, payload);
    if (response.success && response.data) {
      setSuccess('Break period updated successfully');
      setShowBreakEditModal(false);
      setEditingBreak(null);
      setBreakPeriods((prev) => prev.map((b) => (b.id === editingBreak.id ? (response.data as DoctorBreakPeriod) : b)));
    } else {
      setError(response.error || 'Failed to update break period');
    }
    setSaving(false);
  };

  const handleBreakDelete = async () => {
    if (!deletingBreak || saving) return;
    setSaving(true);

    setError(null);
    setSuccess(null);

    const response = await apiClient.delete<DoctorBreakPeriod>(`/secretaries/managed-doctors/break-periods/${deletingBreak.id}`);
    if (response.success && response.data) {
      setSuccess('Break period deleted successfully');
      setShowBreakDeleteModal(false);
      setDeletingBreak(null);
      setBreakPeriods((prev) => prev.filter((b) => b.id !== deletingBreak.id));
    } else {
      setError(response.error || 'Failed to delete break period');
    }
    setSaving(false);
  };

  const openBreakEditModal = (breakPeriod: DoctorBreakPeriod) => {
    setEditingBreak(breakPeriod);
    const breakDate = new Date(breakPeriod.break_date);
    const dayOfWeek = breakDate.getDay();
    setBreakFormData({
      breakDate: breakPeriod.break_date,
      dayOfWeek: dayOfWeek,
      startTime: breakPeriod.start_time,
      endTime: breakPeriod.end_time,
      reason: breakPeriod.reason || '',
    });
    setShowBreakEditModal(true);
  };

  const openBreakDeleteModal = (breakPeriod: DoctorBreakPeriod) => {
    setDeletingBreak(breakPeriod);
    setShowBreakDeleteModal(true);
  };

  // Capacity handlers
  const fetchCapacity = async (date: string) => {
    if (!date) return;

    setCapacityLoading(true);
    setError(null);

    const response = await apiClient.get<DoctorCapacity>(`/secretaries/managed-doctors/capacity?date=${date}`);
    if (response.success && response.data) {
      setCapacityData(response.data);
      setConfiguredCapacity(response.data.configured_capacity ?? '');
    } else {
      setError(response.error || 'Failed to fetch capacity data');
      setCapacityData(null);
    }
    setCapacityLoading(false);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (date) {
      fetchCapacity(date);
    } else {
      setCapacityData(null);
      setConfiguredCapacity('');
    }
  };

  const handleConfiguredCapacityChange = (value: string) => {
    const numValue = value === '' ? '' : parseInt(value);
    if (numValue === '' || (capacityData && numValue <= capacityData.calculated_capacity)) {
      setConfiguredCapacity(numValue);
    }
  };

  const handleSaveCapacity = async () => {
    if (!selectedDate) return;

    setCapacityLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      date: selectedDate,
      configuredCapacity: configuredCapacity === '' ? null : configuredCapacity,
    };

    const response = await apiClient.post<DoctorCapacity>(`/secretaries/managed-doctors/capacity/${selectedDate}`, payload);
    if (response.success && response.data) {
      setSuccess('Capacity updated successfully');
      setCapacityData(response.data);
      setConfiguredCapacity(response.data.configured_capacity ?? '');
    } else {
      setError(response.error || 'Failed to update capacity');
    }
    setCapacityLoading(false);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Select date';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filterPastDates = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = today.toISOString().split('T')[0];

  const activeUnavailability = unavailability.filter(u => u.is_active && filterPastDates(u.start_date.split('T')[0]));
  const activeBreakPeriods = breakPeriods.filter(b => b.is_active && filterPastDates(b.break_date.split('T')[0]));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Schedule Management</h1>
        <p className="text-neutral-600 mt-1">Manage your assigned doctor&apos;s schedule, exceptions, and capacity</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100 mb-6">
        <div className="flex border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('working-hours')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
              activeTab === 'working-hours'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
              Working Hours
            </span>
          </button>
          <button
            onClick={() => setActiveTab('exceptions')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
              activeTab === 'exceptions'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">event_busy</span>
              Exceptions
              <span className="px-2 py-0.5 rounded-full bg-error-100 text-error-600 text-xs font-semibold">
                {activeUnavailability.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('breaks')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
              activeTab === 'breaks'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">free_breakfast</span>
              Break Periods
              <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-600 text-xs font-semibold">
                {activeBreakPeriods.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
              activeTab === 'capacity'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              Capacity
            </span>
          </button>
        </div>
      </div>

      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
      {success && <Toast message={success} type="success" onClose={() => setSuccess(null)} />}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-neutral-500">Loading...</div>
        </div>
      ) : (
        <>
          {/* Working Hours Tab - Read Only */}
          {activeTab === 'working-hours' && (
            <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
              <div className="p-6 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-800">Weekly Working Hours</h2>
                    <p className="text-sm text-neutral-500 mt-1">View-only: Contact your doctor to modify weekly working hours</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-100 text-success-700 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-success-500"></span> Active
                    </span>
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-neutral-400"></span> Inactive
                    </span>
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100 rounded-2xl p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[24px]">calendar_today</span>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-500 font-medium">Active Days</div>
                      <div className="text-3xl font-bold text-neutral-900">{activeDays}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-success-50 to-white border border-success-100 rounded-2xl p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[24px]">schedule</span>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-500 font-medium">Total Hours</div>
                      <div className="text-3xl font-bold text-neutral-900">{totalHours.toFixed(1)}h</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100 rounded-2xl p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[24px]">wb_sunny</span>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-500 font-medium">Active Shifts</div>
                      <div className="text-3xl font-bold text-neutral-900">{activeShifts}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Grid */}
              <div className="divide-y divide-neutral-200">
                {DAYS_OF_WEEK.map((day) => {
                  const daySchedules = getSchedulesForDay(day.value);
                  const active = isDayActive(day.value);

                  return (
                    <div key={day.value} className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-neutral-900">{day.label}</h3>
                          {active ? (
                            <span className="px-2 py-0.5 rounded-full bg-success-100 text-success-700 text-xs font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-success-500"></span> Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-xs font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {daySchedules.length === 0 ? (
                        <div className="text-center py-6 text-neutral-400 text-sm">
                          No schedules for this day
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {daySchedules.map((schedule) => {
                            const duration = calculateDuration(schedule.start_time, schedule.end_time);
                            return (
                              <div
                                key={schedule.id}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all hover:shadow-lg ${
                                  schedule.is_active
                                    ? 'bg-gradient-to-br from-white to-neutral-50 border-neutral-200 hover:border-primary-300 shadow-md'
                                    : 'bg-neutral-50/50 border-dashed border-neutral-300 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                                    schedule.is_active
                                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
                                      : 'bg-neutral-200 text-neutral-400'
                                  }`}>
                                    <span className="material-symbols-outlined text-[22px]">wb_sunny</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`font-mono text-lg font-bold ${schedule.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>
                                        {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                                      </span>
                                      <span className="text-sm text-neutral-500 font-medium">({duration.toFixed(1)}h)</span>
                                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                                        schedule.is_active
                                          ? 'bg-gradient-to-r from-success-500 to-success-600 text-white shadow-md'
                                          : 'bg-neutral-200 text-neutral-500'
                                      }`}>
                                        <span className={`w-2 h-2 rounded-full ${schedule.is_active ? 'bg-white' : 'bg-neutral-400'}`}></span>
                                        {schedule.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <span className="text-sm text-neutral-400 mt-1">
                                      Consultation: {schedule.consultation_duration_minutes} min
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Exceptions Tab */}
          {activeTab === 'exceptions' && (
            <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
              <div className="p-6 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-neutral-800">Date-Specific Exceptions</h2>
                  <button
                    onClick={() => setShowExceptionAddModal(true)}
                    className="h-10 px-4 rounded-2xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                    title="Add exception"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>Add Exception</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-neutral-200">
                {activeUnavailability.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500">No exceptions configured</div>
                ) : (
                  activeUnavailability.map((exception) => {
                    const [year, month, day] = exception.start_date.split('T')[0].split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <div
                        key={exception.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all hover:shadow-lg ${
                          exception.is_active
                            ? 'bg-gradient-to-br from-white to-neutral-50 border-neutral-200 hover:border-error-300 shadow-md'
                            : 'bg-neutral-50/50 border-dashed border-neutral-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                            exception.is_active
                              ? 'bg-gradient-to-br from-error-500 to-error-600 text-white'
                              : 'bg-neutral-200 text-neutral-400'
                          }`}>
                            <span className="material-symbols-outlined text-[22px]">event_busy</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="font-semibold text-neutral-900">{formattedDate}</div>
                            {exception.reason && (
                              <div className="text-sm text-neutral-500 mt-1">{exception.reason}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 sm:mt-0">
                          <button
                            onClick={() => openExceptionEditModal(exception)}
                            className="h-10 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => openExceptionDeleteModal(exception)}
                            className="h-10 px-4 rounded-2xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Break Periods Tab */}
          {activeTab === 'breaks' && (
            <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
              <div className="p-6 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-neutral-800">Break Periods</h2>
                  <button
                    onClick={() => setShowBreakAddModal(true)}
                    className="h-10 px-4 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                    title="Add break"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>Add Break</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-neutral-200">
                {activeBreakPeriods.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500">No break periods configured</div>
                ) : (
                  activeBreakPeriods.map((breakPeriod) => {
                    const [year, month, day] = breakPeriod.break_date.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <div
                        key={breakPeriod.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all hover:shadow-lg ${
                          breakPeriod.is_active
                            ? 'bg-gradient-to-br from-white to-neutral-50 border-neutral-200 hover:border-primary-300 shadow-md'
                            : 'bg-neutral-50/50 border-dashed border-neutral-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                            breakPeriod.is_active
                              ? 'bg-gradient-to-br from-warning-500 to-warning-600 text-white'
                              : 'bg-neutral-200 text-neutral-400'
                          }`}>
                            <span className="material-symbols-outlined text-[22px]">free_breakfast</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="font-semibold text-neutral-900">{formattedDate}</div>
                            <div className="text-sm text-neutral-500 mt-1">
                              {formatTime(breakPeriod.start_time)} - {formatTime(breakPeriod.end_time)}
                            </div>
                            {breakPeriod.reason && (
                              <div className="text-sm text-neutral-500 mt-1">{breakPeriod.reason}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 sm:mt-0">
                          <button
                            onClick={() => openBreakEditModal(breakPeriod)}
                            className="h-10 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => openBreakDeleteModal(breakPeriod)}
                            className="h-10 px-4 rounded-2xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Capacity Tab */}
          {activeTab === 'capacity' && (
            <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
              <div className="p-6 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
                <h2 className="text-xl font-bold text-neutral-800">Daily Capacity Management</h2>
                <p className="text-sm text-neutral-500 mt-1">Configure maximum patient capacity for specific dates</p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Select Date</label>
                  <DatePicker
                    value={selectedDate}
                    onChange={handleDateChange}
                    showClear
                    showToday
                  onOpen={closeAllDropdowns}
                  />
                </div>

                {capacityData && (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100 rounded-2xl p-5 shadow-md">
                      <div className="text-xs text-neutral-500 font-semibold mb-1">Calculated</div>
                      <div className="text-2xl font-bold text-neutral-900">{capacityData.calculated_capacity}</div>
                    </div>
                    <div className="bg-white border-2 border-neutral-200 rounded-2xl p-5 shadow-md">
                      <div className="text-xs text-neutral-500 font-semibold mb-1">Configured</div>
                      <input
                        type="number"
                        value={configuredCapacity}
                        onChange={(e) => handleConfiguredCapacityChange(e.target.value)}
                        min="0"
                        max={capacityData.calculated_capacity}
                        className="w-full text-2xl font-bold text-neutral-900 border-b-2 border-neutral-300 focus:border-primary-500 focus:outline-none bg-transparent"
                      />
                    </div>
                    <div className="bg-gradient-to-br from-success-50 to-white border border-success-100 rounded-2xl p-5 shadow-md">
                      <div className="text-xs text-neutral-500 font-semibold mb-1">Final Limit</div>
                      <div className="text-2xl font-bold text-neutral-900">{capacityData.final_capacity}</div>
                    </div>
                    <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100 rounded-2xl p-5 shadow-md">
                      <div className="text-xs text-neutral-500 font-semibold mb-1">Registered</div>
                      <div className="text-2xl font-bold text-neutral-900">{capacityData.registered_count}</div>
                    </div>
                    <div className="bg-gradient-to-br from-warning-50 to-white border border-warning-100 rounded-2xl p-5 shadow-md">
                      <div className="text-xs text-neutral-500 font-semibold mb-1">Remaining</div>
                      <div className="text-2xl font-bold text-neutral-900">{capacityData.remaining_capacity}</div>
                    </div>
                  </div>
                )}

                {capacityData && (
                  <button
                    onClick={handleSaveCapacity}
                    disabled={capacityLoading}
                    className="h-12 px-8 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    {capacityLoading ? 'Saving...' : 'Save Capacity'}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Exception Add Modal */}
      {exceptionAddModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          data-state={showExceptionAddModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            data-state={showExceptionAddModal ? 'open' : 'closed'}
          >
            <h3 className="text-xl font-bold text-neutral-900 mb-6">Add Exception</h3>
            <form onSubmit={handleExceptionAddSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Date</label>
                <DatePicker
                  value={exceptionFormData.date}
                  onChange={(date) => setExceptionFormData({ ...exceptionFormData, date })}
                  minDate={todayDateString}
                  showClear
                  showToday
                onOpen={closeAllDropdowns}
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={exceptionFormData.reason}
                  onChange={(e) => setExceptionFormData({ ...exceptionFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExceptionAddModal(false)}
                  className="h-10 px-6 rounded-2xl border-2 border-neutral-200 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exception Edit Modal */}
      {exceptionEditModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          data-state={exceptionEditModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            data-state={exceptionEditModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-xl font-bold text-neutral-900 mb-6">Edit Exception</h3>
            <form onSubmit={handleExceptionEditSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Date</label>
                <DatePicker
                  value={exceptionFormData.date}
                  onChange={(date) => setExceptionFormData({ ...exceptionFormData, date })}
                  showClear
                  showToday
                onOpen={closeAllDropdowns}
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={exceptionFormData.reason}
                  onChange={(e) => setExceptionFormData({ ...exceptionFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExceptionEditModal(false)}
                  className="h-10 px-6 rounded-2xl border-2 border-neutral-200 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exception Delete Modal */}
      {exceptionDeleteModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          data-state={exceptionDeleteModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            data-state={exceptionDeleteModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-xl font-bold text-neutral-900 mb-4">Delete Exception</h3>
            <p className="text-neutral-600 mb-6">Are you sure you want to delete this exception?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExceptionDeleteModal(false)}
                className="h-10 px-6 rounded-2xl border-2 border-neutral-200 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleExceptionDelete}
                disabled={saving}
                className="h-10 px-6 rounded-2xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Break Add Modal */}
      {breakAddModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          data-state={showBreakAddModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            data-state={showBreakAddModal ? 'open' : 'closed'}
          >
            <h3 className="text-xl font-bold text-neutral-900 mb-6">Add Break Period</h3>
            <form onSubmit={handleBreakAddSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Day of Week</label>
                <Select
                  value={String(breakFormData.dayOfWeek)}
                  onChange={(value) => setBreakFormData({ ...breakFormData, dayOfWeek: parseInt(value) })}
                  options={DAYS_OF_WEEK.map((day) => ({ value: String(day.value), label: day.label }))}
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={breakFormData.startTime}
                  onChange={(e) => setBreakFormData({ ...breakFormData, startTime: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={breakFormData.endTime}
                  onChange={(e) => setBreakFormData({ ...breakFormData, endTime: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={breakFormData.reason}
                  onChange={(e) => setBreakFormData({ ...breakFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBreakAddModal(false)}
                  className="h-10 px-6 rounded-2xl border-2 border-neutral-200 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Break Edit Modal */}
      {breakEditModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          data-state={breakEditModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            data-state={breakEditModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-xl font-bold text-neutral-900 mb-6">Edit Break Period</h3>
            <form onSubmit={handleBreakEditSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Day of Week</label>
                <Select
                  value={String(breakFormData.dayOfWeek)}
                  onChange={(value) => setBreakFormData({ ...breakFormData, dayOfWeek: parseInt(value) })}
                  options={DAYS_OF_WEEK.map((day) => ({ value: String(day.value), label: day.label }))}
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={breakFormData.startTime}
                  onChange={(e) => setBreakFormData({ ...breakFormData, startTime: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={breakFormData.endTime}
                  onChange={(e) => setBreakFormData({ ...breakFormData, endTime: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={breakFormData.reason}
                  onChange={(e) => setBreakFormData({ ...breakFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBreakEditModal(false)}
                  className="h-10 px-6 rounded-2xl border-2 border-neutral-200 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Break Delete Modal */}
      {breakDeleteModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          data-state={breakDeleteModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            data-state={breakDeleteModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-xl font-bold text-neutral-900 mb-4">Delete Break Period</h3>
            <p className="text-neutral-600 mb-6">Are you sure you want to delete this break period?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBreakDeleteModal(false)}
                className="h-10 px-6 rounded-2xl border-2 border-neutral-200 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBreakDelete}
                disabled={saving}
                className="h-10 px-6 rounded-2xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
