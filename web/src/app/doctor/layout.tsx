'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DoctorSidebar from '@/components/layout/DoctorSidebar';
import DoctorHeader from '@/components/layout/DoctorHeader';
import { apiClient } from '@/lib/api/apiClient';

interface DoctorLayoutProps {
  children: React.ReactNode;
}

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  const router = useRouter();
  const [userName, setUserName] = useState('Dr. Smith');
  const [userRole, setUserRole] = useState('Doctor');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
    const cookieToken = getCookie('doctor_accessToken') || getCookie('accessToken');
    const token = cookieToken || localStorage.getItem('doctor_token') || localStorage.getItem('token');
    const userStr = localStorage.getItem('doctor_user') || localStorage.getItem('user');

    let shouldRedirect = false;
    let redirectPath = '';

    if (!token) {
      shouldRedirect = true;
      redirectPath = '/doctor-login';
    } else if (userStr) {
      const user = JSON.parse(userStr);
      // Verify backend-returned role is DOCTOR
      if (user.role !== 'DOCTOR') {
        // Cross-role access denied, redirect to appropriate login
        apiClient.clearToken();
        localStorage.removeItem('doctor_refreshToken');
        localStorage.removeItem('doctor_user');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        shouldRedirect = true;
        redirectPath = '/doctor-login';
      } else {
        setUserName(user.email.split('@')[0] || 'Doctor');
        setUserRole(user.role || 'Doctor');
        apiClient.setToken(token);
      }
    }

    if (shouldRedirect) {
      router.push(redirectPath);
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <DoctorSidebar userName={userName} userRole={userRole} />
      <DoctorHeader userName={userName} userRole={userRole} />
      <main className="ml-64 pt-20 bg-[#f8f9ff] p-6">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}