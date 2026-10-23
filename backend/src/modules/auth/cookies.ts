import { Response } from 'express';
import { SessionPolicy } from './sessionPolicy';

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
}

const ROLE_TO_PREFIX: Record<string, string> = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  SECRETARY: 'secretary',
  ADMIN: 'admin',
  SUPERADMIN: 'admin',
};

export const ROLE_PREFIXES = ['doctor', 'secretary', 'admin', 'patient'] as const;

const TRUSTED_BROWSER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function rolePrefixForRole(role: string): string {
  return ROLE_TO_PREFIX[role] || '';
}

export function cookieNamesForRole(role: string) {
  const prefix = rolePrefixForRole(role);
  if (!prefix) {
    return {
      accessToken: 'accessToken',
      refreshToken: 'refreshToken',
      trustedBrowser: 'trustedBrowser',
      sessionActive: 'sessionActive',
    };
  }

  return {
    accessToken: `${prefix}_accessToken`,
    refreshToken: `${prefix}_refreshToken`,
    trustedBrowser: `${prefix}_trustedBrowser`,
    // Non-sensitive browser-session hint the web client can read. It lets the
    // client discard a non-persistent session after the browser is restarted.
    sessionActive: `${prefix}_sessionActive`,
  };
}

function baseCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    // In development the web client still reads the access token for the
    // Authorization header, matching the pre-existing behavior.
    httpOnly: isProduction,
    secure: isProduction,
    sameSite: 'lax' as const,
    // Root path so login pages and portal pages share the same cookie.
    path: '/',
  };
}

/**
 * Set the access/refresh cookies for a role.
 * Session policies without `persistent` deliberately omit maxAge so the
 * browser drops them when it closes.
 */
export function setSessionCookies(
  res: Response,
  role: string,
  tokens: TokenSet,
  policy: SessionPolicy
) {
  const names = cookieNamesForRole(role);
  const base = baseCookieOptions();

  const accessOptions = policy.persistent
    ? { ...base, maxAge: policy.accessExpiresInSec * 1000 }
    : base;
  const refreshOptions = policy.persistent
    ? { ...base, maxAge: policy.refreshExpiresInSec * 1000 }
    : base;

  res.cookie(names.accessToken, tokens.accessToken, accessOptions);
  res.cookie(names.refreshToken, tokens.refreshToken, refreshOptions);

  // The hint is a browser-session cookie (no maxAge). It is intentionally
  // readable by JavaScript because it contains no credentials.
  if (policy.persistent) {
    res.clearCookie(names.sessionActive, { path: '/' });
  } else {
    res.cookie(names.sessionActive, '1', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}

/** Trusted-browser tokens are always HttpOnly and never exposed to JavaScript. */
export function setTrustedBrowserCookie(res: Response, role: string, token: string) {
  const names = cookieNamesForRole(role);
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(names.trustedBrowser, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: TRUSTED_BROWSER_MAX_AGE_MS,
  });
}

export function clearTrustedBrowserCookie(res: Response, role: string) {
  const names = cookieNamesForRole(role);
  res.clearCookie(names.trustedBrowser, { path: '/' });
}

export function clearSessionCookies(res: Response, role?: string) {
  const roles = role ? [role] : Object.keys(ROLE_TO_PREFIX);

  for (const currentRole of roles) {
    const names = cookieNamesForRole(currentRole);
    res.clearCookie(names.accessToken, { path: '/' });
    res.clearCookie(names.refreshToken, { path: '/' });
    res.clearCookie(names.sessionActive, { path: '/' });
  }

  if (!role) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
  }
}

export function clearTrustedCookies(res: Response, role?: string) {
  if (role) {
    clearTrustedBrowserCookie(res, role);
    return;
  }

  for (const prefix of ROLE_PREFIXES) {
    res.clearCookie(`${prefix}_trustedBrowser`, { path: '/' });
  }
  res.clearCookie('trustedBrowser', { path: '/' });
}
