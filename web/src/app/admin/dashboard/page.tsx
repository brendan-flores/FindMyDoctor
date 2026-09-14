'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/adminApi';

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDoctors: 0,
    activeDoctors: 0,
    pendingDoctors: 0,
    totalSecretaries: 0,
    activeSecretaries: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const usersResponse = await adminApi.getAllUsers();
      if (usersResponse.success && usersResponse.data) {
        const users = usersResponse.data;
        const doctors = users.filter(u => u.role === 'DOCTOR');
        const secretaries = users.filter(u => u.role === 'SECRETARY');
        const patients = users.filter(u => u.role === 'PATIENT');

        setStats({
          totalDoctors: doctors.length,
          activeDoctors: doctors.length, // Would need approval status from doctor API
          pendingDoctors: 0, // Would need approval status from doctor API
          totalSecretaries: secretaries.length,
          activeSecretaries: secretaries.length,
          totalUsers: users.length,
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1b5eb8] shrink-0">
            <span className="material-symbols-outlined text-[26px]">admin_panel_settings</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900">Administrative Monitoring Overview</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                System Operational
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Central Medical Healthcare Network • Real-time clinical directory & governance telemetry</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span>Security Log</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Total Doctors */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Doctors</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">stethoscope</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.totalDoctors}</span>
            <span className="text-xs text-slate-400">licensed</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span> {stats.activeDoctors} active
            </span>
            {stats.pendingDoctors > 0 && (
              <span className="text-amber-600 font-medium px-1.5 py-0.5 rounded bg-amber-50">{stats.pendingDoctors} pending</span>
            )}
          </div>
        </div>

        {/* Total Secretaries */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Secretaries</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">badge</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.totalSecretaries}</span>
            <span className="text-xs text-slate-400">total</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {stats.activeSecretaries} active today
            </span>
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Users</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.totalUsers}</span>
            <span className="text-xs text-slate-400">registered</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[#1b5eb8] font-medium">System-wide</span>
            <span className="text-emerald-600 font-medium">Active</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-[#1b5eb8]">person_add</span>
            <span className="text-sm font-medium text-slate-700">Add New Doctor</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-[#1b5eb8]">badge</span>
            <span className="text-sm font-medium text-slate-700">Add Secretary</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left">
            <span className="material-symbols-outlined text-[20px] text-[#1b5eb8]">manage_accounts</span>
            <span className="text-sm font-medium text-slate-700">Manage Users</span>
          </button>
        </div>
      </div>
    </div>
  );
}
