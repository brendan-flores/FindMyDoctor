'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';

interface SecretaryProfile {
  two_factor_enabled?: boolean;
}

interface TwoFactorUpdateResponse {
  twoFactorEnabled: boolean;
}

export default function SecretarySettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/secretary-login');
      return;
    }

    apiClient.setToken(token);
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/secretaries/me');
      if (response.success && response.data) {
        const data = response.data as SecretaryProfile;
        setTwoFactorEnabled(data.two_factor_enabled ?? false);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      console.error('Error fetching secretary settings:', err);
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
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
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to update setting');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A62CD] mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">Manage your account settings and preferences</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6">
            {success}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Security</h2>

          <div className="flex items-center justify-between py-4 border-b border-slate-200">
            <div>
              <h3 className="font-semibold text-slate-900">Two-Factor Authentication</h3>
              <p className="text-sm text-slate-600 mt-1">
                Require a verification code every time you sign in
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Enabled
              </span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <p className="text-sm text-emerald-800">
              Two-factor authentication is mandatory for all secretary accounts. You will be required to enter a verification code sent to your email each time you sign in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
