'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DoctorPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the canonical dashboard route
    router.replace('/doctor/dashboard');
  }, [router]);

  return null;
}
