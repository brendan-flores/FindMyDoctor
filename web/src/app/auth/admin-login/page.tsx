'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is deprecated. Redirect to the correct admin login page.
export default function AdminLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F5F9]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A62CD] mx-auto"></div>
        <p className="mt-4 text-slate-600">Redirecting to login...</p>
      </div>
    </div>
  );
}
