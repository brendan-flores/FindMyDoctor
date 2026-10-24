/**
 * Shared timing policy for the web API client.
 *
 * Only safe (GET) reads are retried. Data-changing requests are never retried
 * automatically so a retry cannot create a duplicate appointment, message, or
 * payment action.
 */

/** Short cache lifetime for GET responses, mainly to collapse rapid navigation. */
export const DEFAULT_GET_CACHE_TTL_MS = 15_000;

/** Total attempts for a GET request, including the first one. */
export const MAX_GET_RETRY_ATTEMPTS = 3;

export const BASE_RETRY_DELAY_MS = 500;
export const MAX_RETRY_DELAY_MS = 5_000;
const JITTER_MAX_MS = 250;

/**
 * Parse a `Retry-After` header. Returns milliseconds, or null when the header
 * is missing or malformed. Both the delay-seconds and HTTP-date forms are
 * supported.
 */
export function parseRetryAfterMs(header: string | null, now: number = Date.now()): number | null {
  if (!header) return null;

  const trimmed = header.trim();
  if (!trimmed) return null;

  // A bare number is delay-seconds. Check it before Date.parse, which parses
  // some negative numbers as dates.
  if (/^[+-]?\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
  }

  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - now);
  }

  return null;
}

/**
 * Delay before retry number `attempt` (1-based). Prefers a server-provided
 * Retry-After value, otherwise uses exponential backoff with jitter. Always
 * capped at MAX_RETRY_DELAY_MS so a user is never left waiting indefinitely.
 */
export function computeRetryDelayMs(
  attempt: number,
  retryAfterMs: number | null,
  random: () => number = Math.random
): number {
  if (retryAfterMs !== null && retryAfterMs >= 0) {
    return Math.min(retryAfterMs, MAX_RETRY_DELAY_MS);
  }

  const exponential = Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1))
  );
  const jitter = Math.floor(random() * JITTER_MAX_MS);

  return Math.min(MAX_RETRY_DELAY_MS, exponential + jitter);
}

/** GET requests may be retried on rate limits. Mutations must not be retried. */
export function shouldRetryResponse(method: string, status: number): boolean {
  return method.toUpperCase() === 'GET' && status === 429;
}
