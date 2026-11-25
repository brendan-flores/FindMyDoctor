import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/max';

export type PhoneValidationError =
  | 'required'
  | 'invalid_characters'
  | 'malformed_plus'
  | 'corrupted'
  | 'too_long'
  | 'invalid_country_code'
  | 'invalid_prefix'
  | 'invalid_length'
  | 'invalid_mobile';

export interface PhoneNormalizationOptions {
  allowLandline?: boolean;
}

export interface PhoneNormalizationResult {
  ok: boolean;
  e164?: string;
  error?: PhoneValidationError;
}

const MAX_E164_DIGITS = 15;
const SEPARATOR_PATTERN = /[\s\-().]/g;
const PH_COUNTRY_CODE = '63';
const PH_MOBILE_08_PREFIXES = ['813', '817', '895', '896', '897', '898'];

const VALID_CALLING_CODES = new Set<string>(
  getCountries().map((country) => getCountryCallingCode(country)),
);

export function isPhilippineMobileNational(national: string): boolean {
  if (national.length !== 10) return false;
  if (national[0] === '9') return true;
  return PH_MOBILE_08_PREFIXES.includes(national.slice(0, 3));
}

export function isPhilippineLandlineNational(national: string): boolean {
  return national.length === 9 && '2345678'.includes(national[0]);
}

function findCallingCode(digits: string): string | null {
  if (digits[0] === '1' || digits[0] === '7') return digits[0];
  if (VALID_CALLING_CODES.has(digits.slice(0, 3))) return digits.slice(0, 3);
  if (VALID_CALLING_CODES.has(digits.slice(0, 2))) return digits.slice(0, 2);
  return null;
}

function philippineResult(national: string, options: PhoneNormalizationOptions): PhoneNormalizationResult {
  if (isPhilippineMobileNational(national)) {
    return { ok: true, e164: `+${PH_COUNTRY_CODE}${national}` };
  }

  if (isPhilippineLandlineNational(national)) {
    if (options.allowLandline) {
      return { ok: true, e164: `+${PH_COUNTRY_CODE}${national}` };
    }
    return { ok: false, error: 'invalid_mobile' };
  }

  if (national.length > 10) return { ok: false, error: 'too_long' };
  if (national.length < 9) return { ok: false, error: 'invalid_length' };
  return { ok: false, error: 'invalid_prefix' };
}

function isPhilippineDuplicate(national: string): boolean {
  if (national.startsWith('0')) {
    return isPhilippineMobileNational(national.slice(1)) || isPhilippineLandlineNational(national.slice(1));
  }
  if (national.startsWith(PH_COUNTRY_CODE)) {
    const remainder = national.slice(PH_COUNTRY_CODE.length);
    return isPhilippineMobileNational(remainder) || isPhilippineLandlineNational(remainder);
  }
  return false;
}

function validatePhilippines(national: string, options: PhoneNormalizationOptions): PhoneNormalizationResult {
  if (isPhilippineDuplicate(national)) {
    return { ok: false, error: 'corrupted' };
  }
  return philippineResult(national, options);
}

function validateForeignNumber(
  digits: string,
  options: PhoneNormalizationOptions,
): PhoneNormalizationResult {
  const phoneNumber = parsePhoneNumberFromString(`+${digits}`);
  if (!phoneNumber || !phoneNumber.isValid()) {
    return { ok: false, error: 'invalid_prefix' };
  }

  const type = phoneNumber.getType();
  if (type === 'MOBILE') {
    return { ok: true, e164: phoneNumber.format('E.164') };
  }

  if (type === 'FIXED_LINE_OR_MOBILE') {
    if (options.allowLandline) {
      return { ok: true, e164: phoneNumber.format('E.164') };
    }
    return { ok: false, error: 'invalid_mobile' };
  }

  if (type === 'FIXED_LINE') {
    if (options.allowLandline) {
      return { ok: true, e164: phoneNumber.format('E.164') };
    }
    return { ok: false, error: 'invalid_mobile' };
  }

  return { ok: false, error: 'invalid_prefix' };
}

