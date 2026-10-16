'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';

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
  const [showExceptionStartDatePicker, setShowExceptionStartDatePicker] = useState(false);
  const [showExceptionEditStartDatePicker, setShowExceptionEditStartDatePicker] = useState(false);

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
  const [showCapacityDatePicker, setShowCapacityDatePicker] = useState(false);
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
    setShowExceptionStartDatePicker(false);
    setShowExceptionEditStartDatePicker(false);
    setShowCapacityDatePicker(false);
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
      fetchUnavailability();
    } else {
      setError(response.error || 'Failed to create exception');
    }
  };

  const handleExceptionEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editingException) return;

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
      fetchUnavailability();
    } else {
      setError(response.error || 'Failed to update exception');
    }
  };

  const handleExceptionDelete = async () => {
    if (!deletingException) return;

    setError(null);
    setSuccess(null);

    const response = await apiClient.delete<DoctorUnavailability>(`/secretaries/managed-doctors/unavailability/${deletingException.id}`);
    if (response.success && response.data) {
      setSuccess('Exception deleted successfully');
      setShowExceptionDeleteModal(false);
      setDeletingException(null);
      fetchUnavailability();
    } else {
      setError(response.error || 'Failed to delete exception');
    }
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
      fetchBreakPeriods();
    } else {
      setError(response.error || 'Failed to create break period');
    }
  };

  const handleBreakEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editingBreak) return;

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
      fetchBreakPeriods();
    } else {
      setError(response.error || 'Failed to update break period');
    }
  };

  const handleBreakDelete = async () => {
    if (!deletingBreak) return;

    setError(null);
    setSuccess(null);

    const response = await apiClient.delete<DoctorBreakPeriod>(`/secretaries/managed-doctors/break-periods/${deletingBreak.id}`);
    if (response.success && response.data) {
      setSuccess('Break period deleted successfully');
      setShowBreakDeleteModal(false);
      setDeletingBreak(null);
      fetchBreakPeriods();
    } else {
      setError(response.error || 'Failed to delete break period');
    }
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

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const DatePicker = ({ value, onChange, showPicker, setShowPicker, disabledDates }: { value: string, onChange: (date: string) => void, showPicker: boolean, setShowPicker: (show: boolean) => void, disabledDates?: string[] }) => {
    const currentDate = value ? (() => {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    })() : new Date();
    const [viewMonth, setViewMonth] = useState(currentDate.getMonth());
    const [viewYear, setViewYear] = useState(currentDate.getFullYear());

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const handleDateClick = (day: number) => {
      const formattedDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      onChange(formattedDate);
      setShowPicker(false);
    };

    const isDateDisabled = (day: number) => {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return disabledDates?.includes(dateStr);
    };

    const handlePreviousMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(viewYear - 1);
      } else {
        setViewMonth(viewMonth - 1);
      }
    };

    const handleNextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(viewYear + 1);
      } else {
        setViewMonth(viewMonth + 1);
      }
    };

    const handleToday = () => {
      const today = new Date();
      const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      onChange(formattedDate);
      setShowPicker(false);
    };

    const handleClear = () => {
      onChange('');
      setShowPicker(false);
    };

    return (
      <div className="relative dropdown-container">
        <div
          onClick={() => {
            closeAllDropdowns();
            setShowPicker(!showPicker);
          }}
          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-400 bg-gradient-to-r from-white to-slate-50 hover:border-blue-300 transition-all cursor-pointer relative"
        >
          <span>{formatDate(value)}</span>
          <span className="material-symbols-outlined text-blue-600 absolute right-6 text-[20px]">calendar_today</span>
        </div>
        {showPicker && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-10">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePreviousMonth}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-600">chevron_left</span>
              </button>
              <span className="font-semibold text-slate-800">{monthNames[viewMonth]} {viewYear}</span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-600">chevron_right</span>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-slate-500 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2"></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = value === dateStr;
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const isToday = todayStr === dateStr;
                const disabled = isDateDisabled(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => !disabled && handleDateClick(day)}
                    disabled={disabled}
                    className={`p-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                        : isToday
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : disabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    );
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
        <h1 className="text-2xl font-bold text-slate-900">Schedule Management</h1>
        <p className="text-slate-600 mt-1">Manage your assigned doctor's schedule, exceptions, and capacity</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 mb-6">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('working-hours')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
              activeTab === 'working-hours'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
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
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">event_busy</span>
              Exceptions
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold">
                {activeUnavailability.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('breaks')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
              activeTab === 'breaks'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">free_breakfast</span>
              Break Periods
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold">
                {activeBreakPeriods.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-all ${
              activeTab === 'capacity'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
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
          <div className="text-slate-500">Loading...</div>
        </div>
      ) : (
        <>
          {/* Working Hours Tab - Read Only */}
          {activeTab === 'working-hours' && (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100">
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Weekly Working Hours</h2>
                    <p className="text-sm text-slate-500 mt-1">View-only: Contact your doctor to modify weekly working hours</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Active
                    </span>
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Inactive
                    </span>
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[24px]">calendar_today</span>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 font-medium">Active Days</div>
                      <div className="text-3xl font-bold text-slate-900">{activeDays}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[24px]">schedule</span>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 font-medium">Total Hours</div>
                      <div className="text-3xl font-bold text-slate-900">{totalHours.toFixed(1)}h</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-white text-[24px]">wb_sunny</span>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 font-medium">Active Shifts</div>
                      <div className="text-3xl font-bold text-slate-900">{activeShifts}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Grid */}
              <div className="divide-y divide-slate-200">
                {DAYS_OF_WEEK.map((day) => {
                  const daySchedules = getSchedulesForDay(day.value);
                  const active = isDayActive(day.value);

                  return (
                    <div key={day.value} className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{day.label}</h3>
                          {active ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {daySchedules.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-sm">
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
                                    ? 'bg-gradient-to-br from-white to-slate-50 border-slate-200 hover:border-blue-300 shadow-sm'
                                    : 'bg-slate-50/50 border-dashed border-slate-300 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                                    schedule.is_active
                                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                                      : 'bg-slate-200 text-slate-400'
                                  }`}>
                                    <span className="material-symbols-outlined text-[22px]">wb_sunny</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`font-mono text-lg font-bold ${schedule.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                        {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                                      </span>
                                      <span className="text-sm text-slate-500 font-medium">({duration.toFixed(1)}h)</span>
                                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                                        schedule.is_active
                                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md'
                                          : 'bg-slate-200 text-slate-500'
                                      }`}>
                                        <span className={`w-2 h-2 rounded-full ${schedule.is_active ? 'bg-white' : 'bg-slate-400'}`}></span>
                                        {schedule.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <span className="text-sm text-slate-400 mt-1">
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
            <div className="bg-white rounded-2xl shadow-md border border-slate-100">
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">Date-Specific Exceptions</h2>
                  <button
                    onClick={() => setShowExceptionAddModal(true)}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>Add Exception</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                {activeUnavailability.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No exceptions configured</div>
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
                            ? 'bg-gradient-to-br from-white to-slate-50 border-slate-200 hover:border-red-300 shadow-sm'
                            : 'bg-slate-50/50 border-dashed border-slate-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                            exception.is_active
                              ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}>
                            <span className="material-symbols-outlined text-[22px]">event_busy</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="font-semibold text-slate-900">{formattedDate}</div>
                            {exception.reason && (
                              <div className="text-sm text-slate-500 mt-1">{exception.reason}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 sm:mt-0">
                          <button
                            onClick={() => openExceptionEditModal(exception)}
                            className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => openExceptionDeleteModal(exception)}
                            className="h-10 px-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
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
            <div className="bg-white rounded-2xl shadow-md border border-slate-100">
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">Break Periods</h2>
                  <button
                    onClick={() => setShowBreakAddModal(true)}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>Add Break</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                {activeBreakPeriods.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No break periods configured</div>
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
                            ? 'bg-gradient-to-br from-white to-slate-50 border-slate-200 hover:border-blue-300 shadow-sm'
                            : 'bg-slate-50/50 border-dashed border-slate-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                            breakPeriod.is_active
                              ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}>
                            <span className="material-symbols-outlined text-[22px]">free_breakfast</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="font-semibold text-slate-900">{formattedDate}</div>
                            <div className="text-sm text-slate-500 mt-1">
                              {formatTime(breakPeriod.start_time)} - {formatTime(breakPeriod.end_time)}
                            </div>
                            {breakPeriod.reason && (
                              <div className="text-sm text-slate-500 mt-1">{breakPeriod.reason}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 sm:mt-0">
                          <button
                            onClick={() => openBreakEditModal(breakPeriod)}
                            className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => openBreakDeleteModal(breakPeriod)}
                            className="h-10 px-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
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
            <div className="bg-white rounded-2xl shadow-md border border-slate-100">
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-xl font-bold text-slate-800">Daily Capacity Management</h2>
                <p className="text-sm text-slate-500 mt-1">Configure maximum patient capacity for specific dates</p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Select Date</label>
                  <DatePicker
                    value={selectedDate}
                    onChange={handleDateChange}
                    showPicker={showCapacityDatePicker}
                    setShowPicker={setShowCapacityDatePicker}
                  />
                </div>

                {capacityData && (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-5 shadow-sm">
                      <div className="text-xs text-slate-500 font-semibold mb-1">Calculated</div>
                      <div className="text-2xl font-bold text-slate-900">{capacityData.calculated_capacity}</div>
                    </div>
                    <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm">
                      <div className="text-xs text-slate-500 font-semibold mb-1">Configured</div>
                      <input
                        type="number"
                        value={configuredCapacity}
                        onChange={(e) => handleConfiguredCapacityChange(e.target.value)}
                        min="0"
                        max={capacityData.calculated_capacity}
                        className="w-full text-2xl font-bold text-slate-900 border-b-2 border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
                      />
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
                      <div className="text-xs text-slate-500 font-semibold mb-1">Final Limit</div>
                      <div className="text-2xl font-bold text-slate-900">{capacityData.final_capacity}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-2xl p-5 shadow-sm">
                      <div className="text-xs text-slate-500 font-semibold mb-1">Registered</div>
                      <div className="text-2xl font-bold text-slate-900">{capacityData.registered_count}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-2xl p-5 shadow-sm">
                      <div className="text-xs text-slate-500 font-semibold mb-1">Remaining</div>
                      <div className="text-2xl font-bold text-slate-900">{capacityData.remaining_capacity}</div>
                    </div>
                  </div>
                )}

                {capacityData && (
                  <button
                    onClick={handleSaveCapacity}
                    disabled={capacityLoading}
                    className="h-12 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
      {showExceptionAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Add Exception</h3>
            <form onSubmit={handleExceptionAddSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
                <DatePicker
                  value={exceptionFormData.date}
                  onChange={(date) => setExceptionFormData({ ...exceptionFormData, date })}
                  showPicker={showExceptionStartDatePicker}
                  setShowPicker={setShowExceptionStartDatePicker}
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={exceptionFormData.reason}
                  onChange={(e) => setExceptionFormData({ ...exceptionFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExceptionAddModal(false)}
                  className="h-10 px-6 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exception Edit Modal */}
      {showExceptionEditModal && editingException && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Edit Exception</h3>
            <form onSubmit={handleExceptionEditSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
                <DatePicker
                  value={exceptionFormData.date}
                  onChange={(date) => setExceptionFormData({ ...exceptionFormData, date })}
                  showPicker={showExceptionEditStartDatePicker}
                  setShowPicker={setShowExceptionEditStartDatePicker}
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={exceptionFormData.reason}
                  onChange={(e) => setExceptionFormData({ ...exceptionFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExceptionEditModal(false)}
                  className="h-10 px-6 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exception Delete Modal */}
      {showExceptionDeleteModal && deletingException && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Delete Exception</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to delete this exception?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExceptionDeleteModal(false)}
                className="h-10 px-6 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleExceptionDelete}
                className="h-10 px-6 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Break Add Modal */}
      {showBreakAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Add Break Period</h3>
            <form onSubmit={handleBreakAddSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Day of Week</label>
                <select
                  value={breakFormData.dayOfWeek}
                  onChange={(e) => setBreakFormData({ ...breakFormData, dayOfWeek: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={breakFormData.startTime}
                  onChange={(e) => setBreakFormData({ ...breakFormData, startTime: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={breakFormData.endTime}
                  onChange={(e) => setBreakFormData({ ...breakFormData, endTime: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={breakFormData.reason}
                  onChange={(e) => setBreakFormData({ ...breakFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBreakAddModal(false)}
                  className="h-10 px-6 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Break Edit Modal */}
      {showBreakEditModal && editingBreak && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Edit Break Period</h3>
            <form onSubmit={handleBreakEditSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Day of Week</label>
                <select
                  value={breakFormData.dayOfWeek}
                  onChange={(e) => setBreakFormData({ ...breakFormData, dayOfWeek: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={breakFormData.startTime}
                  onChange={(e) => setBreakFormData({ ...breakFormData, startTime: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={breakFormData.endTime}
                  onChange={(e) => setBreakFormData({ ...breakFormData, endTime: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={breakFormData.reason}
                  onChange={(e) => setBreakFormData({ ...breakFormData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBreakEditModal(false)}
                  className="h-10 px-6 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Break Delete Modal */}
      {showBreakDeleteModal && deletingBreak && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Delete Break Period</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to delete this break period?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBreakDeleteModal(false)}
                className="h-10 px-6 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBreakDelete}
                className="h-10 px-6 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold shadow-md transition-all transform hover:scale-105"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
