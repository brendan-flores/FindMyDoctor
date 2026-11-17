import { apiClient } from '@/lib/api/apiClient';
import { authApi } from '@/lib/api/authApi';

/**
 * Local storage keys written for a secretary session. The legacy global keys
 * are included so a session created by an older build is cleared as well.
 */
const SECRETARY_SESSION_KEYS = [
  'secretary_token',
  'secretary_refreshToken',
  'secretary_session',
  'secretary_user',
  'token',
  'refreshToken',
  'user',
];

/**
 * A 401/403/404 from the secretary profile endpoint means the token has no
 * secretary account behind it: the account was deleted, or the session was
 * issued against a database that no longer exists. Such a token is still
 * cryptographically valid, so the API accepts it and answers with a payload
 * that has no profile fields. That must never be read as "profile incomplete".
 */
export function isInvalidSecretarySessionStatus(httpStatus?: number): boolean {
  return httpStatus === 401 || httpStatus === 403 || httpStatus === 404;
}

/**
 * Forget a secretary session everywhere: in-memory token, scoped/legacy local
 * storage, and the role cookies (which are HttpOnly in production). Used when a
 * stored session cannot be tied to a real secretary account.
 */
export function clearSecretarySession(): void {
  if (typeof window !== 'undefined') {
    try {
      SECRETARY_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage can be unavailable (e.g. private mode); the in-memory clear
      // below still runs.
    }
  }

  apiClient.clearToken();

  // Ask the server to expire the secretary cookies too. Without this the stale
  // cookie survives the logout and re-triggers the guard on the next visit.
  void authApi.logout().catch(() => {
    // Best effort: the local session is already cleared.
  });
}
