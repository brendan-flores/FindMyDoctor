'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';
import TrustedBrowsersCard from '@/components/settings/TrustedBrowsersCard';
import ChangePasswordCard from '@/components/settings/ChangePasswordCard';

interface DoctorProfile {
  two_factor_enabled?: boolean;
}

interface TwoFactorUpdateResponse {
  twoFactorEnabled: boolean;
}

export default function DoctorSettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoaded, setTwoFactorLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = apiClient.getStoredToken();
    if (!token) {
      router.push('/doctor-login');
      return;
    }

    apiClient.setToken(token);
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchSettings = async () => {
    setTwoFactorLoaded(false);
    try {
      const response = await apiClient.get('/doctors/me');
      if (response.success && response.data) {
        const data = response.data as DoctorProfile;
        setTwoFactorEnabled(data.two_factor_enabled ?? false);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      console.error('Error fetching doctor settings:', err);
      setError('Failed to load settings');
    } finally {
      setTwoFactorLoaded(true);
    }
  };

  const handleToggle2FA = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.put('/doctors/me/two-factor', {
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

  return (
    <div className="py-2">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-2">Manage your account security settings</p>
      </div>

      {/* Toast notifications */}
      {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}
      {error && <Toast message={error} type="error" onClose={() => setError('')} />}

      <section aria-labelledby="account-section-heading">
        <h2 id="account-section-heading" className="text-lg font-bold text-slate-500 uppercase tracking-wide mb-4">
          Account
        </h2>

        <div className="space-y-6">
          {/* Two-Factor Authentication */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-800">Two-Factor Authentication</h3>
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

          {/* Trusted Browsers */}
          <TrustedBrowsersCard />
        </div>
      </section>
    </div>
  );
}
