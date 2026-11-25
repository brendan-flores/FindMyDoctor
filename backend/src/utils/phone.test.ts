import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

import {
  normalizePhoneNumber,
  phoneErrorMessage,
  isPhilippineMobileNational,
} from './phone';

describe('normalizePhoneNumber', () => {
  describe('Philippine numbers', () => {
    it('accepts a Philippine E.164 mobile number', () => {
      expect(normalizePhoneNumber('+639171234567')).toEqual({
        ok: true,
        e164: '+639171234567',
      });
    });

    it('accepts an allocated 08 mobile block in E.164 form', () => {
      expect(normalizePhoneNumber('+638131234567')).toEqual({
        ok: true,
        e164: '+638131234567',
      });
    });

    it.each([
      ['08131234567', '+638131234567'],
      ['08171234567', '+638171234567'],
      ['08951234567', '+638951234567'],
      ['08961234567', '+638961234567'],
      ['08971234567', '+638971234567'],
      ['08981234567', '+638981234567'],
    ])('accepts the allocated 08 domestic prefix %s', (input, expected) => {
      expect(normalizePhoneNumber(input)).toEqual({ ok: true, e164: expected });
    });

    it.each([
      ['8131234567', '+638131234567'],
      ['8171234567', '+638171234567'],
      ['8951234567', '+638951234567'],
      ['8961234567', '+638961234567'],
      ['8971234567', '+638971234567'],
      ['8981234567', '+638981234567'],
    ])('accepts the allocated 08 national prefix %s', (input, expected) => {
      expect(normalizePhoneNumber(input)).toEqual({ ok: true, e164: expected });
    });

    it('normalizes a legacy domestic mobile number', () => {
      expect(normalizePhoneNumber('09171234567')).toEqual({
        ok: true,
        e164: '+639171234567',
      });
    });

    it('normalizes a national mobile number without the trunk zero', () => {
      expect(normalizePhoneNumber('9171234567')).toEqual({
        ok: true,
        e164: '+639171234567',
      });
    });

    it('normalizes a digits-only Philippine E.164 value', () => {
      expect(normalizePhoneNumber('639171234567')).toEqual({
        ok: true,
        e164: '+639171234567',
      });
    });

    it('normalizes formatted input', () => {
      expect(normalizePhoneNumber('+63 917 123 4567')).toEqual({
        ok: true,
        e164: '+639171234567',
      });
      expect(normalizePhoneNumber('0917-123-4567')).toEqual({
        ok: true,
        e164: '+639171234567',
      });
    });

    it('rejects a duplicated country code', () => {
      expect(normalizePhoneNumber('+63639171234567')).toEqual({
        ok: false,
        error: 'corrupted',
      });
    });

    it('rejects a country code followed by a trunk zero', () => {
      expect(normalizePhoneNumber('+6309171234567')).toEqual({
        ok: false,
        error: 'corrupted',
      });
    });

    it('rejects a duplicated country code without the plus sign', () => {
      expect(normalizePhoneNumber('63639171234567')).toEqual({
        ok: false,
        error: 'corrupted',
      });
    });

    it('rejects a duplicated trunk prefix without the plus sign', () => {
      expect(normalizePhoneNumber('6309171234567')).toEqual({
        ok: false,
        error: 'corrupted',
      });
    });

    it('rejects an unallocated 08 mobile prefix', () => {
      expect(normalizePhoneNumber('08121234567').ok).toBe(false);
      expect(normalizePhoneNumber('+638121234567').ok).toBe(false);
    });

    it('rejects a Philippine landline for a mobile-only field', () => {
      expect(normalizePhoneNumber('+63212345678')).toEqual({
        ok: false,
        error: 'invalid_mobile',
      });
    });

    it('accepts a Philippine landline when landlines are allowed', () => {
      expect(normalizePhoneNumber('+63212345678', { allowLandline: true })).toEqual({
        ok: true,
        e164: '+63212345678',
      });
      expect(normalizePhoneNumber('0212345678', { allowLandline: true })).toEqual({
        ok: true,
        e164: '+63212345678',
      });
      expect(normalizePhoneNumber('0281234567', { allowLandline: true })).toEqual({
        ok: true,
        e164: '+63281234567',
      });
    });
  });

  describe('foreign numbers', () => {
    it.each([
      ['+33612345678', '+33612345678'],
      ['+4915123456789', '+4915123456789'],
      ['+61412345678', '+61412345678'],
      ['+819012345678', '+819012345678'],
      ['+8613800138000', '+8613800138000'],
    ])('accepts mobile number %s for mobile-only fields', (input, expected) => {
      expect(normalizePhoneNumber(input)).toEqual({ ok: true, e164: expected });
    });

    it('accepts a digits-only foreign E.164 value without adding +63', () => {
      expect(normalizePhoneNumber('33612345678')).toEqual({
        ok: true,
        e164: '+33612345678',
      });
    });

    it.each([
      ['+442079460958', '+442079460958'],
      ['+4930123456', '+4930123456'],
      ['+390612345678', '+390612345678'],
    ])('accepts foreign fixed-line %s when landlines are allowed', (input, expected) => {
      expect(normalizePhoneNumber(input, { allowLandline: true })).toEqual({
        ok: true,
        e164: expected,
      });
    });

    it.each(['+442079460958', '+4930123456', '+390612345678'])(
      'rejects foreign fixed-line %s for mobile-only fields',
      (input) => {
        expect(normalizePhoneNumber(input)).toEqual({
          ok: false,
          error: 'invalid_mobile',
        });
      },
    );

    it('rejects ambiguous fixed-line-or-mobile numbers for mobile-only fields', () => {
      expect(parsePhoneNumberFromString('+14155550123')?.getType()).toBe('FIXED_LINE_OR_MOBILE');
      expect(normalizePhoneNumber('+14155550123')).toEqual({
        ok: false,
        error: 'invalid_mobile',
      });
    });

    it('accepts ambiguous fixed-line-or-mobile numbers when landlines are allowed', () => {
      expect(normalizePhoneNumber('+14155550123', { allowLandline: true })).toEqual({
        ok: true,
        e164: '+14155550123',
      });
    });

    it('rejects incomplete foreign numbers', () => {
      expect(normalizePhoneNumber('+3361234')).toEqual({
        ok: false,
        error: 'invalid_prefix',
      });
      expect(normalizePhoneNumber('+44207946095')).toEqual({
        ok: false,
        error: 'invalid_prefix',
      });
    });

    it('rejects impossible foreign numbers', () => {
      expect(normalizePhoneNumber('+10000000000')).toEqual({
        ok: false,
        error: 'invalid_prefix',
      });
      expect(normalizePhoneNumber('+336123456789')).toEqual({
        ok: false,
        error: 'invalid_prefix',
      });
    });
  });

  describe('unsupported number types', () => {
    it.each([
      ['+16003837322', 'VOIP'],
      ['+18005551234', 'TOLL_FREE'],
      ['+19009260747', 'PREMIUM_RATE'],
    ])('rejects %s (%s) even when landlines are allowed', (input, type) => {
      expect(parsePhoneNumberFromString(input)?.getType()).toBe(type);
      expect(normalizePhoneNumber(input)).toEqual({ ok: false, error: 'invalid_prefix' });
      expect(normalizePhoneNumber(input, { allowLandline: true })).toEqual({
        ok: false,
        error: 'invalid_prefix',
      });
    });
  });

  describe('invalid values', () => {
    it('rejects an empty value', () => {
      expect(normalizePhoneNumber('')).toEqual({ ok: false, error: 'required' });
      expect(normalizePhoneNumber('   ')).toEqual({ ok: false, error: 'required' });
      expect(normalizePhoneNumber(null)).toEqual({ ok: false, error: 'required' });
    });

    it('rejects letters and unsupported characters', () => {
      expect(normalizePhoneNumber('invalid-phone')).toEqual({
        ok: false,
        error: 'invalid_characters',
      });
    });

    it('rejects a malformed plus sign', () => {
      expect(normalizePhoneNumber('++639171234567')).toEqual({
        ok: false,
        error: 'malformed_plus',
      });
      expect(normalizePhoneNumber('+63+9171234567')).toEqual({
        ok: false,
        error: 'malformed_plus',
      });
    });

    it('rejects an invalid country calling code', () => {
      expect(normalizePhoneNumber('+999123456789')).toEqual({
        ok: false,
        error: 'invalid_country_code',
      });
      expect(normalizePhoneNumber('999123456789')).toEqual({
        ok: false,
        error: 'invalid_country_code',
      });
    });

    it('rejects a value longer than the E.164 maximum', () => {
      expect(normalizePhoneNumber('+1415555012345678')).toEqual({
        ok: false,
        error: 'too_long',
      });
      expect(normalizePhoneNumber('09123456789' + '0'.repeat(20))).toEqual({
        ok: false,
        error: 'too_long',
      });
    });

    it('rejects an incomplete number', () => {
      expect(normalizePhoneNumber('+63917')).toEqual({
        ok: false,
        error: 'invalid_length',
      });
      expect(normalizePhoneNumber('+')).toEqual({
        ok: false,
        error: 'invalid_length',
      });
    });

    it('rejects scientific notation and the 00 dialling prefix', () => {
      expect(normalizePhoneNumber('9.17123E+10')).toEqual({
        ok: false,
        error: 'corrupted',
      });
      expect(normalizePhoneNumber('00639171234567')).toEqual({
        ok: false,
        error: 'corrupted',
      });
    });
  });

  describe('phoneErrorMessage', () => {
    it('uses the caller label', () => {
      expect(phoneErrorMessage('invalid_mobile', 'Contact number')).toBe(
        'Contact number must be a valid mobile number',
      );
      expect(phoneErrorMessage('too_long')).toContain('15 digits');
    });
  });

  describe('isPhilippineMobileNational', () => {
    it('recognizes mobile national numbers only', () => {
      expect(isPhilippineMobileNational('9171234567')).toBe(true);
      expect(isPhilippineMobileNational('8131234567')).toBe(true);
      expect(isPhilippineMobileNational('212345678')).toBe(false);
    });
  });
});
