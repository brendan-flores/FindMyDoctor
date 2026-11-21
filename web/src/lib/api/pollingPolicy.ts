/**
 * Polling cadence for the secretary unread badge.
 *
 * Successful polls keep the fixed 30-second cadence. Consecutive failures back
 * off exponentially (60 s, 120 s, 240 s, then a 5-minute cap) so a failing
 * backend is not hammered at the normal rate. A success resets the counter, so
 * normal polling resumes immediately.
 */

/** Delay between successful polls. */
export const DEFAULT_POLL_INTERVAL_MS = 30_000;

/** Upper bound for the exponential failure backoff. */
export const MAX_POLL_INTERVAL_MS = 300_000;

/**
 * Delay before the next poll, given the number of consecutive failures.
 *
 * `0` failures (last attempt succeeded) returns the normal cadence. Each
 * failure doubles the delay, capped at `maxMs` so a long outage never schedules
 * an unbounded wait.
 */
export function computePollingDelayMs(
  consecutiveFailures: number,
  baseMs: number = DEFAULT_POLL_INTERVAL_MS,
  maxMs: number = MAX_POLL_INTERVAL_MS
): number {
  const failures = Math.floor(consecutiveFailures);

  if (!Number.isFinite(failures) || failures <= 0) {
    return baseMs;
  }

  // Bound the exponent before it can overflow a double for very long outages.
  const multiplier = Math.pow(2, Math.min(failures, 16));
  return Math.min(baseMs * multiplier, maxMs);
}
