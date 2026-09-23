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

    // Check authentication
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token) {
      router.push('/admin/login');
      return;
    }

    if (userStr) {
      const user = JSON.parse(userStr);
      // Verify backend-returned role is ADMIN or SUPERADMIN
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        // Cross-role access denied, redirect to admin login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        apiClient.clearToken();
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
      <main className="ml-64 pt-20 min-h-screen bg-[#f8f9ff] p-6">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}