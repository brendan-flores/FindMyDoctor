'use client';

import { useEffect, useState } from 'react';
import { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Wraps route-level page content so App Router navigations play a subtle
 * crossfade (see the `.page-fade` rules in globals.css). The key on
 * pathname forces the ViewTransition to remount per route, producing an
 * exit/enter pair; `default="none"` keeps unrelated transitions (Suspense
 * reveals, state updates) from animating. Browsers without View
 * Transitions API support render normally with no animation.
 *
 * The rendered element type stays a `ViewTransition` regardless of document
 * visibility. Previously the component switched between a Fragment and a
 * `ViewTransition` based on `visibilityState`, which unmounted and remounted
 * the whole page subtree on every tab show/hide and destroyed form state,
 * open modals, wizard steps, and OTP state. Keeping the wrapper type stable
 * preserves that state across ordinary visibility changes.
 *
 * Transition props are disabled while the document is hidden (or during
 * SSR/hydration) so we never start a view transition on a hidden document.
 * The wrapper itself remains mounted, so no hidden-document abort occurs and
 * no subtree remount happens.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === 'undefined') return undefined;
    return document.visibilityState === 'visible';
  });

  // Track visibility so we never start a view transition on a hidden document.
  // This only updates state; it does not change the rendered element type.
  useEffect(() => {
    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const canTransition =
    isVisible === true &&
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function';

  return (
    <ViewTransition
      key={pathname}
      enter={canTransition ? 'page-fade' : 'none'}
      exit={canTransition ? 'page-fade' : 'none'}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
