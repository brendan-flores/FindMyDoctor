/**
 * Schedule-change apply-time side effects.
 *
 * Exception and break-period writes apply immediately (no approval step).
 * When a CREATE or UPDATE affects active future appointments, those
 * appointments are flagged needs_attention and each affected patient gets a
 * SCHEDULE_CHANGE_NOTICE notification plus a best-effort push. DELETE
 * restores availability and never flags or notifies.
 */

import request from 'supertest';
import express from 'express';
import doctorsRouter from './doctors';
import secretariesRouter from './secretaries';

const DOCTOR_ID = 'doctor-id-1';

let mockUser: any = { id: 'doctor-user-id', role: 'DOCTOR', mustChangePassword: false };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    }
  },
  requirePasswordChange: (_req: any, _res: any, next: any) => next(),
  requireSecretaryPasswordChange: (_req: any, _res: any, next: any) => next(),
  requireSecretaryProfileCompletion: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../database/connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  getClient: jest.fn(),
}));

jest.mock('../services/pushService', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/storageService', () => ({
  uploadDoctorPhoto: jest.fn(),
  deleteDoctorPhoto: jest.fn(),
  replaceDoctorPhoto: jest.fn(),
  validateImageFile: jest.fn(),
  uploadDoctorSignature: jest.fn(),
  deleteDoctorSignature: jest.fn(),
  generateSignedDoctorSignatureUrl: jest.fn(),
}));

const { getClient } = require('../database/connection');
const { sendPushToUser } = require('../services/pushService');

interface MockState {
  /** Appointment ids returned by the affected-appointments SELECT. */
  affectedAppointmentIds: string[];
  /** Rows returned by the appointments→patients join. */
  patientRows: Array<{ appointment_id: string; user_id: string }>;
  flaggedAppointmentIds: string[];
  notifications: Array<{ user_id: string; type: string; related_entity_id: string }>;
  existingUnavailability: any;
  existingBreak: any;
}

function freshState(): MockState {
  return {
    affectedAppointmentIds: [],
    patientRows: [],
    flaggedAppointmentIds: [],
    notifications: [],
    existingUnavailability: null,
    existingBreak: null,
  };
}

let state = freshState();

function clientQuery(sql: string, params: any[] = []) {
  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
    return Promise.resolve({ rows: [] });
  }
  if (sql.includes('FROM doctors WHERE user_id')) {
    return Promise.resolve({ rows: [{ id: DOCTOR_ID }] });
  }
  if (sql.includes('FROM secretaries WHERE user_id')) {
    return Promise.resolve({ rows: [{ doctor_id: DOCTOR_ID }] });
  }
  if (sql.includes('INSERT INTO doctor_unavailability')) {
    return Promise.resolve({
      rows: [{ id: 'exc-new', doctor_id: DOCTOR_ID, start_date: params[1], end_date: params[2], reason: params[3], is_active: true }],
    });
  }
  if (sql.includes('INSERT INTO doctor_break_periods')) {
    return Promise.resolve({
      rows: [{ id: 'brk-new', doctor_id: DOCTOR_ID, break_date: params[1], start_time: params[2], end_time: params[3], reason: params[4], is_active: true }],
    });
  }
  if (sql.includes('UPDATE doctor_unavailability')) {
    return Promise.resolve({
      rows: [{ id: params[3], doctor_id: DOCTOR_ID, start_date: params[0], end_date: params[1], reason: params[2], is_active: true }],
    });
  }
  if (sql.includes('UPDATE doctor_break_periods')) {
    return Promise.resolve({
      rows: [{ id: params[4], doctor_id: DOCTOR_ID, break_date: params[0], start_time: params[1], end_time: params[2], reason: params[3], is_active: true }],
    });
  }
  if (sql.includes('DELETE FROM doctor_unavailability')) {
    return Promise.resolve({ rows: [{ id: params[0] }] });
  }
  if (sql.includes('DELETE FROM doctor_break_periods')) {
    return Promise.resolve({ rows: [{ id: params[0] }] });
  }
  if (sql.includes('SELECT * FROM doctor_unavailability WHERE id')) {
    return Promise.resolve({ rows: state.existingUnavailability ? [state.existingUnavailability] : [] });
  }
  if (sql.includes('SELECT * FROM doctor_break_periods WHERE id')) {
    return Promise.resolve({ rows: state.existingBreak ? [state.existingBreak] : [] });
  }
  // Working-hours lookup for doctor-side break validation
  if (sql.includes('FROM doctor_schedules')) {
    return Promise.resolve({ rows: [{ start_time: '08:00:00', end_time: '17:00:00' }] });
  }
  // Break overlap check (doctor-side validation)
  if (sql.includes('FROM doctor_break_periods') && sql.includes('is_active = true')) {
    return Promise.resolve({ rows: [] });
  }
  // Affected-appointments computation (appointments → patients join)
  if (sql.includes('FROM appointments a') && sql.includes('JOIN patients')) {
    return Promise.resolve({ rows: state.patientRows });
  }
  // Affected-appointments computation (id list)
  if (sql.includes('FROM appointments a')) {
    return Promise.resolve({ rows: state.affectedAppointmentIds.map((id) => ({ id })) });
  }
  // needs_attention flagging
  if (sql.includes('UPDATE appointments') && sql.includes('needs_attention = true')) {
    state.flaggedAppointmentIds.push(...(params[0] as string[]));
    return Promise.resolve({ rows: [] });
  }
  // Notification insert (type is a SQL literal, appointment id is $4)
  if (sql.includes('INSERT INTO notifications')) {
    state.notifications.push({
      user_id: params[0],
      type: 'SCHEDULE_CHANGE_NOTICE',
      related_entity_id: params[3],
    });
    return Promise.resolve({ rows: [] });
  }
  return Promise.resolve({ rows: [] });
}

function buildApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/doctors', doctorsRouter);
  app.use('/api/v1/secretaries', secretariesRouter);
  return app;
}

describe('schedule changes apply immediately and notify affected patients', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp();
    state = freshState();
    mockUser = { id: 'doctor-user-id', role: 'DOCTOR', mustChangePassword: false };
    getClient.mockImplementation(() =>
      Promise.resolve({ query: jest.fn(clientQuery), release: jest.fn() })
    );
    sendPushToUser.mockClear();
  });

  it('doctor exception create affecting appointments returns 201, flags them, and notifies patients', async () => {
    state.affectedAppointmentIds = ['appt-1', 'appt-2'];
    state.patientRows = [
      { appointment_id: 'appt-1', user_id: 'patient-user-1' },
      { appointment_id: 'appt-2', user_id: 'patient-user-2' },
    ];

    const response = await request(app)
      .post('/api/v1/doctors/me/unavailability')
      .send({ startDate: '2026-12-01', endDate: '2026-12-03', reason: 'Conference' });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('exc-new');
    expect(state.flaggedAppointmentIds.sort()).toEqual(['appt-1', 'appt-2']);
    expect(state.notifications).toHaveLength(2);
    expect(state.notifications.every((n) => n.type === 'SCHEDULE_CHANGE_NOTICE')).toBe(true);
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
    expect(sendPushToUser).toHaveBeenCalledWith('patient-user-1', expect.objectContaining({
      data: expect.objectContaining({ type: 'SCHEDULE_CHANGE_NOTICE', appointmentId: 'appt-1' }),
    }));
  });

  it('doctor exception create with no affected appointments notifies nobody', async () => {
    const response = await request(app)
      .post('/api/v1/doctors/me/unavailability')
      .send({ startDate: '2026-12-01', endDate: '2026-12-03' });

    expect(response.status).toBe(201);
    expect(state.flaggedAppointmentIds).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('secretary break-period create affecting appointments applies immediately and notifies', async () => {
    mockUser = { id: 'secretary-user-id', role: 'SECRETARY', mustChangePassword: false };
    state.affectedAppointmentIds = ['appt-9'];
    state.patientRows = [{ appointment_id: 'appt-9', user_id: 'patient-user-9' }];

    const response = await request(app)
      .post('/api/v1/secretaries/managed-doctors/break-periods')
      .send({ breakDate: '2026-12-01', startTime: '12:00', endTime: '13:00' });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('brk-new');
    expect(state.flaggedAppointmentIds).toEqual(['appt-9']);
    expect(state.notifications).toHaveLength(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });

  it('doctor break-period create validates working hours then applies and notifies', async () => {
    state.affectedAppointmentIds = ['appt-5'];
    state.patientRows = [{ appointment_id: 'appt-5', user_id: 'patient-user-5' }];

    const response = await request(app)
      .post('/api/v1/doctors/me/break-periods')
      .send({ breakDate: '2026-12-01', startTime: '12:00', endTime: '13:00' });

    expect(response.status).toBe(201);
    expect(state.flaggedAppointmentIds).toEqual(['appt-5']);
    expect(state.notifications).toHaveLength(1);
  });

  it('doctor exception delete applies immediately without flagging or notifying', async () => {
    state.existingUnavailability = {
      id: 'exc-1',
      doctor_id: DOCTOR_ID,
      start_date: '2026-12-01',
      end_date: '2026-12-02',
      is_active: true,
    };

    const response = await request(app).delete('/api/v1/doctors/me/unavailability/exc-1');

    expect(response.status).toBe(200);
    expect(state.flaggedAppointmentIds).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('doctor exception update notifies only newly affected appointments', async () => {
    state.existingUnavailability = {
      id: 'exc-1',
      doctor_id: DOCTOR_ID,
      start_date: '2026-12-01',
      end_date: '2026-12-02',
      is_active: true,
    };
    state.affectedAppointmentIds = ['appt-new'];
    state.patientRows = [{ appointment_id: 'appt-new', user_id: 'patient-user-new' }];

    const response = await request(app)
      .put('/api/v1/doctors/me/unavailability/exc-1')
      .send({ startDate: '2026-12-05', endDate: '2026-12-06' });

    expect(response.status).toBe(200);
    expect(state.flaggedAppointmentIds).toEqual(['appt-new']);
    expect(state.notifications).toHaveLength(1);
  });
});
