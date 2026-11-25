/**
 * Shared keyboard-focus helpers for the app's modal dialogs
 * (ConfirmDialog). Kept DOM-only and framework-free so the focus-trap
 * math can be unit tested with `node --test`.
 */

/** Selector matching elements that may receive keyboard focus inside a dialog. */
export const DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]',
].join(', ');

type CheckVisibilityCapable = HTMLElement & {
  checkVisibility?: (options?: {
    checkOpacity?: boolean;
    checkVisibilityCSS?: boolean;
    visibilityProperty?: boolean;
  }) => boolean;
};

function isRendered(el: HTMLElement): boolean {
  const view = el.ownerDocument?.defaultView;
  if (typeof el.checkVisibility === 'function') {
    return (el as CheckVisibilityCapable).checkVisibility?.({
      checkOpacity: false,
      checkVisibilityCSS: true,
      visibilityProperty: true,
    }) ?? true;
  }
  if (!view?.getComputedStyle) return true;

  // `display: none` on any ancestor removes the subtree from the box tree, so
  // walk up to catch elements hidden by a parent. `visibility` is inherited, so
  // the element's own computed value already reflects hidden ancestors.
  let current: HTMLElement | null = el;
  while (current) {
    if (view.getComputedStyle(current).display === 'none') return false;
    current = current.parentElement;
  }

  const ownStyle = view.getComputedStyle(el);
  return ownStyle.visibility !== 'hidden' && ownStyle.visibility !== 'collapse';
}

function hasHiddenAncestor(el: HTMLElement): boolean {
  let current: HTMLElement | null = el;
  while (current) {
    if (current.getAttribute?.('aria-hidden') === 'true') return true;
    if (current.hasAttribute?.('inert')) return true;
    current = current.parentElement;
  }
  return false;
}

/**
 * Returns whether `element` can actually receive keyboard focus: it must have
 * a non-negative tab index, be enabled, and be visible (including when hidden
 * by an ancestor).
 */
export function isKeyboardFocusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.matches?.(':disabled')) return false;
  if (element.hidden) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (hasHiddenAncestor(element)) return false;
  return isRendered(element);
}

/**
 * Returns the visible, enabled, tabbable descendants of `root` in DOM order.
 */
export function getFocusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR),
  ).filter(isKeyboardFocusable);
}

/**
 * Computes the wrapped focus index for Tab / Shift+Tab inside a dialog.
 * `currentIndex` is the index of the currently focused element (-1 when
 * focus is outside the dialog), `count` the number of focusable elements.
 * Returns -1 when there is nothing to focus.
 */
export function nextFocusIndex(
  currentIndex: number,
  count: number,
  backwards: boolean,
): number {
  if (count <= 0) return -1;
  const delta = backwards ? -1 : 1;
  return (currentIndex + delta + count) % count;
}
