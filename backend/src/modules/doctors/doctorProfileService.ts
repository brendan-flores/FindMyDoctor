import { query } from '../../database/connection';
import { calculateAvailabilityRange } from '../availability/availabilityService';
import { getConsultationDurationMinutes } from '../capacity/capacityService';
import { getClinicDate } from '../../utils/date';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Availability is shown for the current day plus a short forward window. The
// window matches the booking journey's practical horizon and keeps the batched
// availability query bounded.
const AVAILABILITY_LOOKAHEAD_DAYS = 60;

export interface PatientDoctorWorkingDay {
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
}

export interface PatientDoctorAvailability {
  availableToday: boolean;
  slotsLeftToday: number;
  nextAvailableDate: string | null;
  consultationDurationMinutes: number;
  workingDays: PatientDoctorWorkingDay[];
}

/**
 * Patient-facing doctor profile. Every field here is explicitly built from
 * public professional information; private columns (contact number, practice
 * email/phone, PRC license, account status, approval flags) are never selected
 * or included.
 */
export interface PatientDoctorProfile {
  id: string;
  displayName: string;
  photoUrl: string | null;
  specialty: string | null;
  credentials: string | null;
  practiceName: string | null;
  practiceAddress: string | null;
  roomNumber: string | null;
  yearsOfExperience: number | null;
  consultationFee: number | null;
  areasOfExpertise: string[];
  languagesSpoken: string[];
  biography: string | null;
  availability: PatientDoctorAvailability;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function splitCommaSeparated(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatTime(value: unknown): string {
  // PostgreSQL TIME values arrive as HH:MM:SS. The mobile UI only needs HH:MM.
  return String(value ?? '').slice(0, 5);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/**
 * Load the public patient-facing profile for one active, approved doctor.
 * Returns null when the doctor does not exist, is not approved/active, or the
 * associated user account is deactivated. Callers must translate null into a
 * generic not-found response so internal status is never disclosed.
 */
export async function getPatientDoctorProfile(
  doctorId: string
): Promise<PatientDoctorProfile | null> {
  const doctorResult = await query(
    `SELECT
       d.id,
       d.first_name,
       d.middle_name,
       d.last_name,
       d.specialty,
       d.credentials,
       d.practice_name,
       d.practice_address,
       d.room_number,
       d.years_of_experience,
       d.consultation_fee,
       d.areas_of_expertise,
       d.languages_spoken,
       d.biography,
       d.professional_photo_url
     FROM doctors d
     INNER JOIN users u ON u.id = d.user_id
     WHERE d.id = $1
       AND d.approval_status = 'ACTIVE'
       AND d.is_approved = true
       AND u.is_active = true
       AND u.role = 'DOCTOR'`,
    [doctorId]
  );

  if (doctorResult.rows.length === 0) {
    return null;
  }

  const doctor = doctorResult.rows[0];

  const [schedulesResult, availabilityRange] = await Promise.all([
    query(
      `SELECT day_of_week, start_time, end_time
       FROM doctor_schedules
       WHERE doctor_id = $1 AND is_active = true
       ORDER BY day_of_week, start_time`,
      [doctorId]
    ),
    (async () => {
      const today = getClinicDate();
      const endDate = addDays(today, AVAILABILITY_LOOKAHEAD_DAYS - 1);
      return {
        today,
        range: await calculateAvailabilityRange(doctorId, today, endDate, null),
      };
    })(),
  ]);

  const workingDays: PatientDoctorWorkingDay[] = schedulesResult.rows.map((row) => {
    const dayOfWeek = Number(row.day_of_week);
    return {
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek] ?? '',
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
    };
  });

  const todayAvailability = availabilityRange.range.dates.find(
    (date) => date.date === availabilityRange.today
  );
  const nextAvailable = availabilityRange.range.dates.find(
    (date) => date.status === 'AVAILABLE'
  );

  const availableToday = todayAvailability?.status === 'AVAILABLE';

  return {
    id: String(doctor.id),
    displayName: `Dr. ${[doctor.first_name, doctor.middle_name, doctor.last_name]
      .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
      .filter((part) => part.length > 0)
      .join(' ')}`,
    photoUrl: toNullableString(doctor.professional_photo_url),
    specialty: toNullableString(doctor.specialty),
    credentials: toNullableString(doctor.credentials),
    practiceName: toNullableString(doctor.practice_name),
    practiceAddress: toNullableString(doctor.practice_address),
    roomNumber: toNullableString(doctor.room_number),
    yearsOfExperience: toNullableNumber(doctor.years_of_experience),
    consultationFee: toNullableNumber(doctor.consultation_fee),
    areasOfExpertise: splitCommaSeparated(doctor.areas_of_expertise),
    languagesSpoken: splitCommaSeparated(doctor.languages_spoken),
    biography: toNullableString(doctor.biography),
    availability: {
      availableToday,
      slotsLeftToday: availableToday
        ? Math.max(0, Number(todayAvailability?.capacity?.remaining ?? 0))
        : 0,
      nextAvailableDate: nextAvailable?.date ?? null,
      consultationDurationMinutes: getConsultationDurationMinutes(),
      workingDays,
    },
  };
}
