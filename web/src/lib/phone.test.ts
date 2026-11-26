import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

import {
  formatPhoneFieldInput,
  formatPhoneInput,
  hasMalformedPlus,
  isCorruptedValue,
  parsePhone,
  phoneFieldValueFromStored,
  phoneFormatErrorMessage,
  storedPhoneWarningFor,
  toPatientMobileE164,
  toStaffContactDomestic,
  toStaffContactE164,
  resolveStoredPhone,
  splitInternationalInput,
  toPhoneFieldE164,
  STORED_PHONE_WARNING,
} from './phone.ts';

// ---------------------------------------------------------------------------
// Parser: 09 mobile
// ---------------------------------------------------------------------------

test('parsePhone accepts 09 domestic mobile numbers', () => {
  assert.deepEqual(parsePhone('09171234567'), {
    ok: true,
    kind: 'mobile',
    e164: '+639171234567',
    national: '09171234567',
  });
});

test('parsePhone accepts 09 national and +63 international mobile forms', () => {
  const national = parsePhone('9171234567');
  assert.equal(national.ok, true);
  if (national.ok) {
    assert.equal(national.kind, 'mobile');
    assert.equal(national.e164, '+639171234567');
    assert.equal(national.national, '09171234567');
  }

  const international = parsePhone('+639171234567');
  assert.equal(international.ok, true);
  if (international.ok) {
    assert.equal(international.e164, '+639171234567');
    assert.equal(international.national, '09171234567');
  }
});

test('parsePhone accepts international digits without a leading plus', () => {
  const result = parsePhone('639171234567');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.kind, 'mobile');
    assert.equal(result.e164, '+639171234567');
    assert.equal(result.national, '09171234567');
  }
});

test('parsePhone accepts structurally valid numbers whose digits repeat', () => {
  assert.deepEqual(parsePhone('9999999999'), {
    ok: true,
    kind: 'mobile',
    e164: '+639999999999',
    national: '09999999999',
  });
  assert.deepEqual(parsePhone('09111111111'), {
    ok: true,
    kind: 'mobile',
    e164: '+639111111111',
    national: '09111111111',
  });
  assert.deepEqual(parsePhone('09888888888'), {
    ok: true,
    kind: 'mobile',
    e164: '+639888888888',
    national: '09888888888',
  });
  assert.deepEqual(parsePhone('0211111111'), {
    ok: true,
    kind: 'landline',
    e164: '+63211111111',
    national: '0211111111',
  });
});

// ---------------------------------------------------------------------------
// Parser: allocated 08 mobile prefixes
// ---------------------------------------------------------------------------

test('parsePhone accepts exactly the six allocated 08 mobile prefixes', () => {
  const cases: Array<[string, string]> = [
    ['08131234567', '+638131234567'],
    ['08171234567', '+638171234567'],
    ['08951234567', '+638951234567'],
    ['08961234567', '+638961234567'],
    ['08971234567', '+638971234567'],
    ['08981234567', '+638981234567'],
  ];

  for (const [domestic, e164] of cases) {
    const result = parsePhone(domestic);
    assert.equal(result.ok, true, `${domestic} should parse`);
    if (!result.ok) continue;
    assert.equal(result.kind, 'mobile');
    assert.equal(result.e164, e164);
    assert.equal(result.national, domestic);
  }
});

test('parsePhone rejects unallocated 08 mobile prefixes', () => {
  for (const value of [
    '08111234567',
    '08121234567',
    '08141234567',
    '08151234567',
    '08161234567',
    '08181234567',
    '08191234567',
    '08901234567',
    '08911234567',
    '08921234567',
    '08931234567',
    '08941234567',
    '08991234567',
  ]) {
    assert.deepEqual(parsePhone(value), { ok: false, error: 'invalid_prefix' }, value);
  }
});

test('parsePhone keeps 08 national, domestic and +63 forms consistent', () => {
  // 0817 -> national 817XXXXXXX, domestic 0817XXXXXXX, international +63817XXXXXXX
  const national = parsePhone('8171234567');
  const domestic = parsePhone('08171234567');
  const international = parsePhone('+638171234567');

  for (const result of [national, domestic, international]) {
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.kind, 'mobile');
    assert.equal(result.e164, '+638171234567');
    assert.equal(result.national, '08171234567');
  }
});

test('parsePhone accepts allocated 08 international digits without a leading plus', () => {
  const cases: Array<[string, string]> = [
    ['638131234567', '+638131234567'],
    ['638171234567', '+638171234567'],
    ['638951234567', '+638951234567'],
    ['638961234567', '+638961234567'],
    ['638971234567', '+638971234567'],
    ['638981234567', '+638981234567'],
  ];

  for (const [digitsOnly, e164] of cases) {
    const result = parsePhone(digitsOnly);
    assert.equal(result.ok, true, `${digitsOnly} should parse`);
    if (!result.ok) continue;
    assert.equal(result.kind, 'mobile');
    assert.equal(result.e164, e164);
    assert.equal(result.national, `0${digitsOnly.slice(2)}`);
  }
});

test('parsePhone rejects an unallocated 08 prefix in +63 form too', () => {
  assert.deepEqual(parsePhone('+638121234567'), { ok: false, error: 'invalid_prefix' });
});

