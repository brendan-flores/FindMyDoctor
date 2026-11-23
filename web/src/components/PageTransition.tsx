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
 * Guard: the View Transitions API throws `InvalidStateError`
 * ("Transition was aborted because of invalid state. Document hidden")
 * when `startViewTransition` is called on a document that is not fully
 * active (hidden). That can happen mid-navigation or when the tab is
 * backgrounded/minimized, which is exactly the "right after navigating to
 * the doctor portal" symptom. While the document is hidden we render the
 * children without a transition and resume the crossfade once the document
 * becomes visible again. This single shared component is used by the
 * Doctor, Secretary, and Admin portal layouts (and their auth layouts), so
 * the guard covers all web portals.
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

  // Track visibility so we never call startViewTransition on a hidden document.
  useEffect(() => {
    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // No animation during SSR/hydration, while the document is hidden, or in
  // browsers without the View Transitions API.
  if (
    isVisible === undefined ||
    !isVisible ||
    typeof document === 'undefined' ||
    !document.startViewTransition
  ) {
    return <>{children}</>;
  }

  return (
    <ViewTransition key={pathname} enter="page-fade" exit="page-fade" default="none">
      {children}
    </ViewTransition>
  );
}
