import { ClientTtlCache } from './ttlCache';
import {
  DEFAULT_GET_CACHE_TTL_MS,
  MAX_GET_RETRY_ATTEMPTS,
  computeRetryDelayMs,
  parseRetryAfterMs,
  shouldRetryResponse,
} from './requestPolicy';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Error code returned when the caller aborted a request. */
export const REQUEST_ABORTED_ERROR_CODE = 'REQUEST_ABORTED';

export interface GetOptions {
  /** Abort the request (and any retry backoff) when the caller unmounts. */
  signal?: AbortSignal;
  /** Skip the cache read. The fresh response still refreshes the cache. */
  skipCache?: boolean;
  /** Per-request cache lifetime. Use 0 to disable caching entirely. */
  cacheTtlMs?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  message?: string;
  httpStatus?: number;
}

export interface SessionMetadata {
  rememberMe: boolean;
  persistent: boolean;
  idleTimeoutMinutes: number;
  maxSessionMinutes: number | null;
  startedAt?: number;
  lastActivityAt?: number;
}

/**
 * The backend returns errors as `{ success: false, error: { code, message } }`.
 * Normalize that into the flat shape the pages consume so error messages can be
 * displayed directly.
 */
function normalizeApiResponse<T>(payload: any): ApiResponse<T> {
  if (payload && payload.success === false && payload.error && typeof payload.error === 'object') {
    const code = typeof payload.error.code === 'string' ? payload.error.code : undefined;
    const message = typeof payload.error.message === 'string' ? payload.error.message : 'Request failed';

    return { success: false, error: message, errorCode: code };
  }

  return payload as ApiResponse<T>;
}

function parseErrorResponse<T>(status: number, text: string): ApiResponse<T> {
  try {
    const json = JSON.parse(text);
    const normalized = normalizeApiResponse<T>(json);
    if (normalized && normalized.error) {
      return { ...normalized, httpStatus: status };
    }
  } catch {
    // not valid JSON
  }
  return {
    success: false,
    error: `Server error (${status}): ${text}`,
    httpStatus: status,
  };
}

function detectRoleFromPath(path: string): string | null {
  if (path.startsWith('/doctor') || path.startsWith('/doctor-login')) return 'doctor';
  if (path.startsWith('/secretary') || path.startsWith('/secretary-login')) return 'secretary';
  if (path.startsWith('/admin') || path.startsWith('/admin/login')) return 'admin';
  if (path.startsWith('/patient')) return 'patient';
  return null;
}

const IDLE_FALLBACK_MINUTES: Record<string, number> = {
  doctor: 8 * 60,
  secretary: 8 * 60,
  admin: 2 * 60,
  patient: 30 * 24 * 60,
};

const MAX_FALLBACK_MINUTES: Record<string, number | null> = {
  doctor: null,
  secretary: null,
  admin: 8 * 60,
  patient: 30 * 24 * 60,
};

