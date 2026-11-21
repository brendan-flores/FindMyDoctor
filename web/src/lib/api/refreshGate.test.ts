import assert from 'node:assert/strict';
import test from 'node:test';

import { createRefreshGate } from './refreshGate.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('coalesces overlapping triggers into one follow-up run', async () => {
  const calls: boolean[] = [];
  const gate = createRefreshGate(async (force) => {
    calls.push(force);
  });

  await Promise.all([gate.run(), gate.run(), gate.run()]);

  assert.deepEqual(calls, [false, false]);
});

test('keeps the forced flag for a trigger that arrives during a refresh', async () => {
  const calls: boolean[] = [];
  const firstRun = deferred();
  let runs = 0;
  const gate = createRefreshGate(async (force) => {
    calls.push(force);
    runs += 1;
    if (runs === 1) {
      await firstRun.promise;
    }
  });

  const initial = gate.run();
  gate.run(true);

  assert.deepEqual(calls, [false]);
  firstRun.resolve();
  await initial;

  assert.deepEqual(calls, [false, true]);
});

test('merges several forced triggers into a single forced follow-up', async () => {
  const calls: boolean[] = [];
  const firstRun = deferred();
  let runs = 0;
  const gate = createRefreshGate(async (force) => {
    calls.push(force);
    runs += 1;
    if (runs === 1) {
      await firstRun.promise;
    }
  });

  const initial = gate.run();
  gate.run(true);
  gate.run(true);

  firstRun.resolve();
  await initial;

  assert.deepEqual(calls, [false, true]);
});

test('runs sequentially when triggers arrive after the previous run settles', async () => {
  const calls: boolean[] = [];
  const gate = createRefreshGate(async (force) => {
    calls.push(force);
  });

  await gate.run();
  await gate.run(true);

  assert.deepEqual(calls, [false, true]);
});

test('a failing refresh does not block a queued follow-up', async () => {
  const calls: boolean[] = [];
  const firstRun = deferred();
  let runs = 0;
  const gate = createRefreshGate(async (force) => {
    calls.push(force);
    runs += 1;
    if (runs === 1) {
      await firstRun.promise;
      throw new Error('initial refresh failed');
    }
  });

  const initial = gate.run();
  gate.run(true);

  firstRun.resolve();
  await assert.rejects(initial, /initial refresh failed/);

  assert.deepEqual(calls, [false, true]);
});
