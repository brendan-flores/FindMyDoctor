'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';

interface DoctorInfo {
  doctor_first_name: string;
  doctor_last_name: string;
  practice_name: string;
}

interface CapacityData {
  date: string;
  calculated_capacity: number;
  configured_capacity: number | null;
  final_capacity: number;
  registered_count: number;
  remaining_capacity: number;
  consultation_duration_minutes: number;
}

export default function SecretaryCapacity() {
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [capacityData, setCapacityData] = useState<CapacityData | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [configuredCapacity, setConfiguredCapacity] = useState<number | ''>('');
  const [showCapacityDatePicker, setShowCapacityDatePicker] = useState(false);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchDoctorInfo();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowCapacityDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDoctorInfo = async () => {
    setLoading(true);
    const response = await apiClient.get<DoctorInfo>('/secretaries/me');
    if (response.success && response.data) {
      setDoctorInfo(response.data as any);
    } else {
      setError(response.error || 'Failed to fetch doctor information');
    }
    setLoading(false);
  };

  const fetchCapacity = async (date: string) => {
    if (!date) return;

    setCapacityLoading(true);
    setError(null);

    const response = await apiClient.get<CapacityData>(`/secretaries/managed-doctors/capacity?date=${date}`);
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
    
    const response = await apiClient.post<CapacityData>(`/secretaries/managed-doctors/capacity/${selectedDate}`, payload);
    if (response.success && response.data) {
      setSuccess('Capacity updated successfully');
      setCapacityData(response.data);
      setConfiguredCapacity(response.data.configured_capacity ?? '');
    } else {
      setError(response.error || 'Failed to update capacity');
    }
    setCapacityLoading(false);
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

  const DatePicker = ({ value, onChange, showPicker, setShowPicker }: { value: string, onChange: (date: string) => void, showPicker: boolean, setShowPicker: (show: boolean) => void }) => {
    const currentDate = value ? (() => {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    })() : new Date();
    const [viewMonth, setViewMonth] = useState(currentDate.getMonth());
    const [viewYear, setViewYear] = useState(currentDate.getFullYear());

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const handlePrevMonth = () => {
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

    const handleDateSelect = (day: number) => {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      onChange(dateStr);
      setShowPicker(false);
    };

    const handleClear = () => {
      onChange('');
      setShowPicker(false);
    };

    const handleToday = () => {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      onChange(dateStr);
      setViewMonth(today.getMonth());
      setViewYear(today.getFullYear());
      setShowPicker(false);
    };

    return (
      <div className="relative dropdown-container">
        <div
          onClick={() => setShowPicker(!showPicker)}
          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white hover:border-blue-300 transition-all cursor-pointer"
        >
          {formatDate(value)}
        </div>
        {showPicker && (
          <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-10 w-full">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-slate-600">chevron_left</span>
              </button>
              <span className="font-semibold text-slate-700">
                {monthNames[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-slate-600">chevron_right</span>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
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
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`p-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-slate-100 text-slate-700'
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Doctor Info Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <span className="material-symbols-outlined text-[26px]">analytics</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Capacity Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {doctorInfo && (
                <>
                  {doctorInfo.doctor_first_name} {doctorInfo.doctor_last_name} • {doctorInfo.practice_name}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {success && <Toast message={success} type="success" onClose={() => setSuccess(null)} />}
      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}

      {/* Capacity Management */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="text-xl font-bold text-slate-800">Daily Capacity Settings</h2>
          <p className="text-sm text-slate-500 mt-1">Manage consultation capacity for your doctor</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Date Picker */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Select Date</label>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              showPicker={showCapacityDatePicker}
              setShowPicker={setShowCapacityDatePicker}
            />
          </div>

          {/* Capacity Details */}
          {capacityData && (
            <div className="space-y-4">
              {/* 5-Metric Responsive Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* Calculated Capacity */}
                <div className="p-3.5 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-xl border border-emerald-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[16px]">calculate</span>
                    </div>
                    <div className="text-xs text-slate-600 font-semibold truncate">Calculated</div>
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{capacityData.calculated_capacity}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">From working hours</div>
                </div>

                {/* Configured Capacity */}
                <div className="p-3.5 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 rounded-xl border border-blue-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[16px]">tune</span>
                    </div>
                    <div className="text-xs text-slate-600 font-semibold truncate">Configured</div>
                  </div>
                  <div className="text-2xl font-bold text-slate-800">
                    {capacityData.configured_capacity ?? 'Not set'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">Optional limit</div>
                </div>

                {/* Final Capacity */}
                <div className="p-3.5 bg-gradient-to-br from-purple-50/80 to-violet-50/50 rounded-xl border border-purple-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                    </div>
                    <div className="text-xs text-slate-600 font-semibold truncate">Final Limit</div>
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{capacityData.final_capacity}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">Enforced limit</div>
                </div>

                {/* Registered Count */}
                <div className="p-3.5 bg-gradient-to-br from-amber-50/80 to-orange-50/50 rounded-xl border border-amber-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[16px]">event_available</span>
                    </div>
                    <div className="text-xs text-slate-600 font-semibold truncate">Registered</div>
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{capacityData.registered_count}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">Booked reservations</div>
                </div>

                {/* Remaining Capacity */}
                <div className={`p-3.5 rounded-xl border shadow-sm ${
                  capacityData.remaining_capacity > 0
                    ? 'bg-gradient-to-br from-emerald-50/80 to-green-50/50 border-emerald-200/80'
                    : 'bg-gradient-to-br from-rose-50/80 to-red-50/50 border-rose-200/80'
                }`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shadow-xs shrink-0 ${
                      capacityData.remaining_capacity > 0
                        ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                        : 'bg-gradient-to-br from-rose-500 to-red-600'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
                    </div>
                    <div className="text-xs text-slate-600 font-semibold truncate">Remaining</div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    capacityData.remaining_capacity > 0 ? 'text-slate-800' : 'text-red-600'
                  }`}>
                    {capacityData.remaining_capacity}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">Available slots</div>
                </div>
              </div>

              {/* Configured Capacity Input Panel */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 max-w-xl">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Set Configured Capacity (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={configuredCapacity}
                    onChange={(e) => handleConfiguredCapacityChange(e.target.value)}
                    className="w-44 px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-slate-800 bg-white shadow-sm hover:border-slate-400 transition-all"
                    min="0"
                    max={capacityData.calculated_capacity}
                    placeholder={`Max: ${capacityData.calculated_capacity}`}
                  />
                  <button
                    onClick={handleSaveCapacity}
                    disabled={capacityLoading}
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all transform hover:scale-102 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>{capacityLoading ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Leave empty to use calculated capacity ({capacityData.calculated_capacity})
                </p>
              </div>
            </div>
          )}

          {!capacityData && selectedDate && capacityLoading && (
            <div className="p-8 text-center text-slate-500">Loading capacity data...</div>
          )}

          {!capacityData && !selectedDate && (
            <div className="p-8 text-center text-slate-500">Select a date to view capacity information</div>
          )}
        </div>
      </div>
    </div>
  );
}
