/**
 * Philippine phone number parsing and input formatting.
 *
 * Pure helpers only: no dependencies, no I/O, no framework imports. The parser
 * and formatter mirror `mobile/lib/core/utils/phone_input.dart`; any behavioural
 * change to them must be made there in the same commit.
 *
 * The fixed-prefix field adapter at the bottom of this file mirrors the mobile
 * form glue in `mobile/lib/core/utils/phone_input_form.dart`. It adapts the same
 * pure helpers to the web forms and re-encodes no parsing, prefix, or length
 * rule of its own.
 *
 * Accepted shapes
 * ---------------
 * Mobile, domestic (11 digits):
 *   09XXXXXXXXX            -> +639XXXXXXXXX
 *   0813XXXXXXX            -> +63813XXXXXXX
 *   0817XXXXXXX            -> +63817XXXXXXX
 *   0895XXXXXXX            -> +63895XXXXXXX
 *   0896XXXXXXX            -> +63896XXXXXXX
 *   0897XXXXXXX            -> +63897XXXXXXX
 *   0898XXXXXXX            -> +63898XXXXXXX
 * Mobile, national (10 digits, no trunk zero):
 *   9XXXXXXXXX / 813XXXXXXX / 817XXXXXXX / 895..898XXXXXXX
 * Mobile, international (with or without the leading plus):
 *   +63 followed by either national form above, or the same digits without the
 *   plus, e.g. `+639171234567` or `639171234567`.
 *
 * Landline, domestic (10 digits):   0[2-8]XXXXXXXX  -> +63[2-8]XXXXXXXX
 * Landline, national (9 digits):    [2-8]XXXXXXXX   -> +63[2-8]XXXXXXXX
 * Landline, international:          +63[2-8]XXXXXXXX
 *
 * Design rules
 * ------------
 * 1. A +63 international number may be written with or without the leading
 *    plus, so `+639171234567` and `639171234567` both parse. A duplicated
 *    country code or domestic trunk prefix (`+6309...`, `6363...`) is
 *    corrupted, not silently repaired.
 * 2. `08` is a mobile prefix only for the allocated blocks 0813, 0817, 0895,
 *    0896, 0897 and 0898. Every other `08` block is rejected rather than
 *    accepted structurally, so an unallocated prefix cannot slip through.
 * 3. Landline area codes cover the full 2 through 8 range, so families such as
 *    82 are valid. National landlines are nine digits; national mobiles are ten.
 * 4. Periods are formatting separators, so `0917.123.4567` is accepted and
 *    normalised. Scientific notation is still detected and rejected before any
 *    separator stripping, so it can never be silently repaired into a number.
 * 5. Overlong input is rejected, never truncated. Silently cutting digits off a
 *    phone number produces a plausible-looking number that reaches the wrong
 *    person.
 * 6. On rejection the formatter returns the caller's previous value unchanged
 *    plus a structured error, so a form can keep the field stable and show an
 *    inline message.
 */

export type PhoneKind = 'mobile' | 'landline';

export type PhoneParseError =
  | 'empty'
  | 'corrupted'
  | 'malformed_plus'
  | 'invalid_characters'
  | 'too_long'
  | 'invalid_prefix'
  | 'invalid_length';

export interface PhoneParseSuccess {
  ok: true;
  kind: PhoneKind;
  /** Canonical E.164 form, e.g. `+639171234567`. */
  e164: string;
  /** Domestic form with the trunk zero, e.g. `09171234567`. */
  national: string;
}

export interface PhoneParseFailure {
  ok: false;
  error: PhoneParseError;
}

export type PhoneParseResult = PhoneParseSuccess | PhoneParseFailure;

export type PhoneFormatError =
  | 'corrupted'
  | 'malformed_plus'
  | 'invalid_characters'
  | 'too_long'
  | 'invalid_prefix';

export interface PhoneFormatSuccess {
  value: string;
  error: null;
}

export interface PhoneFormatFailure {
  value: string;
  error: PhoneFormatError;
}

