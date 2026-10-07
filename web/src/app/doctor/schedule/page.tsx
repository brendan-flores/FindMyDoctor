'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/apiClient';

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

export default function DoctorSchedule() {
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DoctorSchedule | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivatingSchedule, setDeactivatingSchedule] = useState<DoctorSchedule | null>(null);
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

  useEffect(() => {
    // Load token from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.setToken(token);
    }
    fetchSchedules();
  }, []);

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
    setError(null);
    setSuccess(null);

    const response = await apiClient.post<DoctorSchedule>('/doctors/me/schedules', formData);
    if (response.success && response.data) {
      setSuccess('Schedule created successfully');
      setShowAddModal(false);
      setFormData({ dayOfWeek: 1, startTime: '08:00', endTime: '17:00', consultationDurationMinutes: 30 });
      fetchSchedules();
    } else {
      setError(response.error || 'Failed to create schedule');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editingSchedule) return;

    const response = await apiClient.put<DoctorSchedule>(`/doctors/me/schedules/${editingSchedule.id}`, formData);
    if (response.success && response.data) {
      setSuccess('Schedule updated successfully');
      setShowEditModal(false);
      setEditingSchedule(null);
      fetchSchedules();
    } else {
      setError(response.error || 'Failed to update schedule');
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingSchedule) return;

    setError(null);
    setSuccess(null);

    const response = await apiClient.patch<DoctorSchedule>(`/doctors/me/schedules/${deactivatingSchedule.id}/deactivate`, {});
    if (response.success && response.data) {
      setSuccess('Schedule deactivated successfully');
      setShowDeactivateModal(false);
      setDeactivatingSchedule(null);
      fetchSchedules();
    } else {
      setError(response.error || 'Failed to deactivate schedule');
    }
  };

  const handleReactivate = async (schedule: DoctorSchedule) => {
    setError(null);
    setSuccess(null);

    const response = await apiClient.patch<DoctorSchedule>(`/doctors/me/schedules/${schedule.id}/reactivate`, {});
    if (response.success && response.data) {
      setSuccess('Schedule reactivated successfully');
      fetchSchedules();
    } else {
      setError(response.error || 'Failed to reactivate schedule');
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

  const openDeactivateModal = (schedule: DoctorSchedule) => {
    setDeactivatingSchedule(schedule);
    setShowDeactivateModal(true);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">calendar_view_week</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Days</span>
            <span className="text-2xl font-bold text-slate-800">{activeDays}</span>
            <span className="text-xs text-slate-400">This week</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">timelapse</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Weekly Hours</span>
            <span className="text-2xl font-bold text-slate-800">{totalHours.toFixed(1)}h</span>
            <span className="text-xs text-slate-400">Total time</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">verified</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Shifts</span>
            <span className="text-2xl font-bold text-slate-800">{activeShifts}</span>
            <span className="text-xs text-slate-400">{inactiveShifts} inactive</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">domain</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total</span>
            <span className="text-2xl font-bold text-slate-800">{schedules.length}</span>
            <span className="text-xs text-slate-400">All schedules</span>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Weekly Schedule */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Weekly Schedule</h2>
            <div className="flex items-center gap-4 text-sm">
              <button
                onClick={() => {
                  setFormData({ ...formData, dayOfWeek: 0 });
                  setShowAddModal(true);
                }}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Shift</span>
              </button>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Active
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Inactive
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading schedules...</div>
        ) : (
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

                            <div className="flex items-center gap-2 mt-3 sm:mt-0">
                              {schedule.is_active ? (
                                <>
                                  <button
                                    onClick={() => openEditModal(schedule)}
                                    className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105"
                                    title="Edit"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => openDeactivateModal(schedule)}
                                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                                    title="Deactivate"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">pause_circle</span>
                                    <span>Deactivate</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleReactivate(schedule)}
                                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
                                    title="Reactivate"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">play_circle</span>
                                    <span>Reactivate</span>
                                  </button>
                                  <button
                                    onClick={() => openEditModal(schedule)}
                                    className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center gap-2 transition-all transform hover:scale-105"
                                    title="Edit"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                    <span>Edit</span>
                                  </button>
                                </>
                              )}
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-slate-800 mb-6">Add Working Hours</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Day of Week</label>
                <div className="relative">
                  <div
                    onClick={() => setShowDayPicker(!showDayPicker)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-400 bg-gradient-to-r from-white to-slate-50 hover:border-blue-300 transition-all cursor-pointer relative"
                  >
                    <span>{DAYS_OF_WEEK.find(d => d.value === formData.dayOfWeek)?.label}</span>
                    <span className="material-symbols-outlined text-blue-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showDayPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-10">
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
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">Start Time</label>
                <div className="relative">
                  <div
                    onClick={() => setShowStartPicker(!showStartPicker)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-400 bg-gradient-to-r from-white to-slate-50 hover:border-blue-300 transition-all cursor-pointer relative"
                  >
                    <span>{formData.startTime}</span>
                    <span className="material-symbols-outlined text-blue-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showStartPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-10">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">Hour</label>
                          <select
                            value={formData.startTime.split(':')[0]}
                            onChange={(e) => setFormData({ ...formData, startTime: `${e.target.value}:${formData.startTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">Minute</label>
                          <select
                            value={formData.startTime.split(':')[1]}
                            onChange={(e) => setFormData({ ...formData, startTime: `${formData.startTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">End Time</label>
                <div className="relative">
                  <div
                    onClick={() => setShowEndPicker(!showEndPicker)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-400 bg-gradient-to-r from-white to-slate-50 hover:border-blue-300 transition-all cursor-pointer relative"
                  >
                    <span>{formData.endTime}</span>
                    <span className="material-symbols-outlined text-blue-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showEndPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-10">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">Hour</label>
                          <select
                            value={formData.endTime.split(':')[0]}
                            onChange={(e) => setFormData({ ...formData, endTime: `${e.target.value}:${formData.endTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">Minute</label>
                          <select
                            value={formData.endTime.split(':')[1]}
                            onChange={(e) => setFormData({ ...formData, endTime: `${formData.endTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">Consultation Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.consultationDurationMinutes}
                  onChange={(e) => setFormData({ ...formData, consultationDurationMinutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-400 bg-white hover:border-blue-300 transition-all"
                  min="15"
                  step="5"
                  required
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  Add Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSchedule && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-slate-800 mb-6">Edit Working Hours</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Start Time</label>
                <div className="relative">
                  <div
                    onClick={() => setShowStartPicker(!showStartPicker)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-400 bg-gradient-to-r from-white to-slate-50 hover:border-blue-300 transition-all cursor-pointer relative"
                  >
                    <span>{formData.startTime}</span>
                    <span className="material-symbols-outlined text-blue-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showStartPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-10">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">Hour</label>
                          <select
                            value={formData.startTime.split(':')[0]}
                            onChange={(e) => setFormData({ ...formData, startTime: `${e.target.value}:${formData.startTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">Minute</label>
                          <select
                            value={formData.startTime.split(':')[1]}
                            onChange={(e) => setFormData({ ...formData, startTime: `${formData.startTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">End Time</label>
                <div className="relative">
                  <div
                    onClick={() => setShowEndPicker(!showEndPicker)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-400 bg-gradient-to-r from-white to-slate-50 hover:border-blue-300 transition-all cursor-pointer relative"
                  >
                    <span>{formData.endTime}</span>
                    <span className="material-symbols-outlined text-blue-600 absolute right-6 text-[20px]">expand_more</span>
                  </div>
                  {showEndPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-10">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">Hour</label>
                          <select
                            value={formData.endTime.split(':')[0]}
                            onChange={(e) => setFormData({ ...formData, endTime: `${e.target.value}:${formData.endTime.split(':')[1]}` })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-2">Minute</label>
                          <select
                            value={formData.endTime.split(':')[1]}
                            onChange={(e) => setFormData({ ...formData, endTime: `${formData.endTime.split(':')[0]}:${e.target.value}` })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">Consultation Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.consultationDurationMinutes}
                  onChange={(e) => setFormData({ ...formData, consultationDurationMinutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-400 bg-white hover:border-blue-300 transition-all"
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
                  className="flex-1 px-6 py-3 border-2 border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
                >
                  Update Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && deactivatingSchedule && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-slate-800 mb-3">Deactivate Schedule</h3>
            <p className="text-slate-600 mb-8 text-base">
              Are you sure you want to deactivate this schedule? It will no longer be available for patient bookings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setDeactivatingSchedule(null);
                }}
                className="flex-1 px-6 py-3 border-2 border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
