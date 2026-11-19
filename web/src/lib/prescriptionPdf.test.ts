import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPrescriptionFileName,
  prescriptionFileNameFromDisposition,
} from './prescriptionPdf.ts';

test('reads the backend-provided clinic filename', () => {
  assert.equal(
    prescriptionFileNameFromDisposition(
      'attachment; filename="FLORES_Beavz_RX-20261117-006B2828.pdf"'
    ),
    'FLORES_Beavz_RX-20261117-006B2828.pdf'
  );
});

test('reads an unquoted filename and returns null when the header is absent', () => {
  assert.equal(
    prescriptionFileNameFromDisposition(
      'attachment; filename=PENA-DELA-CRUZ_Juan-Carlos_RX-20261117-006B2828.pdf'
    ),
    'PENA-DELA-CRUZ_Juan-Carlos_RX-20261117-006B2828.pdf'
  );
  assert.equal(prescriptionFileNameFromDisposition(''), null);
});

test('accepts clinic, replacement, superseded, and fallback names', () => {
  assert.equal(isPrescriptionFileName('FLORES_Beavz_RX-20261117-006B2828.pdf'), true);
  assert.equal(
    isPrescriptionFileName('FLORES_Beavz_RX-20261117-006B2828_replaces-41A6B551.pdf'),
    true
  );
  assert.equal(
    isPrescriptionFileName('FLORES_Beavz_RX-20261117-41A6B551_SUPERSEDED.pdf'),
    true
  );
  assert.equal(isPrescriptionFileName('RX-20261117-006B2828.pdf'), true);
});

test('rejects name-free RX names and internal storage object names', () => {
  assert.equal(isPrescriptionFileName('RX-abc123.pdf'), false);
  assert.equal(isPrescriptionFileName('RX-20261117-006B2828_replaces-41A6B551.pdf'), false);
  assert.equal(isPrescriptionFileName('FLORES_Beavz.pdf'), false);
  assert.equal(
    isPrescriptionFileName(
      'prescription_006b2828-de19-4b37-b611-58b47d53d3a3_v5_12345678-1234-1234-1234-123456789abc.pdf'
    ),
    false
  );
});
