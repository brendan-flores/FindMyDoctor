'use client';

import { useEffect, useState } from 'react';
import { authApi, type TrustedBrowser } from '@/lib/api/authApi';
import { apiClient } from '@/lib/api/apiClient';
import { describeDevice } from '@/lib/deviceInfo';
import Toast from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

/** Rows are already returned newest-first by the backend. */
const RECENT_LIMIT = 5;

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

type ConfirmState =
  | { kind: 'revoke'; browser: TrustedBrowser }
  | { kind: 'signOutAll' }
  | null;

interface TrustedBrowsersCardProps {
  /**
   * Show a confirmation dialog before revoking trust or signing out of all
   * devices. Defaults to true (doctor settings). Portal pages that must act
   * immediately — like secretary settings — pass false.
   */
  confirmDialogs?: boolean;
}

export default function TrustedBrowsersCard({ confirmDialogs = true }: TrustedBrowsersCardProps) {
  const [browsers, setBrowsers] = useState<TrustedBrowser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadBrowsers();
  }, []);

  const loadBrowsers = async () => {
    setIsLoading(true);
    try {
      const response = await authApi.getTrustedBrowsers();
      if (response.success && response.data) {
        setBrowsers(response.data.browsers || []);
      } else {
        setError(response.error || 'Failed to load trusted browsers');
      }
    } catch {
      setError('Failed to load trusted browsers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (browser: TrustedBrowser) => {
    setBusyId(browser.id);
    setError('');
    setSuccess('');
    setConfirm(null);

    try {
      const response = await authApi.revokeTrustedBrowserById(browser.id);
      if (response.success) {
        setBrowsers((current) => current.filter((item) => item.id !== browser.id));
        setSuccess('Trusted browser revoked');
      } else {
        setError(response.error || 'Failed to revoke trusted browser');
      }
    } catch {
      setError('Failed to revoke trusted browser');
    } finally {
      setBusyId(null);
    }
  };

  const handleSignOutAll = async () => {
    setIsSigningOutAll(true);
    setError('');
    setConfirm(null);

    try {
      const response = await authApi.signOutAllDevices();
      if (response.success) {
        apiClient.clearToken();
        const path = window.location.pathname;
        if (path.startsWith('/secretary')) {
          window.location.href = '/secretary-login';
        } else {
          window.location.href = '/doctor-login';
        }
      } else {
        setError(response.error || 'Failed to sign out of all devices');
        setIsSigningOutAll(false);
      }
    } catch {
      setError('Failed to sign out of all devices');
      setIsSigningOutAll(false);
    }
  };

  const visibleBrowsers = showAll ? browsers : browsers.slice(0, RECENT_LIMIT);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
      {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}
      {error && <Toast message={error} type="error" onClose={() => setError('')} />}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Trusted Browsers</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Trusted browsers can skip the email verification code for 30 days. Your password is
            always required. Only trust private, personal devices.
          </p>
        </div>
        <button
          onClick={() => (confirmDialogs ? setConfirm({ kind: 'signOutAll' }) : handleSignOutAll())}
          disabled={isSigningOutAll}
          className="flex-shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigningOutAll ? 'Signing out…' : 'Sign out of all devices'}
        </button>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading trusted browsers…</p>
        ) : browsers.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-700">No trusted browsers</p>
            <p className="text-sm text-slate-500 mt-1">
              Choose &ldquo;Trust this device&rdquo; after signing in on a private device to add one.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Device</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Added</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last used</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Expires</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleBrowsers.map((browser) => {
                    const isRevokeBusy = busyId === browser.id;
                    return (
                      <tr key={browser.id}>
                        <td className="py-3 px-3 text-sm font-medium text-slate-800">
                          <span className="flex items-center gap-2 flex-wrap">
                            {describeDevice(browser.device_info).label}
                            {browser.is_current && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1A62CD] border border-blue-100">
                                This browser
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm text-slate-600">{formatDate(browser.created_at)}</td>
                        <td className="py-3 px-3 text-sm text-slate-600">{formatDate(browser.last_used_at)}</td>
                        <td className="py-3 px-3 text-sm text-slate-600">{formatDate(browser.expires_at)}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() =>
                              confirmDialogs
                                ? setConfirm({ kind: 'revoke', browser })
                                : handleRevoke(browser)
                            }
                            disabled={isRevokeBusy}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRevokeBusy ? 'Revoking…' : 'Revoke'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {browsers.length > RECENT_LIMIT && (
              <div className="mt-4">
                <button
                  onClick={() => setShowAll((current) => !current)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[#1A62CD] hover:bg-blue-50 transition-colors"
                  aria-expanded={showAll}
                >
                  {showAll ? 'Show recent only' : `View all (${browsers.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {confirm?.kind === 'revoke' && (
        <ConfirmDialog
          open
          title="Revoke trusted browser"
          message={
            confirm.browser.is_current
              ? 'Revoke your current browser? You will need to enter a verification code the next time you sign in.'
              : 'Revoke trust for this browser? It will need a verification code the next time it signs in.'
          }
          confirmLabel="Revoke"
          confirmVariant="danger"
          busy={busyId === confirm.browser.id}
          onConfirm={() => handleRevoke(confirm.browser)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === 'signOutAll' && (
        <ConfirmDialog
          open
          title="Sign out everywhere?"
          message="You will need to sign in again on every device."
          confirmLabel="Sign out all devices"
          confirmVariant="danger"
          busy={isSigningOutAll}
          onConfirm={handleSignOutAll}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
