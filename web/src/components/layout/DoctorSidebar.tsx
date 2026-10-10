'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi, DoctorProfile } from '@/lib/api/doctorApi';
import { useEffect, useState } from 'react';
import SetupProgressCard from '@/components/ui/SetupProgressCard';

interface DoctorSidebarProps {
  userName?: string;
  userRole?: string;
}

export default function DoctorSidebar({ userName = 'Dr. Smith', userRole = 'Doctor' }: DoctorSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);

  // Load profile and schedules for setup progress
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    apiClient.setToken(token);

    // Load profile
    doctorApi.getProfile().then(response => {
      if (response.success && response.data) {
        setProfile(response.data);
      }
    }).catch(err => {
      console.error('Error loading profile:', err);
    });

    // Load schedules
    doctorApi.getSchedules().then(response => {
      if (response.success && response.data) {
        setSchedules(response.data);
      }
    }).catch(err => {
      console.error('Error loading schedules:', err);
    });
  }, []);

  const activeTab = pathname === '/doctor'
    ? 'dashboard'
    : pathname.startsWith('/doctor/')
      ? pathname.slice('/doctor/'.length).split('/')[0]
      : 'dashboard';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view' },
    { id: 'appointments', label: 'Appointments', icon: 'calendar_month' },
    { id: 'schedule', label: 'Schedule', icon: 'schedule' },
    { id: 'patients', label: 'Patients', icon: 'people' },
    { id: 'secretary', label: 'Secretary', icon: 'badge' },
    { id: 'prescriptions', label: 'Prescriptions', icon: 'medication' },
    { id: 'profile', label: 'My Profile', icon: 'account_circle' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      apiClient.clearToken();
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      router.push('/doctor-login');
    }
  };

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between z-30 select-none">
      {/* Top & Navigation Region */}
      <div className="flex flex-col min-h-0">
        {/* Brand Logo Header */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1b5eb8] flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <span className="material-symbols-outlined text-[22px] font-bold">add_box</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xl font-bold tracking-tight text-slate-900">FiDo</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-[#1b5eb8]">Clinic</span>
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mt-0.5 block">Doctor Portal</span>
          </div>
        </div>

        {/* Setup Progress Card */}
        <div className="px-3 py-3">
          {profile && <SetupProgressCard profile={profile} schedules={schedules} />}
        </div>

        {/* Navigation Group */}
        <div className="px-5 pt-1 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Clinical Workspace</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.id === 'dashboard' ? '/doctor' : `/doctor/${item.id}`}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={`nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === item.id
                  ? 'bg-[#1b5eb8] text-white shadow-sm shadow-blue-600/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-1">
        <a
          href="/doctor-login"
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          onClick={handleLogout}
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Sign Out</span>
        </a>
      </div>
    </aside>
  );
}