/**
 * Pure helpers for the Doctor Portal header/sidebar identity.
 *
 * The doctor profile is the preferred source; the stored `doctor_user`
 * session identity is only a fallback for the email. The authentication role
 * value stays `DOCTOR`; `Doctor` is a display label only.
 */

export const DOCTOR_ROLE_LABEL = 'Doctor';
export const DOCTOR_NAME_FALLBACK = 'Doctor';

export interface DoctorIdentityNameSource {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}

export interface DoctorIdentityProfileSource extends DoctorIdentityNameSource {
  email?: string | null;
}

export interface DoctorIdentity {
  displayName: string;
  email: string;
  role: string;
  initials: string;
}

function clean(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Local part of an email address, or an empty string when unavailable. */
export function doctorEmailLocalPart(email?: string | null): string {
  const trimmed = clean(email);
  const at = trimmed.indexOf('@');
  if (at <= 0) return '';
  return trimmed.slice(0, at).trim();
}

/** Prefer the loaded profile email, then the stored session email. */
export function resolveDoctorEmail(
  profileEmail?: string | null,
  sessionEmail?: string | null
): string {
  const fromProfile = clean(profileEmail);
  if (fromProfile) return fromProfile;
  return clean(sessionEmail);
}

/**
 * `First Middle Last`, omitting an absent middle name. A complete name needs
 * both a first and a last name; otherwise fall back to the email local part,
 * then to the generic `Doctor` label.
 */
export function resolveDoctorDisplayName(
  name?: DoctorIdentityNameSource | null,
  email?: string | null
): string {
  const first = clean(name?.first_name);
  const middle = clean(name?.middle_name);
  const last = clean(name?.last_name);

  if (first && last) {
    return middle ? `${first} ${middle} ${last}` : `${first} ${last}`;
  }

  return doctorEmailLocalPart(email) || DOCTOR_NAME_FALLBACK;
}

/** Avatar initials from the display name, with a `D` fallback when empty. */
export function doctorInitials(displayName: string): string {
  const parts = clean(displayName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'D';
  return parts
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function resolveDoctorIdentity(
  profile?: DoctorIdentityProfileSource | null,
  sessionEmail?: string | null
): DoctorIdentity {
  const email = resolveDoctorEmail(profile?.email, sessionEmail);
  const displayName = resolveDoctorDisplayName(profile, email);

  return {
    displayName,
    email,
    role: DOCTOR_ROLE_LABEL,
    initials: doctorInitials(displayName),
  };
}
