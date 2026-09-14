'use client';

import { useEffect, useState } from 'react';

export default function SecretaryDashboard() {
  const [stats, setStats] = useState({
    queueSize: 0,
    todayAppointments: 0,
    pendingPayments: 0,
    unreadMessages: 0,
  });

  useEffect(() => {
    // Load dashboard data from backend
    // This would be replaced with actual API calls
    setStats({
      queueSize: 12,
      todayAppointments: 8,
      pendingPayments: 3,
      unreadMessages: 5,
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Secretary Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <span className="material-symbols-outlined text-[26px]">badge</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Secretary Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage daily queue, walk-ins, payments, and messaging</p>
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Queue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Queue</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">people</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.queueSize}</span>
            <span className="text-xs text-slate-400">waiting</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-purple-600 font-medium text-xs">Active queue</span>
          </div>
        </div>

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

        {/* Pending Payments */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Payments</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.pendingPayments}</span>
            <span className="text-xs text-slate-400">pending</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-amber-600 font-medium text-xs">Action needed</span>
          </div>
        </div>

        {/* Unread Messages */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Unread Messages</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">chat</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.unreadMessages}</span>
            <span className="text-xs text-slate-400">messages</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-[#1b5eb8] font-medium text-xs">Respond soon</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-purple-600">people</span>
            <span className="text-sm font-medium text-slate-700">Manage Queue</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-emerald-600">person_add</span>
            <span className="text-sm font-medium text-slate-700">Register Walk-in</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-amber-600">payments</span>
            <span className="text-sm font-medium text-slate-700">Verify Payments</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-blue-600">chat</span>
            <span className="text-sm font-medium text-slate-700">View Messages</span>
          </button>
        </div>
      </div>
    </div>
  );
}
