import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The web test setup has no DOM/React renderer, so these tests guard the
// InternationalPhoneInput country dropdown's accessibility contract by
// asserting on the component source: menu semantics instead of nested
// interactive options, keyboard handling, and focus return.
const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'components',
    'ui',
    'InternationalPhoneInput.tsx',
  ),
  'utf8',
);

test('country trigger exposes menu semantics with expanded/controls state', () => {
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /aria-expanded=\{isOpen\}/);
  assert.match(source, /aria-controls=\{menuId\}/);
});

test('dropdown uses menu/menuitemradio roles, not listbox with nested buttons', () => {
  assert.match(source, /role="menu"/);
  assert.match(source, /role="menuitemradio"/);
  assert.match(source, /aria-checked=\{c\.iso === selected\.iso\}/);
  assert.doesNotMatch(source, /role="listbox"/);
  assert.doesNotMatch(source, /role="option"/);
});

test('menu supports arrow-key navigation and announces the selection', () => {
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab']) {
    assert.ok(source.includes(`'${key}'`), `missing key handler for ${key}`);
  }
  assert.match(source, /scrollIntoView\(/);
  assert.match(source, /aria-label=\{`Country calling code: \+\$\{selected\.callingCode\}/);
});

test('menu items are programmatically focusable but excluded from Tab order', () => {
  assert.match(source, /role="menuitemradio"[\s\S]*?tabIndex=\{-1\}/);
});

test('Tab inside the menu moves focus forward to the national input', () => {
  assert.match(source, /case 'Tab':[\s\S]*?event\.preventDefault\(\)/);
  assert.match(source, /inputRef\.current\?\.focus\(\)/);
  assert.match(source, /<input\s+ref=\{inputRef\}/);
});

test('Shift+Tab inside the menu returns focus to the country trigger', () => {
  assert.match(source, /case 'Tab':[\s\S]*?event\.shiftKey[\s\S]*?triggerRef\.current\?\.focus\(\)/);
});

test('selecting a country returns focus to the trigger', () => {
  assert.match(source, /triggerRef\.current\?\.focus\(\)/);
  assert.match(source, /closeMenu\(\)/);
});

test('outside clicks and Escape close the menu', () => {
  assert.match(source, /mousedown/);
  assert.match(source, /keydown/);
  assert.match(source, /rootRef/);
});
