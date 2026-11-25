import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DIALOG_FOCUSABLE_SELECTOR,
  getFocusableElements,
  isKeyboardFocusable,
  nextFocusIndex,
} from './dialogA11y.ts';

// ---------------------------------------------------------------------------
// nextFocusIndex — Tab / Shift+Tab wrap-around math
// ---------------------------------------------------------------------------

test('nextFocusIndex advances forward and wraps to the first element', () => {
  assert.equal(nextFocusIndex(0, 3, false), 1);
  assert.equal(nextFocusIndex(1, 3, false), 2);
  assert.equal(nextFocusIndex(2, 3, false), 0);
});

test('nextFocusIndex moves backward on Shift+Tab and wraps to the last element', () => {
  assert.equal(nextFocusIndex(0, 3, true), 2);
  assert.equal(nextFocusIndex(2, 3, true), 1);
  assert.equal(nextFocusIndex(1, 3, true), 0);
});

test('nextFocusIndex handles a single focusable element', () => {
  assert.equal(nextFocusIndex(0, 1, false), 0);
  assert.equal(nextFocusIndex(0, 1, true), 0);
});

test('nextFocusIndex returns -1 when there are no focusable elements', () => {
  assert.equal(nextFocusIndex(0, 0, false), -1);
  assert.equal(nextFocusIndex(0, 0, true), -1);
});

// ---------------------------------------------------------------------------
// getFocusableElements — filters non-focusable / non-visible nodes
// ---------------------------------------------------------------------------

function fakeElement(overrides: {
  tabIndex?: number;
  ariaHidden?: string | null;
  hidden?: boolean;
  disabled?: boolean;
  visible?: boolean;
}): HTMLElement {
  return {
    tabIndex: overrides.tabIndex ?? 0,
    hidden: overrides.hidden ?? false,
    getAttribute: (name: string) =>
      name === 'aria-hidden' ? (overrides.ariaHidden ?? null) : null,
    hasAttribute: (name: string) =>
      name === 'disabled' ? (overrides.disabled ?? false) : false,
    checkVisibility: () => overrides.visible ?? true,
  } as unknown as HTMLElement;
}

function fakeRoot(elements: HTMLElement[]): ParentNode {
  return {
    querySelectorAll: () => elements,
  } as unknown as ParentNode;
}

test('getFocusableElements returns all eligible elements in order', () => {
  const first = fakeElement({});
  const second = fakeElement({ tabIndex: 0 });
  const root = fakeRoot([first, second]);

  assert.deepEqual(getFocusableElements(root), [first, second]);
});

test('getFocusableElements filters out aria-hidden and negative tabindex elements', () => {
  const visible = fakeElement({});
  const hidden = fakeElement({ ariaHidden: 'true' });
  const removed = fakeElement({ tabIndex: -1 });
  const furtherRemoved = fakeElement({ tabIndex: -2 });
  const root = fakeRoot([visible, hidden, removed, furtherRemoved]);

  assert.deepEqual(getFocusableElements(root), [visible]);
});

test('getFocusableElements filters out disabled and hidden elements', () => {
  const visible = fakeElement({});
  const disabled = fakeElement({ disabled: true });
  const hiddenAttribute = fakeElement({ hidden: true });
  const root = fakeRoot([visible, disabled, hiddenAttribute]);

  assert.deepEqual(getFocusableElements(root), [visible]);
});

test('getFocusableElements filters out elements that are not rendered', () => {
  const visible = fakeElement({});
  const displayNone = fakeElement({ visible: false });
  const root = fakeRoot([visible, displayNone]);

  assert.deepEqual(getFocusableElements(root), [visible]);
});

test('isKeyboardFocusable rejects elements hidden by an ancestor', () => {
  const styleByElement = new Map<object, { display: string; visibility: string }>();
  const root = { display: 'block', visibility: 'visible' };
  const hiddenAncestor = { display: 'none', visibility: 'visible' };
  styleByElement.set(root, root);
  styleByElement.set(hiddenAncestor, hiddenAncestor);

  const element = {
    tabIndex: 0,
    hidden: false,
    getAttribute: () => null,
    hasAttribute: () => false,
    parentElement: hiddenAncestor,
    ownerDocument: {
      defaultView: {
        getComputedStyle: (node: object) =>
          styleByElement.get(node) ?? { display: 'block', visibility: 'visible' },
      },
    },
  } as unknown as HTMLElement;

  assert.equal(isKeyboardFocusable(element), false);
});

test('isKeyboardFocusable rejects elements inside an aria-hidden ancestor', () => {
  const hiddenAncestor = {
    getAttribute: (name: string) => (name === 'aria-hidden' ? 'true' : null),
    hasAttribute: () => false,
    parentElement: null,
  };
  const element = {
    tabIndex: 0,
    hidden: false,
    getAttribute: () => null,
    hasAttribute: () => false,
    parentElement: hiddenAncestor,
    checkVisibility: () => true,
  } as unknown as HTMLElement;

  assert.equal(isKeyboardFocusable(element), false);
});

test('isKeyboardFocusable rejects elements with a disabled state', () => {
  const element = {
    tabIndex: 0,
    hidden: false,
    getAttribute: () => null,
    hasAttribute: (name: string) => name === 'disabled',
    parentElement: null,
    checkVisibility: () => true,
  } as unknown as HTMLElement;

  assert.equal(isKeyboardFocusable(element), false);
});

test('isKeyboardFocusable accepts a visible element without checkVisibility', () => {
  const element = {
    tabIndex: 0,
    hidden: false,
    getAttribute: () => null,
    hasAttribute: () => false,
    parentElement: null,
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
      },
    },
  } as unknown as HTMLElement;

  assert.equal(isKeyboardFocusable(element), true);
});

test('getFocusableElements returns an empty list for an empty container', () => {
  assert.deepEqual(getFocusableElements(fakeRoot([])), []);
});

test('dialog focusable selector covers standard interactive elements', () => {
  for (const token of [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]',
  ]) {
    assert.ok(DIALOG_FOCUSABLE_SELECTOR.includes(token), `missing ${token}`);
  }
});
