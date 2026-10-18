'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CapacityRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/secretary/schedule');
  }, [router]);

  return null;
}
