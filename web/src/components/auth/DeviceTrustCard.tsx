'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/authApi';
import { apiClient } from '@/lib/api/apiClient';
import { describeDevice } from '@/lib/deviceInfo';
import Toast from '@/components/ui/Toast';

interface DeviceTrustCardProps {
  portalLabel: string;
  loginPath: string;
  dashboardPath: string;
}

function formatCapturedAt(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function DeviceTrustCard({
  portalLabel,
  loginPath,
  dashboardPath,
}: DeviceTrustCardProps) {
  const router = useRouter();
  const [deviceInfo, setDeviceInfo] = useState<string | null>(null);
  const [fallbackDeviceInfo, setFallbackDeviceInfo] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = apiClient.getStoredToken();
    if (!token) {
      router.replace(loginPath);
      return;
    }

    // Read the local User-Agent only after mount so server-rendered HTML and
    // the first client render agree (avoids a hydration mismatch).
    setFallbackDeviceInfo(
      typeof navigator !== 'undefined' ? navigator.userAgent : null
    );

    let cancelled = false;

    const loadDevice = async () => {
      try {
        const response = await authApi.getCurrentDevice();
        if (cancelled) return;

        if (response.success && response.data) {
          setDeviceInfo(response.data.deviceInfo);
          setCapturedAt(response.data.capturedAt);
        } else {
          setError(response.error || 'Failed to load device details');
        }
      } catch {
        if (!cancelled) setError('Failed to load device details');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadDevice();

    return () => {
      cancelled = true;
    };
  }, [loginPath, router]);

  const handleTrust = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await authApi.trustCurrentDevice();
      if (response.success && response.data) {
        // The backend also sets the new HttpOnly cookies. Keep the readable
        // client copy and session watchdog in sync, preserving the original
        // session start so the 30-day cap cannot be extended by trusting.
        apiClient.setToken(
          response.data.accessToken,
          response.data.refreshToken,
          response.data.session || null,
          true
        );
        router.replace(dashboardPath);
        return;
      }

      setError(response.error || 'Failed to trust this device');
    } catch {
      setError('Failed to trust this device');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Best effort: clear any stale trusted-device cookie for this browser.
      await authApi.revokeTrustedBrowser();
    } catch {
      // Continuing with the normal short session is safe.
    }

    router.replace(dashboardPath);
  };

  const details = describeDevice(deviceInfo || fallbackDeviceInfo);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F5F9] px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[520px]">
        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src="/images/findmydoctor_logo.png"
            alt="FindMyDoctor Logo"
            className="h-16 w-auto mb-2"
          />
          <p className="text-[13px] font-bold uppercase tracking-widest text-[#1967D2]">
            {portalLabel}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#1A62CD]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#0D1829]">
                Trust this device?
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                We don&apos;t recognize this browser. Trusting it lets you skip the
                verification code on future logins from this device for 30 days. Your
                password is always required.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5">
              <Toast message={error} type="error" onClose={() => setError('')} />
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading device details...</p>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Browser</dt>
                  <dd className="font-semibold text-slate-800">{details.browser}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Operating system</dt>
                  <dd className="font-semibold text-slate-800">{details.platform}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Device type</dt>
                  <dd className="font-semibold text-slate-800">{details.deviceType}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Detected</dt>
                  <dd className="font-semibold text-slate-800">{formatCapturedAt(capturedAt)}</dd>
                </div>
              </dl>
            )}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            You can remove this device anytime from Settings &gt; Trusted Browsers.
            Choosing &ldquo;Do not trust&rdquo; keeps this session limited to the current
            browser session.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleTrust}
              disabled={isSubmitting || isLoading}
              className="flex-1 rounded-xl bg-[#0D3B75] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-[#0D3B75] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Trust this device'}
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Do not trust this device
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