// ---------------------------------------------------------------------------
// Parser: landlines
// ---------------------------------------------------------------------------

test('parsePhone accepts 02 Manila landlines', () => {
  assert.deepEqual(parsePhone('0281234567'), {
    ok: true,
    kind: 'landline',
    e164: '+63281234567',
    national: '0281234567',
  });
});

test('parsePhone accepts the nine-digit national landline form', () => {
  assert.deepEqual(parsePhone('821234567'), {
    ok: true,
    kind: 'landline',
    e164: '+63821234567',
    national: '0821234567',
  });
});

test('parsePhone accepts landline area codes across the full 2 through 8 range', () => {
  for (const areaCode of ['2', '3', '4', '5', '6', '7', '8']) {
    const domestic = `0${areaCode}812345678`.slice(0, 10);
    const result = parsePhone(domestic);
    assert.equal(result.ok, true, `${domestic} should parse`);
    if (!result.ok) continue;
    assert.equal(result.kind, 'landline');
    assert.equal(result.national, domestic);
    assert.equal(result.e164, `+63${domestic.slice(1)}`);
  }
});

test('parsePhone accepts +63 international landlines', () => {
  const result = parsePhone('+63281234567');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.kind, 'landline');
    assert.equal(result.national, '0281234567');
  }
});

test('parsePhone rejects landline area codes outside 2 through 8', () => {
  assert.deepEqual(parsePhone('0181234567'), { ok: false, error: 'invalid_prefix' });
  assert.deepEqual(parsePhone('0191234567'), { ok: false, error: 'invalid_prefix' });
});

test('parsePhone keeps nine-digit landlines distinct from ten-digit mobiles', () => {
  // 821234567 is a nine-digit landline; 8212345678 is neither a landline nor an
  // allocated 08 mobile.
  const landline = parsePhone('821234567');
  assert.equal(landline.ok, true);
  if (landline.ok) assert.equal(landline.kind, 'landline');

  assert.deepEqual(parsePhone('8212345678'), { ok: false, error: 'invalid_prefix' });
});

// ---------------------------------------------------------------------------
// Parser: formatting separators, including periods
// ---------------------------------------------------------------------------

test('parsePhone accepts periods as formatting separators', () => {
  const result = parsePhone('0917.123.4567');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.e164, '+639171234567');
    assert.equal(result.national, '09171234567');
  }
});

test('parsePhone accepts spaces, hyphens, parentheses and periods together', () => {
  for (const value of ['0917 123 4567', '0917-123-4567', '(0917) 123-4567', '0917.123.4567']) {
    const result = parsePhone(value);
    assert.equal(result.ok, true, `${value} should parse`);
    if (result.ok) assert.equal(result.e164, '+639171234567');
  }
});

test('parsePhone never repairs scientific notation into a valid number', () => {
  // Stripping the period would yield 917123E+10 style digits; it must reject.
  assert.deepEqual(parsePhone('9.17123E+10'), { ok: false, error: 'corrupted' });
  assert.deepEqual(parsePhone('9.17123457e10'), { ok: false, error: 'corrupted' });
  assert.deepEqual(parsePhone('917.1234567E10'), { ok: false, error: 'corrupted' });
});

// ---------------------------------------------------------------------------
// Parser: malformed plus
// ---------------------------------------------------------------------------

test('parsePhone rejects a doubled plus sign', () => {
  assert.deepEqual(parsePhone('++639171234567'), { ok: false, error: 'malformed_plus' });
});

test('parsePhone rejects a plus sign that is not leading', () => {
  assert.deepEqual(parsePhone('63+9171234567'), { ok: false, error: 'malformed_plus' });
  assert.deepEqual(parsePhone('0917+1234567'), { ok: false, error: 'malformed_plus' });
});

test('parsePhone rejects a national number wearing a leading plus', () => {
  assert.deepEqual(parsePhone('+09171234567'), { ok: false, error: 'malformed_plus' });
  assert.deepEqual(parsePhone('+0281234567'), { ok: false, error: 'malformed_plus' });
});

test('hasMalformedPlus only flags genuinely malformed plus signs', () => {
  assert.equal(hasMalformedPlus('09171234567'), false);
  assert.equal(hasMalformedPlus('+639171234567'), false);
  assert.equal(hasMalformedPlus('++639171234567'), true);
  assert.equal(hasMalformedPlus('63+9171234567'), true);
});

// ---------------------------------------------------------------------------
// Parser: corrupted values
// ---------------------------------------------------------------------------

test('parsePhone rejects the 00 international dialling prefix', () => {
  assert.deepEqual(parsePhone('00639171234567'), { ok: false, error: 'corrupted' });
});

test('parsePhone rejects duplicated country-code and trunk prefixes', () => {
  for (const value of [
    '+6309171234567',
    '6309171234567',
    '+63639171234567',
    '63639171234567',
  ]) {
    assert.deepEqual(parsePhone(value), { ok: false, error: 'corrupted' }, value);
  }
});

test('isCorruptedValue leaves legitimate formatted numbers alone', () => {
  assert.equal(isCorruptedValue('09171234567'), false);
  assert.equal(isCorruptedValue('+639171234567'), false);
  assert.equal(isCorruptedValue('639171234567'), false);
  assert.equal(isCorruptedValue('0281234567'), false);
  assert.equal(isCorruptedValue('0917.123.4567'), false);
  assert.equal(isCorruptedValue('09111111111'), false);
  assert.equal(isCorruptedValue('9999999999'), false);
  assert.equal(isCorruptedValue(''), false);
});

