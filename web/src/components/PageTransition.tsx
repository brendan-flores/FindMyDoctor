'use client';

import { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Wraps route-level page content so App Router navigations play a subtle
 * crossfade (see the `.page-fade` rules in globals.css). The key on
 * pathname forces the ViewTransition to remount per route, producing an
 * exit/enter pair; `default="none"` keeps unrelated transitions (Suspense
 * reveals, state updates) from animating. Browsers without View
 * Transitions API support render normally with no animation.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <ViewTransition key={pathname} enter="page-fade" exit="page-fade" default="none">
      {children}
    </ViewTransition>
  );
}
