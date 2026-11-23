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
    <div className="min-h-screen flex items-center justify-center bg-neutral-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-neutral-600">Redirecting to login...</p>
      </div>
    </div>
  );
}