test('isCorruptedValue flags duplicated prefixes, scientific notation and 00 dialling', () => {
  assert.equal(isCorruptedValue('+6309171234567'), true);
  assert.equal(isCorruptedValue('6309171234567'), true);
  assert.equal(isCorruptedValue('+63639171234567'), true);
  assert.equal(isCorruptedValue('63639171234567'), true);
  assert.equal(isCorruptedValue('9.17123E+10'), true);
  assert.equal(isCorruptedValue('00639171234567'), true);
});

// ---------------------------------------------------------------------------
// Parser: length and character failures
// ---------------------------------------------------------------------------

test('parsePhone rejects overlong input instead of truncating it', () => {
  assert.deepEqual(parsePhone('091712345678'), { ok: false, error: 'too_long' });
  assert.deepEqual(parsePhone('+6391712345678'), { ok: false, error: 'too_long' });
});

test('parsePhone rejects numbers of an impossible length', () => {
  assert.deepEqual(parsePhone('091712345'), { ok: false, error: 'invalid_length' });
  assert.deepEqual(parsePhone('028123456'), { ok: false, error: 'invalid_length' });
});

test('parsePhone rejects a truncated mobile as an invalid prefix', () => {
  // Nine digits is a landline length, and 9 is not a landline area code.
  assert.deepEqual(parsePhone('0917123456'), { ok: false, error: 'invalid_prefix' });
});

test('parsePhone rejects non-numeric characters', () => {
  assert.deepEqual(parsePhone('0917abc4567'), { ok: false, error: 'invalid_characters' });
  assert.deepEqual(parsePhone('+63 917 123 456x'), { ok: false, error: 'invalid_characters' });
});

test('parsePhone rejects empty input', () => {
  assert.deepEqual(parsePhone(''), { ok: false, error: 'empty' });
  assert.deepEqual(parsePhone('   '), { ok: false, error: 'empty' });
});

test('parsePhone rejects numbers that do not start with 0, a valid prefix, or +63', () => {
  assert.deepEqual(parsePhone('4171234567'), { ok: false, error: 'invalid_prefix' });
  assert.deepEqual(parsePhone('+659171234567'), { ok: false, error: 'invalid_prefix' });
});

// ---------------------------------------------------------------------------
// Formatter: permissible partial input
// ---------------------------------------------------------------------------

test('formatPhoneInput accepts partial 09 mobile input while typing', () => {
  for (const value of ['0', '09', '091', '0917', '0917123', '09171234567']) {
    assert.deepEqual(formatPhoneInput(value, ''), { value, error: null });
  }
});

test('formatPhoneInput accepts partial allocated 08 input while typing', () => {
  for (const value of ['08', '081', '0813', '0817', '0895', '0898', '08981234567']) {
    assert.deepEqual(formatPhoneInput(value, ''), { value, error: null });
  }
});

test('formatPhoneInput allows an unallocated 08 prefix while it could still be a landline', () => {
  // `0812` is not an allocated mobile block, but it is still a valid landline
  // prefix in progress, so typing it must not be blocked.
  assert.deepEqual(formatPhoneInput('0812', '081'), { value: '0812', error: null });
});

test('formatPhoneInput rejects an unallocated 08 prefix once it is a full mobile length', () => {
  assert.deepEqual(formatPhoneInput('08121234567', '0812123456'), {
    value: '0812123456',
    error: 'invalid_prefix',
  });
});

test('formatPhoneInput accepts partial landline input while typing', () => {
  for (const value of ['02', '028', '0281234567', '82', '821', '821234567']) {
    assert.deepEqual(formatPhoneInput(value, ''), { value, error: null });
  }
});

test('formatPhoneInput accepts partial international input while typing', () => {
  for (const value of ['+', '+6', '+63', '+639', '+639171234567']) {
    assert.deepEqual(formatPhoneInput(value, ''), { value, error: null });
  }
});

test('formatPhoneInput strips separators, including periods, as the user types', () => {
  assert.deepEqual(formatPhoneInput('0917-123', ''), { value: '0917123', error: null });
  assert.deepEqual(formatPhoneInput('0917.123.4567', ''), {
    value: '09171234567',
    error: null,
  });
  assert.deepEqual(formatPhoneInput('(0917) 123 4567', ''), {
    value: '09171234567',
    error: null,
  });
});

test('formatPhoneInput clears the field when the user empties it', () => {
  assert.deepEqual(formatPhoneInput('', '0917'), { value: '', error: null });
});

// ---------------------------------------------------------------------------
// Formatter: rejection preserves the previous value
// ---------------------------------------------------------------------------

test('formatPhoneInput rejects overlong input and keeps the previous value', () => {
  assert.deepEqual(formatPhoneInput('091712345678', '09171234567'), {
    value: '09171234567',
    error: 'too_long',
  });
  assert.deepEqual(formatPhoneInput('+6391712345678', '+639171234567'), {
    value: '+639171234567',
    error: 'too_long',
  });
});

