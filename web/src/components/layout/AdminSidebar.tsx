'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface AdminSidebarProps {
  userName?: string;
  userRole?: string;
}

export default function AdminSidebar({ userName = 'Eleanor Vance', userRole = 'Super Admin' }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => {
    if (pathname === '/admin') return 'dashboard';
    if (pathname.startsWith('/admin/')) return pathname.replace('/admin/', '');
    return 'dashboard';
  });

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view' },
    { id: 'doctors', label: 'Doctors', icon: 'stethoscope' },
    { id: 'secretaries', label: 'Secretaries', icon: 'badge' },
    { id: 'audit-log', label: 'Audit Log', icon: 'history' },
    { id: 'users', label: 'Users', icon: 'manage_accounts' },
    // Only show Admin tab for SUPERADMIN
    ...(userRole === 'SUPERADMIN' ? [
      { id: 'admin', label: 'Admin', icon: 'admin_panel_settings' }
    ] : []),
    { id: 'settings', label: 'Settings', icon: 'tune' },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'dashboard') {
      router.push('/admin');
    } else {
      router.push(`/admin/${tabId}`);
    }
  };

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-white border-r border-neutral-200 flex flex-col justify-between z-30 select-none">
      {/* Top & Navigation Region */}
      <div className="flex flex-col min-h-0">
        {/* Brand Logo Header */}
        <div className="h-16 px-6 border-b border-neutral-100 flex items-center justify-center">
          <img
            src="/images/findmydoctor_logo.png"
            alt="FindMyDoctor Logo"
            className="h-14 w-auto max-w-full object-contain"
          />
        </div>

        {/* Admin Identity Pill */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-neutral-50 border border-neutral-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600">System Ops</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-success-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
              Online
            </span>
          </div>
          <div className="text-sm font-semibold text-neutral-900 truncate">{userName}</div>
          <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
            <span>{userRole}</span>
            <span>•</span>
            <span className="text-neutral-400">HQ Access</span>
          </div>
        </div>

        {/* Core Directory Navigation Group */}
        <div className="px-5 pt-1 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Core Directory</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === item.id
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}