export type PhoneFormatResult = PhoneFormatSuccess | PhoneFormatFailure;

export const PH_COUNTRY_CODE = '63';

/** National significant number of a mobile: 9XXXXXXXXX. */
export const MOBILE_NATIONAL_LENGTH = 10;
/** Domestic mobile, trunk zero included: 09XXXXXXXXX. */
export const MOBILE_DOMESTIC_LENGTH = 11;
/** National significant number of a landline: [2-8]XXXXXXXX. */
export const LANDLINE_NATIONAL_LENGTH = 9;
/** Domestic landline, trunk zero included: 0[2-8]XXXXXXXX. */
export const LANDLINE_DOMESTIC_LENGTH = 10;

/** Longest accepted domestic digit count (mobile). */
export const MAX_NATIONAL_DIGITS = MOBILE_DOMESTIC_LENGTH;
/** Country code plus the longest national significant number (mobile). */
export const MAX_INTERNATIONAL_DIGITS =
  PH_COUNTRY_CODE.length + MOBILE_NATIONAL_LENGTH;

/**
 * Allocated `08` mobile blocks, in national form (trunk zero stripped).
 * Only these six are valid; the rest of the `08` range is unallocated.
 */
const MOBILE_08_NATIONAL_PREFIXES = ['813', '817', '895', '896', '897', '898'];

/** Landline area codes cover 2 through 8. */
const LANDLINE_AREA_CODE_START = '2345678';

/**
 * Characters stripped before validation. Periods are included: they are a
 * legitimate formatting separator, not a corruption signal.
 */
const SEPARATOR_PATTERN = /[\s\-().]/g;

function isLandlineAreaCodeStart(char: string): boolean {
  return LANDLINE_AREA_CODE_START.includes(char);
}

/**
 * True when the value carries the fingerprints of a mangled import: Excel
 * scientific notation, a `00` international dialling prefix, or a duplicated
 * country code / domestic trunk prefix.
 *
 * Repeated digits are NOT corruption: `09111111111` and `9999999999` are
 * structurally valid Philippine numbers and are validated by prefix and length
 * instead. Periods are deliberately NOT a corruption signal here; they are
 * separators.
 */
export function isCorruptedValue(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;

  // Excel turns long digit strings into 9.17123E+10 style values. Checked
  // before separator stripping so it can never be repaired into a number.
  if (/[eE]/.test(trimmed)) return true;

  // `0063...` is an international dialling prefix, not a leading-plus number.
  if (/^00/.test(trimmed)) return true;

  const digits = trimmed.replace(SEPARATOR_PATTERN, '').replace(/^\+/, '');
  return hasDuplicatedInternationalPrefix(digits);
}

/**
 * True when a country code has been duplicated: `+63` followed by a domestic
 * trunk zero (`+6309...`), or `63` repeated before a valid national number
 * (`6363...`). Matched precisely so genuine landlines in the 63x family still
 * parse.
 */
function hasDuplicatedInternationalPrefix(digits: string): boolean {
  if (!digits.startsWith(PH_COUNTRY_CODE)) return false;
  const national = digits.slice(PH_COUNTRY_CODE.length);
  if (
    national.startsWith('0') &&
    classifyNationalSignificant(national.slice(1)) !== null
  ) {
    return true;
  }
  return (
    national.startsWith(PH_COUNTRY_CODE) &&
    classifyNationalSignificant(national.slice(PH_COUNTRY_CODE.length)) !== null
  );
}

/**
 * True when the plus sign is present but not a single leading plus.
 * `+` alone is treated as an incomplete number, not a malformed one.
 */
export function hasMalformedPlus(raw: string): boolean {
  const trimmed = raw.trim();
  const firstPlus = trimmed.indexOf('+');
  if (firstPlus === -1) return false;
  if (firstPlus !== 0) return true;
  return trimmed.indexOf('+', 1) !== -1;
}

/**
 * Classifies a national significant number (trunk zero and country code
 * removed) as a mobile or landline, or null when it is not a valid length or
 * prefix.
 */
