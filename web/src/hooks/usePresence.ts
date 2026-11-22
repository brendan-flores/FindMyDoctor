'use client';

import { useEffect, useRef, useState } from 'react';

const EXIT_DURATION_MS = 180;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Keeps a component mounted for `duration` ms after `open` becomes false so
 * CSS exit transitions can play before the element unmounts. Returns whether
 * the element should currently be rendered. Under prefers-reduced-motion the
 * delay collapses to zero so behavior matches an instant unmount.
 */
export function usePresence(open: boolean, duration = EXIT_DURATION_MS): boolean {
  const [present, setPresent] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const delay = prefersReducedMotion() ? 0 : duration;
    const timeout = setTimeout(() => setPresent(false), delay);
    return () => clearTimeout(timeout);
  }, [open, duration]);

  return present;
}

/**
 * Like usePresence, but for modals driven by an entity value (e.g.
 * `{selectedItem && <Modal/>}`). Returns `present` for mount control and
 * `value`, the last non-null value, so the modal can keep rendering its
 * content while the exit transition plays after the source state is
 * cleared.
 */
export function usePresenceValue<T>(
  value: T | null | undefined,
  duration = EXIT_DURATION_MS,
): { present: boolean; value: T | null } {
  const present = usePresence(value != null, duration);
  const ref = useRef<T | null>(null);
  if (value != null) ref.current = value;
  return { present, value: ref.current };
}
