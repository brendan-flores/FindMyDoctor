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
    // Only show Admin and Users tabs for SUPERADMIN
    ...(userRole === 'SUPERADMIN' ? [
      { id: 'admin', label: 'Admin', icon: 'admin_panel_settings' },
      { id: 'users', label: 'Users', icon: 'manage_accounts' }
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/admin/login');
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
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mt-0.5 block">Admin Console</span>
          </div>
        </div>

        {/* Admin Identity Pill */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1b5eb8]">System Ops</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-900 truncate">{userName}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
            <span>{userRole}</span>
            <span>•</span>
            <span className="text-slate-400">HQ Access</span>
          </div>
        </div>

        {/* Core Directory Navigation Group */}
        <div className="px-5 pt-1 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Core Directory</span>
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
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-1">
        <a
          href="/admin/login"
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          onClick={handleLogout}
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Sign Out Console</span>
        </a>
      </div>
    </aside>
  );
}