function classifyNationalSignificant(ns: string): PhoneKind | null {
  if (ns.length === MOBILE_NATIONAL_LENGTH) {
    if (ns[0] === '9') return 'mobile';
    if (MOBILE_08_NATIONAL_PREFIXES.includes(ns.slice(0, 3))) return 'mobile';
    return null;
  }
  if (ns.length === LANDLINE_NATIONAL_LENGTH) {
    if (isLandlineAreaCodeStart(ns[0])) return 'landline';
    return null;
  }
  return null;
}

/** True when `ns` could still grow into a valid mobile national number. */
function isMobileNationalPrefix(ns: string): boolean {
  if (ns.length > MOBILE_NATIONAL_LENGTH) return false;
  if (ns[0] === '9') return true;
  if (ns[0] === '8') {
    const head = ns.slice(0, 3);
    return MOBILE_08_NATIONAL_PREFIXES.some(
      (prefix) => prefix.startsWith(head) || ns.startsWith(prefix),
    );
  }
  return false;
}

/** True when `ns` could still grow into a valid landline national number. */
function isLandlineNationalPrefix(ns: string): boolean {
  if (ns.length > LANDLINE_NATIONAL_LENGTH) return false;
  return isLandlineAreaCodeStart(ns[0]);
}

/** True when `ns` is a prefix of some valid national significant number. */
function isPermissiblePartialSignificant(ns: string): boolean {
  if (ns.length === 0) return true;
  if (isMobileNationalPrefix(ns)) return true;
  if (isLandlineNationalPrefix(ns)) return true;
  return false;
}

/**
 * True when the digit string could still grow into a valid national number.
 * This is what lets a form accept `0`, `09`, `0917`, `821` while the user is
 * typing.
 */
export function isPermissiblePartialNational(digits: string): boolean {
  if (digits.length === 0) return true;
  if (digits.length > MAX_NATIONAL_DIGITS) return false;
  const ns = digits[0] === '0' ? digits.slice(1) : digits;
  return isPermissiblePartialSignificant(ns);
}

/**
 * True when the digit string (country code included, plus stripped) could still
 * grow into a valid international number.
 */
export function isPermissiblePartialInternational(digits: string): boolean {
  if (digits.length === 0) return true;
  if (digits.length > MAX_INTERNATIONAL_DIGITS) return false;
  if (digits[0] !== '6') return false;
  if (digits.length === 1) return true;
  if (digits[1] !== '3') return false;
  return isPermissiblePartialSignificant(digits.slice(PH_COUNTRY_CODE.length));
}

function stripSeparators(raw: string): string {
  return raw.trim().replace(SEPARATOR_PATTERN, '');
}

function buildResult(ns: string): PhoneParseResult {
  const kind = classifyNationalSignificant(ns);
  if (kind !== null) {
    return {
      ok: true,
      kind,
      e164: `+${PH_COUNTRY_CODE}${ns}`,
      national: `0${ns}`,
    };
  }
  if (ns.length > MOBILE_NATIONAL_LENGTH) return { ok: false, error: 'too_long' };
  if (ns.length < LANDLINE_NATIONAL_LENGTH) return { ok: false, error: 'invalid_length' };
  return { ok: false, error: 'invalid_prefix' };
}

/**
 * Parses a complete Philippine phone number into canonical form.
 *
 * Incomplete input is a failure here: use `formatPhoneInput` while the user is
 * still typing.
 */
