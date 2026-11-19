/**
 * Client-side validation and display helpers for doctor signature uploads.
 *
 * The backend still validates the MIME type, the 4MB limit, and the actual PNG
 * bytes. These checks only give the doctor immediate feedback before a request
 * is sent, so large or wrong-format files never leave the browser.
 */

export const SIGNATURE_MAX_BYTES = 4 * 1024 * 1024;
export const SIGNATURE_ACCEPTED_MIME_TYPE = 'image/png';

export interface SignatureFileLike {
  type: string;
  size: number;
}

export function validateSignatureFile(file: SignatureFileLike): {
  valid: boolean;
  error?: string;
} {
  if (file.type !== SIGNATURE_ACCEPTED_MIME_TYPE) {
    return { valid: false, error: 'Only PNG files are allowed for your signature.' };
  }

  if (file.size > SIGNATURE_MAX_BYTES) {
    return { valid: false, error: 'Signature file size must not exceed 4MB.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'The selected signature file is empty.' };
  }

  return { valid: true };
}

/**
 * Signed preview URLs expire, so a failed image load (for example after the
 * browser cached an expired URL) should trigger exactly one refresh attempt.
 */
export function shouldRefreshSignaturePreview(
  hasSignature: boolean,
  alreadyRetried: boolean
): boolean {
  return hasSignature && !alreadyRetried;
}
