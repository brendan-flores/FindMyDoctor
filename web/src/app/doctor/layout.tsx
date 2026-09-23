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
    // Check authentication
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token) {
      router.push('/doctor-login');
      return;
    }

    if (userStr) {
      const user = JSON.parse(userStr);
      // Verify backend-returned role is DOCTOR
      if (user.role !== 'DOCTOR') {
        // Cross-role access denied, redirect to appropriate login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        apiClient.clearToken();
        router.push('/doctor-login');
        return;
      }
      setUserName(user.email.split('@')[0] || 'Doctor');
      setUserRole(user.role || 'Doctor');
      apiClient.setToken(token);
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
      <main className="ml-64 pt-20 min-h-screen bg-[#f8f9ff] p-6">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}