'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface PersistedStateKeyParts {
  role: string;
  route: string;
  userId?: string | null;
  field: string;
}

/**
 * Builds a sessionStorage key scoped to the portal role, route and authenticated
 * user so UI preferences can never leak between accounts sharing a browser tab.
 *
 * Returns null when no user identity is available: protected portal
 * preferences must never fall back to a shared anonymous namespace, so the
 * hook runs in memory-only mode until a real user ID exists.
 */
export function buildPersistedStateKey(parts: PersistedStateKeyParts): string | null {
  if (!parts.userId) return null;
  return `fido:ui:${parts.role}:${parts.route}:${parts.userId}:${parts.field}`;
}

export type PersistedStateValidator<T> = (value: unknown) => value is T;

function readStoredValue<T>(key: string, validate?: PersistedStateValidator<T>): T | undefined {
  try {
    const storage = typeof window !== 'undefined' ? window.sessionStorage : null;
    if (!storage) return undefined;

    const raw = storage.getItem(key);
    if (raw === null) return undefined;

    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return undefined;

    return parsed as T;
  } catch {
    // Corrupted JSON or unavailable storage: fall back to the default value.
    return undefined;
  }
}

function writeStoredValue<T>(key: string, value: T): void {
  try {
    const storage = typeof window !== 'undefined' ? window.sessionStorage : null;
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore unavailable or full storage; the page keeps working in memory.
  }
}

/**
 * Persists a small, non-sensitive UI preference to sessionStorage.
 *
 * The default value is rendered during SSR and the first client render so the
 * markup matches during hydration. The stored value is restored from an effect
 * after mounting.
 *
 * Restoration is tracked per key: `ready` is only true once the value stored
 * under the *current* key has been read and applied. When the key changes
 * (for example after an account switch), the previous key's value is discarded
 * during render, readiness drops to false, and nothing is written until the
 * new key has been restored — so one user's state can never be persisted
 * under another user's key.
 *
 * A null key (no authenticated user ID yet) disables persistence entirely:
 * nothing is read or written and the hook behaves like plain useState.
 */
export function usePersistedState<T>(
  key: string | null,
  defaultValue: T,
  validate?: PersistedStateValidator<T>
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);

  // Render-phase adjustment for key changes (the React-sanctioned pattern for
  // resetting state when a prop changes). This guarantees the committed render
  // for a new key already exposes the default value and reports not-ready, so
  // the persistence effect below can never observe the previous key's value
  // under the new key.
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setValue(defaultValue);
    setRestoredKey(null);
  }

  // Keep callbacks out of the restore effect dependencies so an inline
  // validator cannot re-run restoration on every render.
  const validateRef = useRef(validate);
  validateRef.current = validate;

  // A null key means persistence is disabled: report ready immediately so the
  // page keeps working with in-memory state only.
  const ready = key === null ? true : restoredKey === key;

  useEffect(() => {
    if (key === null) return;

    const restored = readStoredValue<T>(key, validateRef.current);
    if (restored !== undefined) {
      setValue(restored);
    }

    setRestoredKey(key);
  }, [key]);

  useEffect(() => {
    // Only persist once the value stored under this exact key has been
    // restored and is the active value.
    if (key === null || restoredKey !== key) return;
    writeStoredValue(key, value);
  }, [key, restoredKey, value]);

  return [value, setValue, ready];
}
