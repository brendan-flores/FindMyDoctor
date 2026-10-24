import rateLimit, { Options } from 'express-rate-limit';
import { Request } from 'express';
import { config } from '../config';
import { error, ErrorCodes } from '../utils/response';

/**
 * Sensitive authentication routes get their own strict budget. Requests to
 * these paths are also counted by the general API limiter, so the stricter
 * limit is the effective one.
 */
const SENSITIVE_AUTH_PREFIXES = [
  '/auth/login',
  '/auth/verify-login-otp',
  '/auth/resend-login-otp',
  '/auth/otp',
  '/auth/patient/otp',
  '/auth/register',
  '/auth/change-password',
];

export function isSensitiveAuthPath(req: Request): boolean {
  // Mounted at /api/v1, so req.path is relative to that mount point.
  return SENSITIVE_AUTH_PREFIXES.some((prefix) => req.path.startsWith(prefix));
}

/**
 * Seconds until the current rate-limit window resets. Uses the value computed
 * by express-rate-limit when available so the header matches the limiter's
 * own window accounting.
 */
function getRetryAfterSeconds(req: Request, windowMs: number): number {
  const resetTime = (req as any).rateLimit?.resetTime as Date | undefined;
  const resetMs = resetTime instanceof Date ? resetTime.getTime() : Date.now() + windowMs;
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}

/**
 * Build a limiter that returns the same JSON error shape as the rest of the
 * API and always includes a `Retry-After` header on 429 responses.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  skip?: (req: Request) => boolean;
}) {
  const { windowMs, max, message, skip } = options;

  const handler: Options['handler'] = (req, res, _next, limiterOptions) => {
    const retryAfter = getRetryAfterSeconds(req, windowMs);

    res.setHeader('Retry-After', String(retryAfter));
    res.status(limiterOptions.statusCode).json(
      error(ErrorCodes.RATE_LIMIT, message)
    );
  };

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Health checks and static assets are not mounted under /api, but
    // pre-flight requests must never consume the user's budget.
    skip: (req) => req.method === 'OPTIONS' || (skip ? skip(req) : false),
    handler,
  });
}

/** General API budget for normal read/navigation traffic. */
export const apiLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
});

/** Strict budget for login, OTP, registration, and password-change routes. */
export const authLimiter = createRateLimiter({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxRequests,
  message: 'Too many authentication attempts from this IP, please try again later.',
  skip: (req) => !isSensitiveAuthPath(req),
});
