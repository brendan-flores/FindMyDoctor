import { config } from '../config';

/**
 * Get the current date in the configured clinic timezone (Asia/Manila by default)
 * Returns a date string in YYYY-MM-DD format
 */
export function getClinicDate(): string {
  const timezone = config.app.timezone;
  const now = new Date();

  // Use Intl API to get the date in the configured timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(now);
}

/**
 * Convert a Date object to a date string in the configured clinic timezone
 * Returns a date string in YYYY-MM-DD format
 */
export function toClinicDateString(date: Date): string {
  const timezone = config.app.timezone;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

/**
 * Get the current datetime in the configured clinic timezone
 * Returns an ISO string
 */
export function getClinicDateTime(): string {
  const timezone = config.app.timezone;
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  const second = parts.find(p => p.type === 'second')?.value;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}
