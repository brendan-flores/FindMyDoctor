'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api/apiClient';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const userStr = localStorage.getItem('user');

    if (userStr) {
      const user = JSON.parse(userStr);
      // Redirect authenticated users to their correct dashboard
      if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        router.push('/admin/dashboard');
      } else if (user.role === 'DOCTOR') {
        router.push('/doctor/dashboard');
      } else if (user.role === 'SECRETARY') {
        router.push('/secretary/dashboard');
      } else {
        // Unknown role, clear credentials and redirect to doctor login
        apiClient.clearToken();
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        router.push('/doctor-login');
      }
    } else {
      // Unauthenticated, redirect to doctor login as default
      router.push('/doctor-login');
    }
  }, [router]);

  // Show a brief loading state while redirecting
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F3F5F9] px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <img
          src="/images/findmydoctor_logo.png"
          alt="FindMyDoctor Logo"
          className="h-20 w-auto mx-auto mb-4"
        />
        <p className="text-slate-600 mt-4">Redirecting...</p>
      </div>
    </main>
  );
}