test('formatPhoneInput rejects corrupted input and keeps the previous value', () => {
  assert.deepEqual(formatPhoneInput('9.17123E+10', '0917'), {
    value: '0917',
    error: 'corrupted',
  });
  assert.deepEqual(formatPhoneInput('00639171234567', '0917'), {
    value: '0917',
    error: 'corrupted',
  });
});

test('formatPhoneInput rejects malformed plus signs and keeps the previous value', () => {
  assert.deepEqual(formatPhoneInput('++63', '09'), { value: '09', error: 'malformed_plus' });
  assert.deepEqual(formatPhoneInput('63+9', '09'), { value: '09', error: 'malformed_plus' });
  assert.deepEqual(formatPhoneInput('+0917', '09'), { value: '09', error: 'malformed_plus' });
});

test('formatPhoneInput rejects impossible prefixes and keeps the previous value', () => {
  assert.deepEqual(formatPhoneInput('01', ''), { value: '', error: 'invalid_prefix' });
  // `417` could still become a landline (area code 4), so it is allowed while
  // typing; twelve digits is past every valid length and is rejected.
  assert.deepEqual(formatPhoneInput('417123456789', '4171234567'), {
    value: '4171234567',
    error: 'too_long',
  });
  assert.deepEqual(formatPhoneInput('+65', ''), { value: '', error: 'invalid_prefix' });
});

test('formatPhoneInput rejects non-numeric characters and keeps the previous value', () => {
  assert.deepEqual(formatPhoneInput('0917a', '0917'), {
    value: '0917',
    error: 'invalid_characters',
  });
});

test('formatPhoneInput never truncates an overlong value into a valid one', () => {
  // 12 digits would become a valid 11-digit number if truncated; it must not.
  const result = formatPhoneInput('091712345670', '');
  assert.equal(result.error, 'too_long');
  assert.equal(result.value, '');
});

test('formatPhoneInput checks corruption before filtering incomplete digits', () => {
  const result = formatPhoneInput('9.17123E+10', '0917');
  assert.equal(result.error, 'corrupted');
});

test('formatPhoneInput checks malformed plus before filtering incomplete digits', () => {
  // `+63+` would otherwise strip to `+63` and look valid.
  const result = formatPhoneInput('+63+', '+63');
  assert.equal(result.error, 'malformed_plus');
  assert.equal(result.value, '+63');
});

// ---------------------------------------------------------------------------
// Fixed-prefix field adapter: patient mobile normalization
// ---------------------------------------------------------------------------

test('formatPhoneFieldInput normalizes complete patient mobile forms to ten digits', () => {
  for (const raw of [
    '09171234567',
    '9171234567',
    '+639171234567',
    '639171234567',
    '+63 917 123 4567',
    '0917-123-4567',
    '(0917) 123 4567',
  ]) {
    assert.deepEqual(
      formatPhoneFieldInput(raw, '', { allowLandline: false }),
      { value: '9171234567', error: null },
      raw,
    );
  }
});

test('formatPhoneFieldInput normalizes every allocated 08 patient mobile form', () => {
  const cases: Array<[string, string]> = [
    ['08131234567', '8131234567'],
    ['8171234567', '8171234567'],
    ['+638171234567', '8171234567'],
    ['638951234567', '8951234567'],
    ['08961234567', '8961234567'],
    ['08971234567', '8971234567'],
    ['08981234567', '8981234567'],
  ];
  for (const [raw, expected] of cases) {
    assert.deepEqual(
      formatPhoneFieldInput(raw, '', { allowLandline: false }),
      { value: expected, error: null },
      raw,
    );
  }
});

test('formatPhoneFieldInput accepts exactly the six allocated 08 patient prefixes', () => {
  for (const prefix of ['813', '817', '895', '896', '897', '898']) {
    const domestic = `0${prefix}1234567`;
    const national = `${prefix}1234567`;
    assert.deepEqual(
      formatPhoneFieldInput(domestic, '', { allowLandline: false }),
      { value: national, error: null },
      domestic,
    );
  }
});

test('formatPhoneFieldInput rejects an unallocated 08 patient mobile and keeps the previous value', () => {
  assert.deepEqual(
    formatPhoneFieldInput('08121234567', '0812123456', { allowLandline: false }),
    { value: '0812123456', error: 'invalid_prefix' },
  );
  assert.deepEqual(
    formatPhoneFieldInput('8121234567', '812123456', { allowLandline: false }),
    { value: '812123456', error: 'invalid_prefix' },
  );
});

test('formatPhoneFieldInput rejects patient landlines and keeps the previous value', () => {
  assert.deepEqual(
    formatPhoneFieldInput('0281234567', '', { allowLandline: false }),
    { value: '', error: 'invalid_prefix' },
  );
  assert.deepEqual(
    formatPhoneFieldInput('821234567', '82123456', { allowLandline: false }),
    { value: '82123456', error: 'invalid_prefix' },
  );
});

// ---------------------------------------------------------------------------
// Fixed-prefix field adapter: 08 mobile/landline typing overlap
// ---------------------------------------------------------------------------

test('formatPhoneFieldInput keeps building while a landline can still become an 08 mobile', () => {
  // `817123456` parses as a landline but becomes the mobile `8171234567`.
  assert.deepEqual(
    formatPhoneFieldInput('817123456', '81712345', { allowLandline: false }),
    { value: '817123456', error: null },
  );
  // `0817123456` parses as a domestic landline but becomes the mobile `08171234567`.
  assert.deepEqual(
    formatPhoneFieldInput('0817123456', '081712345', { allowLandline: false }),
    { value: '0817123456', error: null },
  );
});

