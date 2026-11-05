'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { secretaryApi } from '@/lib/api/secretaryApi';

interface SecretarySidebarProps {
  userName?: string;
  userRole?: string;
}

export default function SecretarySidebar({ userName = 'Secretary', userRole = 'Secretary' }: SecretarySidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => {
    if (pathname === '/secretary') return 'dashboard';
    if (pathname.startsWith('/secretary/')) return pathname.replace('/secretary/', '');
    return 'dashboard';
  });
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    // Poll unread conversation badges without changing the sidebar layout
    const fetchUnread = async () => {
      try {
        const response = await secretaryApi.getConversations();
        if (response.success && response.data) {
          const total = response.data.reduce((sum, conversation) => {
            const unreadCount = Number(conversation.unread_count);
            return sum + (Number.isFinite(unreadCount) ? unreadCount : 0);
          }, 0);
          setTotalUnread(total);
        }
      } catch {
        // Badge is best-effort; keep the previous value on failure
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view' },
    { id: 'queue', label: 'Daily Queue', icon: 'people' },
    { id: 'walk-ins', label: 'Walk-ins', icon: 'person_add' },
    { id: 'patients', label: 'Patients', icon: 'medical_services' },
    { id: 'appointments', label: 'Appointments', icon: 'calendar_month' },
    { id: 'schedule', label: 'Schedule', icon: 'schedule' },
    { id: 'conversations', label: 'Conversations', icon: 'chat' },
    { id: 'payments', label: 'Payments', icon: 'payments' },
    { id: 'profile', label: 'Profile', icon: 'account_circle' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'dashboard') {
      router.push('/secretary');
    } else {
      router.push(`/secretary/${tabId}`);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      apiClient.clearToken();
      localStorage.removeItem('secretary_refreshToken');
      localStorage.removeItem('secretary_user');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      router.push('/secretary-login');
    }
  };

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

        {/* Secretary Identity Pill */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1b5eb8]">Clinic Staff</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-900 truncate">{userName}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
            <span>{userRole}</span>
            <span>•</span>
            <span className="text-slate-400">On Duty</span>
          </div>
        </div>

        {/* Navigation Group */}
        <div className="px-5 pt-1 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Front Desk</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === item.id
                  ? 'bg-[#1b5eb8] text-white shadow-sm shadow-blue-600/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'conversations' && totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}