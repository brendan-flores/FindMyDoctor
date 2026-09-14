'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SecretaryPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the canonical dashboard route
    router.replace('/secretary/dashboard');
  }, [router]);

  return null;
}
