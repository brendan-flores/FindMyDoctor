'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import SecretarySidebar from '@/components/layout/SecretarySidebar';
import SecretaryHeader from '@/components/layout/SecretaryHeader';
import PageTransition from '@/components/PageTransition';
import { apiClient } from '@/lib/api/apiClient';
import { secretaryApi } from '@/lib/api/secretaryApi';
import { toStaffContactDomestic } from '@/lib/phone';
import {
  clearSecretarySession,
  isInvalidSecretarySessionStatus,
} from '@/lib/auth/secretarySession';

interface SecretaryLayoutProps {
  children: React.ReactNode;
}

export default function SecretaryLayout({ children }: SecretaryLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isTrustPage = pathname === '/secretary/trust-device';
  const isPublicPage =
    pathname === '/secretary/forgot-password' ||
    pathname === '/secretary/reset-password' ||
    isTrustPage;
  const [userName, setUserName] = useState('Secretary');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('Secretary');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

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
    const cookieToken = getCookie('secretary_accessToken') || getCookie('accessToken');
    const token = cookieToken || localStorage.getItem('secretary_token') || localStorage.getItem('token');
    const userStr = localStorage.getItem('secretary_user') || localStorage.getItem('user');

    let shouldRedirect = false;
    let redirectPath = '';
    let asyncLoadNeeded = false;
    let sessionCleared = false;

    // Forgot-password and reset-password are public pages; skip auth check.
    if (isPublicPage) {
      setIsLoading(false);
      return;
    }

    // A token with no secretary account behind it (deleted account, or a
    // session issued before the database was reset) is still cryptographically
    // valid, so the API accepts it and answers without a profile. Never read
    // that as "profile incomplete": sign the user out instead.
    const handleInvalidSession = () => {
      sessionCleared = true;
      clearSecretarySession();
      if (active) {
        router.replace('/secretary-login');
      }
    };

    if (!token) {
      shouldRedirect = true;
      redirectPath = '/secretary-login';
    } else if (userStr) {
      const user = JSON.parse(userStr);
      // Verify backend-returned role is SECRETARY
      if (user.role !== 'SECRETARY') {
        // Cross-role access denied, redirect to appropriate login
        apiClient.clearToken();
        localStorage.removeItem('secretary_refreshToken');
        localStorage.removeItem('secretary_user');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        shouldRedirect = true;
        redirectPath = '/secretary-login';
      } else {
        // Check if password change is required
        // Exclude the change-password page itself to avoid redirect loop
        if (user.mustChangePassword === true && !pathname.includes('/change-password')) {
          shouldRedirect = true;
          redirectPath = '/secretary/change-password';
        } else {
          // Check if profile completion is required (only after password change).
          // The device-trust prompt is allowed before profile completion.
          if (
            user.mustChangePassword === false &&
            !pathname.includes('/complete-profile') &&
            !isTrustPage
          ) {
            asyncLoadNeeded = true;
            // Fetch the secretary profile to check completion status and get the real name.
            // A 404 here means the token has no secretary row: the account no longer exists.
            secretaryApi.getProfile()
              .then((response) => {
                if (!active) return;

                if (!response.success) {
                  if (isInvalidSecretarySessionStatus(response.httpStatus)) {
                    handleInvalidSession();
                    return;
                  }

                  // Transient failure (network/5xx): keep the session and fall back to the username.
                  setUserName(user.email.split('@')[0] || 'Secretary');
                  setUserEmail(user.email);
                  setIsLoading(false);
                  return;
                }

                const secretary = response.data;
                const firstName = secretary?.first_name?.trim() ?? '';
                const lastName = secretary?.last_name?.trim() ?? '';
                const contactNumber = secretary?.contact_number?.trim() ?? '';
                const hasValidContact =
                  contactNumber !== '' && toStaffContactDomestic(contactNumber) !== null;
                const isComplete = firstName !== '' && lastName !== '' && hasValidContact;

                if (!isComplete) {
                  router.push('/secretary/complete-profile');
                  return;
                }

                // If profile is complete, use real name. Fall back to the username
                // when the profile has no usable name.
                if (firstName && lastName) {
                  setUserName(`${firstName} ${lastName}`);
                } else {
                  setUserName(user.email.split('@')[0] || 'Secretary');
                }
                setUserEmail(user.email);
                setIsLoading(false);
              })
              .catch((err) => {
                if (!active) return;
                console.error('Error checking profile completion:', err);
                // On error, fallback to username and allow access to avoid blocking
                setUserName(user.email.split('@')[0] || 'Secretary');
                setIsLoading(false);
              });
          } else {
            // If password change is required or on complete-profile page, use username
            setUserName(user.email.split('@')[0] || 'Secretary');
            setUserEmail(user.email);
          }

          setUserRole(user.role || 'Secretary');
          apiClient.setToken(token);
        }
      }
    } else {
      // A token with no stored user metadata cannot be tied to a secretary
      // account (for example a role cookie left over from a previous session).
      // Verify nothing, sign out, and let the user authenticate again.
      handleInvalidSession();
    }

    if (shouldRedirect) {
      router.push(redirectPath);
    }

    if (!asyncLoadNeeded && !sessionCleared) {
      setIsLoading(false);
    }

    return () => {
      active = false;
    };
  }, [router, pathname, isTrustPage]);

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

  return (
    <div className="min-h-screen bg-neutral-50">
      <SecretarySidebar userName={userName} userRole={userRole} />
      <SecretaryHeader userName={userName} userEmail={userEmail} userRole={userRole} />
      <main className="ml-64 pt-20 bg-neutral-50 p-6">
        <div className="max-w-[1600px] mx-auto">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}