export function parsePhone(raw: string): PhoneParseResult {
  if (raw.trim().length === 0) return { ok: false, error: 'empty' };

  if (isCorruptedValue(raw)) return { ok: false, error: 'corrupted' };
  if (hasMalformedPlus(raw)) return { ok: false, error: 'malformed_plus' };

  const stripped = stripSeparators(raw);
  if (!/^\+?\d+$/.test(stripped)) return { ok: false, error: 'invalid_characters' };

  const hasPlus = stripped.startsWith('+');
  const digits = hasPlus ? stripped.slice(1) : stripped;

  if (hasPlus) {
    if (digits.length > MAX_INTERNATIONAL_DIGITS) return { ok: false, error: 'too_long' };
    // `+0917...` is a national number wearing a plus: the plus is malformed,
    // not the prefix.
    if (digits.startsWith('0')) return { ok: false, error: 'malformed_plus' };
    if (!digits.startsWith(PH_COUNTRY_CODE)) return { ok: false, error: 'invalid_prefix' };

    const ns = digits.slice(PH_COUNTRY_CODE.length);
    if (ns.length === 0) return { ok: false, error: 'invalid_length' };
    return buildResult(ns);
  }

  // Digits-only international form: the parser accepts `63` followed by a
  // complete national significant number without the leading plus.
  if (digits.startsWith(PH_COUNTRY_CODE)) {
    const ns = digits.slice(PH_COUNTRY_CODE.length);
    if (
      ns.length === LANDLINE_NATIONAL_LENGTH ||
      ns.length === MOBILE_NATIONAL_LENGTH
    ) {
      return buildResult(ns);
    }
  }

  if (digits.length > MAX_NATIONAL_DIGITS) {
    return { ok: false, error: 'too_long' };
  }

  const ns = digits.startsWith('0') ? digits.slice(1) : digits;
  if (ns.length === 0) return { ok: false, error: 'invalid_length' };
  return buildResult(ns);
}

/**
 * Formats a partially typed phone number for a controlled text field.
 *
 * Order is deliberate and must not be rearranged:
 *   1. corruption check on the raw value,
 *   2. malformed plus check,
 *   3. character check after separator stripping,
 *   4. overlong rejection (never truncate),
 *   5. permissible-incomplete-digit filtering.
 *
 * On any rejection the previous value is returned untouched with a structured
 * error, so the field stays stable and the caller can show an inline message.
 */
export function formatPhoneInput(raw: string, previous: string): PhoneFormatResult {
  if (raw.trim().length === 0) return { value: '', error: null };

  if (isCorruptedValue(raw)) return { value: previous, error: 'corrupted' };
  if (hasMalformedPlus(raw)) return { value: previous, error: 'malformed_plus' };

  const stripped = stripSeparators(raw);
  if (!/^\+?\d*$/.test(stripped)) return { value: previous, error: 'invalid_characters' };

  const hasPlus = stripped.startsWith('+');
  const digits = hasPlus ? stripped.slice(1) : stripped;

  // A bare `+` is the first keystroke of an international number, not an error.
  if (hasPlus && digits.length === 0) return { value: '+', error: null };

  const maxDigits = hasPlus ? MAX_INTERNATIONAL_DIGITS : MAX_NATIONAL_DIGITS;
  if (digits.length > maxDigits) return { value: previous, error: 'too_long' };

  if (hasPlus && digits.startsWith('0')) {
    return { value: previous, error: 'malformed_plus' };
  }

  const permissible = hasPlus
    ? isPermissiblePartialInternational(digits)
    : isPermissiblePartialNational(digits);
  if (!permissible) return { value: previous, error: 'invalid_prefix' };

  return { value: `${hasPlus ? '+' : ''}${digits}`, error: null };
}

// ---------------------------------------------------------------------------
// Fixed-prefix field adapter (web forms)
// ---------------------------------------------------------------------------
// Mirrors the mobile form glue in `mobile/lib/core/utils/phone_input_form.dart`.
// The parsing, prefix and length rules stay in the pure helpers above; this
// section only adapts them to the fixed `+63` fields used by the web forms.

/** Label shown beside the fixed, non-editable prefix of a number field. */
export const PH_FIXED_PREFIX_LABEL = `+${PH_COUNTRY_CODE}`;

/** Warning shown when a stored value cannot be read as a supported number. */
export const STORED_PHONE_WARNING =
  'This saved number is not a recognized Philippine phone number. Please re-enter it.';

export interface PhoneFieldOptions {
  /**
   * Accept Philippine landlines in addition to mobiles. Patient mobile fields
   * leave this false; staff contact fields set it true.
   */
  allowLandline?: boolean;
}

