'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { notificationApi, Notification } from '@/lib/api/secretaryApi';

interface SecretaryHeaderProps {
  userName?: string;
  userRole?: string;
}

export default function SecretaryHeader({ userName = 'Secretary', userRole = 'Secretary' }: SecretaryHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get current date/time in Asia/Manila timezone
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  const formattedDate = dateFormatter.format(now);
  const formattedTime = timeFormatter.format(now);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch notifications on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await notificationApi.getNotifications();
      if (response.success && response.data) {
        setNotifications(response.data);
        setUnreadCount(response.data.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationClick = () => {
    setIsNotificationOpen(!isNotificationOpen);
    if (!isNotificationOpen) {
      loadNotifications();
    }
  };

  const handleNotificationItemClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await notificationApi.markAsRead(notification.id);
        // Update local state
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    setIsNotificationOpen(false);

    // Navigate based on notification type
    if (notification.type === 'PAYMENT_VERIFIED' || notification.type === 'PAYMENT_REJECTED') {
      router.push('/secretary/payments');
    } else if (notification.type === 'NEW_PATIENT_MESSAGE' || notification.type === 'NEW_SECRETARY_MESSAGE') {
      router.push('/secretary/conversations');
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'PAYMENT_VERIFIED':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'PAYMENT_REJECTED':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'NEW_SECRETARY_MESSAGE':
      case 'NEW_PATIENT_MESSAGE':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getTypeBadgeText = (type: string) => {
    switch (type) {
      case 'PAYMENT_VERIFIED':
      case 'PAYMENT_REJECTED':
        return 'Payment';
      case 'NEW_SECRETARY_MESSAGE':
      case 'NEW_PATIENT_MESSAGE':
        return 'Message';
      default:
        return 'Notification';
    }
  };

  const handleProfileClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleViewProfile = () => {
    setIsDropdownOpen(false);
    router.push('/secretary/profile');
  };

  const handleChangePassword = () => {
    setIsDropdownOpen(false);
    router.push('/secretary/change-password');
  };

  const handleSignOut = () => {
    setIsDropdownOpen(false);
    apiClient.clearToken();
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/secretary-login');
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-slate-200 z-20 flex items-center justify-between px-8">
      {/* Left: Badge & Hierarchy */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-[#1b5eb8] border border-blue-100">
            Secretary Portal
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

        {/* Notification Bell with Badge */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={handleNotificationClick}
            className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {isNotificationOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-lg py-2 z-50 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">notifications_none</span>
                  <p>No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationItemClick(notification)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${getTypeBadgeColor(
                          notification.type
                        )}`}
                      >
                        {getTypeBadgeText(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{notification.title}</p>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{notification.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatTimestamp(notification.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Secretary Avatar with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleProfileClick}
            className="flex items-center gap-2.5 pl-1 border-l border-slate-200 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#1b5eb8] text-white flex items-center justify-center font-semibold text-xs shadow-sm">
              {getInitials(userName)}
            </div>
            <div className="hidden lg:block text-left leading-none">
              <div className="text-xs font-semibold text-slate-800">{userName}</div>
              <div className="text-[10px] text-slate-400">{userRole}</div>
            </div>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-50">
              <button
                onClick={handleViewProfile}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
                View Profile
              </button>
              <button
                onClick={handleChangePassword}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">lock</span>
                Change Password
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