test('formatPhoneFieldInput completes the 08 overlap to the ten-digit national mobile', () => {
  assert.deepEqual(
    formatPhoneFieldInput('8171234567', '817123456', { allowLandline: false }),
    { value: '8171234567', error: null },
  );
  assert.deepEqual(
    formatPhoneFieldInput('08171234567', '0817123456', { allowLandline: false }),
    { value: '8171234567', error: null },
  );
});

test('formatPhoneFieldInput never rejects an allocated 08 number one digit early', () => {
  // Type `8171234567` one character at a time; no keystroke may be rejected.
  let value = '';
  for (const digit of '8171234567') {
    const result = formatPhoneFieldInput(`${value}${digit}`, value, { allowLandline: false });
    assert.equal(result.error, null, `${value}${digit} should be accepted`);
    value = result.value;
  }
  assert.equal(value, '8171234567');
});

// ---------------------------------------------------------------------------
// Fixed-prefix field adapter: staff mobile and landline
// ---------------------------------------------------------------------------

test('formatPhoneFieldInput accepts staff mobiles and landlines', () => {
  for (const raw of ['09171234567', '08171234567']) {
    assert.deepEqual(
      formatPhoneFieldInput(raw, '', { allowLandline: true }),
      { value: raw.slice(1), error: null },
      raw,
    );
  }
  assert.deepEqual(formatPhoneFieldInput('0281234567', '', { allowLandline: true }), {
    value: '281234567',
    error: null,
  });
  assert.deepEqual(formatPhoneFieldInput('+639171234567', '', { allowLandline: true }), {
    value: '9171234567',
    error: null,
  });
});

test('formatPhoneFieldInput accepts staff landlines in area-code families beginning with 8', () => {
  // `08` is not automatically a mobile block: a ten-digit `08...` can be a
  // landline, and staff fields must accept it.
  assert.deepEqual(formatPhoneFieldInput('0812345678', '', { allowLandline: true }), {
    value: '812345678',
    error: null,
  });
  assert.deepEqual(formatPhoneFieldInput('0821234567', '', { allowLandline: true }), {
    value: '821234567',
    error: null,
  });
});

// ---------------------------------------------------------------------------
// Fixed-prefix field adapter: rejection preserves the previous value
// ---------------------------------------------------------------------------

test('formatPhoneFieldInput rejects malformed plus signs and keeps the previous value', () => {
  assert.deepEqual(formatPhoneFieldInput('++639171234567', '0917', { allowLandline: false }), {
    value: '0917',
    error: 'malformed_plus',
  });
  assert.deepEqual(formatPhoneFieldInput('+09171234567', '0917', { allowLandline: true }), {
    value: '0917',
    error: 'malformed_plus',
  });
});

test('formatPhoneFieldInput rejects corrupted legacy values and keeps the previous value', () => {
  for (const raw of ['+6309171234567', '6309171234567', '00639171234567', '9.17123E+10']) {
    assert.deepEqual(
      formatPhoneFieldInput(raw, '9171234567', { allowLandline: false }),
      { value: '9171234567', error: 'corrupted' },
      raw,
    );
  }
});

test('formatPhoneFieldInput rejects overlong values without truncating them', () => {
  assert.deepEqual(
    formatPhoneFieldInput('091712345678', '09171234567', { allowLandline: true }),
    { value: '09171234567', error: 'too_long' },
  );
  assert.deepEqual(
    formatPhoneFieldInput('+6391712345678', '+639171234567', { allowLandline: false }),
    { value: '+639171234567', error: 'too_long' },
  );
});

test('formatPhoneFieldInput clears the field when the user empties it', () => {
  assert.deepEqual(formatPhoneFieldInput('', '9171234567', { allowLandline: false }), {
    value: '',
    error: null,
  });
});

// ---------------------------------------------------------------------------
// Fixed-prefix field adapter: serializers
// ---------------------------------------------------------------------------

test('toPatientMobileE164 returns canonical +63 values', () => {
  for (const raw of ['9171234567', '09171234567', '+639171234567', '917 123 4567']) {
    assert.equal(toPatientMobileE164(raw), '+639171234567', raw);
  }
  assert.equal(toPatientMobileE164('8171234567'), '+638171234567');
  assert.equal(toPatientMobileE164('08131234567'), '+638131234567');
});

test('toPatientMobileE164 refuses landlines, unallocated 08 numbers and incomplete input', () => {
  assert.equal(toPatientMobileE164('281234567'), null);
  assert.equal(toPatientMobileE164('0281234567'), null);
  assert.equal(toPatientMobileE164('821234567'), null);
  assert.equal(toPatientMobileE164('8121234567'), null);
  assert.equal(toPatientMobileE164('91712345'), null);
  assert.equal(toPatientMobileE164(''), null);
});

