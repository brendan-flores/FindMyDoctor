'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the canonical dashboard route
    router.replace('/admin/dashboard');
  }, [router]);

  return null;
}
