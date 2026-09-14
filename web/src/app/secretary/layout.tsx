'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SecretarySidebar from '@/components/layout/SecretarySidebar';
import SecretaryHeader from '@/components/layout/SecretaryHeader';
import { apiClient } from '@/lib/api/apiClient';

interface SecretaryLayoutProps {
  children: React.ReactNode;
}

export default function SecretaryLayout({ children }: SecretaryLayoutProps) {
  const router = useRouter();
  const [userName, setUserName] = useState('Secretary');
  const [userRole, setUserRole] = useState('Secretary');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token) {
      router.push('/auth/login');
      return;
    }

    if (userStr) {
      const user = JSON.parse(userStr);
      // Verify backend-returned role is SECRETARY
      if (user.role !== 'SECRETARY') {
        // Cross-role access denied, redirect to appropriate login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        apiClient.clearToken();
        router.push('/auth/login');
        return;
      }
      setUserName(user.email.split('@')[0] || 'Secretary');
      setUserRole(user.role || 'Secretary');
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
      <SecretarySidebar userName={userName} userRole={userRole} />
      <SecretaryHeader userName={userName} userRole={userRole} />
      <main className="ml-64 pt-20 min-h-screen bg-[#f8f9ff] p-6">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}