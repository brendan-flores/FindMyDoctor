import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { error, ErrorCodes } from '../utils/response';
import { query } from '../database/connection';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
    sessionVersion?: number;
    remember?: boolean;
    sst?: number;
    iat?: number;
  };
}

const ROLE_PREFIX_TO_EXPECTED_ROLE: Record<string, string> = {
  doctor: 'DOCTOR',
  secretary: 'SECRETARY',
  admin: 'ADMIN',
  patient: 'PATIENT',
};

/**
 * Resolve the portal role for this request from the API path or the
 * X-Portal-Role header sent by the web client. This lets the middleware pick
 * the correct role-scoped cookie when Doctor, Secretary, and Admin sessions
 * coexist in one browser.
 */
function resolveRolePrefix(req: Request): string {
  // Shared sub-resources under a role-named namespace are not portal-specific.
  // /doctors/:id/availability is consumed by both PATIENT tokens (the mobile
  // booking journey reads doctor availability) and DOCTOR tokens, so forcing
  // the DOCTOR portal on that path would 401 valid patient tokens.
  // Doctor-only routes remain protected by authorize('DOCTOR') downstream.
  const fullPath = (req.originalUrl || req.baseUrl || req.path || '')
    .split('?')[0]
    .toLowerCase();
  const sharedResource = fullPath.split('/').filter(Boolean).slice(2).join('/');
  if (/^doctors?\/[^/]+\/availability$/.test(sharedResource)) {
    return '';
  }

  // Role-namespaced API paths are authoritative, so a spoofed X-Portal-Role
  // header cannot weaken the cross-role check. Shared resource paths such as
  // /patients/:id, /prescriptions/patients/:id, and /visits/patient/:id are
  // used by more than one portal, so they must use the client's header rather
  // than assuming the PATIENT role from the path.
  const candidates = [req.baseUrl || '', req.originalUrl || '', req.path || ''];
  for (const candidate of candidates) {
    const path = candidate.split('?')[0].toLowerCase();
    if (path.startsWith('/api/')) {
      // Role-namespaced mounts are authoritative. Anchor the role name to the
      // mount namespace (the segment after the API version) so secretary-only
      // sub-resource paths such as /gcash-qr/doctor/:id are not misread as the
      // DOCTOR portal (that mismatch would 401 valid secretary tokens).
      const segments = path.split('/').filter(Boolean);
      const namespace = segments[2] ?? '';
      if (/^doctors?$/.test(namespace)) return 'doctor';
      if (/^secret(?:ary|aries)$/.test(namespace)) return 'secretary';
      if (/^admin$/.test(namespace)) return 'admin';
    }
  }

  const headerRole = String(req.headers['x-portal-role'] || '').toLowerCase();
  if (['doctor', 'secretary', 'admin', 'patient'].includes(headerRole)) {
    return headerRole;
  }

  return '';
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // First try to get token from Authorization header
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const headerToken = authHeader.substring(7).trim();
      if (headerToken && headerToken !== 'undefined' && headerToken !== 'null') {
        token = headerToken;
      }
    }

    if (!token) {
      const rolePrefix = resolveRolePrefix(req);

      // Try the role-scoped cookie for this portal first.
      const cookieNames = rolePrefix
        ? [`${rolePrefix}_accessToken`]
        : ['doctor_accessToken', 'secretary_accessToken', 'admin_accessToken', 'patient_accessToken'];

      for (const cookieName of cookieNames) {
        const cookieToken = req.cookies?.[cookieName];
        if (cookieToken && cookieToken !== 'undefined' && cookieToken !== 'null') {
          token = cookieToken;
          break;
        }
      }

      // Fallback to the legacy global cookie for backward compatibility.
      if (!token) {
        const globalCookieToken = req.cookies?.accessToken;
        if (globalCookieToken && globalCookieToken !== 'undefined' && globalCookieToken !== 'null') {
          token = globalCookieToken;
        }
      }
    }

    if (!token) {
      return res.status(401).json(
        error(ErrorCodes.UNAUTHORIZED, 'No token provided')
      );
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
      role: string;
      mustChangePassword: boolean;
      sv?: number;
      remember?: boolean;
    };

    // Never let a cookie from one portal authenticate another portal.
    const rolePrefix = resolveRolePrefix(req);
    const expectedRole = rolePrefix ? ROLE_PREFIX_TO_EXPECTED_ROLE[rolePrefix] : '';
    if (expectedRole) {
      const roleMatches = expectedRole === 'ADMIN'
        ? decoded.role === 'ADMIN' || decoded.role === 'SUPERADMIN'
        : decoded.role === expectedRole;
      if (!roleMatches) {
        console.warn('Rejected cross-role token', { path: req.originalUrl, ip: req.ip });
        return res.status(401).json(
          error(ErrorCodes.UNAUTHORIZED, 'Invalid or expired token')
        );
      }
    }

    req.user = {
      ...decoded,
      sessionVersion: decoded.sv,
      remember: decoded.remember === true,
    };
    next();
  } catch (err) {
    // Never log the token value.
    console.warn('Auth token validation failed', { path: req.originalUrl, ip: req.ip });
    return res.status(401).json(
      error(ErrorCodes.UNAUTHORIZED, 'Invalid or expired token')
    );
  }
}

export function requirePasswordChange(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json(
      error(ErrorCodes.MUST_CHANGE_PASSWORD, 'Password change required')
    );
  }
  next();
}

export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json(
        error(ErrorCodes.UNAUTHORIZED, 'Authentication required')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(
        error(ErrorCodes.FORBIDDEN, 'Insufficient permissions')
      );
    }

    next();
  };
}

// Require password change only for SECRETARY role
// This allows shared routes (DOCTOR, SECRETARY, ADMIN) to work for non-Secretary users
export function requireSecretaryPasswordChange(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role === 'SECRETARY' && req.user?.mustChangePassword) {
    return res.status(403).json(
      error(ErrorCodes.MUST_CHANGE_PASSWORD, 'Password change required')
    );
  }
  next();
}

// Require secretary profile completion
// This middleware checks if a Secretary has completed their required profile details
// Completion is determined by: first_name, last_name, and contact_number being non-NULL and non-blank
export async function requireSecretaryProfileCompletion(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role === 'SECRETARY') {
    try {
      const result = await query(
        'SELECT first_name, last_name, contact_number FROM secretaries WHERE user_id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json(
          error(ErrorCodes.NOT_FOUND, 'Secretary profile not found')
        );
      }

      const secretary = result.rows[0];

      // Check if required fields are complete
      const isComplete =
        secretary.first_name &&
        secretary.first_name.trim() !== '' &&
        secretary.last_name &&
        secretary.last_name.trim() !== '' &&
        secretary.contact_number &&
        secretary.contact_number.trim() !== '';

      if (!isComplete) {
        return res.status(403).json(
          error(ErrorCodes.FORBIDDEN, 'Profile completion required')
        );
      }
    } catch (err) {
      console.error('Error checking secretary profile completion:', err);
      return res.status(500).json(
        error(ErrorCodes.SERVER_ERROR, 'Failed to verify profile completion')
      );
    }
  }

  next();
}