test('toStaffContactDomestic returns domestic 0-prefixed values', () => {
  assert.equal(toStaffContactDomestic('9171234567'), '09171234567');
  assert.equal(toStaffContactDomestic('08171234567'), '08171234567');
  assert.equal(toStaffContactDomestic('281234567'), '0281234567');
  assert.equal(toStaffContactDomestic('821234567'), '0821234567');
  assert.equal(toStaffContactDomestic('0281234567'), '0281234567');
  assert.equal(toStaffContactDomestic(''), null);
  assert.equal(toStaffContactDomestic('8121234567'), null);
});

// ---------------------------------------------------------------------------
// Fixed-prefix field adapter: stored values
// ---------------------------------------------------------------------------

test('phoneFieldValueFromStored normalizes recognized values and preserves the rest', () => {
  assert.equal(phoneFieldValueFromStored('+639171234567', { allowLandline: false }), '9171234567');
  assert.equal(phoneFieldValueFromStored('09171234567', { allowLandline: false }), '9171234567');
  assert.equal(phoneFieldValueFromStored('9171234567', { allowLandline: false }), '9171234567');
  assert.equal(phoneFieldValueFromStored('', { allowLandline: false }), '');
  assert.equal(phoneFieldValueFromStored(null, { allowLandline: false }), '');
  // Patient fields preserve a stored landline and a corrupted value verbatim.
  assert.equal(phoneFieldValueFromStored('0212345678', { allowLandline: false }), '0212345678');
  assert.equal(
    phoneFieldValueFromStored('+6309171234567', { allowLandline: false }),
    '+6309171234567',
  );
  // Staff fields normalize a stored landline into its national portion.
  assert.equal(phoneFieldValueFromStored('0212345678', { allowLandline: true }), '212345678');
});

test('storedPhoneWarningFor warns only for values the field cannot use', () => {
  assert.equal(storedPhoneWarningFor('+639171234567', { allowLandline: false }), null);
  assert.equal(storedPhoneWarningFor('09171234567', { allowLandline: true }), null);
  assert.equal(storedPhoneWarningFor('', { allowLandline: false }), null);
  assert.equal(storedPhoneWarningFor(null, { allowLandline: false }), null);
  assert.notEqual(storedPhoneWarningFor('+6309171234567', { allowLandline: false }), null);
  assert.notEqual(storedPhoneWarningFor('abc', { allowLandline: true }), null);
  // A landline is unusable in a patient field but fine in a staff field.
  assert.notEqual(storedPhoneWarningFor('0212345678', { allowLandline: false }), null);
  assert.equal(storedPhoneWarningFor('0212345678', { allowLandline: true }), null);
});

// ---------------------------------------------------------------------------
// Fixed-prefix field adapter: messages and GCash behavior
// ---------------------------------------------------------------------------

test('phoneFormatErrorMessage returns a message for every rejection reason', () => {
  for (const error of [
    'corrupted',
    'malformed_plus',
    'invalid_characters',
    'too_long',
    'invalid_prefix',
  ] as const) {
    assert.ok(phoneFormatErrorMessage(error).length > 0, error);
  }
});

test('GCash account numbers keep their independent +63 / 09 behavior', () => {
  // The GCash serializer is unchanged: both accepted wire forms still parse,
  // and no GCash-specific helper is introduced by this module.
  assert.equal(parsePhone('+639171234567').ok, true);
  assert.equal(parsePhone('09171234567').ok, true);
  assert.equal(parsePhone('+6391712345').ok, false);
  assert.equal(parsePhone('917123456').ok, false);
});

// ---------------------------------------------------------------------------
// Secretary complete-profile contact gate
// ---------------------------------------------------------------------------

test('secretary complete-profile gate treats only a parseable staff contact as complete', () => {
  // Mirrors the completion check: the contact counts as complete only when the
  // staff serializer accepts it. Mobile and landline forms both pass.
  const isContactComplete = (raw: string | null | undefined) =>
    toStaffContactDomestic(raw) !== null;

  assert.equal(isContactComplete('9171234567'), true);
  assert.equal(isContactComplete('09171234567'), true);
  assert.equal(isContactComplete('+639171234567'), true);
  assert.equal(isContactComplete('281234567'), true);
  assert.equal(isContactComplete('0281234567'), true);

  // Malformed or invalid saved values stay incomplete so the completion form
  // renders and the warning/correction flow can run.
  assert.equal(isContactComplete('8121234567'), false);
  assert.equal(isContactComplete('+6309171234567'), false);
  assert.equal(isContactComplete('not-a-number'), false);
  assert.equal(isContactComplete(''), false);
  assert.equal(isContactComplete(null), false);
  assert.equal(isContactComplete(undefined), false);
});

// ---------------------------------------------------------------------------
// International parsing and stored-number resolution
// ---------------------------------------------------------------------------

test('parsePhone treats 63-prefixed input as Philippine only when PH is selected', () => {
  const ph = parsePhone('6315551234', 'PH');
  // 6315551234 is not a valid Philippine number, so it must not be accepted.
  assert.equal(ph.ok, false);

  const us = parsePhone('6315551234', 'US');
  assert.equal(us.ok, true);
  if (us.ok) {
    assert.equal(us.kind, 'landline');
    assert.equal(us.e164, '+16315551234');
  }
});

test('parsePhone derives the country from explicit international numbers', () => {
  const fr = parsePhone('+33612345678');
  assert.equal(fr.ok, true);
  if (fr.ok) {
    assert.equal(fr.kind, 'mobile');
    assert.equal(fr.e164, '+33612345678');
  }

  const de = parsePhone('+4915123456789', 'US');
  assert.equal(de.ok, true);
  if (de.ok) {
    assert.equal(de.e164, '+4915123456789');
  }
});

