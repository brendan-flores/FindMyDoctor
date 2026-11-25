'use client';

import { useEffect, useId, useRef } from 'react';
import { usePresence } from '@/hooks/usePresence';
import { getFocusableElements, nextFocusIndex } from '@/lib/dialogA11y';

/**
 * - `confirm`: title + message with Cancel and a Confirm action (primary or
 *   danger styling). Used for irreversible actions.
 * - `info`: title + message with a single OK action. Used where the user
 *   must acknowledge a message (replaces native `alert()`).
 */
export type ConfirmDialogMode = 'confirm' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  mode?: ConfirmDialogMode;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Restores focus to the element that opened the dialog, if it is still in the
 * document, and clears the stored target so a later open captures a new one.
 */
function restoreFocus(ref: { current: HTMLElement | null }) {
  const previous = ref.current;
  ref.current = null;
  if (previous?.isConnected) previous.focus();
}

/**
 * Keyboard-accessible confirmation/information dialog used for irreversible
 * actions (revoke trust, sign out everywhere, delete records) and for
 * messages the user must acknowledge.
 *
 * - Closes on Escape (ignored while `busy` or already closing).
 * - Focus lands on the cancel button for confirmations (a careless Enter is
 *   safe) or on the OK button for info dialogs.
 * - Tab / Shift+Tab are trapped inside the dialog while it is rendered,
 *   including its exit transition.
 * - Focus is restored to the element that opened the dialog only once the
 *   dialog leaves the rendered state or unmounts.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  mode = 'confirm',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isInfo = mode === 'info';
  const resolvedConfirmLabel = confirmLabel ?? (isInfo ? 'OK' : 'Confirm');

  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  const openRef = useRef(open);
  onCancelRef.current = onCancel;
  busyRef.current = busy;
  openRef.current = open;
  const present = usePresence(open);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!present) return;

    const active = document.activeElement;
    if (
      !previousFocusRef.current &&
      active instanceof HTMLElement &&
      !panelRef.current?.contains(active)
    ) {
      previousFocusRef.current = active;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (openRef.current && !busyRef.current) onCancelRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = focusable.findIndex(
        (element) => element === document.activeElement,
      );
      const next =
        currentIndex === -1
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : nextFocusIndex(currentIndex, focusable.length, event.shiftKey);

      event.preventDefault();
      focusable[next]?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [present]);

  useEffect(() => {
    if (!open) return;

    const focusTarget = isInfo ? confirmRef.current : cancelRef.current;
    focusTarget?.focus();
  }, [open, present, isInfo]);

  useEffect(() => {
    if (present) return;
    restoreFocus(previousFocusRef);
  }, [present]);

  useEffect(
    () => () => {
      restoreFocus(previousFocusRef);
    },
    [],
  );

  if (!present) return null;

  const confirmClasses =
    confirmVariant === 'danger'
      ? 'bg-error-600 text-white hover:bg-error-700'
      : 'bg-primary-600 text-white hover:bg-primary-700';
  const state = open ? 'open' : 'closed';

  return (
    <div
      className="fmd-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-state={state}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="fmd-modal-panel bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        data-state={state}
      >
        <h3 id={titleId} className="text-lg font-bold text-neutral-800">
          {title}
        </h3>
        <p id={messageId} className="mt-2 text-sm text-neutral-600">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          {!isInfo && (
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmClasses}`}
          >
            {busy ? 'Working…' : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