function validateInternational(digits: string, options: PhoneNormalizationOptions): PhoneNormalizationResult {
  if (digits.length < 2) return { ok: false, error: 'invalid_length' };
  if (digits.length > MAX_E164_DIGITS) return { ok: false, error: 'too_long' };
  if (digits.startsWith('0')) return { ok: false, error: 'invalid_country_code' };

  const callingCode = findCallingCode(digits);
  if (!callingCode) return { ok: false, error: 'invalid_country_code' };

  if (callingCode === PH_COUNTRY_CODE) {
    return validatePhilippines(digits.slice(PH_COUNTRY_CODE.length), options);
  }

  return validateForeignNumber(digits, options);
}

function tryLegacyPhilippines(digits: string, options: PhoneNormalizationOptions): PhoneNormalizationResult | null {
  if (digits.startsWith('0')) {
    const national = digits.slice(1);
    if (national.startsWith(PH_COUNTRY_CODE)) {
      const remainder = national.slice(PH_COUNTRY_CODE.length);
      if (isPhilippineMobileNational(remainder) || isPhilippineLandlineNational(remainder)) {
        return { ok: false, error: 'corrupted' };
      }
    }
    if (isPhilippineMobileNational(national) || isPhilippineLandlineNational(national)) {
      return philippineResult(national, options);
    }
    return null;
  }

  if (digits.startsWith(PH_COUNTRY_CODE)) {
    const national = digits.slice(PH_COUNTRY_CODE.length);
    if (national.length >= 9 && national.length <= 10) {
      return validatePhilippines(national, options);
    }
    return null;
  }

  if (isPhilippineMobileNational(digits) || isPhilippineLandlineNational(digits)) {
    return philippineResult(digits, options);
  }

  return null;
}

export function normalizePhoneNumber(
  raw: string | null | undefined,
  options: PhoneNormalizationOptions = {},
): PhoneNormalizationResult {
  const input = typeof raw === 'string' ? raw.trim() : '';
  if (input.length === 0) return { ok: false, error: 'required' };

  if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(input)) return { ok: false, error: 'corrupted' };
  if (/^00/.test(input)) return { ok: false, error: 'corrupted' };

  const firstPlus = input.indexOf('+');
  if (firstPlus !== -1 && (firstPlus !== 0 || input.indexOf('+', 1) !== -1)) {
    return { ok: false, error: 'malformed_plus' };
  }

  const stripped = input.replace(SEPARATOR_PATTERN, '');
  if (stripped === '+') return { ok: false, error: 'invalid_length' };
  if (!/^\+?\d+$/.test(stripped)) return { ok: false, error: 'invalid_characters' };

  const hasPlus = stripped.startsWith('+');
  const digits = hasPlus ? stripped.slice(1) : stripped;

  if (digits.length > MAX_E164_DIGITS) return { ok: false, error: 'too_long' };
  if (digits.length < 2) return { ok: false, error: 'invalid_length' };

  if (hasPlus) {
    return validateInternational(digits, options);
  }

  const legacy = tryLegacyPhilippines(digits, options);
  if (legacy) return legacy;

  return validateInternational(digits, options);
}

export function phoneErrorMessage(error: PhoneValidationError, label = 'Mobile number'): string {
  switch (error) {
    case 'required':
      return `${label} is required`;
    case 'invalid_characters':
      return `${label} must contain only digits, spaces, hyphens, plus sign, or parentheses`;
    case 'malformed_plus':
      return `${label} must start with a single plus sign followed by the country code`;
    case 'corrupted':
      return `${label} contains a duplicated or invalid country code`;
    case 'too_long':
      return `${label} must not exceed 15 digits in E.164 format`;
    case 'invalid_country_code':
      return `${label} has an invalid country calling code`;
    case 'invalid_mobile':
      return `${label} must be a valid mobile number`;
    case 'invalid_prefix':
      return `${label} must be a valid phone number`;
    case 'invalid_length':
      return `${label} must be a valid E.164 number`;
  }
}
