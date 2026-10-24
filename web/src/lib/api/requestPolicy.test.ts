import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  computeRetryDelayMs,
  parseRetryAfterMs,
  shouldRetryResponse,
} from './requestPolicy.ts';

test('parseRetryAfterMs reads delay-seconds', () => {
  assert.equal(parseRetryAfterMs('2'), 2000);
  assert.equal(parseRetryAfterMs(' 0 '), 0);
});

test('parseRetryAfterMs reads an HTTP date and clamps to zero in the past', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');

  assert.equal(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:05 GMT', now), 5000);
  assert.equal(parseRetryAfterMs('Thu, 01 Jan 2025 00:00:00 GMT', now), 0);
});

test('parseRetryAfterMs rejects missing and malformed values', () => {
  assert.equal(parseRetryAfterMs(null), null);
  assert.equal(parseRetryAfterMs(''), null);
  assert.equal(parseRetryAfterMs('soon'), null);
  assert.equal(parseRetryAfterMs('-5'), null);
});

test('computeRetryDelayMs prefers Retry-After and caps it', () => {
  assert.equal(computeRetryDelayMs(1, 1200), 1200);
  assert.equal(computeRetryDelayMs(1, MAX_RETRY_DELAY_MS * 10), MAX_RETRY_DELAY_MS);
});

test('computeRetryDelayMs grows exponentially with bounded jitter', () => {
  const noJitter = () => 0;
  assert.equal(computeRetryDelayMs(1, null, noJitter), BASE_RETRY_DELAY_MS);
  assert.equal(computeRetryDelayMs(2, null, noJitter), BASE_RETRY_DELAY_MS * 2);
  assert.equal(computeRetryDelayMs(10, null, noJitter), MAX_RETRY_DELAY_MS);

  const withJitter = computeRetryDelayMs(1, null, () => 0.999);
  assert.ok(withJitter >= BASE_RETRY_DELAY_MS);
  assert.ok(withJitter <= BASE_RETRY_DELAY_MS + 250);
});

test('only safe GET requests are retried on rate limits', () => {
  assert.equal(shouldRetryResponse('GET', 429), true);
  assert.equal(shouldRetryResponse('get', 429), true);
  assert.equal(shouldRetryResponse('POST', 429), false);
  assert.equal(shouldRetryResponse('PUT', 429), false);
  assert.equal(shouldRetryResponse('PATCH', 429), false);
  assert.equal(shouldRetryResponse('DELETE', 429), false);
  assert.equal(shouldRetryResponse('GET', 500), false);
});
