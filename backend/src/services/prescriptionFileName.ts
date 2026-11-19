/**
 * Canonical prescription PDF filename generator.
 *
 * This module is the single naming authority for prescription PDF exports.
 * The backend uses it for `Content-Disposition` and the PDF document title, and
 * the web and mobile clients save the server-provided filename verbatim instead
 * of constructing a name of their own.
 *
 * Format:
 *   SURNAME_Firstname_RX-YYYYMMDD-XXXXXXXX.pdf
 *
 * Replacements add `_replaces-<original 8-character number>` and superseded
 * prescriptions add `_SUPERSEDED`:
 *   SURNAME_Firstname_RX-YYYYMMDD-XXXXXXXX_replaces-YYYYYYYY.pdf
 *   SURNAME_Firstname_RX-YYYYMMDD-YYYYYYYY_SUPERSEDED.pdf
 *
 * When either name part is missing or unusable the name-free fallback is used:
 *   RX-YYYYMMDD-XXXXXXXX.pdf
 */

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface PrescriptionFileNameOptions {
  prescriptionId: string;
  prescriptionDate?: string | Date | null;
  patientFirstName?: string | null;
  patientLastName?: string | null;
  /** Original prescription id when this prescription is a replacement. */
  replacesPrescriptionId?: string | null;
  /** Original prescription date when this prescription is a replacement. */
  replacesPrescriptionDate?: string | Date | null;
  /** True when this prescription has been replaced by a newer one. */
  superseded?: boolean;
}

/**
 * Parse a date into its calendar parts without timezone shifts.
 * PostgreSQL DATE values are timezone-free, so the components are read
 * directly when the value is `YYYY-MM-DD`.
 */
export function parseDateParts(value?: string | Date | null): CalendarDate | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }

  const text = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    return {
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
    };
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

/**
 * Human-readable prescription number: `RX-YYYYMMDD-XXXXXXXX`.
 *
 * The prescription schema has no dedicated number column, so the number is
 * derived deterministically from the issue date and the prescription UUID.
 * Repeating the derivation always yields the same value, which lets a
 * replacement prescription reference the original prescription's number.
 */
export function buildPrescriptionNumber(
  prescriptionId: string,
  prescriptionDate?: string | Date | null
): string {
  const parts = parseDateParts(prescriptionDate) || {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  };
  const year = parts.year;
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  const suffix =
    String(prescriptionId || '')
      .replace(/-/g, '')
      .slice(0, 8)
      .toUpperCase() || 'UNKNOWN';
  return `RX-${year}${month}${day}-${suffix}`;
}

/**
 * Characters that do not decompose through Unicode normalization but still
 * have an ordinary Latin spelling. Everything else outside A-Z/a-z/0-9 is
 * removed or converted to a word separator.
 */
const LATIN_EQUIVALENTS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ø: 'o',
  Ø: 'O',
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'TH',
};

/**
 * Normalize one name part to the filename character set.
 *
 * - diacritics are folded to plain letters (`Peña` -> `Pena`)
 * - apostrophes are removed (`O'Brien` -> `OBrien`)
 * - spaces, periods, commas and other separators become single hyphens
 * - underscores are never kept inside a name part
 * - runs of hyphens are collapsed and the ends are trimmed
 */
export function normalizePrescriptionNamePart(value: unknown): string {
  const text = String(value ?? '').replace(
    /[ßæÆœŒøØłŁđĐðÐþÞ]/g,
    (character) => LATIN_EQUIVALENTS[character] || character
  );

  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’‘`´]/g, '')
    .replace(/[^A-Za-z0-9 -]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isValidNamePart(part: string): boolean {
  return part.length > 0 && /[A-Za-z]/.test(part);
}

function toTitleCase(part: string): string {
  return part
    .split('-')
    .map((segment) =>
      segment ? `${segment[0].toUpperCase()}${segment.slice(1).toLowerCase()}` : ''
    )
    .join('-');
}

function prescriptionNumberSuffix(
  prescriptionId: string,
  prescriptionDate?: string | Date | null
): string {
  const number = buildPrescriptionNumber(prescriptionId, prescriptionDate);
  return number.slice(number.lastIndexOf('-') + 1);
}

/**
 * Build the download filename for a prescription PDF.
 *
 * The same function is used for every export surface. A replacement keeps its
 * own prescription number and records the original number after `_replaces-`;
 * a superseded prescription keeps its own number and ends in `_SUPERSEDED`.
 * The names are generated automatically and are never user-editable.
 */
export function buildPrescriptionDownloadFileName(
  options: PrescriptionFileNameOptions
): string {
  const prescriptionNumber = buildPrescriptionNumber(
    options.prescriptionId,
    options.prescriptionDate
  );

  const surname = normalizePrescriptionNamePart(options.patientLastName);
  const firstName = normalizePrescriptionNamePart(options.patientFirstName);

  // The name-free fallback is used exactly as documented whenever either name
  // part is missing or invalid, including for replacements and superseded
  // prescriptions. The prescription number still keeps the file unique.
  if (!isValidNamePart(surname) || !isValidNamePart(firstName)) {
    return `${prescriptionNumber}.pdf`;
  }

  let baseName = `${surname.toUpperCase()}_${toTitleCase(firstName)}_${prescriptionNumber}`;

  const replacesId = String(options.replacesPrescriptionId ?? '').trim();
  if (replacesId) {
    baseName += `_replaces-${prescriptionNumberSuffix(
      replacesId,
      options.replacesPrescriptionDate
    )}`;
  }

  if (options.superseded) {
    baseName += '_SUPERSEDED';
  }

  return `${baseName}.pdf`;
}

const PRESCRIPTION_FILE_NAME_PATTERN =
  /^(?:[A-Z0-9-]+_[A-Za-z0-9][A-Za-z0-9-]*_RX-\d{8}-[A-Z0-9]+(?:_replaces-[A-Z0-9]+)?(?:_SUPERSEDED)?|RX-\d{8}-[A-Z0-9]+)\.pdf$/;

/**
 * True when a filename matches the prescription PDF naming contract.
 * Clients use this to reject a stray legacy/name-free name rather than saving
 * a file the backend did not authorize.
 */
export function isValidPrescriptionDownloadFileName(fileName: string): boolean {
  return PRESCRIPTION_FILE_NAME_PATTERN.test(String(fileName ?? ''));
}
