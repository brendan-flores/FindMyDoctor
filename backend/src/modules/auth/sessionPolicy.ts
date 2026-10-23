/**
 * Central session policy for the FindMyDoctor web portals.
 *
 * The `rememberMe` flag now represents an explicit trusted-device session for
 * Doctor and Secretary accounts. It controls BOTH lifetime and trusted-browser
 * status. Admin/SuperAdmin sessions are deliberately shorter and never use
 * persistent trusted-device sessions.
 */

export type SessionRole = 'PATIENT' | 'DOCTOR' | 'SECRETARY' | 'ADMIN' | 'SUPERADMIN';

export interface SessionPolicy {
  /** Access-token lifetime in seconds. */
  accessExpiresInSec: number;
  /** Refresh-token lifetime in seconds (sliding for non-remembered staff). */
  refreshExpiresInSec: number;
  /** Hard cap from the start of the session, or null when there is no cap. */
  absoluteTimeoutSec: number | null;
  /** Idle timeout exposed to the frontend so it can expire inactive sessions. */
  idleTimeoutSec: number;
  /** Persistent (maxAge) cookies vs. browser-session cookies. */
  persistent: boolean;
  /** Whether this role may register a trusted browser. */
  trustedBrowserAllowed: boolean;
}

export interface SessionResponse {
  rememberMe: boolean;
  persistent: boolean;
  idleTimeoutMinutes: number;
  maxSessionMinutes: number | null;
}

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/**
 * Resolve the policy for a role and trusted-device state.
 *
 * The `rememberMe` parameter is the internal persistent-session flag retained
 * for token/cookie compatibility. It no longer comes from a login checkbox.
 *
 * Doctor/Secretary:
 *  - false: browser-session cookies, 8-hour idle timeout, no trusted browser
 *  - true:  30-day persistent session and trusted browser
 * Admin/SuperAdmin:
 *  - session cookies, 2-hour idle timeout, 8-hour absolute maximum, mandatory OTP
 * Patient:
 *  - existing 7-day access / 30-day refresh behavior is preserved
 */
export function getSessionPolicy(role: string, rememberMe: boolean): SessionPolicy {
  if (role === 'ADMIN' || role === 'SUPERADMIN') {
    return {
      accessExpiresInSec: 90 * 60,
      refreshExpiresInSec: 2 * HOUR,
      absoluteTimeoutSec: 8 * HOUR,
      idleTimeoutSec: 2 * HOUR,
      persistent: false,
      trustedBrowserAllowed: false,
    };
  }

  if (role === 'DOCTOR' || role === 'SECRETARY') {
    if (rememberMe) {
      return {
        accessExpiresInSec: 7 * DAY,
        refreshExpiresInSec: 30 * DAY,
        absoluteTimeoutSec: 30 * DAY,
        idleTimeoutSec: 30 * DAY,
        persistent: true,
        trustedBrowserAllowed: true,
      };
    }

    return {
      // Access tokens are intentionally shorter than the idle window so an
      // active session can rotate its refresh token before the idle window
      // closes, while an idle session still ends after 8 hours.
      accessExpiresInSec: 7 * HOUR,
      refreshExpiresInSec: 8 * HOUR,
      absoluteTimeoutSec: null,
      idleTimeoutSec: 8 * HOUR,
      persistent: false,
      trustedBrowserAllowed: true,
    };
  }

  // Patient (mobile + legacy web): keep the existing behavior.
  return {
    accessExpiresInSec: 7 * DAY,
    refreshExpiresInSec: 30 * DAY,
    absoluteTimeoutSec: 30 * DAY,
    idleTimeoutSec: 30 * DAY,
    persistent: true,
    trustedBrowserAllowed: false,
  };
}

export function isStaffRole(role: string): boolean {
  return role === 'DOCTOR' || role === 'SECRETARY';
}

export function isAdminRole(role: string): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

/** Remaining seconds before the absolute session cap, or Infinity. */
export function remainingAbsoluteSeconds(policy: SessionPolicy, sessionStartMs: number): number {
  if (policy.absoluteTimeoutSec === null) {
    return Number.POSITIVE_INFINITY;
  }

  const elapsedSec = Math.floor((Date.now() - sessionStartMs) / 1000);
  return policy.absoluteTimeoutSec - elapsedSec;
}

export function buildSessionResponse(role: string, rememberMe: boolean): SessionResponse {
  const policy = getSessionPolicy(role, rememberMe);
  return {
    rememberMe,
    persistent: policy.persistent,
    idleTimeoutMinutes: Math.round(policy.idleTimeoutSec / 60),
    maxSessionMinutes:
      policy.absoluteTimeoutSec === null ? null : Math.round(policy.absoluteTimeoutSec / 60),
  };
}
