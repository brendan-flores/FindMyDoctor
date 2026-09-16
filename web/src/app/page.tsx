'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      const user = JSON.parse(userStr);
      // Redirect authenticated users to their correct dashboard
      if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        router.push('/admin/dashboard');
      } else if (user.role === 'DOCTOR') {
        router.push('/doctor/dashboard');
      } else if (user.role === 'SECRETARY') {
        router.push('/secretary/dashboard');
      } else {
        // Unauthenticated or unknown role, redirect to shared login
        router.push('/auth/login');
      }
    } else {
      // Unauthenticated, redirect to shared login
      router.push('/auth/login');
    }
  }, [router]);

  // Show a brief loading state while redirecting
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F3F5F9] px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="w-12 h-12 bg-[#1A62CD] rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
            <line x1="12" x2="12" y1="5" y2="19"></line>
            <line x1="5" x2="19" y1="12" y2="12"></line>
          </svg>
        </div>
        <span className="text-4xl font-extrabold tracking-tight text-[#165CBE]">FiDo</span>
        <p className="text-slate-600 mt-4">Redirecting...</p>
      </div>
    </main>
  );
}