test('parsePhone distinguishes countries sharing a calling code by ISO identity', () => {
  const us = parsePhone('+12125551234');
  const ca = parsePhone('+14165551234');
  assert.equal(us.ok, true);
  assert.equal(ca.ok, true);
  if (us.ok && ca.ok) {
    assert.equal(us.e164, '+12125551234');
    assert.equal(ca.e164, '+14165551234');
  }
});

test('toStaffContactE164 uses the selected country', () => {
  assert.equal(toStaffContactE164('6315551234', 'US'), '+16315551234');
  assert.equal(toStaffContactE164('9171234567', 'PH'), '+639171234567');
  assert.equal(toStaffContactE164('917abc', 'US'), null);
});

test('toPatientMobileE164 remains mobile-only', () => {
  assert.equal(toPatientMobileE164('+33612345678'), '+33612345678');
  assert.equal(toPatientMobileE164('+442079460958'), null);
  assert.equal(toPatientMobileE164('+16315551234'), null);
});

test('parsePhone rejects VoIP, toll-free, and unsupported types', () => {
  // +1800 numbers are toll-free; ensure not accepted as landlines.
  const tollFree = parsePhone('+18005551234');
  assert.equal(tollFree.ok, false);
});

test('resolveStoredPhone restores empty, domestic, E.164, foreign, and invalid values', () => {
  assert.deepEqual(resolveStoredPhone(''), {
    country: 'PH',
    nationalNumber: '',
    warning: null,
  });

  const domestic = resolveStoredPhone('09171234567');
  assert.equal(domestic.country, 'PH');
  assert.equal(domestic.warning, null);

  const phE164 = resolveStoredPhone('+639171234567');
  assert.equal(phE164.country, 'PH');
  assert.equal(phE164.nationalNumber, '9171234567');
  assert.equal(phE164.warning, null);

  const foreign = resolveStoredPhone('+33612345678');
  assert.equal(foreign.country, 'FR');
  assert.equal(foreign.warning, null);

  const invalid = resolveStoredPhone('not-a-number');
  assert.equal(invalid.nationalNumber, 'not-a-number');
  assert.equal(invalid.warning, STORED_PHONE_WARNING);
});

test('parsePhone handles invalid ISO country input safely', () => {
  const result = parsePhone('123', 'ZZ');
  assert.equal(result.ok, false);
});

test('parsePhone preserves FIXED_LINE_OR_MOBILE conservatively for mobile-only use', () => {
  const result = parsePhone('+16315551234');
  assert.equal(result.ok, true);
  if (result.ok) {
    // Classified as landline, not mobile, so mobile-only fields reject it.
    assert.equal(result.kind, 'landline');
  }
});

// ---------------------------------------------------------------------------
// Unsupported types and shared calling-code restoration
// ---------------------------------------------------------------------------

test('unsupported VoIP, toll-free, and premium-rate numbers are rejected', () => {
  const voip = '+16003837322';
  const tollFree = '+18336271907';
  const premium = '+19009260747';

  // Verify the fixtures' actual types with the approved metadata library.
  assert.equal(parsePhoneNumberFromString(voip)?.getType(), 'VOIP');
  assert.equal(parsePhoneNumberFromString(tollFree)?.getType(), 'TOLL_FREE');
  assert.equal(parsePhoneNumberFromString(premium)?.getType(), 'PREMIUM_RATE');

  for (const value of [voip, tollFree, premium]) {
    assert.equal(parsePhone(value).ok, false, value);
    assert.equal(toStaffContactE164(value), null, value);
  }
});

test('resolveStoredPhone restores US and Canadian numbers sharing +1 correctly', () => {
  const us = '+12125551234';
  const ca = '+14165551234';

  const usResolved = resolveStoredPhone(us, true);
  const caResolved = resolveStoredPhone(ca, true);

  assert.equal(usResolved.country, 'US');
  assert.equal(caResolved.country, 'CA');
  assert.notEqual(usResolved.country, caResolved.country);

  assert.equal(usResolved.nationalNumber, parsePhoneNumberFromString(us)!.nationalNumber);
  assert.equal(caResolved.nationalNumber, parsePhoneNumberFromString(ca)!.nationalNumber);
  assert.equal(usResolved.warning, null);
  assert.equal(caResolved.warning, null);
});

// ---------------------------------------------------------------------------
// Migrated web fields
// ---------------------------------------------------------------------------

const staffContactField = { allowLandline: true } as const;
const patientMobileField = { allowLandline: false } as const;

test('secretary profile contact accepts mobile and landline and submits E.164', () => {
  assert.equal(
    toPhoneFieldE164('9171234567', 'PH', staffContactField),
    '+639171234567'
  );
  assert.equal(
    toPhoneFieldE164('0281234567', 'PH', staffContactField),
    '+63281234567'
  );
  assert.equal(
    toPhoneFieldE164('+639171234567', 'PH', staffContactField),
    '+639171234567'
  );
  // Empty is left to the form's required/optional decision.
  assert.equal(toPhoneFieldE164('', 'PH', staffContactField), null);
});