const ACTIVITY_THROTTLE_MS = 20_000;
const IDLE_CHECK_INTERVAL_MS = 30_000;

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];
  private role: string | null = null;
  private session: SessionMetadata | null = null;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivityWrite = 0;
  private activityBound = false;
  private getCache = new ClientTtlCache<ApiResponse<unknown>>();
  private inFlightGets = new Map<string, Promise<ApiResponse<unknown>>>();
  /** Bumped whenever cached data must not be reused (token/role change, mutation). */
  private cacheGeneration = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.role = detectRoleFromPath(window.location.pathname);
      this.hydrateFromStorage();
      this.bindActivityTracking();
    }
  }

  private storageKey(name: string, scoped: boolean = true): string {
    return scoped && this.role ? `${this.role}_${name}` : name;
  }

  private sessionKey(): string {
    return this.storageKey('session');
  }

  private hasSessionHint(): boolean {
    if (typeof document === 'undefined' || !this.role) return false;
    const name = `${this.role}_sessionActive`;
    return document.cookie.split('; ').some((row) => row.startsWith(`${name}=`));
  }

  private readSessionMetadata(): SessionMetadata | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.sessionKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as SessionMetadata;
    } catch {
      return null;
    }
  }

  private defaultSessionMetadata(): SessionMetadata {
    const now = Date.now();
    return {
      rememberMe: false,
      persistent: false,
      idleTimeoutMinutes: IDLE_FALLBACK_MINUTES[this.role || ''] || 8 * 60,
      maxSessionMinutes: MAX_FALLBACK_MINUTES[this.role || ''] ?? null,
      startedAt: now,
      lastActivityAt: now,
    };
  }

  private hydrateFromStorage() {
    if (typeof window === 'undefined') return;

    const tokenKey = this.storageKey('token');
    const refreshKey = this.storageKey('refreshToken');

    const storedSession = this.readSessionMetadata();

    if (this.role && this.role !== 'patient') {
      // Staff and admin sessions must always carry metadata. Legacy tokens
      // without it are discarded to avoid unmanaged long-lived sessions.
      if (!storedSession) {
        this.removeStoredCredentials();
        return;
      }

      // Non-persistent (untrusted staff / admin) sessions must not
      // survive a browser restart. The session hint cookie is a browser-session
      // cookie that disappears when the browser closes.
      if (storedSession.persistent === false && !this.hasSessionHint()) {
        this.removeStoredCredentials();
        return;
      }

      this.session = storedSession;
    } else if (storedSession) {
      this.session = storedSession;
    }

    const stored = localStorage.getItem(tokenKey);
    const storedRefresh = localStorage.getItem(refreshKey);
    if (stored && stored !== 'undefined' && stored !== 'null') {
      this.token = stored;
    }
    if (storedRefresh && storedRefresh !== 'undefined' && storedRefresh !== 'null') {
      this.refreshToken = storedRefresh;
    }

    if (this.session) {
      this.startIdleWatch();
    }
  }

  private removeStoredCredentials() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.storageKey('token'));
    localStorage.removeItem(this.storageKey('refreshToken'));
    localStorage.removeItem(this.storageKey('session'));
    this.token = null;
    this.refreshToken = null;
    this.session = null;
  }

  private bindActivityTracking() {
    if (this.activityBound || typeof window === 'undefined') return;
    this.activityBound = true;

    const handler = () => this.recordActivity();
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, handler, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.recordActivity();
      }
    });
  }

  /** Record user activity so the idle watchdog can expire inactive sessions. */
  recordActivity() {
    if (!this.session) return;

    const now = Date.now();
    this.session.lastActivityAt = now;

    // Persist at most once per throttle window to avoid constant writes.
    if (now - this.lastActivityWrite < ACTIVITY_THROTTLE_MS) {
      return;
    }
    this.lastActivityWrite = now;

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.sessionKey(), JSON.stringify(this.session));
    }
  }

  private isSessionExpired(): boolean {
    if (!this.session) return false;

    const now = Date.now();
    const lastActivity = this.session.lastActivityAt || now;
    const idleMs = this.session.idleTimeoutMinutes * 60_000;

    if (now - lastActivity >= idleMs) {
      return true;
    }

    if (this.session.maxSessionMinutes !== null) {
      const startedAt = this.session.startedAt || now;
      const maxMs = this.session.maxSessionMinutes * 60_000;
      if (now - startedAt >= maxMs) {
        return true;
      }
    }

    return false;
  }

  private startIdleWatch() {
    if (typeof window === 'undefined' || this.idleTimer) return;

    this.idleTimer = setInterval(() => {
      if (this.isSessionExpired()) {
        this.handleSessionExpired();
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  private stopIdleWatch() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /** Store the server-provided session policy metadata and start the watchdog. */
  setSession(session?: SessionMetadata | null, preserveSessionStart: boolean = false) {
    if (!session) return;

    const now = Date.now();
    const startedAt =
      preserveSessionStart && this.session?.startedAt
        ? this.session.startedAt
        : now;

    this.session = {
      rememberMe: session.rememberMe === true,
      persistent: session.persistent === true,
      idleTimeoutMinutes: session.idleTimeoutMinutes,
      maxSessionMinutes: session.maxSessionMinutes,
      startedAt,
      lastActivityAt: now,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.sessionKey(), JSON.stringify(this.session));
    }

    this.startIdleWatch();
  }

  setToken(
    token: string,
    refreshToken?: string,
    session?: SessionMetadata | null,
    preserveSessionStart: boolean = false
  ) {
    if (!token || token === 'undefined' || token === 'null') {
      this.clearToken();
      return;
    }

    const previousToken = this.token;
    const previousRole = this.role;
    this.token = token;
    if (typeof window !== 'undefined') {
      // Re-detect role from current path to ensure correct scoping
      this.role = detectRoleFromPath(window.location.pathname);

      const tokenKey = this.storageKey('token');
      const refreshKey = this.storageKey('refreshToken');
      localStorage.setItem(tokenKey, token);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        localStorage.setItem(refreshKey, refreshToken);
      }
    }

    // Never serve data cached for a different session or portal.
    if (previousToken !== token || previousRole !== this.role) {
      this.clearGetCache();
    }

    if (session) {
      this.setSession(session, preserveSessionStart);
    } else if (this.session) {
      this.startIdleWatch();
    }
  }

  clearToken() {
    this.token = null;
    this.refreshToken = null;
    this.session = null;
    this.clearGetCache();
    this.stopIdleWatch();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey('token'));
      localStorage.removeItem(this.storageKey('refreshToken'));
      localStorage.removeItem(this.storageKey('user'));
      localStorage.removeItem(this.sessionKey());
    }
  }

  /**
   * Read the current portal's stored access token. Role-scoped cookies and
   * localStorage keys take precedence; legacy global keys remain as a fallback
   * for sessions created before the role-scoped change.
   */
  getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;

    // Check role-scoped cookie first
    const scopedCookieName = this.role ? `${this.role}_accessToken` : 'accessToken';
    const scopedCookieToken = this.getCookie(scopedCookieName);
    if (scopedCookieToken && scopedCookieToken !== 'undefined' && scopedCookieToken !== 'null') {
      return scopedCookieToken;
    }

    // Fallback to global cookie
    const cookieToken = this.getCookie('accessToken');
    if (cookieToken && cookieToken !== 'undefined' && cookieToken !== 'null') {
      return cookieToken;
    }

    // Check role-scoped localStorage
    const scopedToken = localStorage.getItem(this.storageKey('token'));
    if (scopedToken && scopedToken !== 'undefined' && scopedToken !== 'null') {
      return scopedToken;
    }

    // Fallback to legacy global localStorage
    const legacyToken = localStorage.getItem('token');
    if (legacyToken && legacyToken !== 'undefined' && legacyToken !== 'null') {
      return legacyToken;
    }

    return this.token;
  }

  private subscribeTokenRefresh(callback: (token: string | null) => void) {
    this.refreshSubscribers.push(callback);
  }

  private onTokenRefreshed(token: string) {
    const subscribers = this.refreshSubscribers;
    this.refreshSubscribers = [];
    subscribers.forEach(callback => callback(token));
  }

  private onTokenRefreshFailed() {
    const subscribers = this.refreshSubscribers;
    this.refreshSubscribers = [];
    subscribers.forEach(callback => callback(null));
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.subscribeTokenRefresh((token) => resolve(token));
      });
    }

    this.isRefreshing = true;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.role) {
        headers['X-Portal-Role'] = this.role;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers,
        // The refresh token may live in an HttpOnly cookie, so it is not
        // required to be readable from JavaScript.
        body: JSON.stringify({
          refreshToken: this.refreshToken || undefined,
          role: this.role || undefined,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        // A 400/401 means the refresh token is missing, expired, or revoked,
        // so the session really is over. Rate limits, server errors, and
        // network failures are transient and must not sign the user out.
        if (response.status === 400 || response.status === 401) {
          this.handleSessionExpired();
        }
        this.onTokenRefreshFailed();
        return null;
      }

      const data = await response.json();
      if (data.success && data.data && data.data.accessToken) {
        const newToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        this.setToken(newToken, newRefreshToken, data.data.session || null, true);

        this.onTokenRefreshed(newToken);

        return newToken;
      }

      // A malformed success response is a server problem, not proof that the
      // session is invalid. Keep the session and let the caller show an error.
      this.onTokenRefreshFailed();
      return null;
    } catch (error) {
      // Network failure or malformed JSON: do not destroy a session that may
      // still be valid.
      this.onTokenRefreshFailed();
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  private handleSessionExpired() {
    this.clearToken();
    if (typeof window !== 'undefined') {
      // Redirect to login without session expired parameter
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/doctor')) {
        window.location.href = '/doctor-login';
      } else if (currentPath.startsWith('/secretary')) {
        window.location.href = '/secretary-login';
      } else if (currentPath.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
    }
  }

  private getCookie(name: string): string | null {
    if (typeof window === 'undefined') return null;

    // First try role-scoped cookie name
    const roleName = this.role ? `${this.role}_${name}` : name;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${roleName}=`);

    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }

    // Fallback to non-scoped cookie name
    const parts2 = value.split(`; ${name}=`);
    if (parts2.length === 2) {
      return parts2.pop()?.split(';').shift() || null;
    }

    return null;
  }

  private portalHeaders(): Record<string, string> {
    return this.role ? { 'X-Portal-Role': this.role } : {};
  }

  /**
   * Authentication endpoints return 401 for invalid credentials/OTP. Refreshing
   * and retrying those would replace the real error with a misleading
   * "Session expired" message, so only protected API calls get the retry.
   */
  private shouldRefreshOn401(endpoint: string): boolean {
    const authEndpoints = [
      '/auth/login',
      '/auth/verify-login-otp',
      '/auth/resend-login-otp',
      '/auth/refresh',
      '/auth/register',
      '/auth/otp/send',
      '/auth/otp/verify',
    ];

    return !authEndpoints.some((path) => endpoint.startsWith(path));
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.portalHeaders(),
    };

    // Prefer token from cookies (HttpOnly), fall back to localStorage (for backward compatibility)
    const cookieToken = this.getCookie('accessToken');
    const tokenToUse = cookieToken || this.token;

    if (tokenToUse && tokenToUse !== 'undefined' && tokenToUse !== 'null') {
      headers['Authorization'] = `Bearer ${tokenToUse}`;
    }

    return headers;
  }

  private getCacheKey(endpoint: string): string {
    // The role prefix keeps data from different portals from ever mixing.
    return `${this.role || 'guest'}|${endpoint}`;
  }

  /**
   * Drop every cached GET response. The generation bump also stops a request
   * that is still in flight from writing stale data into the fresh cache.
   */
  private clearGetCache() {
    this.cacheGeneration += 1;
    this.getCache.invalidate();
    // Do not let a request started under a previous session be joined by a
    // caller from the current session.
    this.inFlightGets.clear();
  }

  private cacheGetResponse<T>(
    cacheKey: string,
    ttlMs: number,
    generation: number,
    response: ApiResponse<T>
  ) {
    if (ttlMs <= 0 || generation !== this.cacheGeneration) return;
    if (!response || response.success !== true) return;
    this.getCache.set(cacheKey, response as ApiResponse<unknown>, ttlMs);
  }

  private abortedResponse<T>(): ApiResponse<T> {
    return {
      success: false,
      error: 'Request cancelled',
      errorCode: REQUEST_ABORTED_ERROR_CODE,
    };
  }

  /** Abort-aware delay used between rate-limit retries. */
  private waitForRetry(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('aborted'));
        return;
      }

      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      };

      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private async performGet<T>(
    endpoint: string,
    cacheKey: string,
    ttlMs: number,
    generation: number,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    for (let attempt = 1; attempt <= MAX_GET_RETRY_ATTEMPTS; attempt += 1) {
      if (signal?.aborted) return this.abortedResponse<T>();

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'GET',
          headers: this.getHeaders(),
          credentials: 'include',
          signal,
        });

        if (response.status === 401 && this.shouldRefreshOn401(endpoint)) {
          const newToken = await this.refreshAccessToken();
          if (!newToken) {
            return {
              success: false,
              error: 'Session expired',
              httpStatus: 401,
            };
          }

          // Retry once with the refreshed token. Only GETs reach this path, so
          // the retry is always safe.
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: this.getHeaders(),
            credentials: 'include',
            signal,
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          const normalized = normalizeApiResponse<T>(data);
          this.cacheGetResponse(cacheKey, ttlMs, generation, normalized);
          return normalized;
        }

        if (!response.ok) {
          // Rate limiting on a safe read is transient: honour Retry-After and
          // back off instead of surfacing a 429 to the page.
          const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
          if (shouldRetryResponse('GET', response.status) && attempt < MAX_GET_RETRY_ATTEMPTS) {
            await this.waitForRetry(computeRetryDelayMs(attempt, retryAfterMs), signal);
            continue;
          }

          const errorText = await response.text();
          return parseErrorResponse<T>(response.status, errorText);
        }

        const data = await response.json();
        const normalized = normalizeApiResponse<T>(data);
        this.cacheGetResponse(cacheKey, ttlMs, generation, normalized);
        return normalized;
      } catch (error) {
        if (signal?.aborted) return this.abortedResponse<T>();

        // Mutations are never retried, but a failed safe read is not
        // destructive either; keep the existing single-attempt behaviour for
        // network errors and only special-case rate limits.
        return {
          success: false,
          error: 'Network error occurred',
        };
      }
    }

    return {
      success: false,
      error: 'Too many requests. Please wait a moment and try again.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      httpStatus: 429,
    };
  }

  async get<T>(endpoint: string, options: GetOptions = {}): Promise<ApiResponse<T>> {
    const { signal } = options;
    const ttlMs = options.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;
    const cacheKey = this.getCacheKey(endpoint);

    if (ttlMs > 0 && !options.skipCache) {
      const cached = this.getCache.get(cacheKey);
      if (cached) return cached as ApiResponse<T>;
    }

    // Collapse concurrent identical reads (for example a sidebar and a page
    // loading the same profile on first paint). Abortable callers manage their
    // own request so an abort never cancels another caller's data.
    if (!signal && !options.skipCache && ttlMs > 0) {
      const pending = this.inFlightGets.get(cacheKey);
      if (pending) return pending as Promise<ApiResponse<T>>;
    }

    const generation = this.cacheGeneration;
    const request = this.performGet<T>(endpoint, cacheKey, ttlMs, generation, signal);

    if (!signal) {
      this.inFlightGets.set(cacheKey, request as Promise<ApiResponse<unknown>>);
      const cleanup = () => {
        if (this.inFlightGets.get(cacheKey) === request) {
          this.inFlightGets.delete(cacheKey);
        }
      };
      request.then(cleanup, cleanup);
    }

    return request;
  }

  async post<T>(endpoint: string, body: any = {}, options?: { isFormData?: boolean; headers?: HeadersInit }): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        ...this.portalHeaders(),
        ...(options?.headers as Record<string, string> || {}),
      };

      // Add Authorization header if not provided
      if (!headers['Authorization']) {
        const cookieToken = this.getCookie('accessToken');
        const tokenToUse = cookieToken || this.token;
        if (tokenToUse && tokenToUse !== 'undefined' && tokenToUse !== 'null') {
          headers['Authorization'] = `Bearer ${tokenToUse}`;
        }
      }

      // Don't set Content-Type for FormData - let the browser set it with boundary
      if (!options?.isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: headers as HeadersInit,
        body: options?.isFormData ? body : JSON.stringify(body),
        credentials: 'include',
      });

      if (response.status === 401 && this.shouldRefreshOn401(endpoint)) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryHeaders: Record<string, string> = {
            ...this.portalHeaders(),
            ...(options?.headers as Record<string, string> || {}),
          };
          if (!retryHeaders['Authorization']) {
            const cookieToken = this.getCookie('accessToken');
            const tokenToUse = cookieToken || this.token;
            if (tokenToUse && tokenToUse !== 'undefined' && tokenToUse !== 'null') {
              retryHeaders['Authorization'] = `Bearer ${tokenToUse}`;
            }
          }
          if (!options?.isFormData && !retryHeaders['Content-Type']) {
            retryHeaders['Content-Type'] = 'application/json';
          }

          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: retryHeaders as HeadersInit,
            body: options?.isFormData ? body : JSON.stringify(body),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          const normalized = normalizeApiResponse<T>(data);
          this.clearGetCache();
          return normalized;
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      const normalized = normalizeApiResponse<T>(data);
      this.clearGetCache();
      return normalized;
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async put<T>(endpoint: string, body: any = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (response.status === 401 && this.shouldRefreshOn401(endpoint)) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          const normalized = normalizeApiResponse<T>(data);
          this.clearGetCache();
          return normalized;
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      const normalized = normalizeApiResponse<T>(data);
      this.clearGetCache();
      return normalized;
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async patch<T>(endpoint: string, body: any = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (response.status === 401 && this.shouldRefreshOn401(endpoint)) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          const normalized = normalizeApiResponse<T>(data);
          this.clearGetCache();
          return normalized;
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      const normalized = normalizeApiResponse<T>(data);
      this.clearGetCache();
      return normalized;
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        credentials: 'include',
      });

      if (response.status === 401 && this.shouldRefreshOn401(endpoint)) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          const normalized = normalizeApiResponse<T>(data);
          this.clearGetCache();
          return normalized;
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      const normalized = normalizeApiResponse<T>(data);
      this.clearGetCache();
      return normalized;
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }
}

export const apiClient = new ApiClient();
