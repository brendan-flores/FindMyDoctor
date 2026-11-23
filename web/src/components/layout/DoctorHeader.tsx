'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { usePresence } from '@/hooks/usePresence';

interface DoctorHeaderProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export default function DoctorHeader({
  userName = 'Doctor',
  userEmail = '',
  userRole = 'Doctor',
}: DoctorHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownPresent = usePresence(isDropdownOpen);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const getInitials = (name: string) => {
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return initials || 'D';
  };

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = currentDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleProfileClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleViewProfile = () => {
    setIsDropdownOpen(false);
    router.push('/doctor/profile');
  };

  const handleChangeSettings = () => {
    setIsDropdownOpen(false);
    router.push('/doctor/settings');
  };

  const handleSignOut = async () => {
    setIsDropdownOpen(false);
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      apiClient.clearToken();
      localStorage.removeItem('doctor_refreshToken');
      localStorage.removeItem('doctor_user');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      router.push('/doctor-login');
    }
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-slate-200 z-20 flex items-center justify-between px-8">
      {/* Left: Badge & Hierarchy */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-[#1b5eb8] border border-blue-100">
            Doctor Portal
          </span>
          <span className="text-slate-300">|</span>
          <div className="text-sm font-semibold text-slate-800 truncate">
            FindMyDoctor Healthcare Network
          </div>
        </div>
      </div>

      {/* Right: Date & Profile Controls */}
      <div className="flex items-center gap-5">
        {/* Date / Shift Tag */}
        <div className="hidden xl:flex flex-col text-right leading-tight">
          <span className="text-xs font-semibold text-slate-700">{formattedDate}</span>
          <span className="text-[11px] font-mono text-slate-400">{formattedTime}</span>
        </div>

        {/* Notification Bell */}
        <button className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>

        {/* Doctor Avatar with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleProfileClick}
            className="flex items-center gap-2.5 pl-1 border-l border-slate-200 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#1b5eb8] text-white flex items-center justify-center font-semibold text-xs shadow-sm">
              {getInitials(userName)}
            </div>
            <div className="hidden lg:block text-left leading-tight max-w-[220px]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-800 truncate" title={userName}>
                  {userName}
                </span>
                <span className="shrink-0 text-[10px] font-medium text-[#1b5eb8]">{userRole}</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate" title={userEmail}>
                {userEmail}
              </div>
            </div>
          </button>

          {/* Dropdown Menu */}
          {dropdownPresent && (
            <div
              data-state={isDropdownOpen ? 'open' : 'closed'}
              className="fmd-dropdown absolute right-0 top-full mt-2 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-50"
            >
              <button
                onClick={handleViewProfile}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
                Profile
              </button>
              <button
                onClick={handleChangeSettings}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Settings
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}