test('doctor add-patient phone stays required and mobile-only', () => {
  assert.equal(
    toPhoneFieldE164('09171234567', 'PH', patientMobileField),
    '+639171234567'
  );
  assert.equal(
    toPhoneFieldE164('+639171234567', 'PH', patientMobileField),
    '+639171234567'
  );
  // Landlines and unallocated mobile blocks remain rejected.
  assert.equal(toPhoneFieldE164('0281234567', 'PH', patientMobileField), null);
  assert.equal(
    toPhoneFieldE164('08121234567', 'PH', patientMobileField),
    null
  );
  assert.equal(toPhoneFieldE164('', 'PH', patientMobileField), null);
});

test('doctor emergency-contact phone stays optional but accepts mobile or landline', () => {
  assert.equal(toPhoneFieldE164('', 'PH', staffContactField), null);
  assert.equal(
    toPhoneFieldE164('9171234567', 'PH', staffContactField),
    '+639171234567'
  );
  assert.equal(
    toPhoneFieldE164('0281234567', 'PH', staffContactField),
    '+63281234567'
  );
  assert.equal(
    toPhoneFieldE164('not-a-number', 'PH', staffContactField),
    null
  );
});

test('secretary walk-in phone stays required and mobile-only', () => {
  assert.equal(
    toPhoneFieldE164('+639171234567', 'PH', patientMobileField),
    '+639171234567'
  );
  assert.equal(
    toPhoneFieldE164('09171234567', 'PH', patientMobileField),
    '+639171234567'
  );
  assert.equal(toPhoneFieldE164('0281234567', 'PH', patientMobileField), null);
  assert.equal(toPhoneFieldE164('', 'PH', patientMobileField), null);
});

test('secretary patient edit loads domestic and E.164 records and submits E.164', () => {
  const domestic = resolveStoredPhone('09171234567', false);
  assert.equal(domestic.country, 'PH');
  assert.equal(domestic.nationalNumber, '9171234567');
  assert.equal(domestic.warning, null);
  assert.equal(
    toPhoneFieldE164(domestic.nationalNumber, domestic.country, patientMobileField),
    '+639171234567'
  );

  const storedE164 = resolveStoredPhone('+639171234567', false);
  assert.equal(storedE164.country, 'PH');
  assert.equal(storedE164.nationalNumber, '9171234567');
  assert.equal(storedE164.warning, null);
  assert.equal(
    toPhoneFieldE164(storedE164.nationalNumber, storedE164.country, patientMobileField),
    '+639171234567'
  );
});

test('invalid legacy patient numbers are preserved with a warning', () => {
  for (const legacy of ['not-a-number', '+6309171234567', '0917abc4567']) {
    const resolved = resolveStoredPhone(legacy, false);
    assert.equal(resolved.country, 'PH');
    assert.equal(resolved.nationalNumber, legacy);
    assert.equal(resolved.warning, STORED_PHONE_WARNING);
    assert.equal(
      toPhoneFieldE164(resolved.nationalNumber, resolved.country, patientMobileField),
      null
    );
  }
});

test('country changes revalidate against the selected country', () => {
  // The same national digits resolve differently, and only the selected
  // country's rules decide whether the value is a mobile.
  assert.equal(
    toPhoneFieldE164('0612345678', 'FR', patientMobileField),
    '+33612345678'
  );
  assert.equal(
    toPhoneFieldE164('0612345678', 'PH', patientMobileField),
    null
  );
  assert.equal(
    toPhoneFieldE164('9171234567', 'US', patientMobileField),
    null
  );
  assert.equal(
    toPhoneFieldE164('9171234567', 'PH', patientMobileField),
    '+639171234567'
  );
});

test('pasted domestic and international numbers split without duplicating the country code', () => {
  assert.deepEqual(splitInternationalInput('+639171234567', 'PH'), {
    country: 'PH',
    nationalNumber: '9171234567',
  });
  assert.deepEqual(splitInternationalInput('+63 917 123 4567', 'PH'), {
    country: 'PH',
    nationalNumber: '9171234567',
  });
  // Digits-only international input is split only when it carries the selected
  // country's calling code.
  assert.deepEqual(splitInternationalInput('639171234567', 'PH'), {
    country: 'PH',
    nationalNumber: '9171234567',
  });
  assert.deepEqual(splitInternationalInput('16315551234', 'US'), {
    country: 'US',
    nationalNumber: '6315551234',
  });
  // A foreign mobile pasted over the PH default switches country and keeps
  // only the national portion.
  assert.deepEqual(splitInternationalInput('+447123456789', 'PH'), {
    country: 'GB',
    nationalNumber: '7123456789',
  });
  // Incomplete or invalid international input is left for the field's own
  // validation to reject rather than being split into a bogus country.
  assert.equal(splitInternationalInput('+15551234', 'PH'), null);
  assert.equal(splitInternationalInput('+999999999999', 'PH'), null);
  // A pasted domestic number is left untouched.
  assert.equal(splitInternationalInput('09171234567', 'PH'), null);
  assert.equal(splitInternationalInput('6315551234', 'US'), null);
  // Duplicated country codes and trunk prefixes are not silently repaired.
  assert.equal(splitInternationalInput('+6309171234567', 'PH'), null);
  assert.equal(splitInternationalInput('63639171234567', 'PH'), null);
});
