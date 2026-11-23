'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';
import { scheduleChangesApi, isPendingResponse, pendingRequestDateLabel, pendingSummaryText, type ScheduleChangeRequest } from '@/lib/api/scheduleChangesApi';
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

interface ScheduleFormData {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  consultationDurationMinutes: number;
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

export default function DoctorSchedule() {
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DoctorSchedule | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<DoctorSchedule | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>({
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '17:00',
    consultationDurationMinutes: 30,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);

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

  // Capacity states
  const [capacityData, setCapacityData] = useState<DoctorCapacity | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [configuredCapacity, setConfiguredCapacity] = useState<number | ''>('');
  const [capacityLoading, setCapacityLoading] = useState(false);

  // Date picker states

  const editModalOpen = showEditModal && !!editingSchedule;
  const deleteModalOpen = showDeleteModal && !!deletingSchedule;
  const exceptionEditModalOpen = showExceptionEditModal && !!editingException;
  const exceptionDeleteModalOpen = showExceptionDeleteModal && !!deletingException;
  const breakEditModalOpen = showBreakEditModal && !!editingBreak;
  const breakDeleteModalOpen = showBreakDeleteModal && !!deletingBreak;
  const addModalPresent = usePresence(showAddModal);
  const editModalPresent = usePresence(editModalOpen);
  const deleteModalPresent = usePresence(deleteModalOpen);
  const exceptionAddModalPresent = usePresence(showExceptionAddModal);
  const exceptionEditModalPresent = usePresence(exceptionEditModalOpen);
  const exceptionDeleteModalPresent = usePresence(exceptionDeleteModalOpen);
  const breakAddModalPresent = usePresence(showBreakAddModal);
  const breakEditModalPresent = usePresence(breakEditModalOpen);
  const breakDeleteModalPresent = usePresence(breakDeleteModalOpen);

  // Pending schedule-change requests (awaiting secretary confirmation)
  const [pendingRequests, setPendingRequests] = useState<ScheduleChangeRequest[]>([]);

  useEffect(() => {
    fetchSchedules();
    fetchUnavailability();
    fetchBreakPeriods();
    fetchPendingRequests();
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
    setShowDayPicker(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowBreakStartPicker(false);
    setShowBreakEndPicker(false);
    setShowBreakDayPicker(false);
    setShowBreakEditDayPicker(false);
  };

  const fetchPendingRequests = async () => {
    const response = await scheduleChangesApi.listMinePending();
    if (response.success && response.data) {
      setPendingRequests(response.data);
    }
    // Pending list is advisory; the server still enforces the duplicate check.
  };

  const pendingExceptionCreates = pendingRequests.filter(r => r.changeType === 'EXCEPTION' && r.operation === 'CREATE');
  const pendingBreakCreates = pendingRequests.filter(r => r.changeType === 'BREAK' && r.operation === 'CREATE');
  const pendingTargetFor = (targetId: string) =>
    pendingRequests.find(r => r.targetId === targetId && (r.operation === 'UPDATE' || r.operation === 'DELETE')) ?? null;

  // Lists show records dated today or later (active and inactive); badges count active ones only.
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const visibleExceptions = unavailability.filter((u) => {
    const [y, m, d] = u.start_date.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d) >= todayMidnight;
  });
  const visibleBreaks = breakPeriods.filter((b) => new Date(b.break_date) >= todayMidnight);
  const activeVisibleExceptionCount = visibleExceptions.filter((u) => u.is_active).length;
  const activeVisibleBreakCount = visibleBreaks.filter((b) => b.is_active).length;

  const fetchSchedules = async () => {
    setLoading(true);
    const response = await apiClient.get<DoctorSchedule[]>('/doctors/me/schedules?includeInactive=true');
    if (response.success && response.data) {
      setSchedules(response.data);
    } else {
      setError(response.error || 'Failed to fetch schedules');
    }
    setLoading(false);
  };

  const fetchUnavailability = async () => {
    const response = await apiClient.get<DoctorUnavailability[]>('/doctors/me/unavailability?includeInactive=true');
    if (response.success && response.data) {
      setUnavailability(response.data);
    } else {
      setError(response.error || 'Failed to fetch exceptions');
    }
  };

  const fetchBreakPeriods = async () => {
    const response = await apiClient.get<DoctorBreakPeriod[]>('/doctors/me/break-periods?includeInactive=true');
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
    const inactiveShifts = schedules.filter(s => !s.is_active).length;

    return { activeDays, totalHours, activeShifts, inactiveShifts };
  };

  const { activeDays, totalHours, activeShifts, inactiveShifts } = calculateKPIs();

  const getSchedulesForDay = (dayValue: number) => {
    return schedules.filter(s => s.day_of_week === dayValue).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const isDayActive = (dayValue: number) => {
    return schedules.some(s => s.day_of_week === dayValue && s.is_active);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await apiClient.post<DoctorSchedule>('/doctors/me/schedules', formData);
    setSaving(false);
    if (response.success && response.data) {
      setSuccess('Schedule created successfully');
      setShowAddModal(false);
      setFormData({ dayOfWeek: 1, startTime: '08:00', endTime: '17:00', consultationDurationMinutes: 30 });
      setSchedules((prev) => [...prev, response.data as DoctorSchedule]);
      // Notify sidebar to refresh the setup progress card
      window.dispatchEvent(new CustomEvent('schedulesUpdated'));
    } else {
      setError(response.error || 'Failed to create schedule');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editingSchedule || saving) return;
    setSaving(true);

    const response = await apiClient.put<DoctorSchedule>(`/doctors/me/schedules/${editingSchedule.id}`, formData);
    setSaving(false);
    if (response.success && response.data) {
      setSuccess('Schedule updated successfully');
      setShowEditModal(false);
      setEditingSchedule(null);
      setSchedules((prev) => prev.map((s) => (s.id === editingSchedule.id ? (response.data as DoctorSchedule) : s)));
    } else {
      setError(response.error || 'Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deletingSchedule || saving) return;
    setSaving(true);

    setError(null);
    setSuccess(null);

    const response = await apiClient.delete<DoctorSchedule>(`/doctors/me/schedules/${deletingSchedule.id}`);
    setSaving(false);
    if (response.success && response.data) {
      setSuccess('Schedule deleted successfully');
      setShowDeleteModal(false);
      setDeletingSchedule(null);
      setSchedules((prev) => prev.filter((s) => s.id !== deletingSchedule.id));
      // Notify sidebar to refresh the setup progress card
      window.dispatchEvent(new CustomEvent('schedulesUpdated'));
    } else {
      setError(response.error || 'Failed to delete schedule');
    }
  };

  const openEditModal = (schedule: DoctorSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      dayOfWeek: schedule.day_of_week,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      consultationDurationMinutes: schedule.consultation_duration_minutes,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (schedule: DoctorSchedule) => {
    setDeletingSchedule(schedule);
    setShowDeleteModal(true);
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

    // Use the same date for both start and end (single-day exception)
    const payload = {
      startDate: exceptionFormData.date,
      endDate: exceptionFormData.date,
      reason: exceptionFormData.reason,
    };

    const response = await apiClient.post<DoctorUnavailability>('/doctors/me/unavailability', payload);
    if (response.success && response.data) {
      if (isPendingResponse(response.data)) {
        setSuccess(`Awaiting secretary confirmation (${response.data.affectedCount} affected appointment(s)). It is not in effect yet.`);
        setShowExceptionAddModal(false);
        setExceptionFormData({ date: '', reason: '' });
        fetchPendingRequests();
      } else {
        setSuccess('Exception created successfully');
        setShowExceptionAddModal(false);
        setExceptionFormData({ date: '', reason: '' });
        setUnavailability((prev) => [...prev, response.data as DoctorUnavailability]);
      }
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

    // Use the same date for both start and end (single-day exception)
    const payload = {
      startDate: exceptionFormData.date,
      endDate: exceptionFormData.date,
      reason: exceptionFormData.reason,
    };

    const response = await apiClient.put<DoctorUnavailability>(`/doctors/me/unavailability/${editingException.id}`, payload);
    if (response.success && response.data) {
      if (isPendingResponse(response.data)) {
        setSuccess(`Awaiting secretary confirmation (${response.data.affectedCount} affected appointment(s)). It is not in effect yet.`);
        setShowExceptionEditModal(false);
        setEditingException(null);
        fetchPendingRequests();
      } else {
        setSuccess('Exception updated successfully');
        setShowExceptionEditModal(false);
        setEditingException(null);
        setUnavailability((prev) => prev.map((u) => (u.id === editingException.id ? (response.data as DoctorUnavailability) : u)));
      }
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

    const response = await apiClient.delete<DoctorUnavailability>(`/doctors/me/unavailability/${deletingException.id}`);
    if (response.success && response.data) {
      if (isPendingResponse(response.data)) {
        setSuccess(`Awaiting secretary confirmation (${response.data.affectedCount} affected appointment(s)). It is not in effect yet.`);
        setShowExceptionDeleteModal(false);
        setDeletingException(null);
        fetchPendingRequests();
      } else {
        setSuccess('Exception deleted successfully');
        setShowExceptionDeleteModal(false);
        setDeletingException(null);
        setUnavailability((prev) => prev.filter((u) => u.id !== deletingException.id));
      }
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

    // Convert dayOfWeek to a date (using the next occurrence of that day)
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

    const response = await apiClient.post<DoctorBreakPeriod>('/doctors/me/break-periods', payload);
    if (response.success && response.data) {
      if (isPendingResponse(response.data)) {
        setSuccess(`Awaiting secretary confirmation (${response.data.affectedCount} affected appointment(s)). It is not in effect yet.`);
        setShowBreakAddModal(false);
        setBreakFormData({ breakDate: '', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', reason: '' });
        fetchPendingRequests();
      } else {
        setSuccess('Break period created successfully');
        setShowBreakAddModal(false);
        setBreakFormData({ breakDate: '', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', reason: '' });
        setBreakPeriods((prev) => [...prev, response.data as DoctorBreakPeriod]);
      }
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

    // Convert dayOfWeek to a date
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

    const response = await apiClient.put<DoctorBreakPeriod>(`/doctors/me/break-periods/${editingBreak.id}`, payload);
    if (response.success && response.data) {
      if (isPendingResponse(response.data)) {
        setSuccess(`Awaiting secretary confirmation (${response.data.affectedCount} affected appointment(s)). It is not in effect yet.`);
        setShowBreakEditModal(false);
        setEditingBreak(null);
        fetchPendingRequests();
      } else {
        setSuccess('Break period updated successfully');
        setShowBreakEditModal(false);
        setEditingBreak(null);
        setBreakPeriods((prev) => prev.map((b) => (b.id === editingBreak.id ? (response.data as DoctorBreakPeriod) : b)));
      }
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

    const response = await apiClient.delete<DoctorBreakPeriod>(`/doctors/me/break-periods/${deletingBreak.id}`);
    if (response.success && response.data) {
      if (isPendingResponse(response.data)) {
        setSuccess(`Awaiting secretary confirmation (${response.data.affectedCount} affected appointment(s)). It is not in effect yet.`);
        setShowBreakDeleteModal(false);
        setDeletingBreak(null);
        fetchPendingRequests();
      } else {
        setSuccess('Break period deleted successfully');
        setShowBreakDeleteModal(false);
        setDeletingBreak(null);
        setBreakPeriods((prev) => prev.filter((b) => b.id !== deletingBreak.id));
      }
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
    
    const response = await apiClient.get<DoctorCapacity>(`/doctors/me/capacity?date=${date}`);
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

    const response = await apiClient.post<DoctorCapacity>(`/doctors/me/capacity/${selectedDate}`, payload);
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


  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">calendar_view_week</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Active Days</span>
            <span className="text-2xl font-bold text-neutral-800">{activeDays}</span>
            <span className="text-xs text-neutral-400">This week</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success-500 to-success-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">timelapse</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Weekly Hours</span>
            <span className="text-2xl font-bold text-neutral-800">{totalHours.toFixed(1)}h</span>
            <span className="text-xs text-neutral-400">Total time</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">verified</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Active Shifts</span>
            <span className="text-2xl font-bold text-neutral-800">{activeShifts}</span>
            <span className="text-xs text-neutral-400">{inactiveShifts} inactive</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning-500 to-warning-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">domain</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Total</span>
            <span className="text-2xl font-bold text-neutral-800">{schedules.length}</span>
            <span className="text-xs text-neutral-400">All schedules</span>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {/* Toast Notification */}
      {success && <Toast message={success} type="success" onClose={() => setSuccess(null)} />}
      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
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
                {activeVisibleExceptionCount}
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
                {activeVisibleBreakCount}
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

      {/* Working Hours Tab */}
      {activeTab === 'working-hours' && (
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
        <div className="p-6 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-neutral-800">Weekly Schedule</h2>
            <div className="flex items-center gap-4 text-sm">
              <button
                onClick={() => {
                  setFormData({ ...formData, dayOfWeek: 0 });
                  setShowAddModal(true);
                }}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Shift</span>
              </button>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-100 text-success-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-success-500"></span> Active
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400"></span> Inactive
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading schedules...</div>
        ) : (
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
                                ? 'bg-gradient-to-br from-white to-neutral-50 border-neutral-200 hover:border-primary-300 shadow-sm'
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

                            <div className="flex items-center gap-2 mt-3 sm:mt-0">
                              <button
                                onClick={() => openEditModal(schedule)}
                                className="h-10 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => openDeleteModal(schedule)}
                                className="h-10 px-4 rounded-xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                <span>Delete</span>
                              </button>
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
        )}
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
              disabled={pendingExceptionCreates.length > 0}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:from-error-500 disabled:hover:to-error-600"
              title={pendingExceptionCreates.length > 0 ? 'Awaiting secretary confirmation for an exception change' : 'Add Exception'}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add Exception</span>
            </button>
          </div>
        </div>

        {pendingExceptionCreates.length > 0 && (
          <div className="px-6 pt-4">
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-warning-800">Awaiting secretary confirmation</p>
              {pendingExceptionCreates.map((req) => (
                <div key={req.id} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-warning-600 text-[18px] mt-0.5">pending_actions</span>
                  <div className="text-sm">
                    <p className="font-semibold text-warning-900">{pendingSummaryText(req)}</p>
                    <p className="text-xs text-warning-800">
                      {pendingRequestDateLabel(req)} · {req.affectedCount} affected appointment{req.affectedCount === 1 ? '' : 's'} · waiting for secretary confirmation (not in effect)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y divide-neutral-200">
          {visibleExceptions.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No exceptions configured</div>
          ) : (
            visibleExceptions
              .map((exception) => {
              const [year, month, day] = exception.start_date.split('T')[0].split('-').map(Number);
              const date = new Date(year, month - 1, day);
              const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              const pendingTarget = pendingTargetFor(exception.id);
              return (
                <div
                  key={exception.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all hover:shadow-lg ${
                    exception.is_active
                      ? 'bg-gradient-to-br from-white to-neutral-50 border-neutral-200 hover:border-error-300 shadow-sm'
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-lg font-bold ${exception.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>
                          {formattedDate}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                          exception.is_active
                            ? 'bg-gradient-to-r from-error-500 to-error-600 text-white shadow-md'
                            : 'bg-neutral-200 text-neutral-500'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${exception.is_active ? 'bg-white' : 'bg-neutral-400'}`}></span>
                          {exception.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {pendingTarget && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-warning-100 border border-warning-300 text-warning-800">
                            <span className="material-symbols-outlined text-[14px]">pending_actions</span>
                            Awaiting secretary confirmation
                          </span>
                        )}
                       </div>
                       {exception.reason && (
                        <span className="text-sm text-neutral-500 mt-1">{exception.reason}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 sm:mt-0">
                    <button
                      onClick={() => openExceptionEditModal(exception)}
                      disabled={!!pendingTarget}
                      className="h-10 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:bg-neutral-100"
                      title={pendingTarget ? 'This exception is awaiting secretary confirmation' : 'Edit'}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => openExceptionDeleteModal(exception)}
                      disabled={!!pendingTarget}
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:from-error-500 disabled:hover:to-error-600"
                      title={pendingTarget ? 'This exception is awaiting secretary confirmation' : 'Delete'}
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
              disabled={pendingBreakCreates.length > 0}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:from-primary-500 disabled:hover:to-primary-600"
              title={pendingBreakCreates.length > 0 ? 'Awaiting secretary confirmation for a break change' : 'Add Break'}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add Break</span>
            </button>
          </div>
        </div>

        {pendingBreakCreates.length > 0 && (
          <div className="px-6 pt-4">
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-warning-800">Awaiting secretary confirmation</p>
              {pendingBreakCreates.map((req) => (
                <div key={req.id} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-warning-600 text-[18px] mt-0.5">pending_actions</span>
                  <div className="text-sm">
                    <p className="font-semibold text-warning-900">{pendingSummaryText(req)}</p>
                    <p className="text-xs text-warning-800">
                      {pendingRequestDateLabel(req)} · {req.affectedCount} affected appointment{req.affectedCount === 1 ? '' : 's'} · waiting for secretary confirmation (not in effect)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y divide-neutral-200">
          {visibleBreaks.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No break periods configured</div>
          ) : (
            visibleBreaks
              .map((breakPeriod) => {
              const breakDate = new Date(breakPeriod.break_date);
              const dayName = breakDate.toLocaleDateString('en-US', { weekday: 'long' });
              const pendingTarget = pendingTargetFor(breakPeriod.id);
              return (
                <div
                  key={breakPeriod.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all hover:shadow-lg ${
                    breakPeriod.is_active
                      ? 'bg-gradient-to-br from-white to-neutral-50 border-neutral-200 hover:border-primary-300 shadow-sm'
                      : 'bg-neutral-50/50 border-dashed border-neutral-300 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                      breakPeriod.is_active
                        ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
                        : 'bg-neutral-200 text-neutral-400'
                    }`}>
                      <span className="material-symbols-outlined text-[22px]">free_breakfast</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-lg font-bold ${breakPeriod.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>
                          {dayName}
                        </span>
                        <span className={`font-mono text-lg font-bold ${breakPeriod.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>
                          {formatTime(breakPeriod.start_time)} – {formatTime(breakPeriod.end_time)}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                          breakPeriod.is_active
                            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                            : 'bg-neutral-200 text-neutral-500'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${breakPeriod.is_active ? 'bg-white' : 'bg-neutral-400'}`}></span>
                          {breakPeriod.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {pendingTarget && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-warning-100 border border-warning-300 text-warning-800">
                            <span className="material-symbols-outlined text-[14px]">pending_actions</span>
                            Awaiting secretary confirmation
                          </span>
                        )}
                       </div>
                       {breakPeriod.reason && (
                        <span className="text-sm text-neutral-500 mt-1">{breakPeriod.reason}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 sm:mt-0">
                    <button
                      onClick={() => openBreakEditModal(breakPeriod)}
                      disabled={!!pendingTarget}
                      className="h-10 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:bg-neutral-100"
                      title={pendingTarget ? 'This break is awaiting secretary confirmation' : 'Edit'}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => openBreakDeleteModal(breakPeriod)}
                      disabled={!!pendingTarget}
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:from-error-500 disabled:hover:to-error-600"
                      title={pendingTarget ? 'This break is awaiting secretary confirmation' : 'Delete'}
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
          <p className="text-sm text-neutral-500 mt-1">View and manage your daily consultation capacity</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Consultation Duration */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary-50 to-primary-50 rounded-xl border border-primary-100">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[24px]">schedule</span>
            </div>
            <div className="flex-1">
              <div className="text-sm text-neutral-500 font-medium">Consultation Duration</div>
              <div className="text-2xl font-bold text-neutral-800">30 minutes</div>
            </div>
            <div className="px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
              Fixed
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Select Date</label>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              showClear
              showToday
              onOpen={closeAllDropdowns}
            />
          </div>

          {/* Capacity Details */}
          {capacityData && (
            <div className="space-y-4">
              {/* 5-Metric Responsive Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* Calculated Capacity */}
                <div className="p-3.5 bg-gradient-to-br from-success-50/80 to-success-50/50 rounded-xl border border-success-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-success-500 to-success-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[16px]">calculate</span>
                    </div>
                    <div className="text-xs text-neutral-600 font-semibold truncate">Calculated</div>
                  </div>
                  <div className="text-2xl font-bold text-neutral-800">{capacityData.calculated_capacity}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">From working hours</div>
                </div>

                {/* Configured Capacity */}
                <div className="p-3.5 bg-gradient-to-br from-primary-50/80 to-primary-50/50 rounded-xl border border-primary-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[16px]">tune</span>
                    </div>
                    <div className="text-xs text-neutral-600 font-semibold truncate">Configured</div>
                  </div>
                  <div className="text-2xl font-bold text-neutral-800">
                    {capacityData.configured_capacity ?? 'Not set'}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">Optional limit</div>
                </div>

                {/* Final Capacity */}
                <div className="p-3.5 bg-gradient-to-br from-primary-50/80 to-primary-50/50 rounded-xl border border-primary-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                    </div>
                    <div className="text-xs text-neutral-600 font-semibold truncate">Final Limit</div>
                  </div>
                  <div className="text-2xl font-bold text-neutral-800">{capacityData.final_capacity}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">Enforced limit</div>
                </div>

                {/* Registered Count */}
                <div className="p-3.5 bg-gradient-to-br from-warning-50/80 to-warning-50/50 rounded-xl border border-warning-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-warning-500 to-warning-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[16px]">event_available</span>
                    </div>
                    <div className="text-xs text-neutral-600 font-semibold truncate">Registered</div>
                  </div>
                  <div className="text-2xl font-bold text-neutral-800">{capacityData.registered_count}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">Booked reservations</div>
                </div>

                {/* Remaining Capacity */}
                <div className={`p-3.5 rounded-xl border shadow-sm ${
                  capacityData.remaining_capacity > 0
                    ? 'bg-gradient-to-br from-success-50/80 to-success-50/50 border-success-200/80'
                    : 'bg-gradient-to-br from-error-50/80 to-error-50/50 border-error-200/80'
                }`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shadow-xs shrink-0 ${
                      capacityData.remaining_capacity > 0
                        ? 'bg-gradient-to-br from-success-500 to-success-600'
                        : 'bg-gradient-to-br from-error-500 to-error-600'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
                    </div>
                    <div className="text-xs text-neutral-600 font-semibold truncate">Remaining</div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    capacityData.remaining_capacity > 0 ? 'text-neutral-800' : 'text-error-600'
                  }`}>
                    {capacityData.remaining_capacity}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">Available slots</div>
                </div>
              </div>

              {/* Configured Capacity Input Panel */}
              <div className="p-4 bg-neutral-50/80 rounded-xl border border-neutral-200/80 max-w-xl">
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Set Configured Capacity (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={configuredCapacity}
                    onChange={(e) => handleConfiguredCapacityChange(e.target.value)}
                    className="w-44 px-3.5 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-sm font-semibold text-neutral-800 bg-white shadow-sm hover:border-neutral-400 transition-all"
                    min="0"
                    max={capacityData.calculated_capacity}
                    placeholder={`Max: ${capacityData.calculated_capacity}`}
                  />
                  <button
                    onClick={handleSaveCapacity}
                    disabled={capacityLoading}
                    className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all transform hover:scale-102 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>{capacityLoading ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  Leave empty to use calculated capacity ({capacityData.calculated_capacity})
                </p>
              </div>
            </div>
          )}

          {!capacityData && selectedDate && capacityLoading && (
            <div className="p-8 text-center text-neutral-500">Loading capacity data...</div>
          )}

          {!capacityData && !selectedDate && (
            <div className="p-8 text-center text-neutral-500">Select a date to view capacity information</div>
          )}
        </div>
      </div>
      )}

      {/* Add Modal */}
      {addModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={showAddModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={showAddModal ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-6">Add Working Hours</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Day of Week</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowDayPicker(!showDayPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{DAYS_OF_WEEK.find(d => d.value === formData.dayOfWeek)?.label}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showDayPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="grid grid-cols-2 gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, dayOfWeek: day.value });
                              setShowDayPicker(false);
                            }}
                            className={`px-3 py-2 rounded-lg border transition-all ${
                              formData.dayOfWeek === day.value
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-primary-300 hover:bg-primary-50'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Start Time</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowStartPicker(!showStartPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{formData.startTime}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showStartPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Hour</label>
                          <select
                            value={formData.startTime.split(':')[0]}
                            onChange={(e) => setFormData({ ...formData, startTime: `${e.target.value}:${formData.startTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Minute</label>
                          <select
                            value={formData.startTime.split(':')[1]}
                            onChange={(e) => setFormData({ ...formData, startTime: `${formData.startTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">End Time</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowEndPicker(!showEndPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{formData.endTime}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showEndPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Hour</label>
                          <select
                            value={formData.endTime.split(':')[0]}
                            onChange={(e) => setFormData({ ...formData, endTime: `${e.target.value}:${formData.endTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Minute</label>
                          <select
                            value={formData.endTime.split(':')[1]}
                            onChange={(e) => setFormData({ ...formData, endTime: `${formData.endTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Consultation Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.consultationDurationMinutes}
                  onChange={(e) => setFormData({ ...formData, consultationDurationMinutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-white hover:border-primary-300 transition-all"
                  min="15"
                  step="5"
                  required
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Add Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={editModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={editModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-6">Edit Working Hours</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Start Time</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowStartPicker(!showStartPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{formData.startTime}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showStartPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Hour</label>
                          <select
                            value={formData.startTime.split(':')[0]}
                            onChange={(e) => setFormData({ ...formData, startTime: `${e.target.value}:${formData.startTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Minute</label>
                          <select
                            value={formData.startTime.split(':')[1]}
                            onChange={(e) => setFormData({ ...formData, startTime: `${formData.startTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">End Time</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowEndPicker(!showEndPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{formData.endTime}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showEndPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Hour</label>
                          <select
                            value={formData.endTime.split(':')[0]}
                            onChange={(e) => setFormData({ ...formData, endTime: `${e.target.value}:${formData.endTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Minute</label>
                          <select
                            value={formData.endTime.split(':')[1]}
                            onChange={(e) => setFormData({ ...formData, endTime: `${formData.endTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Consultation Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.consultationDurationMinutes}
                  onChange={(e) => setFormData({ ...formData, consultationDurationMinutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-white hover:border-primary-300 transition-all"
                  min="15"
                  step="5"
                  required
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSchedule(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Update Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={deleteModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={deleteModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-3">Delete Schedule</h3>
            <p className="text-neutral-600 mb-8 text-base">
              Are you sure you want to delete this schedule? It will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingSchedule(null);
                }}
                className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSchedule}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exception Add Modal */}
      {exceptionAddModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={showExceptionAddModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={showExceptionAddModal ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-6">Add Exception</h3>
            <form onSubmit={handleExceptionAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Date</label>
                <DatePicker
                  value={exceptionFormData.date}
                  onChange={(date) => setExceptionFormData({ ...exceptionFormData, date: date })}
                  disabledDates={unavailability.filter(u => u.is_active).map(u => u.start_date.split('T')[0])}
                  showClear
                  showToday
                onOpen={closeAllDropdowns}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={exceptionFormData.reason}
                  onChange={(e) => setExceptionFormData({ ...exceptionFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-white hover:border-primary-300 transition-all"
                  placeholder="e.g., Doctor leave, Clinic closure"
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowExceptionAddModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Add Exception'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exception Edit Modal */}
      {exceptionEditModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={exceptionEditModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={exceptionEditModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-6">Edit Exception</h3>
            <form onSubmit={handleExceptionEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Date</label>
                <DatePicker
                  value={exceptionFormData.date}
                  onChange={(date) => setExceptionFormData({ ...exceptionFormData, date: date })}
                  disabledDates={unavailability.filter(u => u.is_active && u.id !== editingException?.id).map(u => u.start_date.split('T')[0])}
                  showClear
                  showToday
                onOpen={closeAllDropdowns}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={exceptionFormData.reason}
                  onChange={(e) => setExceptionFormData({ ...exceptionFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-white hover:border-primary-300 transition-all"
                  placeholder="e.g., Doctor leave, Clinic closure"
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowExceptionEditModal(false);
                    setEditingException(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Update Exception'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exception Delete Confirmation Modal */}
      {exceptionDeleteModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={exceptionDeleteModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={exceptionDeleteModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-3">Delete Exception</h3>
            <p className="text-neutral-600 mb-8 text-base">
              Are you sure you want to delete this exception? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowExceptionDeleteModal(false);
                  setDeletingException(null);
                }}
                className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleExceptionDelete}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Break Period Add Modal */}
      {breakAddModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={showBreakAddModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={showBreakAddModal ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-6">Add Break Period</h3>
            <form onSubmit={handleBreakAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Day of Week</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowBreakDayPicker(!showBreakDayPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{DAYS_OF_WEEK.find(d => d.value === breakFormData.dayOfWeek)?.label}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showBreakDayPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="grid grid-cols-2 gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              setBreakFormData({ ...breakFormData, dayOfWeek: day.value });
                              setShowBreakDayPicker(false);
                            }}
                            className={`px-3 py-2 rounded-lg border transition-all ${
                              breakFormData.dayOfWeek === day.value
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-primary-300 hover:bg-primary-50'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Start Time</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowBreakStartPicker(!showBreakStartPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{breakFormData.startTime}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showBreakStartPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Hour</label>
                          <select
                            value={breakFormData.startTime.split(':')[0]}
                            onChange={(e) => setBreakFormData({ ...breakFormData, startTime: `${e.target.value}:${breakFormData.startTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Minute</label>
                          <select
                            value={breakFormData.startTime.split(':')[1]}
                            onChange={(e) => setBreakFormData({ ...breakFormData, startTime: `${breakFormData.startTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">End Time</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowBreakEndPicker(!showBreakEndPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{breakFormData.endTime}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showBreakEndPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Hour</label>
                          <select
                            value={breakFormData.endTime.split(':')[0]}
                            onChange={(e) => setBreakFormData({ ...breakFormData, endTime: `${e.target.value}:${breakFormData.endTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Minute</label>
                          <select
                            value={breakFormData.endTime.split(':')[1]}
                            onChange={(e) => setBreakFormData({ ...breakFormData, endTime: `${breakFormData.endTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={breakFormData.reason}
                  onChange={(e) => setBreakFormData({ ...breakFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-white hover:border-primary-300 transition-all"
                  placeholder="e.g., Lunch break"
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowBreakAddModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Add Break'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Break Period Edit Modal */}
      {breakEditModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={breakEditModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={breakEditModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-6">Edit Break Period</h3>
            <form onSubmit={handleBreakEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Day of Week</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowBreakEditDayPicker(!showBreakEditDayPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{DAYS_OF_WEEK.find(d => d.value === breakFormData.dayOfWeek)?.label}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showBreakEditDayPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="grid grid-cols-2 gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              setBreakFormData({ ...breakFormData, dayOfWeek: day.value });
                              setShowBreakEditDayPicker(false);
                            }}
                            className={`px-3 py-2 rounded-lg border transition-all ${
                              breakFormData.dayOfWeek === day.value
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-primary-300 hover:bg-primary-50'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Start Time</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowBreakStartPicker(!showBreakStartPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{breakFormData.startTime}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showBreakStartPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Hour</label>
                          <select
                            value={breakFormData.startTime.split(':')[0]}
                            onChange={(e) => setBreakFormData({ ...breakFormData, startTime: `${e.target.value}:${breakFormData.startTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Minute</label>
                          <select
                            value={breakFormData.startTime.split(':')[1]}
                            onChange={(e) => setBreakFormData({ ...breakFormData, startTime: `${breakFormData.startTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">End Time</label>
                <div className="relative dropdown-container">
                  <div
                    onClick={() => {
                      closeAllDropdowns();
                      setShowBreakEndPicker(!showBreakEndPicker);
                    }}
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-gradient-to-r from-white to-neutral-50 hover:border-primary-300 transition-all cursor-pointer relative"
                  >
                    <span>{breakFormData.endTime}</span>
                    <span className="material-symbols-outlined text-primary-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showBreakEndPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 z-10">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Hour</label>
                          <select
                            value={breakFormData.endTime.split(':')[0]}
                            onChange={(e) => setBreakFormData({ ...breakFormData, endTime: `${e.target.value}:${breakFormData.endTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 mb-2">Minute</label>
                          <select
                            value={breakFormData.endTime.split(':')[1]}
                            onChange={(e) => setBreakFormData({ ...breakFormData, endTime: `${breakFormData.endTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-neutral-700 bg-white"
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={breakFormData.reason}
                  onChange={(e) => setBreakFormData({ ...breakFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-400 bg-white hover:border-primary-300 transition-all"
                  placeholder="e.g., Lunch break"
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowBreakEditModal(false);
                    setEditingBreak(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Update Break'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Break Period Delete Confirmation Modal */}
      {breakDeleteModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={breakDeleteModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={breakDeleteModalOpen ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-3">Delete Break Period</h3>
            <p className="text-neutral-600 mb-8 text-base">
              Are you sure you want to delete this break period? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBreakDeleteModal(false);
                  setDeletingBreak(null);
                }}
                className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBreakDelete}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
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
