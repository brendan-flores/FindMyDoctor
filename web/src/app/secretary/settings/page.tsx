'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';
import TrustedBrowsersCard from '@/components/settings/TrustedBrowsersCard';
import ChangePasswordCard from '@/components/settings/ChangePasswordCard';

interface SecretaryProfile {
  two_factor_enabled?: boolean;
  doctor_id?: string | null;
}

interface TwoFactorUpdateResponse {
  twoFactorEnabled: boolean;
}

interface GcashQrData {
  gcashQrUrl: string | null;
  gcashQrUpdatedAt: string | null;
}

function formatQrDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

export default function SecretarySettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoaded, setTwoFactorLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [doctorId, setDoctorId] = useState<string | null>(null);

  // Clinic payment settings: current GCash QR state for the assigned doctor
  const [gcashQr, setGcashQr] = useState<GcashQrData | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(true);
  const [qrError, setQrError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated - prefer role-scoped HttpOnly cookies, fall back to localStorage
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
    if (!token) {
      router.push('/secretary-login');
      return;
    }

    apiClient.setToken(token);
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchSettings = async () => {
    setTwoFactorLoaded(false);
    setIsQrLoading(true);
    setQrError('');
    try {
      const response = await apiClient.get('/secretaries/me');
      if (response.success && response.data) {
        const data = response.data as SecretaryProfile;
        setTwoFactorEnabled(data.two_factor_enabled ?? false);
        setDoctorId(data.doctor_id ?? null);
        if (!data.doctor_id) {
          setQrError('You are not assigned to a doctor. Please contact your administrator.');
          setIsQrLoading(false);
          return;
        }
        fetchGcashQr(data.doctor_id);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      console.error('Error fetching secretary settings:', err);
      setError('Failed to load settings');
    } finally {
      setTwoFactorLoaded(true);
    }
  };

  const fetchGcashQr = async (assignedDoctorId: string) => {
    setIsQrLoading(true);
    setQrError('');
    try {
      const response = await apiClient.get(`/gcash-qr/doctor/${assignedDoctorId}`);
      if (response.success && response.data) {
        setGcashQr(response.data as GcashQrData);
      } else {
        setQrError(response.error || 'Failed to load the GCash QR status');
      }
    } catch (err) {
      console.error('Error fetching GCash QR status:', err);
      setQrError('Failed to load the GCash QR status');
    } finally {
      setIsQrLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.put('/secretaries/me/two-factor', {
        twoFactorEnabled: !twoFactorEnabled,
      });

      if (response.success && response.data) {
        const data = response.data as TwoFactorUpdateResponse;
        setTwoFactorEnabled(data.twoFactorEnabled);
        setSuccess('Two-factor authentication setting updated successfully');
      } else {
        setError(response.error || 'Failed to update setting');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const qrLastUpdated = formatQrDate(gcashQr?.gcashQrUpdatedAt ?? null);
  const qrIsActive = !!gcashQr?.gcashQrUrl;

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">Manage your account and clinic settings</p>
        </div>

        {/* Toast notifications */}
        {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}
        {error && <Toast message={error} type="error" onClose={() => setError('')} />}

        {/* ============ Account section ============ */}
        <section aria-labelledby="account-section-heading" className="mb-10">
          <h2 id="account-section-heading" className="text-lg font-bold text-slate-500 uppercase tracking-wide mb-4">
            Account
          </h2>

          <div className="space-y-6">
            {/* Two-Factor Authentication */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Require a verification code when you sign in from a new or untrusted browser.
                  </p>
                </div>
                {!twoFactorLoaded ? (
                  <span className="text-sm text-slate-400" aria-busy="true">
                    Loading…
                  </span>
                ) : (
                  <button
                    onClick={handleToggle2FA}
                    disabled={isSaving}
                    role="switch"
                    aria-checked={twoFactorEnabled}
                    aria-label="Two-Factor Authentication"
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      twoFactorEnabled ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-slate-300'
                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Change Password */}
            <ChangePasswordCard />

            {/* Trusted Browsers: acts immediately, no confirmation dialogs */}
            <TrustedBrowsersCard confirmDialogs={false} />
          </div>
        </section>

        {/* ============ Clinic section ============ */}
        <section aria-labelledby="clinic-section-heading">
          <h2 id="clinic-section-heading" className="text-lg font-bold text-slate-500 uppercase tracking-wide mb-4">
            Clinic
          </h2>

          <div className="space-y-6">
            {/* Clinic Payment Settings (GCash QR) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Clinic Payment Settings</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Upload and manage the clinic&apos;s GCash QR code for patient payments
                </p>
              </div>

              {isQrLoading ? (
                <div className="mt-5 text-sm text-slate-500" aria-busy="true">
                  Loading QR status…
                </div>
              ) : qrError ? (
                <div className="mt-5">
                  <p className="text-sm text-rose-600" role="alert">
                    {qrError}
                  </p>
                  {doctorId && (
                    <button
                      onClick={() => fetchGcashQr(doctorId)}
                      className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-[#1A62CD] hover:bg-blue-50 transition-colors"
                    >
                      Try again
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                  {/* QR thumbnail or empty placeholder */}
                  {qrIsActive ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={gcashQr!.gcashQrUrl!}
                      alt="GCash QR code"
                      className="h-24 w-24 flex-shrink-0 rounded-xl border border-slate-200 object-contain bg-white p-1"
                    />
                  ) : (
                    <div className="h-24 w-24 flex-shrink-0 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400">qr_code_2</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        qrIsActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {qrIsActive ? 'Active' : 'Not uploaded'}
                    </span>
                    <p className="text-sm text-slate-600 mt-2">
                      Last updated:{' '}
                      <span className="font-medium text-slate-800">
                        {qrLastUpdated ?? '—'}
                      </span>
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    <button
                      onClick={() => router.push('/secretary/settings/gcash-qr')}
                      className="px-4 py-2 bg-[#1A62CD] text-white rounded-lg hover:bg-[#1550A8] transition-colors"
                    >
                      Manage QR Code
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800">
                  Patients see this QR code in the mobile app when they pay. Receipt review is on the Payments page.
                </p>
              </div>
            </div>

            {/* Placeholder: waiting for the invoice feature (clinic invoice details are not stored or editable yet). Do not build until invoices ship. */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Invoice details</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Clinic name, address, contact number, and footer line shown on invoices.
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                  Coming soon
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Available later with the invoice feature.
              </p>
            </div>

            {/* Placeholder: waiting for the patient payments view (account details displayed beside the QR code). Do not build until patient payments ship. */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">GCash account details</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Account name and GCash number shown to patients beside the QR code.
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                  Coming soon
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Available later with the patient payments view.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
