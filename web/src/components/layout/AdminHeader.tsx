'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { usePresence } from '@/hooks/usePresence';

interface AdminHeaderProps {
  userName?: string;
  userRole?: string;
}

export default function AdminHeader({ userName = 'E. Vance', userRole = 'Super Admin' }: AdminHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownPresent = usePresence(isDropdownOpen);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  const handleChangeSettings = () => {
    setIsDropdownOpen(false);
    router.push('/admin/settings');
  };

  const handleSignOut = async () => {
    setIsDropdownOpen(false);
    try {
      await apiClient.post('/auth/logout', {});
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      apiClient.clearToken();
      localStorage.removeItem('admin_refreshToken');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      router.push('/admin/login');
    }
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-neutral-200 z-20 flex items-center justify-between px-8">
      {/* Left: Badge & Hierarchy */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-primary-50 text-primary-600 border border-primary-100">
            Admin Console
          </span>
          <span className="text-neutral-300">|</span>
          <div className="text-sm font-semibold text-neutral-800 truncate">
            Central Medical Healthcare Network
          </div>
          <span className="text-neutral-400 text-xs hidden lg:inline">System Directory & Governance</span>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-50 text-success-700 text-xs font-semibold border border-success-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse"></span>
          <span>99.98% Operational</span>
        </div>
      </div>

      {/* Right: Search, Date & Profile Controls */}
      <div className="flex items-center gap-5">
        {/* Search Input */}
        <div className="relative hidden md:block w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
            placeholder="Search physicians, clinics, NPI..."
            type="text"
          />
        </div>

        {/* Date / Shift Tag */}
        <div className="hidden xl:flex flex-col text-right leading-tight">
          <span className="text-xs font-semibold text-neutral-700">{formattedDate}</span>
          <span className="text-[11px] font-mono text-neutral-400">{formattedTime} • Shift A</span>
        </div>

        {/* Notification Bell */}
        <button className="relative w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error-500 ring-2 ring-white"></span>
        </button>

        {/* Admin Avatar with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleProfileClick}
            className="flex items-center gap-2.5 pl-1 border-l border-neutral-200 hover:bg-neutral-50 rounded-lg px-2 py-1 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold text-xs shadow-sm">
              {getInitials(userName)}
            </div>
            <div className="hidden lg:block text-left leading-none">
              <div className="text-xs font-semibold text-neutral-800">{userName}</div>
              <div className="text-[10px] text-neutral-400">{userRole}</div>
            </div>
          </button>

          {/* Dropdown Menu */}
          {dropdownPresent && (
            <div
              data-state={isDropdownOpen ? 'open' : 'closed'}
              className="fmd-dropdown absolute right-0 top-full mt-2 w-48 bg-white rounded-lg border border-neutral-200 shadow-lg py-1 z-50"
            >
              <button
                onClick={handleChangeSettings}
                className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Settings
              </button>
              <div className="border-t border-neutral-100 my-1"></div>
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-error-600 hover:bg-error-50 flex items-center gap-2 transition-colors"
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