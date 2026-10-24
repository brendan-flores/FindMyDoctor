import assert from 'node:assert/strict';
import test from 'node:test';

import { ClientTtlCache } from './ttlCache.ts';

function createClock(start = 1_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

test('returns a cached value until it expires', () => {
  const clock = createClock();
  const cache = new ClientTtlCache<string>(clock.now);

  cache.set('doctor|/doctors/me', 'profile', 15_000);
  assert.equal(cache.get('doctor|/doctors/me'), 'profile');

  clock.advance(14_999);
  assert.equal(cache.get('doctor|/doctors/me'), 'profile');

  clock.advance(1);
  assert.equal(cache.get('doctor|/doctors/me'), undefined);
  assert.equal(cache.size, 0);
});

test('invalidate clears only matching prefixes', () => {
  const clock = createClock();
  const cache = new ClientTtlCache<string>(clock.now);

  cache.set('doctor|/doctors/me', 'a', 15_000);
  cache.set('doctor|/doctors/me/schedules', 'b', 15_000);
  cache.set('secretary|/secretaries/me', 'c', 15_000);

  cache.invalidate('doctor|');
  assert.equal(cache.get('doctor|/doctors/me'), undefined);
  assert.equal(cache.get('doctor|/doctors/me/schedules'), undefined);
  assert.equal(cache.get('secretary|/secretaries/me'), 'c');
});

test('invalidate without a prefix clears everything', () => {
  const clock = createClock();
  const cache = new ClientTtlCache<string>(clock.now);

  cache.set('a', '1', 15_000);
  cache.set('b', '2', 15_000);
  cache.invalidate();

  assert.equal(cache.size, 0);
});

test('non-positive TTLs are not cached', () => {
  const cache = new ClientTtlCache<string>(() => 1_000);

  cache.set('key', 'value', 0);
  cache.set('key', 'value', -1);

  assert.equal(cache.get('key'), undefined);
});
