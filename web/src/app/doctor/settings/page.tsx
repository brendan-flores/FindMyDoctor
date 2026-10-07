'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';

interface DoctorProfile {
  two_factor_enabled?: boolean;
}

interface TwoFactorUpdateResponse {
  twoFactorEnabled: boolean;
}

export default function DoctorSettings() {
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
      router.push('/doctor-login');
      return;
    }

    apiClient.setToken(token);
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchSettings = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">
          {success}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Security</h2>

        <div className="flex items-center justify-between py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">Two-Factor Authentication</h3>
            <p className="text-sm text-slate-600 mt-1">
              Require a verification code every time you sign in
            </p>
          </div>
          <button
            onClick={handleToggle2FA}
            disabled={isSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              twoFactorEnabled ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-slate-300'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 p-4 bg-slate-50 rounded-xl">
          <p className="text-sm text-slate-600">
            {twoFactorEnabled
              ? 'Two-factor authentication is enabled. You will be required to enter a verification code sent to your email each time you sign in.'
              : 'Two-factor authentication is disabled. You can enable it to add an extra layer of security to your account.'}
          </p>
        </div>
      </div>
    </div>
  );
}
