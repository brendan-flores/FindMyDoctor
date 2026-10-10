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
  };
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
      // Fall back to cookie
      const cookieToken = req.cookies?.accessToken;
      if (cookieToken && cookieToken !== 'undefined' && cookieToken !== 'null') {
        token = cookieToken;
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
    };

    req.user = decoded;
    next();
  } catch (err) {
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