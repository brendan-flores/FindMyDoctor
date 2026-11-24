import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Portal configuration for strict role-based access control.
 * Each portal defines its URL path prefix, login page, and allowed roles.
 * Roles are verified against the backend JWT via /auth/session — never trusted
 * from a client-set cookie.
 */
const PORTALS: Record<string, {
  prefix: string;
  login: string;
  roles: string[];
}> = {
  admin: {
    prefix: '/admin',
    login: '/admin/login',
    roles: ['ADMIN', 'SUPERADMIN'],
  },
  doctor: {
    prefix: '/doctor',
    login: '/doctor-login',
    roles: ['DOCTOR'],
  },
  secretary: {
    prefix: '/secretary',
    login: '/secretary-login',
    roles: ['SECRETARY'],
  },
};

/**
 * Public paths within portals that do not require authentication.
 * Includes login pages, OTP, password reset, device trust, and signup.
 */
const PUBLIC_PATHS = new Set([
  '/admin/login',
  '/doctor-login',
  '/secretary-login',
  '/doctor/forgot-password',
  '/doctor/reset-password',
  '/doctor/trust-device',
  '/doctor-signup',
  '/secretary/forgot-password',
  '/secretary/reset-password',
  '/secretary/trust-device',
  '/secretary/change-password',
  '/secretary/complete-profile',
]);

/**
 * Determine which portal (if any) a pathname belongs to.
 * Matches exact portal root (e.g. /admin) and nested routes (e.g. /admin/dashboard).
 */
function matchPortal(pathname: string): string | null {
  for (const [key, portal] of Object.entries(PORTALS)) {
    if (pathname === portal.prefix || pathname.startsWith(portal.prefix + '/')) {
      return key;
    }
  }
  return null;
}

/**
 * Find the portal whose allowed roles include the given user role.
 * Returns null if the role is not authorized for any portal.
 */
function findAuthorizedPortal(userRole: string): string | null {
  for (const [key, portal] of Object.entries(PORTALS)) {
    if (portal.roles.includes(userRole)) {
      return key;
    }
  }
  return null;
}

/**
 * Session cookie name. Contains the JWT access token (set by the frontend
 * after successful login). The middleware reads this cookie and verifies the
 * JWT with the backend /auth/session endpoint — it never trusts the cookie
 * value directly.
 */
const SESSION_COOKIE = 'fmdo_session';

/**
 * Backend session verification URL.
 * NEXT_PUBLIC_API_URL already includes /api/v1 (e.g.
 * https://findmydoctor-api.onrender.com/api/v1), so we append /auth/session
 * directly without stripping anything.
 */
function normalizeBackendSessionUrl(rawUrl: string): string {
  if (!rawUrl) return 'https://findmydoctor-api.onrender.com/api/v1/auth/session';

  let url = rawUrl.trim().replace(/\/+$/, '');
  if (!url.endsWith('/api/v1')) {
    url = `${url}/api/v1`;
  }
  return `${url}/auth/session`;
}

const BACKEND_SESSION_URL =
  normalizeBackendSessionUrl(
    process.env.NEXT_PUBLIC_API_URL ||
      'https://findmydoctor-api.onrender.com/api/v1'
  );

/**
 * Outcome of verifying a session with the backend.
 */
type SessionVerifyResult =
  | { kind: 'valid'; role: string }
  | { kind: 'invalid' }          // 401/403 — token invalid, expired, or tampered
  | { kind: 'unavailable' };     // 5xx / timeout / network — infra failure, session may still be valid

/**
 * Verify the JWT with the backend /auth/session endpoint.
 * Distinguishes authentication failures (do not trust the token) from
 * temporary infrastructure failures (do not destroy a potentially valid session).
 */
async function verifySession(jwt: string): Promise<SessionVerifyResult> {
  try {
    const response = await fetch(BACKEND_SESSION_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      // Short timeout so middleware doesn't block page loads
      signal: AbortSignal.timeout(5000),
    });

    // 2xx + valid shape → session is good
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data && data.data.user && data.data.user.role) {
        return { kind: 'valid', role: data.data.user.role };
      }
      return { kind: 'invalid' };
    }

    // 4xx → authentication/authorization failure. The token is invalid,
    // expired, or the user lacks the expected role. Clear the cookie.
    if (response.status >= 400 && response.status < 500) {
      return { kind: 'invalid' };
    }

    // 5xx → backend infrastructure failure. The session may still be valid;
    // do not clear the cookie so the user can resume when the backend recovers.
    return { kind: 'unavailable' };
  } catch {
    // Network error, timeout, DNS failure, etc. Treat as infrastructure
    // failure — do not destroy a potentially valid session.
    return { kind: 'unavailable' };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept portal routes
  const portal = matchPortal(pathname);
  if (!portal) {
    return NextResponse.next();
  }

  const config = PORTALS[portal];

  // Public paths (login, OTP, password reset, etc.) never require auth
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Read the JWT from the session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const jwt = sessionCookie?.value;

  // No session → redirect to this portal's login page
  if (!jwt) {
    return NextResponse.redirect(new URL(config.login, request.url));
  }

  // Verify the JWT with the backend. Never trust the cookie value directly.
  const sessionResult = await verifySession(jwt);

  // Infrastructure failure (backend down / timeout). Do not clear the cookie —
  // the session may still be valid. Deny access safely by redirecting to login
  // without destroying the cookie so the user can resume when the backend recovers.
  if (sessionResult.kind === 'unavailable') {
    return NextResponse.redirect(new URL(config.login, request.url));
  }

  // Invalid, expired, or tampered session → redirect to login and clear the bad cookie
  if (sessionResult.kind === 'invalid') {
    const response = NextResponse.redirect(new URL(config.login, request.url));
    // Clear the bad cookie so the user isn't stuck in a redirect loop
    response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  }

  const userRole = sessionResult.role;

  // Session is valid but the role doesn't match this portal → redirect to
  // the correct portal's login page. The cookie remains valid for the correct
  // portal; the login page will re-establish it if needed.
  const authorizedPortal = findAuthorizedPortal(userRole);
  if (!authorizedPortal || authorizedPortal !== portal) {
    const targetPortal = authorizedPortal
      ? PORTALS[authorizedPortal]
      : config;
    return NextResponse.redirect(new URL(targetPortal.login, request.url));
  }

  // Role matches portal → allow access
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/doctor', '/doctor/:path*', '/secretary', '/secretary/:path*'],
};