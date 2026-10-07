'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';

export default function DoctorDashboard() {
  const [stats, setStats] = useState({
    totalAppointments: 0,
    todayAppointments: 0,
    totalPatients: 0,
    activePrescriptions: 0,
  });

  // Add Secretary modal state
  const [showAddSecretaryModal, setShowAddSecretaryModal] = useState(false);
  const [secretaryForm, setSecretaryForm] = useState({
    email: '',
    password: '',
  });
  const [isCreatingSecretary, setIsCreatingSecretary] = useState(false);
  const [secretaryError, setSecretaryError] = useState('');
  const [secretarySuccess, setSecretarySuccess] = useState('');

  useEffect(() => {
    // Load dashboard data from backend
    // This would be replaced with actual API calls
    setStats({
      totalAppointments: 15,
      todayAppointments: 5,
      totalPatients: 42,
      activePrescriptions: 8,
    });
  }, []);

  const handleAddSecretary = async () => {
    // Basic validation
    if (!secretaryForm.email || !secretaryForm.password) {
      setSecretaryError('Email and password are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(secretaryForm.email)) {
      setSecretaryError('Invalid email format');
      return;
    }

    setIsCreatingSecretary(true);
    setSecretaryError('');
    setSecretarySuccess('');

    try {
      const response = await apiClient.post('/doctors/secretaries', {
        email: secretaryForm.email,
        password: secretaryForm.password,
      });

      if (response.success) {
        setSecretarySuccess('Secretary created successfully');
        setSecretaryForm({ email: '', password: '' });
        setTimeout(() => {
          setShowAddSecretaryModal(false);
          setSecretarySuccess('');
        }, 2000);
      } else {
        setSecretaryError(response.error || 'Failed to create secretary');
      }
    } catch (err) {
      setSecretaryError('Failed to create secretary');
    } finally {
      setIsCreatingSecretary(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Today's Appointments */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">calendar_today</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Today&apos;s Appointments</span>
            <span className="text-2xl font-bold text-slate-800">{stats.todayAppointments}</span>
            <span className="text-xs text-slate-400">scheduled</span>
          </div>
        </div>

        {/* Total Patients */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">people</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Patients</span>
            <span className="text-2xl font-bold text-slate-800">{stats.totalPatients}</span>
            <span className="text-xs text-slate-400">patients</span>
          </div>
        </div>

        {/* Active Prescriptions */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">medication</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Prescriptions</span>
            <span className="text-2xl font-bold text-slate-800">{stats.activePrescriptions}</span>
            <span className="text-xs text-slate-400">active</span>
          </div>
        </div>

        {/* Upcoming */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">event_upcoming</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Upcoming</span>
            <span className="text-2xl font-bold text-slate-800">{stats.totalAppointments}</span>
            <span className="text-xs text-slate-400">total</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Quick Actions</h3>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md">
            <span className="material-symbols-outlined text-[20px] text-emerald-600">calendar_month</span>
            <span className="text-sm font-semibold text-slate-700">View Appointments</span>
          </button>
          <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md">
            <span className="material-symbols-outlined text-[20px] text-amber-600">schedule</span>
            <span className="text-sm font-semibold text-slate-700">Manage Schedule</span>
          </button>
          <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md">
            <span className="material-symbols-outlined text-[20px] text-blue-600">person_add</span>
            <span className="text-sm font-semibold text-slate-700">Add Patient</span>
          </button>
          <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md">
            <span className="material-symbols-outlined text-[20px] text-purple-600">medication</span>
            <span className="text-sm font-semibold text-slate-700">New Prescription</span>
          </button>
          <button
            onClick={() => setShowAddSecretaryModal(true)}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-blue-600">badge</span>
            <span className="text-sm font-semibold text-slate-700">Add Secretary</span>
          </button>
        </div>
      </div>

      {/* Add Secretary Modal */}
      {showAddSecretaryModal && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-slate-800 mb-6">Add Secretary</h3>
            <div className="space-y-4">
              {secretaryError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {secretaryError}
                </div>
              )}
              {secretarySuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
                  {secretarySuccess}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={secretaryForm.email}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white hover:border-blue-300 transition-all"
                  placeholder="secretary@example.com"
                  disabled={isCreatingSecretary}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Temporary Password</label>
                <input
                  type="password"
                  value={secretaryForm.password}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white hover:border-blue-300 transition-all"
                  placeholder="Enter temporary password"
                  disabled={isCreatingSecretary}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-6">
              <button
                onClick={() => {
                  setShowAddSecretaryModal(false);
                  setSecretaryForm({ email: '', password: '' });
                  setSecretaryError('');
                  setSecretarySuccess('');
                }}
                className="flex-1 px-6 py-3 border-2 border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-semibold transition-all"
                disabled={isCreatingSecretary}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSecretary}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreatingSecretary}
              >
                {isCreatingSecretary ? 'Creating...' : 'Create Secretary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
