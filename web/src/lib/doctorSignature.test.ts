import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SIGNATURE_MAX_BYTES,
  shouldRefreshSignaturePreview,
  validateSignatureFile,
} from './doctorSignature.ts';

function pngFile(size: number) {
  return { type: 'image/png', size };
}

test('accepts a PNG within the size limit', () => {
  assert.deepEqual(validateSignatureFile(pngFile(2048)), { valid: true });
});

test('accepts a PNG exactly at the 4MB boundary', () => {
  assert.deepEqual(validateSignatureFile(pngFile(SIGNATURE_MAX_BYTES)), { valid: true });
});

test('rejects non-PNG files', () => {
  const result = validateSignatureFile({ type: 'image/jpeg', size: 1024 });

  assert.equal(result.valid, false);
  assert.match(result.error ?? '', /PNG/);
});

test('rejects files larger than 4MB', () => {
  const result = validateSignatureFile(pngFile(SIGNATURE_MAX_BYTES + 1));

  assert.equal(result.valid, false);
  assert.match(result.error ?? '', /4MB/);
});

test('rejects an empty file', () => {
  const result = validateSignatureFile(pngFile(0));

  assert.equal(result.valid, false);
  assert.match(result.error ?? '', /empty/i);
});

test('refreshes an expired preview at most once while a signature exists', () => {
  assert.equal(shouldRefreshSignaturePreview(true, false), true);
  assert.equal(shouldRefreshSignaturePreview(true, true), false);
  assert.equal(shouldRefreshSignaturePreview(false, false), false);
  assert.equal(shouldRefreshSignaturePreview(false, true), false);
});
