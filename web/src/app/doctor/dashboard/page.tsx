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
      {/* Doctor Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <span className="material-symbols-outlined text-[26px]">stethoscope</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Doctor Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage your appointments, patients, and prescriptions</p>
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Appointments */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today&apos;s Appointments</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.todayAppointments}</span>
            <span className="text-xs text-slate-400">scheduled</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-emerald-600 font-medium text-xs">On schedule</span>
          </div>
        </div>

        {/* Total Patients */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Patients</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">people</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.totalPatients}</span>
            <span className="text-xs text-slate-400">patients</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-[#1b5eb8] font-medium text-xs">Active care</span>
          </div>
        </div>

        {/* Active Prescriptions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Prescriptions</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">medication</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.activePrescriptions}</span>
            <span className="text-xs text-slate-400">active</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-purple-600 font-medium text-xs">Monitor closely</span>
          </div>
        </div>

        {/* Upcoming */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Upcoming</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">event_upcoming</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.totalAppointments}</span>
            <span className="text-xs text-slate-400">total</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-amber-600 font-medium text-xs">Next 7 days</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-emerald-600">calendar_month</span>
            <span className="text-sm font-medium text-slate-700">View Appointments</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-blue-600">person_add</span>
            <span className="text-sm font-medium text-slate-700">Add Patient</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-purple-600">medication</span>
            <span className="text-sm font-medium text-slate-700">New Prescription</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-amber-600">schedule</span>
            <span className="text-sm font-medium text-slate-700">Manage Schedule</span>
          </button>
          <button
            onClick={() => setShowAddSecretaryModal(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-[#1b5eb8]">badge</span>
            <span className="text-sm font-medium text-slate-700">Add Secretary</span>
          </button>
        </div>
      </div>

      {/* Add Secretary Modal */}
      {showAddSecretaryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Add Secretary</h2>
              <p className="text-sm text-slate-500 mt-1">Create a secretary account for your practice</p>
            </div>
            <div className="p-6 space-y-4">
              {secretaryError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {secretaryError}
                </div>
              )}
              {secretarySuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
                  {secretarySuccess}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={secretaryForm.email}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8] text-slate-900"
                  placeholder="secretary@example.com"
                  disabled={isCreatingSecretary}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  value={secretaryForm.password}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8] text-slate-900"
                  placeholder="Enter temporary password"
                  disabled={isCreatingSecretary}
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddSecretaryModal(false);
                  setSecretaryForm({ email: '', password: '' });
                  setSecretaryError('');
                  setSecretarySuccess('');
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                disabled={isCreatingSecretary}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSecretary}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
