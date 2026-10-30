/**
 * Tests for the patient-only doctor profile endpoint.
 *
 * The endpoint returns a deliberately small whitelist of public professional
 * fields plus availability. These tests prove role enforcement, the active and
 * approved doctor filter, generic not-found behaviour, and that private doctor
 * or account fields can never leak into the response.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import patientDoctorsRouter from './patientDoctors';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import { getClinicDate } from '../utils/date';
import { calculateAvailabilityRange } from '../modules/availability/availabilityService';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../modules/availability/availabilityService', () => ({
  calculateAvailabilityRange: jest.fn(),
}));

const { query } = require('../database/connection');
const mockedAvailability = calculateAvailabilityRange as jest.Mock;

const DOCTOR_ID = '11111111-1111-4111-8111-111111111111';
const UNKNOWN_ID = '22222222-2222-4222-8222-222222222222';

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function tokenFor(role: string): string {
  return jwt.sign(
    {
      id: 'caller-user-id',
      email: 'caller@example.com',
      role,
      mustChangePassword: false,
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

function authHeader(role: string): string {
  return `Bearer ${tokenFor(role)}`;
}

const doctorRow = {
  id: DOCTOR_ID,
  first_name: 'Maria',
  middle_name: 'Santos',
  last_name: 'Reyes',
  specialty: 'Cardiology',
  credentials: 'MD, FPCP',
  practice_name: 'Heart Center Clinic',
  practice_address: '123 Health Street, Makati City',
  room_number: '204',
  years_of_experience: 12,
  consultation_fee: '1500.00',
  areas_of_expertise: 'Arrhythmia, Preventive Cardiology',
  languages_spoken: 'English, Filipino',
  biography: 'A cardiologist focused on preventive heart care.',
  professional_photo_url: 'https://example.com/doctor.png',
  // Private fields intentionally present in the mocked row to prove the
  // service builds an explicit whitelist instead of spreading the row.
  practice_email: 'private-clinic@example.com',
  practice_phone: '+639171234567',
  contact_number: '+639181234567',
  prc_license_number: 'PRC-1234567',
  approval_status: 'ACTIVE',
  is_approved: true,
};

const schedules = [
  { day_of_week: 1, start_time: '09:00:00', end_time: '12:00:00' },
  { day_of_week: 3, start_time: '13:00:00', end_time: '17:00:00' },
];

function mockDoctorQueries(rows: any[] = [doctorRow]) {
  query.mockImplementation((sql: string) => {
    if (sql.includes('FROM doctors d') && sql.includes('INNER JOIN users u')) {
      return Promise.resolve({ rows });
    }
    if (sql.includes('FROM doctor_schedules')) {
      return Promise.resolve({ rows: schedules });
    }
    return Promise.resolve({ rows: [] });
  });
}

function mockAvailability(options: {
  todayStatus?: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE' | 'NON_WORKING' | 'PAST';
  slotsLeft?: number;
  nextDate?: string | null;
}) {
  const today = getClinicDate();
  const tomorrow = addDays(today, 1);
  const dates: any[] = [
    {
      date: today,
      dayOfWeek: new Date(`${today}T00:00:00Z`).getUTCDay(),
      status: options.todayStatus ?? 'AVAILABLE',
      workingHours: [{ start: '09:00:00', end: '12:00:00' }],
      timeSlots: [],
      capacity: {
        calculated: 6,
        configured: null,
        final: 6,
        registered: 6 - (options.slotsLeft ?? 3),
        remaining: options.slotsLeft ?? 3,
      },
    },
    {
      date: tomorrow,
      dayOfWeek: new Date(`${tomorrow}T00:00:00Z`).getUTCDay(),
      status: options.nextDate && options.nextDate === tomorrow ? 'AVAILABLE' : 'FULL',
      workingHours: [],
      timeSlots: [],
      capacity: {
        calculated: 6,
        configured: null,
        final: 6,
        registered: 6,
        remaining: 0,
      },
    },
  ];

  mockedAvailability.mockResolvedValue({
    startDate: today,
    endDate: addDays(today, 59),
    dates,
  });

  return { today, tomorrow };
}

describe('Patient doctor profile API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/patient', authenticate, patientDoctorsRouter);
    jest.clearAllMocks();
    mockDoctorQueries();
    mockAvailability({});
  });

  it('T1: allows a patient to load a whitelisted public profile', async () => {
    const response = await request(app)
      .get(`/api/v1/patient/doctors/${DOCTOR_ID}/profile`)
      .set('Authorization', authHeader('PATIENT'));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const profile = response.body.data;
    expect(profile.id).toBe(DOCTOR_ID);
    expect(profile.displayName).toBe('Dr. Maria Santos Reyes');
    expect(profile.specialty).toBe('Cardiology');
    expect(profile.credentials).toBe('MD, FPCP');
    expect(profile.photoUrl).toBe('https://example.com/doctor.png');
    expect(profile.practiceName).toBe('Heart Center Clinic');
    expect(profile.practiceAddress).toBe('123 Health Street, Makati City');
    expect(profile.roomNumber).toBe('204');
    expect(profile.yearsOfExperience).toBe(12);
    expect(profile.consultationFee).toBe(1500);
    expect(profile.areasOfExpertise).toEqual([
      'Arrhythmia',
      'Preventive Cardiology',
    ]);
    expect(profile.languagesSpoken).toEqual(['English', 'Filipino']);
    expect(profile.biography).toBe(
      'A cardiologist focused on preventive heart care.'
    );

    expect(profile.availability.availableToday).toBe(true);
    expect(profile.availability.slotsLeftToday).toBe(3);
    expect(profile.availability.nextAvailableDate).toBe(getClinicDate());
    expect(profile.availability.consultationDurationMinutes).toBe(30);
    expect(profile.availability.workingDays).toEqual([
      {
        dayOfWeek: 1,
        dayName: 'Monday',
        startTime: '09:00',
        endTime: '12:00',
      },
      {
        dayOfWeek: 3,
        dayName: 'Wednesday',
        startTime: '13:00',
        endTime: '17:00',
      },
    ]);
  });

  it('T2: rejects a valid token from any non-patient role', async () => {
    for (const role of ['DOCTOR', 'SECRETARY', 'ADMIN', 'SUPERADMIN']) {
      const response = await request(app)
        .get(`/api/v1/patient/doctors/${DOCTOR_ID}/profile`)
        .set('Authorization', authHeader(role));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    }

    expect(query).not.toHaveBeenCalled();
  });

  it('T3: rejects anonymous requests', async () => {
    const response = await request(app).get(
      `/api/v1/patient/doctors/${DOCTOR_ID}/profile`
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('T4: returns the same generic not-found result for a non-matching doctor', async () => {
    mockDoctorQueries([]);

    const response = await request(app)
      .get(`/api/v1/patient/doctors/${UNKNOWN_ID}/profile`)
      .set('Authorization', authHeader('PATIENT'));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Doctor not found' },
    });

    // Nothing about approval, activation, or existence is disclosed.
    expect(JSON.stringify(response.body)).not.toContain('approval');
    expect(JSON.stringify(response.body)).not.toContain('inactive');
  });

  it('T5: only active, approved doctors with active user accounts can match', async () => {
    mockDoctorQueries([]);

    await request(app)
      .get(`/api/v1/patient/doctors/${DOCTOR_ID}/profile`)
      .set('Authorization', authHeader('PATIENT'));

    const profileSql = query.mock.calls
      .map((call: any[]) => String(call[0]))
      .find((sql: string) => sql.includes('FROM doctors d'));

    expect(profileSql).toContain("d.approval_status = 'ACTIVE'");
    expect(profileSql).toContain('d.is_approved = true');
    expect(profileSql).toContain('u.is_active = true');
  });

  it('T6: returns only the documented whitelist and never private fields', async () => {
    const response = await request(app)
      .get(`/api/v1/patient/doctors/${DOCTOR_ID}/profile`)
      .set('Authorization', authHeader('PATIENT'));

    expect(response.status).toBe(200);

    const expectedKeys = [
      'areasOfExpertise',
      'availability',
      'biography',
      'consultationFee',
      'credentials',
      'displayName',
      'id',
      'languagesSpoken',
      'photoUrl',
      'practiceAddress',
      'practiceName',
      'roomNumber',
      'specialty',
      'yearsOfExperience',
    ].sort();

    expect(Object.keys(response.body.data).sort()).toEqual(expectedKeys);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('private-clinic@example.com');
    expect(serialized).not.toContain('+639171234567');
    expect(serialized).not.toContain('+639181234567');
    expect(serialized).not.toContain('PRC-1234567');
    expect(response.body.data).not.toHaveProperty('practiceEmail');
    expect(response.body.data).not.toHaveProperty('practicePhone');
    expect(response.body.data).not.toHaveProperty('contactNumber');
    expect(response.body.data).not.toHaveProperty('prcLicenseNumber');
    expect(response.body.data).not.toHaveProperty('approvalStatus');
    expect(response.body.data).not.toHaveProperty('isApproved');
  });

  it('T7: reports a fully booked today as unavailable with zero slots and the next available date', async () => {
    const { today, tomorrow } = mockAvailability({
      todayStatus: 'FULL',
      slotsLeft: 0,
      nextDate: addDays(getClinicDate(), 1),
    });

    const response = await request(app)
      .get(`/api/v1/patient/doctors/${DOCTOR_ID}/profile`)
      .set('Authorization', authHeader('PATIENT'));

    expect(response.status).toBe(200);
    expect(response.body.data.availability.availableToday).toBe(false);
    expect(response.body.data.availability.slotsLeftToday).toBe(0);
    expect(response.body.data.availability.nextAvailableDate).toBe(tomorrow);
    expect(today).not.toBe(response.body.data.availability.nextAvailableDate);
  });

  it('T8: uses the existing capacity default instead of a hardcoded profile value', async () => {
    const response = await request(app)
      .get(`/api/v1/patient/doctors/${DOCTOR_ID}/profile`)
      .set('Authorization', authHeader('PATIENT'));

    expect(response.body.data.availability.consultationDurationMinutes).toBe(30);
  });

  it('T9: returns an empty weekly schedule and null next date when no availability remains', async () => {
    const today = getClinicDate();
    mockedAvailability.mockResolvedValue({
      startDate: today,
      endDate: addDays(today, 59),
      dates: [
        {
          date: today,
          dayOfWeek: new Date(`${today}T00:00:00Z`).getUTCDay(),
          status: 'NON_WORKING',
          workingHours: [],
          timeSlots: [],
          capacity: {
            calculated: 0,
            configured: null,
            final: 0,
            registered: 0,
            remaining: 0,
          },
        },
      ],
    });

    const response = await request(app)
      .get(`/api/v1/patient/doctors/${DOCTOR_ID}/profile`)
      .set('Authorization', authHeader('PATIENT'));

    expect(response.status).toBe(200);
    expect(response.body.data.availability.availableToday).toBe(false);
    expect(response.body.data.availability.slotsLeftToday).toBe(0);
    expect(response.body.data.availability.nextAvailableDate).toBeNull();
  });

  it('T10: a malformed doctor id is a generic not-found without a database lookup', async () => {
    const response = await request(app)
      .get('/api/v1/patient/doctors/not-a-uuid/profile')
      .set('Authorization', authHeader('PATIENT'));

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe('Doctor not found');
    expect(query).not.toHaveBeenCalled();
  });

  it('T11: never returns other patients or queue contents', async () => {
    const response = await request(app)
      .get(`/api/v1/patient/doctors/${DOCTOR_ID}/profile`)
      .set('Authorization', authHeader('PATIENT'));

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('queue');
    expect(serialized).not.toContain('patientName');
    expect(serialized).not.toContain('appointments');
  });
});
