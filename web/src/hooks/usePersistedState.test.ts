import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';

import { buildPersistedStateKey, usePersistedState } from './usePersistedState.ts';

// ---------------------------------------------------------------------------
// Minimal React hook runtime
//
// The project has no DOM test environment, so these tests drive the hook
// through a tiny dispatcher installed on React's shared internals. It
// implements just the hooks the module uses (useState/useRef/useEffect) with
// real semantics: render-phase updates re-render before commit, and effects
// run after commit when their deps change.
// ---------------------------------------------------------------------------

const internals = (React as any)
  .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

interface EffectRecord {
  index: number;
  fn: () => void;
  deps: unknown[] | undefined;
}

function depsChanged(prev: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  return next.some((d, i) => !Object.is(d, prev[i]));
}

function createHookRuntime(hookFn: () => unknown, onCommit?: (result: unknown) => void) {
  const slots: unknown[] = [];
  let cursor = 0;
  let pendingEffects: EffectRecord[] = [];
  let lastDeps: (unknown[] | undefined)[] = [];
  let inRender = false;
  let renderDirty = false;
  let scheduled = false;
  let lastResult: unknown;

  const dispatcher = {
    useState(initial: unknown) {
      const i = cursor++;
      if (!(i in slots)) {
        slots[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      }
      const set = (v: unknown) => {
        const next = typeof v === 'function' ? (v as (p: unknown) => unknown)(slots[i]) : v;
        if (!Object.is(next, slots[i])) {
          slots[i] = next;
          if (inRender) renderDirty = true;
          else scheduled = true;
        }
      };
      return [slots[i], set];
    },
    useRef(initial: unknown) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(fn: () => void, deps: unknown[] | undefined) {
      const i = cursor++;
      pendingEffects.push({ index: i, fn, deps });
    },
    useMemo(fn: () => unknown) {
      return fn();
    },
    useCallback(fn: unknown) {
      return fn;
    },
    useDebugValue() {},
  };

  function renderOnce() {
    let result: unknown;
    // Render-phase state updates (the key-change reset) re-render immediately,
    // mirroring React, until a pass completes without scheduling an update.
    for (let guard = 0; guard < 25; guard += 1) {
      cursor = 0;
      pendingEffects = [];
      renderDirty = false;
      inRender = true;
      result = hookFn();
      inRender = false;
      if (!renderDirty) break;
    }
    return result;
  }

  function commit() {
    const effects = pendingEffects;
    pendingEffects = [];
    for (const effect of effects) {
      if (depsChanged(lastDeps[effect.index], effect.deps)) {
        lastDeps[effect.index] = effect.deps ? [...effect.deps] : undefined;
        effect.fn();
      }
    }
  }

  function flush() {
    for (let guard = 0; guard < 100; guard += 1) {
      lastResult = renderOnce();
      commit();
      onCommit?.(lastResult);
      if (!scheduled) return;
      scheduled = false;
    }
    throw new Error('hook runtime did not settle');
  }

  return { dispatcher, flush, get result() { return lastResult; } };
}

// ---------------------------------------------------------------------------
// sessionStorage fake + per-test environment
// ---------------------------------------------------------------------------

function createSessionStorage() {
  const map = new Map<string, string>();
  const writes: { key: string; value: string }[] = [];
  return {
    writes,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      writes.push({ key: k, value: String(v) });
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

type HookArgs = {
  key: string | null;
  defaultValue: unknown;
  validate?: (v: unknown) => boolean;
};

function mountHook(args: HookArgs, seed?: Record<string, string>) {
  const storage = createSessionStorage();
  if (seed) {
    for (const [k, v] of Object.entries(seed)) storage.setItem(k, v);
  }
  const prevWindow = (globalThis as any).window;
  const prevH = internals.H;
  (globalThis as any).window = { sessionStorage: storage };

  const snapshots: { value: unknown; ready: boolean }[] = [];
  const recordRender = (result: unknown) => {
    const [value, , ready] = result as [unknown, unknown, boolean];
    snapshots.push({ value, ready });
  };

  const runtime = createHookRuntime(
    () => usePersistedState(args.key, args.defaultValue, args.validate as any),
    recordRender,
  );
  internals.H = runtime.dispatcher;

  const controller = {
    storage,
    snapshots,
    get value() {
      return (runtime.result as [unknown])[0];
    },
    get ready() {
      return (runtime.result as [unknown, unknown, boolean])[2];
    },
    setValue: (v: unknown) => {
      const [, set] = runtime.result as [unknown, (x: unknown) => void];
      set(v);
      runtime.flush();
    },
    setKey: (key: string | null) => {
      args.key = key;
      snapshots.length = 0;
      runtime.flush();
    },
    unmount: () => {
      internals.H = prevH;
      (globalThis as any).window = prevWindow;
    },
  };

  runtime.flush();
  return controller;
}

const keyFor = (userId: string, field = 'tab') =>
  buildPersistedStateKey({ role: 'secretary', route: '/secretary/queue', userId, field });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('buildPersistedStateKey returns null without a user ID (no shared anon namespace)', () => {
  assert.equal(buildPersistedStateKey({ role: 'secretary', route: '/r', userId: null, field: 'f' }), null);
  assert.equal(buildPersistedStateKey({ role: 'secretary', route: '/r', field: 'f' }), null);
  assert.equal(
    buildPersistedStateKey({ role: 'secretary', route: '/r', userId: 'u1', field: 'f' }),
    'fido:ui:secretary:/r:u1:f',
  );
});

test('switching keys never writes the previous value under the new key', () => {
  const keyA = keyFor('user-a')!;
  const keyB = keyFor('user-b')!;
  const hook = mountHook({ key: keyA, defaultValue: 'default' });
  try {
    hook.storage.setItem(keyB, JSON.stringify('beta-value'));
    hook.setValue('alpha-value'); // user A changes their preference
    assert.equal(hook.storage.getItem(keyA), JSON.stringify('alpha-value'));

    hook.setKey(keyB);

    assert.equal(hook.value, 'beta-value', 'user B stored value must be restored');
    assert.equal(hook.ready, true);

    const writesToB = hook.storage.writes.filter((w) => w.key === keyB);
    assert.ok(
      writesToB.every((w) => w.value === JSON.stringify('beta-value')),
      `user A value must never be written under user B key; saw ${JSON.stringify(writesToB)}`,
    );
    assert.equal(hook.storage.getItem(keyA), JSON.stringify('alpha-value'), 'user A key untouched');
  } finally {
    hook.unmount();
  }
});

test('readiness is false and the default is exposed while a new key restores', () => {
  const keyA = keyFor('user-a', 'tab')!;
  const keyB = keyFor('user-b', 'tab')!;
  const hook = mountHook({ key: keyA, defaultValue: 'all' });
  try {
    hook.setValue('waiting');
    hook.setKey(keyB);

    // The first committed render after the key change must show the default
    // value and ready=false; the restored render follows after effects.
    assert.ok(hook.snapshots.length >= 2, `expected multiple committed renders, got ${hook.snapshots.length}`);
    assert.deepEqual(hook.snapshots[0], { value: 'all', ready: false });
    assert.deepEqual(hook.snapshots[hook.snapshots.length - 1], { value: 'all', ready: true });
  } finally {
    hook.unmount();
  }
});

test('no persistence write happens before restoration completes', () => {
  const keyA = keyFor('user-a', 'q')!;
  const keyB = keyFor('user-b', 'q')!;
  const hook = mountHook({ key: keyA, defaultValue: '' });
  try {
    hook.storage.setItem(keyB, JSON.stringify('stored-b'));
    hook.setValue('typed-by-a');

    const writesBeforeSwitch = hook.storage.writes.length;
    hook.setKey(keyB);

    const newWrites = hook.storage.writes.slice(writesBeforeSwitch);
    // Every write after the switch targets key B and carries B's restored
    // value; the pre-restore default/A value is never persisted.
    assert.ok(newWrites.length > 0, 'restored value should be persisted once ready');
    assert.ok(
      newWrites.every((w) => w.key === keyB && w.value === JSON.stringify('stored-b')),
      `unexpected writes during key switch: ${JSON.stringify(newWrites)}`,
    );
  } finally {
    hook.unmount();
  }
});

test('null key disables persistence but keeps the hook functional', () => {
  const realKey = keyFor('user-a', 's')!;
  const hook = mountHook({ key: null, defaultValue: 'ALL' });
  try {
    assert.equal(hook.ready, true, 'null key reports ready so the page still works');
    assert.equal(hook.value, 'ALL');

    hook.setValue('COMPLETED');
    assert.equal(hook.value, 'COMPLETED', 'in-memory updates still work');
    assert.equal(hook.storage.writes.length, 0, 'nothing may be written without a user key');

    // When a real identity arrives, persistence resumes and restores stored data.
    hook.storage.setItem(realKey, JSON.stringify('SCHEDULED'));
    hook.setKey(realKey);
    assert.equal(hook.value, 'SCHEDULED');
    assert.equal(hook.ready, true);
  } finally {
    hook.unmount();
  }
});

test('invalid stored values fall back to the default', () => {
  const key = keyFor('user-a', 'd')!;
  const validate = (v: unknown): v is string =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

  const corrupted = mountHook(
    { key, defaultValue: '2026-01-01', validate },
    { [key]: JSON.stringify('not-a-date') },
  );
  try {
    assert.equal(corrupted.value, '2026-01-01');
    assert.equal(corrupted.ready, true);
  } finally {
    corrupted.unmount();
  }

  const brokenJson = mountHook(
    { key, defaultValue: '2026-01-01', validate },
    { [key]: '{"broken-json' },
  );
  try {
    assert.equal(brokenJson.value, '2026-01-01');
    assert.equal(brokenJson.ready, true);
  } finally {
    brokenJson.unmount();
  }
});
