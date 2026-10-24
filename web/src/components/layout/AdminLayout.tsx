'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { apiClient } from '@/lib/api/apiClient';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('Eleanor Vance');
  const [userRole, setUserRole] = useState('Super Admin');
  const [isLoading, setIsLoading] = useState(true);

  // Skip authentication for login page
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    // Skip authentication check for login page
    if (isLoginPage) {
      setIsLoading(false);
      return;
    }

    // Check authentication - prefer role-scoped HttpOnly cookies, fall back to localStorage
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
      }
      return null;
    };

    // Try role-scoped cookie first, then fallback to global cookie
    const cookieToken = getCookie('admin_accessToken') || getCookie('accessToken');
    const token = cookieToken || localStorage.getItem('admin_token') || localStorage.getItem('token');
    const userStr = localStorage.getItem('admin_user') || localStorage.getItem('user');

    if (!token) {
      router.push('/admin/login');
      return;
    }

    if (userStr) {
      const user = JSON.parse(userStr);
      // Verify backend-returned role is ADMIN or SUPERADMIN
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        // Cross-role access denied, redirect to admin login
        apiClient.clearToken();
        localStorage.removeItem('admin_refreshToken');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        router.push('/admin/login');
        return;
      }
      setUserName(user.email.split('@')[0] || 'Admin');
      setUserRole(user.role || 'Admin');
      apiClient.setToken(token);
    }

    setIsLoading(false);
  }, [router, isLoginPage]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  // For login page, render children without sidebar/header
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <AdminSidebar userName={userName} userRole={userRole} />
      <AdminHeader userName={userName} userRole={userRole} />
      <main className="ml-64 pt-20 bg-[#f8f9ff] p-6">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}