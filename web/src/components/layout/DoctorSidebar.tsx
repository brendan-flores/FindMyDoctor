'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi, DoctorProfile } from '@/lib/api/doctorApi';
import { createRefreshGate } from '@/lib/api/refreshGate';
import { useEffect, useMemo, useRef, useState } from 'react';
import SetupProgressCard from '@/components/ui/SetupProgressCard';

interface DoctorSidebarProps {
  userName?: string;
  userRole?: string;
}

export default function DoctorSidebar({ userName = 'Dr. Smith', userRole = 'Doctor' }: DoctorSidebarProps) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const hasLoadedRef = useRef(false);

  // Load profile and schedules for setup progress. A forced refresh (save
  // events) bypasses the short GET cache so saved changes appear immediately.
  // The gate coalesces overlapping triggers, so a save event that arrives
  // during the initial load cannot issue a duplicate simultaneous pair.
  const refreshProfile = useMemo(
    () =>
      createRefreshGate(async (force: boolean) => {
        const token = apiClient.getStoredToken();
        if (!token) return;

        apiClient.setToken(token);

        await Promise.all([
          // Load profile
          doctorApi
            .getProfile({ skipCache: force })
            .then((response) => {
              if (response.success && response.data) {
                setProfile(response.data);
              }
            })
            .catch((err) => {
              console.error('Error loading profile:', err);
            }),
          // Load schedules
          doctorApi
            .getSchedules({ skipCache: force })
            .then((response) => {
              if (response.success && response.data) {
                setSchedules(response.data);
              }
            })
            .catch((err) => {
              console.error('Error loading schedules:', err);
            }),
        ]);
      }).run,
    []
  );

  // Fetch once on mount. The ref prevents a duplicate pair of requests from
  // React's development double-mount.
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    refreshProfile();
  }, [refreshProfile]);

  // Listen for profile/schedule save events to refresh the setup progress card immediately
  useEffect(() => {
    const handleUpdate = () => {
      refreshProfile(true);
    };
    window.addEventListener('profileUpdated', handleUpdate);
    window.addEventListener('schedulesUpdated', handleUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleUpdate);
      window.removeEventListener('schedulesUpdated', handleUpdate);
    };
  }, [refreshProfile]);

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
  ];

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between z-30 select-none">
      {/* Top & Navigation Region */}
      <div className="flex flex-col min-h-0">
        {/* Brand Logo Header */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-center">
          <img
            src="/images/findmydoctor_logo.png"
            alt="FindMyDoctor Logo"
            className="h-14 w-auto max-w-full object-contain"
          />
        </div>

        {/* Setup Progress Card */}
        {profile && <SetupProgressCard profile={profile} schedules={schedules} />}

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
    </aside>
  );
}