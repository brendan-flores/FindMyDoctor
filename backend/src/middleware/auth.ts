import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { error, ErrorCodes } from '../utils/response';

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
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        error(ErrorCodes.UNAUTHORIZED, 'No token provided')
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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