import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_POLL_INTERVAL_MS,
  MAX_POLL_INTERVAL_MS,
  computePollingDelayMs,
} from './pollingPolicy.ts';

test('successful polling keeps the 30-second cadence', () => {
  assert.equal(DEFAULT_POLL_INTERVAL_MS, 30_000);
  assert.equal(computePollingDelayMs(0), 30_000);
});

test('consecutive failures double the polling delay', () => {
  assert.equal(computePollingDelayMs(1), 60_000);
  assert.equal(computePollingDelayMs(2), 120_000);
  assert.equal(computePollingDelayMs(3), 240_000);
});

test('the backoff delay is bounded by the maximum', () => {
  assert.equal(MAX_POLL_INTERVAL_MS, 300_000);
  assert.equal(computePollingDelayMs(4), MAX_POLL_INTERVAL_MS);
  assert.equal(computePollingDelayMs(50), MAX_POLL_INTERVAL_MS);
});

test('a successful request resets the delay to the normal cadence', () => {
  assert.equal(computePollingDelayMs(0), DEFAULT_POLL_INTERVAL_MS);
  assert.equal(computePollingDelayMs(-1), DEFAULT_POLL_INTERVAL_MS);
});

test('custom base and maximum bounds are honored', () => {
  assert.equal(computePollingDelayMs(1, 1000, 5000), 2000);
  assert.equal(computePollingDelayMs(10, 1000, 5000), 5000);
});
