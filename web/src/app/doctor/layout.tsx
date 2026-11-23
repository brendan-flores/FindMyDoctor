'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import DoctorSidebar from '@/components/layout/DoctorSidebar';
import DoctorHeader from '@/components/layout/DoctorHeader';
import PageTransition from '@/components/PageTransition';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi, DoctorProfile } from '@/lib/api/doctorApi';
import { createRefreshGate } from '@/lib/api/refreshGate';
import { resolveDoctorIdentity } from '@/lib/doctorIdentity';

interface DoctorLayoutProps {
  children: React.ReactNode;
}

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isTrustPage = pathname === '/doctor/trust-device';
  const isPublicPage =
    pathname === '/doctor/forgot-password' ||
    pathname === '/doctor/reset-password' ||
    isTrustPage;
  const [sessionEmail, setSessionEmail] = useState<string | undefined>(undefined);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedProfileRef = useRef(false);

  useEffect(() => {
    // Check authentication - prefer role-scoped HttpOnly cookies, fall back to localStorage
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
      }
      return null;
    };

    // Try role-scoped cookie first, then fallback to global cookie
    const cookieToken = getCookie('doctor_accessToken') || getCookie('accessToken');
    const token = cookieToken || localStorage.getItem('doctor_token') || localStorage.getItem('token');
    const userStr = localStorage.getItem('doctor_user') || localStorage.getItem('user');

    let shouldRedirect = false;
    let redirectPath = '';

    // Forgot-password and reset-password are public pages; skip auth check.
    if (isPublicPage) {
      setIsLoading(false);
      return;
    }

    if (!token) {
      shouldRedirect = true;
      redirectPath = '/doctor-login';
    } else if (userStr) {
      const user = JSON.parse(userStr);
      // Verify backend-returned role is DOCTOR
      if (user.role !== 'DOCTOR') {
        // Cross-role access denied, redirect to appropriate login
        apiClient.clearToken();
        localStorage.removeItem('doctor_refreshToken');
        localStorage.removeItem('doctor_user');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        shouldRedirect = true;
        redirectPath = '/doctor-login';
      } else {
        // The stored session identity stays available as the display fallback.
        setSessionEmail(typeof user.email === 'string' ? user.email : undefined);
        apiClient.setToken(token);
      }
    }

    if (shouldRedirect) {
      router.push(redirectPath);
    }

    setIsLoading(false);
  }, [router]);

  // The shared doctor profile lives in the layout so the header and sidebar
  // read one source. A forced refresh (profileUpdated) bypasses the short GET
  // cache, and the gate coalesces overlapping triggers so the profile is never
  // requested twice for a single event.
  const refreshProfile = useMemo(
    () =>
      createRefreshGate(async (force: boolean) => {
        const token = apiClient.getStoredToken();
        if (!token) return;

        apiClient.setToken(token);

        await doctorApi
          .getProfile({ skipCache: force })
          .then((response) => {
            if (response.success && response.data) {
              setDoctorProfile(response.data);
            }
          })
          .catch((err) => {
            // A failed profile read keeps the stored session identity as the
            // fallback and must never clear the session or redirect.
            console.error('Error loading doctor profile:', err);
          });
      }).run,
    []
  );

  // Skip profile loading on the public doctor pages. Portal navigation does not
  // change this flag, so the profile is not re-fetched on every page change.
  useEffect(() => {
    if (isPublicPage) return;
    if (hasLoadedProfileRef.current) return;
    hasLoadedProfileRef.current = true;
    refreshProfile();
  }, [isPublicPage, refreshProfile]);

  // Profile edits dispatch `profileUpdated`; the layout owns the refresh.
  useEffect(() => {
    if (isPublicPage) return;
    const handleUpdate = () => {
      refreshProfile(true);
    };
    window.addEventListener('profileUpdated', handleUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleUpdate);
    };
  }, [isPublicPage, refreshProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-600">Loading...</div>
      </div>
    );
  }

  if (isPublicPage) {
    return <PageTransition>{children}</PageTransition>;
  }

  const identity = resolveDoctorIdentity(doctorProfile, sessionEmail);

  return (
    <div className="min-h-screen bg-neutral-50">
      <DoctorSidebar profile={doctorProfile} />
      <DoctorHeader
        userName={identity.displayName}
        userEmail={identity.email}
        userRole={identity.role}
      />
      <main className="ml-64 pt-20 bg-neutral-50 p-6">
        <div className="max-w-[1600px] mx-auto">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
