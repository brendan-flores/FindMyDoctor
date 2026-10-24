'use client';

import Link from 'next/link';

interface TwoFactorBannerProps {
  /** Portal settings path, e.g. /doctor/settings */
  settingsHref: string;
}

/**
 * Non-blocking reminder shown when email two-factor authentication is disabled.
 * Enabling 2FA remains optional for doctors and secretaries.
 */
export default function TwoFactorBanner({ settingsHref }: TwoFactorBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[22px] text-amber-600">gpp_maybe</span>
        <div>
          <p className="text-sm font-semibold text-amber-900">Two-factor authentication is off</p>
          <p className="text-sm text-amber-800 mt-0.5">
            Enable email verification codes to better protect patient information and your account.
          </p>
        </div>
      </div>
      <Link
        href={settingsHref}
        className="flex-shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-amber-800 transition-colors"
      >
        Enable 2FA
      </Link>
    </div>
  );
}
