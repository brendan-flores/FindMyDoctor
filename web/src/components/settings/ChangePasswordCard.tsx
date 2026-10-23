'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';

interface ChangePasswordResponse {
  user: {
    id: string;
    email: string;
    role: string;
    mustChangePassword?: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
  session?: import('@/lib/api/apiClient').SessionMetadata | null;
}

interface ChangePasswordCardProps {
  onSuccess?: (message: string) => void;
}

/**
 * Change-password card for the portal Account settings. Reuses the shared
 * POST /auth/change-password endpoint: the backend verifies the current
 * password, revokes every trusted browser and refresh token, and issues a
 * fresh token pair for this browser so the current session stays signed in.
 */
export default function ChangePasswordCard({ onSuccess }: ChangePasswordCardProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const passwordIcon = (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect height="11" rx="2" ry="2" strokeWidth="1.8" width="16" x="4" y="11"></rect>
      <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
    </svg>
  );

  const eyeIcon = (open: boolean) =>
    open ? (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
      </svg>
    ) : (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29M3 3l18 18"></path>
      </svg>
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post<ChangePasswordResponse>('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (response.success && response.data) {
        // The backend already revoked every other trusted browser and refresh
        // token and set fresh cookies for this browser. Mirror the tokens into
        // the client storage so the current session stays signed in.
        const data = response.data;
        if (data.accessToken) {
          apiClient.setToken(data.accessToken, data.refreshToken, data.session || null, true);
        }

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('Password changed. Other trusted browsers and sessions were signed out.');
        onSuccess?.('Password changed successfully');
      } else {
        setError(response.error || 'Password change failed. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses =
    'block w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-12 text-sm tracking-wider text-slate-800 placeholder-slate-400 focus:border-[#1A62CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all duration-150';

  const renderField = (
    id: string,
    label: string,
    value: string,
    setValue: (v: string) => void,
    isShown: boolean,
    toggleShown: () => void
  ) => (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
          {passwordIcon}
        </div>
        <input
          id={id}
          name={id}
          type={isShown ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete={id === 'currentPassword' ? 'current-password' : 'new-password'}
          minLength={8}
          className={inputClasses}
        />
        <button
          type="button"
          onClick={toggleShown}
          aria-label={isShown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 focus:outline-none focus:visible:ring-2 focus:visible:ring-[#1A62CD]/40 rounded-full"
        >
          {eyeIcon(isShown)}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
      {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}
      {error && <Toast message={error} type="error" onClose={() => setError('')} />}

      <h2 className="text-xl font-bold text-slate-800">Change Password</h2>
      <p className="text-sm text-slate-600 mt-1 max-w-2xl">
        Changing your password signs out your other trusted browsers and devices. This browser stays
        signed in.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 max-w-md space-y-4" noValidate>
        <div className="text-sm text-rose-600" role="alert">
          {error ? error : ''}
        </div>

        {renderField('currentPassword', 'Current Password', currentPassword, setCurrentPassword, showCurrentPassword, () => setShowCurrentPassword(!showCurrentPassword))}

        <div>
          {renderField('newPassword', 'New Password', newPassword, setNewPassword, showNewPassword, () => setShowNewPassword(!showNewPassword))}
          <p className="text-xs text-slate-500 mt-1.5">Must be at least 8 characters.</p>
        </div>

        {renderField('confirmPassword', 'Confirm New Password', confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 rounded-lg bg-[#1A62CD] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1550A8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Changing password…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