export interface PhoneFieldResult {
  /** The national portion the fixed-prefix field should hold. */
  value: string;
  /** Rejection reason, or null when the value was accepted. */
  error: PhoneFormatError | null;
}

/** National significant number of a parsed E.164 value (`+63` removed). */
function nationalFromE164(e164: string): string {
  return e164.slice(PH_COUNTRY_CODE.length + 1);
}

/**
 * True when `raw` — which the parser already read as a complete landline — could
 * still become a valid mobile by adding one more digit. The `08` allocation
 * rules live in the parser, so this asks it rather than re-encoding them.
 */
function canCompleteMobile(raw: string): boolean {
  for (let digit = 0; digit <= 9; digit += 1) {
    const extended = parsePhone(`${raw}${digit}`);
    if (extended.ok && extended.kind === 'mobile') return true;
  }
  return false;
}

/**
 * Formats a value typed into a fixed-prefix number field.
 *
 * A complete recognized value is normalized to its national portion and a
 * permissible partial value is kept. A rejected value preserves `previous` and
 * reports a structured error. Mobile-only fields refuse a completed landline
 * unless one more digit can still complete a mobile, so the `08` mobile/landline
 * overlap keeps building instead of being rejected prematurely.
 */
export function formatPhoneFieldInput(
  raw: string,
  previous: string,
  options: PhoneFieldOptions = {},
): PhoneFieldResult {
  const allowLandline = options.allowLandline ?? false;

  if (raw.trim().length === 0) return { value: '', error: null };

  const parsed = parsePhone(raw);
  if (parsed.ok) {
    if (parsed.kind === 'mobile' || allowLandline) {
      return { value: nationalFromE164(parsed.e164), error: null };
    }
    if (!canCompleteMobile(raw)) {
      return { value: previous, error: 'invalid_prefix' };
    }
  }

  const result = formatPhoneInput(raw, previous);
  return { value: result.value, error: result.error };
}

/** Canonical `+63` value for a patient mobile field, or null when not a mobile. */
export function toPatientMobileE164(raw: string | null | undefined): string | null {
  const result = parsePhone(raw ?? '');
  if (!result.ok || result.kind !== 'mobile') return null;
  return result.e164;
}

/** Domestic `0` value for a staff contact field (mobile or landline), or null. */
export function toStaffContactDomestic(raw: string | null | undefined): string | null {
  const result = parsePhone(raw ?? '');
  if (!result.ok) return null;
  return result.national;
}

/**
 * Field value for a stored number: the national portion when the stored value
 * is recognized in this field, otherwise the raw value is preserved verbatim so
 * the user can see and correct it.
 */
export function phoneFieldValueFromStored(
  raw: string | null | undefined,
  options: PhoneFieldOptions = {},
): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) return '';
  const allowLandline = options.allowLandline ?? false;
  const result = parsePhone(trimmed);
  if (result.ok && (result.kind === 'mobile' || allowLandline)) {
    return nationalFromE164(result.e164);
  }
  return trimmed;
}

/** Warning for a stored value this field cannot use, or null when valid/empty. */
export function storedPhoneWarningFor(
  raw: string | null | undefined,
  options: PhoneFieldOptions = {},
): string | null {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) return null;
  const allowLandline = options.allowLandline ?? false;
  const result = parsePhone(trimmed);
  if (result.ok && (result.kind === 'mobile' || allowLandline)) return null;
  return STORED_PHONE_WARNING;
}

/** Human-readable message for a formatter rejection. */
export function phoneFormatErrorMessage(error: PhoneFormatError): string {
  switch (error) {
    case 'corrupted':
      return 'This phone number could not be understood. Please re-enter it.';
    case 'malformed_plus':
      return 'Remove the extra plus sign and enter digits only.';
    case 'invalid_characters':
      return 'Use digits only for the phone number.';
    case 'too_long':
      return 'This phone number is too long.';
    case 'invalid_prefix':
      return 'Enter a valid Philippine phone number.';
  }
}
