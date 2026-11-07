/**
 * End-to-end tests for the schedule-change confirmation workflow.
 *
 * These tests exercise the full flow over HTTP with a stateful in-memory
 * mock of the database (the same convention as the other API tests in this
 * repo). They cover: proposal → pending request → secretary confirm/dismiss,
 * the eight endpoint families that trigger the pending flow, authorization,
 * double-confirm/confirm-vs-dismiss races, recompute-at-confirm, and
 * stale-target conflicts.
 *
 * LIMITATION: the mock cannot prove real PostgreSQL row-locking semantics.
 * The FOR UPDATE / transaction paths are verified by code inspection and by
 * asserting that the second operation observes the resolved status and is
 * rejected; they are not verified under true concurrent sessions.
 */

import request from 'supertest';
import express from 'express';
import doctorsRouter from './doctors';
import secretariesRouter from './secretaries';
import scheduleChangesRouter from './scheduleChanges';
import appointmentsRouter from './appointments';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../modules/availability/availabilityService', () => ({
  calculateAvailability: jest.fn(),
  calculateAvailabilityRange: jest.fn(),
  invalidateAvailabilityCache: jest.fn(),
}));

jest.mock('../modules/capacity/capacityService', () => ({
  calculateCapacity: jest.fn(),
  calculateCapacityRange: jest.fn(),
  buildCapacityResult: jest.fn(),
}));

jest.mock('../modules/waitlists/waitlistPromotionService', () => ({
  promoteNextPatient: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../modules/queue/queueService', () => ({
  acquireQueueLocks: jest.fn(),
  nextQueueNumber: jest.fn(),
  renumberQueueAfterRemoval: jest.fn(),
}));

jest.mock('../services/pushService', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/storageService', () => ({
  uploadDoctorPhoto: jest.fn(),
  deleteDoctorPhoto: jest.fn(),
  replaceDoctorPhoto: jest.fn(),
  validateImageFile: jest.fn(),
  uploadPaymentReceipt: jest.fn(),
  validatePaymentReceiptFile: jest.fn(),
  generateSignedReceiptUrl: jest.fn(),
  uploadGcashQr: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
  },
  requirePasswordChange: (req: any, res: any, next: any) => next(),
  requireSecretaryPasswordChange: (req: any, res: any, next: any) => next(),
  requireSecretaryProfileCompletion: (req: any, res: any, next: any) => next(),
}));

const { query, getClient } = require('../database/connection');
const { invalidateAvailabilityCache } = require('../modules/availability/availabilityService');
const { sendPushToUser } = require('../services/pushService');
const { acquireQueueLocks } = require('../modules/queue/queueService');

let mockUser: any = { id: 'doctor-user-id', role: 'DOCTOR' };

// ---------------------------------------------------------------------------
// In-memory database
// ---------------------------------------------------------------------------
interface MockDb {
  doctors: Array<any>;
  secretaries: Array<any>;
  patients: Array<any>;
  users: Array<any>;
  doctorSchedules: Array<any>;
  unavailability: Array<any>;
  breakPeriods: Array<any>;
  appointments: Array<any>;
  scheduleChangeRequests: Array<any>;
  notifications: Array<any>;
}

let db: MockDb;
let nextId = 0;
const uid = () => `id-${++nextId}`;

function resetDb() {
  nextId = 0;
  db = {
    doctors: [
      { id: 'doctor-1', user_id: 'doctor-user-id', first_name: 'Ada', last_name: 'Lovelace' },
      { id: 'doctor-2', user_id: 'other-doctor-user-id', first_name: 'Grace', last_name: 'Hopper' },
    ],
    secretaries: [
      { id: 'sec-1', user_id: 'secretary-user-id', doctor_id: 'doctor-1', first_name: 'Sam', last_name: 'Secretary' },
      { id: 'sec-2', user_id: 'other-secretary-user-id', doctor_id: 'doctor-2', first_name: 'Olivia', last_name: 'Other' },
    ],
    patients: [
      { id: 'patient-1', user_id: 'patient-user-1', first_name: 'P1', last_name: 'One' },
      { id: 'patient-2', user_id: 'patient-user-2', first_name: 'P2', last_name: 'Two' },
      { id: 'patient-3', user_id: 'patient-user-3', first_name: 'P3', last_name: 'Three' },
      { id: 'patient-4', user_id: 'patient-user-4', first_name: 'P4', last_name: 'Four' },
    ],
    users: [
      { id: 'doctor-user-id', role: 'DOCTOR' },
      { id: 'other-doctor-user-id', role: 'DOCTOR' },
      { id: 'secretary-user-id', role: 'SECRETARY' },
      { id: 'other-secretary-user-id', role: 'SECRETARY' },
      { id: 'patient-user-1', role: 'PATIENT' },
      { id: 'patient-user-2', role: 'PATIENT' },
      { id: 'patient-user-3', role: 'PATIENT' },
      { id: 'patient-user-4', role: 'PATIENT' },
      { id: 'admin-user-id', role: 'ADMIN' },
    ],
    doctorSchedules: [
      // Friday working hours for doctor-1 (needed by doctor break rules)
      { id: 'sched-1', doctor_id: 'doctor-1', day_of_week: 5, start_time: '08:00', end_time: '17:00', is_active: true },
    ],
    unavailability: [],
    breakPeriods: [],
    appointments: [],
    scheduleChangeRequests: [],
    notifications: [],
  };
}

// ---------------------------------------------------------------------------
// Date helpers (clinic = local time in this mock)
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0');
const toDateOnly = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function nextFridayDate(): string {
  const d = new Date();
  const diff = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return toDateOnly(d);
}

function nextWeekdayDate(weekday: number, weeksAhead = 0): string {
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + weeksAhead * 7);
  return toDateOnly(d);
}

function friday(): string {
  return nextFridayDate();
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toDateOnly(d);
}

function clinicToday(): string {
  return toDateOnly(new Date());
}

function makeAppointment(doctorId: string, patientId: string, dateStr: string, status: string, time?: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  let date: Date;
  if (time) {
    const [hh, mm, ss] = time.split(':').map(Number);
    date = new Date(y, m - 1, d, hh, mm, ss ?? 0);
  } else {
    date = new Date(y, m - 1, d);
  }
  return {
    id: uid(),
    doctor_id: doctorId,
    patient_id: patientId,
    appointment_date: date,
    status,
    needs_attention: false,
    needs_attention_reason: null,
    needs_attention_flagged_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

const ACTIVE = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'];

function dateStrOf(v: any): string {
  if (v instanceof Date) return toDateOnly(v);
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

function timeStrOf(v: any): string {
  if (v instanceof Date) return `${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  const s = String(v);
  const m = s.match(/^(\d{2}):(\d{2})(:(\d{2}))?/);
  if (m) return `${m[1]}:${m[2]}:${m[4] ?? '00'}`;
  return s;
}

function timeMinutes(t: string): number {
  const m = String(t).match(/^(\d{1,2}):(\d{2})(:(\d{2}))?/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function matchesConflict(a: any, changeType: string, p: any): boolean {
  const aDate = dateStrOf(a.appointment_date);
  if (changeType === 'EXCEPTION') {
    const s = dateStrOf(p.startDate);
    const e = dateStrOf(p.endDate);
    return aDate >= s && aDate <= e;
  }
  // BREAK: whole-day for date-only appointments; 30-minute overlap for timed ones
  if (aDate !== dateStrOf(p.breakDate)) return false;
  const t = timeStrOf(a.appointment_date);
  if (t === '00:00:00') return true;
  return timeMinutes(t) < timeMinutes(p.endTime) && timeMinutes(t) + 30 > timeMinutes(p.startTime);
}

// ---------------------------------------------------------------------------
// SQL router
// ---------------------------------------------------------------------------
async function routeQuery(sqlRaw: string, params: any[] = []): Promise<{ rows: any[] }> {
  const sql = sqlRaw.replace(/\s+/g, ' ').trim();

  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) {
    return { rows: [] };
  }

  // ---- doctors / secretaries lookups
  if (sql.includes('SELECT id FROM doctors WHERE user_id')) {
    return { rows: db.doctors.filter((d) => d.user_id === params[0]).map((d) => ({ id: d.id })) };
  }
  if (sql.includes('SELECT doctor_id FROM secretaries WHERE user_id')) {
    return { rows: db.secretaries.filter((s) => s.user_id === params[0]).map((s) => ({ doctor_id: s.doctor_id })) };
  }
  if (/SELECT id FROM doctors WHERE id = \$1 FOR UPDATE/i.test(sql)) {
    return { rows: db.doctors.filter((d) => d.id === params[0]).map((d) => ({ id: d.id })) };
  }
  if (sql.includes('SELECT role FROM users WHERE id')) {
    const u = db.users.find((x) => x.id === params[0]);
    return { rows: u ? [{ role: u.role }] : [] };
  }

  // ---- schedules (working hours for doctor break rules)
  if (sql.includes('FROM doctor_schedules')) {
    const [doctorId, dayOfWeek] = params;
    return { rows: db.doctorSchedules.filter((s) => s.doctor_id === doctorId && s.day_of_week === dayOfWeek && s.is_active) };
  }

  // ---- exception targets
  if (sql.includes('SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2')) {
    return { rows: db.unavailability.filter((r) => r.id === params[0] && r.doctor_id === params[1]) };
  }
  if (sql.includes('INSERT INTO doctor_unavailability')) {
    const [doctorId, startDate, endDate, reason] = params;
    const row = {
      id: uid(),
      doctor_id: doctorId,
      start_date: new Date(`${startDate}T00:00:00`),
      end_date: new Date(`${endDate}T00:00:00`),
      reason: reason ?? null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    db.unavailability.push(row);
    return { rows: [row] };
  }
  if (sql.includes('UPDATE doctor_unavailability')) {
    const [startDate, endDate, reason, id, doctorId] = params;
    const row = db.unavailability.find((r) => r.id === id && r.doctor_id === doctorId);
    if (!row) return { rows: [] };
    row.start_date = new Date(`${startDate}T00:00:00`);
    row.end_date = new Date(`${endDate}T00:00:00`);
    row.reason = reason ?? null;
    row.updated_at = new Date();
    return { rows: [row] };
  }
  if (sql.includes('DELETE FROM doctor_unavailability')) {
    const [id, doctorId] = params;
    const idx = db.unavailability.findIndex((r) => r.id === id && r.doctor_id === doctorId);
    if (idx === -1) return { rows: [] };
    const [removed] = db.unavailability.splice(idx, 1);
    return { rows: [removed] };
  }

  // ---- break period targets (ownership and overlap checks)
  if (sql.includes('SELECT * FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2')) {
    return { rows: db.breakPeriods.filter((r) => r.id === params[0] && r.doctor_id === params[1]) };
  }
  if (sql.includes('FROM doctor_break_periods') && sql.includes('is_active = true') && sql.includes('break_date = $2')) {
    // Overlap check: doctor_id, break_date, startTime, endTime, [excludeId]
    const [doctorId, breakDate, startTime, endTime, excludeId] = params;
    const st = timeMinutes(timeStrOf(`2000-01-01T${startTime}`));
    const et = timeMinutes(timeStrOf(`2000-01-01T${endTime}`));
    const rows = db.breakPeriods.filter((r) => {
      if (r.doctor_id !== doctorId) return false;
      if (dateStrOf(r.break_date) !== dateStrOf(breakDate)) return false;
      if (!r.is_active) return false;
      if (excludeId && r.id === excludeId) return false;
      const rs = timeMinutes(timeStrOf(r.start_time));
      const re = timeMinutes(timeStrOf(r.end_time));
      return (rs < st && re > st) || (rs < et && re > et) || (rs >= st && re <= et);
    });
    return { rows };
  }
  if (sql.includes('INSERT INTO doctor_break_periods')) {
    const [doctorId, breakDate, startTime, endTime, reason] = params;
    const row = {
      id: uid(),
      doctor_id: doctorId,
      break_date: new Date(`${breakDate}T00:00:00`),
      start_time: startTime,
      end_time: endTime,
      reason: reason ?? null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    db.breakPeriods.push(row);
    return { rows: [row] };
  }
  if (sql.includes('UPDATE doctor_break_periods')) {
    const [breakDate, startTime, endTime, reason, id, doctorId] = params;
    const row = db.breakPeriods.find((r) => r.id === id && r.doctor_id === doctorId);
    if (!row) return { rows: [] };
    row.break_date = new Date(`${breakDate}T00:00:00`);
    row.start_time = startTime;
    row.end_time = endTime;
    row.reason = reason ?? null;
    row.updated_at = new Date();
    return { rows: [row] };
  }
  if (sql.includes('DELETE FROM doctor_break_periods')) {
    const [id, doctorId] = params;
    const idx = db.breakPeriods.findIndex((r) => r.id === id && r.doctor_id === doctorId);
    if (idx === -1) return { rows: [] };
    const [removed] = db.breakPeriods.splice(idx, 1);
    return { rows: [removed] };
  }

  // ---- patient lookup for notices (must come before affected-appointments branch)
  if (sql.includes('JOIN patients p ON p.id = a.patient_id')) {
    const [ids] = params;
    const rows = db.appointments
      .filter((a) => ids.includes(a.id))
      .map((a) => {
        const patient = db.patients.find((p) => p.id === a.patient_id);
        return { appointment_id: a.id, user_id: patient?.user_id };
      });
    return { rows };
  }

  // ---- affected appointments (proposal computation and confirm recompute)
  if (sql.includes('SELECT a.id') && !sql.includes('AS appointment_id') && sql.includes('FROM appointments a')) {
    const todayRef = dateStrOf(params[1]);
    if (sql.includes('BETWEEN')) {
      // EXCEPTION branch params: [doctorId, today, startDate, endDate, (snapStart, snapEnd)]
      const [doctorId, , startDate, endDate] = params;
      const prop: any = { changeType: 'EXCEPTION', operation: 'CREATE', startDate, endDate };
      let rows = db.appointments.filter(
        (a) => a.doctor_id === doctorId && ACTIVE.includes(a.status) && dateStrOf(a.appointment_date) >= todayRef
      );
      rows = rows.filter((a) => matchesConflict(a, 'EXCEPTION', prop));
      if (params.length === 6) {
        const [snapStart, snapEnd] = params.slice(4);
        rows = rows.filter((a) => {
          const d = dateStrOf(a.appointment_date);
          return !(d >= dateStrOf(snapStart) && d <= dateStrOf(snapEnd));
        });
      }
      return { rows: rows.map((r) => ({ id: r.id })) };
    }
    // BREAK branch params: [doctorId, today, breakDate, startTime, endTime, (snapDate, snapStart, snapEnd)]
    const [doctorId, , breakDate, startTime, endTime] = params;
    const prop: any = { changeType: 'BREAK', operation: 'CREATE', breakDate, startTime: timeStrOf(startTime), endTime: timeStrOf(endTime) };
    let rows = db.appointments.filter(
      (a) => a.doctor_id === doctorId && ACTIVE.includes(a.status) && dateStrOf(a.appointment_date) >= todayRef
    );
    rows = rows.filter((a) => matchesConflict(a, 'BREAK', prop));
    if (params.length === 8) {
      const [snapDate, snapStartTime, snapEndTime] = params.slice(5);
      rows = rows.filter((a) => !matchesConflict(a, 'BREAK', { breakDate: snapDate, startTime: snapStartTime, endTime: snapEndTime }));
    }
    return { rows: rows.map((r) => ({ id: r.id })) };
  }

  // ---- pending request duplicate check (proposal-time)
  if (sql.includes('FROM schedule_change_requests') && sql.includes("status = 'PENDING'") && sql.includes('change_type') && !sql.includes('FOR UPDATE')) {
    const [doctorId] = params;
    return {
      rows: db.scheduleChangeRequests
        .filter((r) => r.doctor_id === doctorId && r.status === 'PENDING')
        .map((r) => ({ id: r.id, change_type: r.change_type, operation: r.operation, target_id: r.target_id, proposed_payload: r.proposed_payload })),
    };
  }

  // ---- create pending request
  if (sql.includes('INSERT INTO schedule_change_requests')) {
    const [doctorId, requestedBy, changeType, operation, payloadJson, targetId, affectedCount, affectedIds] = params;
    const row = {
      id: uid(),
      doctor_id: doctorId,
      requested_by: requestedBy,
      change_type: changeType,
      operation,
      proposed_payload: payloadJson,
      target_id: targetId ?? null,
      affected_count: affectedCount,
      affected_appointment_ids: affectedIds,
      status: 'PENDING',
      created_at: new Date(),
      updated_at: new Date(),
      resolved_at: null,
      resolved_by: null,
    };
    // Mirror the partial unique index on (target_id) WHERE status = 'PENDING'
    if (targetId && db.scheduleChangeRequests.some((r) => r.target_id === targetId && r.status === 'PENDING')) {
      const err: any = new Error('duplicate key value violates unique constraint "idx_schedule_change_requests_pending_target_id"');
      err.code = '23505';
      throw err;
    }
    db.scheduleChangeRequests.push(row);
    return { rows: [row] };
  }

  // ---- lock request row (confirm/dismiss)
  if (sql.includes('SELECT * FROM schedule_change_requests WHERE id = $1 FOR UPDATE')) {
    return { rows: db.scheduleChangeRequests.filter((r) => r.id === params[0]) };
  }

  // ---- resolve request (confirm/dismiss)
  if (sql.includes("UPDATE schedule_change_requests") && sql.includes("status = 'CONFIRMED'")) {
    const [resolvedBy, id] = params;
    const row = db.scheduleChangeRequests.find((r) => r.id === id && r.status === 'PENDING');
    if (!row) return { rows: [] };
    row.status = 'CONFIRMED';
    row.resolved_at = new Date();
    row.resolved_by = resolvedBy;
    row.updated_at = new Date();
    return { rows: [row] };
  }
  if (sql.includes("UPDATE schedule_change_requests") && sql.includes("status = 'DISMISSED'")) {
    const [resolvedBy, id] = params;
    const row = db.scheduleChangeRequests.find((r) => r.id === id && r.status === 'PENDING');
    if (!row) return { rows: [] };
    row.status = 'DISMISSED';
    row.resolved_at = new Date();
    row.resolved_by = resolvedBy;
    row.updated_at = new Date();
    return { rows: [row] };
  }

  // ---- flag appointments as needing attention
  if (sql.includes('UPDATE appointments') && sql.includes('needs_attention = true')) {
    const [ids] = params;
    for (const a of db.appointments) {
      if (ids.includes(a.id)) {
        a.needs_attention = true;
        a.needs_attention_reason = 'SCHEDULE_CHANGE';
        a.needs_attention_flagged_at = new Date();
        a.updated_at = new Date();
      }
    }
    return { rows: [] };
  }

  // ---- reschedule / cancel handlers below clear the flag on the specific mutations  // ---- notification inserts
  if (sql.includes('INSERT INTO notifications')) {
    const typeMatch = sql.match(/'([A-Z_]+)',/);
    const type = typeMatch ? typeMatch[1] : 'UNKNOWN';
    if (params.length === 4) {
      // (user_id, title, message, related_entity_id) with literal type/entity
      db.notifications.push({
        id: uid(),
        user_id: params[0],
        type,
        title: params[1],
        message: params[2],
        related_entity_type: 'appointment',
        related_entity_id: params[3],
        is_read: false,
        created_at: new Date(),
      });
    } else if (params.length === 3) {
      // (user_id, message, related_entity_id) with literal type/title
      db.notifications.push({
        id: uid(),
        user_id: params[0],
        type,
        title: type === 'APPOINTMENT_CANCELLED' ? 'Appointment Cancelled' : 'Notification',
        message: params[1],
        related_entity_type: 'appointment',
        related_entity_id: params[2],
        is_read: false,
        created_at: new Date(),
      });
    }
    return { rows: [] };
  }

  // ---- patient lookup (cancel / reschedule authorization)
  if (sql.includes('SELECT id FROM patients WHERE user_id')) {
    return {
      rows: db.patients
        .filter((p) => p.user_id === params[0])
        .map((p) => ({ id: p.id })),
    };
  }

  // ---- appointment load for cancel (no doctor join) and reschedule (doctor join)
  if (sql.includes('FROM appointments a') && sql.includes('WHERE a.id = $1')) {
    const row = db.appointments.find((a) => a.id === params[0]);
    if (!row) return { rows: [] };
    const doctor = db.doctors.find((d) => d.id === row.doctor_id);
    return {
      rows: [{
        ...row,
        doctor_first_name: doctor?.first_name,
        doctor_last_name: doctor?.last_name,
        queue_number: null,
        queue_date: null,
        queue_entry_id: null,
        queue_status: null,
        started_at: null,
        practice_name: 'Clinic',
        consultation_fee: 100,
      }],
    };
  }

  // ---- cancel sets CANCELLED and clears the needs-attention flag
  if (sql.includes("UPDATE appointments SET status = 'CANCELLED'")) {
    const row = db.appointments.find((a) => a.id === params[0]);
    if (row) {
      row.status = 'CANCELLED';
      row.updated_at = new Date();
      row.needs_attention = false;
      row.needs_attention_reason = null;
      row.needs_attention_flagged_at = null;
    }
    return { rows: row ? [row] : [] };
  }

  // ---- reschedule moves the date and clears the needs-attention flag
  if (sql.includes('UPDATE appointments SET appointment_date')) {
    const row = db.appointments.find((a) => a.id === params[1]);
    if (row) {
      row.appointment_date = new Date(`${params[0]}T00:00:00`);
      row.updated_at = new Date();
      row.needs_attention = false;
      row.needs_attention_reason = null;
      row.needs_attention_flagged_at = null;
    }
    return { rows: row ? [row] : [] };
  }

  // ---- capacity under lock for the reschedule path
  if (sql.includes('FROM daily_capacities') && sql.includes('FOR UPDATE')) {
    const dates: string[] = params[1];
    return { rows: dates.map((d) => ({ date: d, final_capacity: 10, registered_count: 0 })) };
  }

  // ---- payments lookup for cancel (no payments in these tests)
  if (sql.includes('FROM payments WHERE appointment_id = $1')) {
    return { rows: [] };
  }

  // ---- pending request lists (secretary / doctor)
  if (sql.includes('FROM schedule_change_requests r')) {
    const [doctorId] = params;
    const rows = db.scheduleChangeRequests
      .filter((r) => r.doctor_id === doctorId && r.status === 'PENDING')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((r) => {
        const doctor = db.doctors.find((d) => d.id === r.doctor_id);
        const reqUser = db.users.find((u) => u.id === r.requested_by);
        const reqDoctor = db.doctors.find((d) => d.user_id === r.requested_by);
        const reqSecretary = db.secretaries.find((s) => s.user_id === r.requested_by);
        return {
          ...r,
          doctor_first_name: doctor?.first_name,
          doctor_last_name: doctor?.last_name,
          req_doctor_first_name: reqDoctor?.first_name ?? null,
          req_doctor_last_name: reqDoctor?.last_name ?? null,
          req_secretary_first_name: reqSecretary?.first_name ?? null,
          req_secretary_last_name: reqSecretary?.last_name ?? null,
          requested_by_role: reqUser?.role ?? null,
        };
      });
    return { rows };
  }

  return { rows: [] };
}

function createClient() {
  return {
    query: jest.fn().mockImplementation((sql: string, params?: any[]) => routeQuery(sql, params)),
    release: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetDb();
  mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
  (getClient as jest.Mock).mockImplementation(() => Promise.resolve(createClient()));
  (query as jest.Mock).mockImplementation((sql: string, params?: any[]) => routeQuery(sql, params));
  (acquireQueueLocks as jest.Mock).mockResolvedValue(true);
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/doctors', doctorsRouter);
  app.use('/api/v1/secretaries', secretariesRouter);
  app.use('/api/v1/schedule-changes', scheduleChangesRouter);
  app.use('/api/v1/appointments', appointmentsRouter);
  return app;
}

function seedFridayAppointments(statuses: string[] = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS']) {
  const friday = nextFridayDate();
  const appts = statuses.map((status, i) =>
    makeAppointment('doctor-1', `patient-${i + 1}`, friday, status)
  );
  db.appointments.push(...appts);
  return { friday, appts };
}

function postAsDoctor(app: express.Application, path: string) {
  mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
  return request(app).post(path);
}

// ---------------------------------------------------------------------------
describe('Schedule-change confirmation workflow', () => {
  describe('the acceptance scenario, end to end', () => {
    it('doctor submits Friday leave with 3 active appointments -> PENDING, then secretary confirms', async () => {
      const app = buildApp();
      const { friday, appts } = seedFridayAppointments();

      // Doctor submits the emergency-leave exception
      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Emergency leave' });

      expect(submit.status).toBe(202);
      expect(submit.body.success).toBe(true);
      expect(submit.body.data.status).toBe('PENDING');
      expect(submit.body.data.pending).toBe(true);
      expect(submit.body.data.affectedCount).toBe(3);
      expect(submit.body.data.affectedAppointmentIds.sort()).toEqual(appts.map((a) => a.id).sort());

      // The exception must NOT be in effect yet
      expect(db.unavailability).toHaveLength(0);
      // No notifications on proposal
      expect(db.notifications).toHaveLength(0);
      // Pending request persisted
      expect(db.scheduleChangeRequests).toHaveLength(1);
      expect(db.scheduleChangeRequests[0].status).toBe('PENDING');

      // Secretary sees it in Schedule Alerts
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const list = await request(app).get('/api/v1/schedule-changes');
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      const item = list.body.data[0];
      expect(item.changeType).toBe('EXCEPTION');
      expect(item.operation).toBe('CREATE');
      expect(item.doctor.name).toBe('Ada Lovelace');
      expect(item.affectedCount).toBe(3);
      expect(item.requestedBy.role).toBe('DOCTOR');
      expect(item.proposed.startDate).toBe(friday);
      // No patient personal data in the list payload
      expect(JSON.stringify(item)).not.toContain('P1 One');

      // Secretary confirms
      const confirm = await request(app).post(`/api/v1/schedule-changes/${item.id}/confirm`);
      expect(confirm.status).toBe(200);
      expect(confirm.body.data.status).toBe('CONFIRMED');
      expect(confirm.body.data.notifiedCount).toBe(3);

      // Exception applied
      expect(db.unavailability).toHaveLength(1);
      expect(dateStrOf(db.unavailability[0].start_date)).toBe(friday);

      // Appointments flagged, still active
      for (const a of db.appointments) {
        expect(a.needs_attention).toBe(true);
        expect(a.needs_attention_reason).toBe('SCHEDULE_CHANGE');
        expect(ACTIVE).toContain(a.status);
      }

      // Three SCHEDULE_CHANGE_NOTICE notifications, one per patient, opening the right appointment
      const notices = db.notifications.filter((n) => n.type === 'SCHEDULE_CHANGE_NOTICE');
      expect(notices).toHaveLength(3);
      const notifiedPatients = new Set(notices.map((n) => n.user_id));
      expect(notifiedPatients).toEqual(new Set(['patient-user-1', 'patient-user-2', 'patient-user-3']));
      for (const a of appts) {
        const notice = notices.find((n) => n.related_entity_id === a.id);
        expect(notice).toBeTruthy();
        expect(notice?.related_entity_type).toBe('appointment');
      }

      // Push delivered after commit (best effort), one per affected patient
      expect(sendPushToUser).toHaveBeenCalledTimes(3);
      for (const call of sendPushToUser.mock.calls) {
        expect(call[1].data.type).toBe('SCHEDULE_CHANGE_NOTICE');
        expect(call[1].body).not.toContain('Ada');
      }

      // Availability cache invalidated after the applying confirm
      expect(invalidateAvailabilityCache).toHaveBeenCalled();

      // Request marked CONFIRMED with resolved_by the confirming secretary
      const resolved = db.scheduleChangeRequests[0];
      expect(resolved.status).toBe('CONFIRMED');
      expect(resolved.resolved_by).toBe('secretary-user-id');
      expect(resolved.resolved_at).toBeTruthy();
    });
  });

  describe('dismiss flow', () => {
    it('leaves the schedule unchanged, flags nothing, notifies no one, and marks the request DISMISSED', async () => {
      const app = buildApp();
      const { friday } = seedFridayAppointments();

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Emergency leave' });
      expect(submit.status).toBe(202);
      const requestId = submit.body.data.id;

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const dismiss = await request(app).post(`/api/v1/schedule-changes/${requestId}/dismiss`);
      expect(dismiss.status).toBe(200);
      expect(dismiss.body.data.status).toBe('DISMISSED');

      expect(db.unavailability).toHaveLength(0);
      expect(db.notifications).toHaveLength(0);
      expect(sendPushToUser).not.toHaveBeenCalled();
      for (const a of db.appointments) {
        expect(a.needs_attention).toBe(false);
        expect(ACTIVE).toContain(a.status);
      }

      const resolved = db.scheduleChangeRequests.find((r) => r.id === requestId);
      expect(resolved.status).toBe('DISMISSED');
      expect(resolved.resolved_by).toBe('secretary-user-id');
      expect(resolved.resolved_at).toBeTruthy();

      // Dismiss never invalidates availability (nothing changed) — and confirm after dismiss is rejected
      const confirmAfterDismiss = await request(app).post(`/api/v1/schedule-changes/${requestId}/confirm`);
      expect(confirmAfterDismiss.status).toBe(409);
    });
  });

  describe('change with no affected appointments applies immediately', () => {
    it('doctor creates an exception with no appointments -> 201 applied, no pending request', async () => {
      const app = buildApp();
      const friday = nextFridayDate();

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Clinic closure' });

      expect(submit.status).toBe(201);
      expect(submit.body.data.doctor_id).toBe('doctor-1');
      expect(db.unavailability).toHaveLength(1);
      expect(db.scheduleChangeRequests).toHaveLength(0);
      expect(db.notifications).toHaveLength(0);
    });
  });

  describe('inactive and past appointments are not counted or flagged', () => {
    it('cancelled, completed, no-show and past appointments are excluded from the affected set', async () => {
      const app = buildApp();
      const friday = nextFridayDate();

      const past = pastDate(2);
      db.appointments.push(
        makeAppointment('doctor-1', 'patient-1', past, 'SCHEDULED'),      // past
        makeAppointment('doctor-1', 'patient-2', friday, 'CANCELLED'),     // cancelled
        makeAppointment('doctor-1', 'patient-3', friday, 'COMPLETED'),     // completed
        makeAppointment('doctor-1', 'patient-4', friday, 'NO_SHOW'),       // no-show
        makeAppointment('doctor-1', 'patient-1', friday, 'CONFIRMED'),     // affected
      );

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: past, endDate: friday, reason: 'Leave' });

      expect(submit.status).toBe(202);
      expect(submit.body.data.affectedCount).toBe(1);
    });

    it('same-day appointments count as affected at the midnight boundary', async () => {
      const app = buildApp();
      const today = clinicToday();
      // Midnight appointment for today: date-only storage must count as future
      db.appointments.push(
        makeAppointment('doctor-1', 'patient-1', today, 'SCHEDULED'),
        makeAppointment('doctor-1', 'patient-2', today, 'SCHEDULED', '00:00:00'),
      );

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: today, endDate: today, reason: 'Same-day leave' });

      expect(submit.status).toBe(202);
      expect(submit.body.data.affectedCount).toBe(2);
    });
  });

  describe('all endpoint families trigger the pending flow', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars

    it('doctor POST /me/unavailability applies immediately when no appointments are affected', async () => {
      const app = buildApp();
      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday(), endDate: friday(), reason: 'x' });
      expect(submit.status).toBe(201);
    });

    it('doctor POST /me/unavailability creates a PENDING request when appointments are affected', async () => {
      const app = buildApp();
      seedFridayAppointments(['SCHEDULED']);
      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday(), endDate: friday(), reason: 'x' });
      expect(submit.status).toBe(202);
    });

    it('doctor PUT /me/unavailability: reason-only change applies immediately', async () => {
      const app = buildApp();
      const f = friday();
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(`${f}T00:00:00`), end_date: new Date(`${f}T00:00:00`),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED'));

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      const res = await request(app).put('/api/v1/doctors/me/unavailability/u-1')
        .send({ startDate: f, endDate: f, reason: 'new reason' });

      expect(res.status).toBe(200);
      expect(db.unavailability[0].reason).toBe('new reason');
      expect(db.scheduleChangeRequests).toHaveLength(0);
    });

    it('doctor PUT /me/unavailability: widening the range into booked dates creates a PENDING request', async () => {
      const app = buildApp();
      const f = friday();
      const later = nextWeekdayDate(5, 1); // next Friday
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(`${f}T00:00:00`), end_date: new Date(`${f}T00:00:00`),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', later, 'SCHEDULED'));

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      const res = await request(app).put('/api/v1/doctors/me/unavailability/u-1')
        .send({ startDate: f, endDate: later, reason: 'old' });

      expect(res.status).toBe(202);
      expect(res.body.data.operation).toBe('UPDATE');
      expect(res.body.data.affectedCount).toBe(1);
    });

    it('doctor DELETE /me/unavailability applies immediately and creates no request', async () => {
      const app = buildApp();
      const f = friday();
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(`${f}T00:00:00`), end_date: new Date(`${f}T00:00:00`),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED'));

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      const res = await request(app).delete('/api/v1/doctors/me/unavailability/u-1');

      expect(res.status).toBe(200);
      expect(db.unavailability).toHaveLength(0);
      expect(db.scheduleChangeRequests).toHaveLength(0);
      expect(db.appointments[0].needs_attention).toBe(false);
    });

    it('secretary POST /managed-doctors/unavailability creates a PENDING request when appointments are affected', async () => {
      const app = buildApp();
      seedFridayAppointments(['SCHEDULED']);

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const res = await request(app).post('/api/v1/secretaries/managed-doctors/unavailability')
        .send({ startDate: friday(), endDate: friday(), reason: 'Leave' });

      expect(res.status).toBe(202);
      expect(res.body.data.affectedCount).toBe(1);
    });

    it('secretary POST /managed-doctors/unavailability applies immediately when no appointments are affected', async () => {
      const app = buildApp();
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const res = await request(app).post('/api/v1/secretaries/managed-doctors/unavailability')
        .send({ startDate: friday(), endDate: friday(), reason: 'Leave' });

      expect(res.status).toBe(201);
      expect(db.unavailability).toHaveLength(1);
    });

    it('secretary PUT /managed-doctors/unavailability creates a PENDING request when the range widens', async () => {
      const app = buildApp();
      const f = friday();
      const later = nextWeekdayDate(5, 1);
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(`${f}T00:00:00`), end_date: new Date(`${f}T00:00:00`),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', later, 'SCHEDULED'));

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const res = await request(app).put('/api/v1/secretaries/managed-doctors/unavailability/u-1')
        .send({ startDate: f, endDate: later, reason: 'old' });

      expect(res.status).toBe(202);
    });

    it('secretary DELETE /managed-doctors/unavailability applies immediately and creates no request', async () => {
      const app = buildApp();
      const f = friday();
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(`${f}T00:00:00`), end_date: new Date(`${f}T00:00:00`),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED'));

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const res = await request(app).delete('/api/v1/secretaries/managed-doctors/unavailability/u-1');

      expect(res.status).toBe(200);
      expect(db.unavailability).toHaveLength(0);
      expect(db.scheduleChangeRequests).toHaveLength(0);
    });

    it('doctor POST /me/break-periods creates a PENDING request when appointments are affected (timed overlap)', async () => {
      const app = buildApp();
      const f = friday();
      // Timed appointment overlapping the break
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED', '12:15:00'));

      const res = await postAsDoctor(app, '/api/v1/doctors/me/break-periods')
        .send({ breakDate: f, startTime: '12:00', endTime: '13:00', reason: 'Lunch' });

      expect(res.status).toBe(202);
      expect(res.body.data.changeType).toBe('BREAK');
    });

    it('doctor POST /me/break-periods: date-only appointments on the break date are affected (whole-day)', async () => {
      const app = buildApp();
      const f = friday();
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED'));

      const res = await postAsDoctor(app, '/api/v1/doctors/me/break-periods')
        .send({ breakDate: f, startTime: '12:00', endTime: '13:00', reason: 'Lunch' });

      expect(res.status).toBe(202);
      expect(res.body.data.affectedCount).toBe(1);
    });

    it('doctor POST /me/break-periods: a timed appointment outside the break window is not affected', async () => {
      const app = buildApp();
      const f = friday();
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED', '14:30:00'));

      const res = await postAsDoctor(app, '/api/v1/doctors/me/break-periods')
        .send({ breakDate: f, startTime: '12:00', endTime: '13:00', reason: 'Lunch' });

      expect(res.status).toBe(201);
      expect(db.breakPeriods).toHaveLength(1);
    });

    it('doctor PUT /me/break-periods creates a PENDING request when the window widens into appointment time', async () => {
      const app = buildApp();
      const f = friday();
      db.breakPeriods.push({
        id: 'b-1', doctor_id: 'doctor-1',
        break_date: new Date(`${f}T00:00:00`),
        start_time: '12:00', end_time: '12:30',
        reason: 'Short', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED', '12:45:00'));

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      const put = await request(app).put('/api/v1/doctors/me/break-periods/b-1')
        .send({ breakDate: f, startTime: '12:00', endTime: '13:00', reason: 'Short' });

      expect(put.status).toBe(202);
      expect(put.body.data.operation).toBe('UPDATE');
    });

    it('doctor DELETE /me/break-periods applies immediately', async () => {
      const app = buildApp();
      const f = friday();
      db.breakPeriods.push({
        id: 'b-1', doctor_id: 'doctor-1',
        break_date: new Date(`${f}T00:00:00`),
        start_time: '12:00', end_time: '13:00',
        reason: 'x', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED'));

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      const res = await request(app).delete('/api/v1/doctors/me/break-periods/b-1');

      expect(res.status).toBe(200);
      expect(db.breakPeriods).toHaveLength(0);
      expect(db.scheduleChangeRequests).toHaveLength(0);
    });

    it('secretary POST /managed-doctors/break-periods creates a PENDING request when appointments are affected', async () => {
      const app = buildApp();
      const f = friday();
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED'));

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const res = await request(app).post('/api/v1/secretaries/managed-doctors/break-periods')
        .send({ breakDate: f, startTime: '12:00', endTime: '13:00', reason: 'Lunch' });

      expect(res.status).toBe(202);
      expect(res.body.data.affectedCount).toBe(1);
    });

    it('secretary POST /managed-doctors/break-periods applies immediately when no appointments are affected', async () => {
      const app = buildApp();
      const f = friday();
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const res = await request(app).post('/api/v1/secretaries/managed-doctors/break-periods')
        .send({ breakDate: f, startTime: '12:00', endTime: '13:00', reason: 'Lunch' });

      expect(res.status).toBe(201);
    });

    it('secretary PUT /managed-doctors/break-periods creates a PENDING request when the window widens', async () => {
      const app = buildApp();
      const f = friday();
      db.breakPeriods.push({
        id: 'b-1', doctor_id: 'doctor-1',
        break_date: new Date(`${f}T00:00:00`),
        start_time: '12:00', end_time: '12:30',
        reason: 'x', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', f, 'SCHEDULED', '12:45:00'));

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const put = await request(app).put('/api/v1/secretaries/managed-doctors/break-periods/b-1')
        .send({ breakDate: f, startTime: '12:00', endTime: '13:00', reason: 'x' });

      expect(put.status).toBe(202);
    });

    it('secretary DELETE /managed-doctors/break-periods applies immediately and creates no request', async () => {
      const app = buildApp();
      const f = friday();
      db.breakPeriods.push({
        id: 'b-1', doctor_id: 'doctor-1',
        break_date: new Date(`${f}T00:00:00`),
        start_time: '12:00', end_time: '13:00',
        reason: 'x', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const res = await request(app).delete('/api/v1/secretaries/managed-doctors/break-periods/b-1');

      expect(res.status).toBe(200);
      expect(db.breakPeriods).toHaveLength(0);
    });

    it('confirm apply path works for a DELETE request inserted directly', async () => {
      const app = buildApp();
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(), end_date: new Date(),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.scheduleChangeRequests.push({
        id: 'req-del-1',
        doctor_id: 'doctor-1',
        requested_by: 'doctor-user-id',
        change_type: 'EXCEPTION',
        operation: 'DELETE',
        proposed_payload: JSON.stringify({
          startDate: '', endDate: '', reason: null, targetId: 'u-1',
          targetSnapshot: {
            start_date: dateStrOf(db.unavailability[0].start_date),
            end_date: dateStrOf(db.unavailability[0].end_date),
            is_active: true,
          },
        }),
        target_id: 'u-1',
        affected_count: 0,
        affected_appointment_ids: [],
        status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
        resolved_at: null,
        resolved_by: null,
      });

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const res = await request(app).post('/api/v1/schedule-changes/req-del-1/confirm');

      expect(res.status).toBe(200);
      expect(db.unavailability).toHaveLength(0);
      expect(db.scheduleChangeRequests.find((r) => r.id === 'req-del-1')?.status).toBe('CONFIRMED');
    });
  });

  describe('duplicate pending requests are rejected', () => {
    it('an identical pending exception blocks a second identical submission', async () => {
      const app = buildApp();
      const f = friday();
      seedFridayAppointments(['SCHEDULED']);

      const first = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: f, endDate: f, reason: 'Leave' });
      expect(first.status).toBe(202);

      const second = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: f, endDate: f, reason: 'Leave' });
      expect(second.status).toBe(409);
    });

    it('overlapping pending requests for the same doctor are rejected', async () => {
      const app = buildApp();
      const f = friday();
      seedFridayAppointments(['SCHEDULED']);

      const first = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: f, endDate: f, reason: 'Leave' });
      expect(first.status).toBe(202);

      const later = nextWeekdayDate(5, 1);
      const second = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: f, endDate: later, reason: 'Leave' });
      expect(second.status).toBe(409);
    });

    it('a second pending request for the same target record (UPDATE) is rejected', async () => {
      const app = buildApp();
      const f = friday();
      const later = nextWeekdayDate(5, 1);
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(`${f}T00:00:00`), end_date: new Date(`${f}T00:00:00`),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', later, 'SCHEDULED'));

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      const first = await request(app).put('/api/v1/doctors/me/unavailability/u-1')
        .send({ startDate: f, endDate: later, reason: 'old' });
      expect(first.status).toBe(202);

      const second = await request(app).put('/api/v1/doctors/me/unavailability/u-1')
        .send({ startDate: f, endDate: later, reason: 'old2' });
      expect(second.status).toBe(409);
    });
  });

  describe('authorization', () => {
    async function submitPending(app: express.Application) {
      const f = friday();
      seedFridayAppointments(['SCHEDULED']);
      const res = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: f, endDate: f, reason: 'Leave' });
      return res.body.data.id as string;
    }

    it('doctor cannot confirm or dismiss', async () => {
      const app = buildApp();
      const id = await submitPending(app);
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      expect((await request(app).post(`/api/v1/schedule-changes/${id}/confirm`)).status).toBe(403);
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/dismiss`)).status).toBe(403);
    });

    it('patient cannot confirm or dismiss', async () => {
      const app = buildApp();
      const id = await submitPending(app);
      mockUser = { id: 'patient-user-1', role: 'PATIENT' };

      expect((await request(app).post(`/api/v1/schedule-changes/${id}/confirm`)).status).toBe(403);
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/dismiss`)).status).toBe(403);
    });

    it('admin cannot confirm or dismiss or list', async () => {
      const app = buildApp();
      const id = await submitPending(app);
      mockUser = { id: 'admin-user-id', role: 'ADMIN' };

      expect((await request(app).post(`/api/v1/schedule-changes/${id}/confirm`)).status).toBe(403);
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/dismiss`)).status).toBe(403);
      expect((await request(app).get('/api/v1/schedule-changes')).status).toBe(403);
    });

    it('a secretary of a different doctor cannot see or act on the request', async () => {
      const app = buildApp();
      const id = await submitPending(app);

      mockUser = { id: 'other-secretary-user-id', role: 'SECRETARY' };
      expect((await request(app).get('/api/v1/schedule-changes')).body.data).toHaveLength(0);
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/confirm`)).status).toBe(403);
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/dismiss`)).status).toBe(403);
    });

    it('a doctor cannot list the secretary-only pending list; doctor read-only list works', async () => {
      const app = buildApp();
      await submitPending(app);

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      expect((await request(app).get('/api/v1/schedule-changes')).status).toBe(403);

      const mine = await request(app).get('/api/v1/doctors/me/schedule-change-requests');
      expect(mine.status).toBe(200);
      expect(mine.body.data).toHaveLength(1);
      expect(mine.body.data[0].changeType).toBe('EXCEPTION');
    });
  });

  describe('idempotency and races', () => {
    it('double confirm: the second confirm is rejected and nothing is applied or notified twice', async () => {
      const app = buildApp();
      const { friday } = seedFridayAppointments(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS']);

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Leave' });
      const id = submit.body.data.id;

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const first = await request(app).post(`/api/v1/schedule-changes/${id}/confirm`);
      expect(first.status).toBe(200);

      const second = await request(app).post(`/api/v1/schedule-changes/${id}/confirm`);
      expect(second.status).toBe(409);

      expect(db.unavailability).toHaveLength(1);
      expect(db.notifications.filter((n) => n.type === 'SCHEDULE_CHANGE_NOTICE')).toHaveLength(3);
      expect(sendPushToUser).toHaveBeenCalledTimes(3);
    });

    it('dismiss after confirm is rejected', async () => {
      const app = buildApp();
      const { friday } = seedFridayAppointments(['SCHEDULED']);

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Leave' });
      const id = submit.body.data.id;

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/confirm`)).status).toBe(200);
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/dismiss`)).status).toBe(409);
    });

    it('confirm after dismiss is rejected', async () => {
      const app = buildApp();
      const { friday } = seedFridayAppointments(['SCHEDULED']);

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Leave' });
      const id = submit.body.data.id;

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/dismiss`)).status).toBe(200);
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/confirm`)).status).toBe(409);

      // Schedule unchanged, no notifications
      expect(db.unavailability).toHaveLength(0);
      expect(db.notifications).toHaveLength(0);
    });

    it('double dismiss is rejected', async () => {
      const app = buildApp();
      const { friday } = seedFridayAppointments(['SCHEDULED']);

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Leave' });
      const id = submit.body.data.id;

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/dismiss`)).status).toBe(200);
      expect((await request(app).post(`/api/v1/schedule-changes/${id}/dismiss`)).status).toBe(409);
    });
  });

  describe('recompute at confirm time', () => {
    it('one appointment cancelled and one newly booked since the request: the confirm flags the current set', async () => {
      const app = buildApp();
      const { friday, appts } = seedFridayAppointments(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS']);

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Leave' });
      const id = submit.body.data.id;

      // One of the three appointments is cancelled meanwhile
      db.appointments[0].status = 'CANCELLED';
      // A new appointment is booked for the same Friday meanwhile
      const newBooked = makeAppointment('doctor-1', 'patient-4', friday, 'SCHEDULED');
      db.appointments.push(newBooked);

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const confirm = await request(app).post(`/api/v1/schedule-changes/${id}/confirm`);
      expect(confirm.status).toBe(200);

      const flagged = db.appointments.filter((a) => a.needs_attention).map((a) => a.id);
      expect(flagged.sort()).toEqual([appts[1].id, appts[2].id, newBooked.id].sort());

      // Exactly the currently active future appointments are notified
      const notified = db.notifications.filter((n) => n.type === 'SCHEDULE_CHANGE_NOTICE');
      expect(notified.map((n) => n.related_entity_id).sort()).toEqual(flagged.sort());
    });
  });

  describe('stale target at confirm time', () => {
    it('target deleted meanwhile: 409, request stays PENDING, nothing applied', async () => {
      const app = buildApp();
      const f = friday();
      const later = nextWeekdayDate(5, 1);
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(`${f}T00:00:00`), end_date: new Date(`${f}T00:00:00`),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', later, 'SCHEDULED'));

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      const res = await request(app).put('/api/v1/doctors/me/unavailability/u-1')
        .send({ startDate: f, endDate: later, reason: 'old' });
      expect(res.status).toBe(202);
      const id = res.body.data.id;

      // Target record is deleted meanwhile
      db.unavailability.splice(0, 1);

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const confirm = await request(app).post(`/api/v1/schedule-changes/${id}/confirm`);
      expect(confirm.status).toBe(409);

      const request_ = db.scheduleChangeRequests.find((r) => r.id === id);
      expect(request_?.status).toBe('PENDING');
      for (const a of db.appointments) expect(a.needs_attention).toBe(false);
      expect(db.notifications).toHaveLength(0);
    });

    it('target modified meanwhile (range changed directly): 409, request stays PENDING', async () => {
      const app = buildApp();
      const f = friday();
      const later = nextWeekdayDate(5, 1);
      db.unavailability.push({
        id: 'u-1', doctor_id: 'doctor-1',
        start_date: new Date(`${f}T00:00:00`), end_date: new Date(`${f}T00:00:00`),
        reason: 'old', is_active: true, created_at: new Date(), updated_at: new Date(),
      });
      db.appointments.push(makeAppointment('doctor-1', 'patient-1', later, 'SCHEDULED'));

      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      const res = await request(app).put('/api/v1/doctors/me/unavailability/u-1')
        .send({ startDate: f, endDate: later, reason: 'old' });
      expect(res.status).toBe(202);
      const id = res.body.data.id;

      // Target edited directly meanwhile (as the endpoints allow when it affects nothing)
      db.unavailability[0].start_date = new Date(`${nextWeekdayDate(1)}T00:00:00`);
      db.unavailability[0].updated_at = new Date();

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      const confirm = await request(app).post(`/api/v1/schedule-changes/${id}/confirm`);
      expect(confirm.status).toBe(409);

      const request_ = db.scheduleChangeRequests.find((r) => r.id === id);
      expect(request_?.status).toBe('PENDING');
      expect(db.unavailability[0].start_date.getTime()).toBe(new Date(`${nextWeekdayDate(1)}T00:00:00`).getTime());
      for (const a of db.appointments) expect(a.needs_attention).toBe(false);
      expect(db.notifications).toHaveLength(0);
    });
  });

  describe('needs-attention clearing on cancel and reschedule', () => {
    it('flagged appointment cancelled via the cancel endpoint -> flag cleared', async () => {
      const app = buildApp();
      const { friday } = seedFridayAppointments(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS']);

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: friday, endDate: friday, reason: 'Leave' });
      const id = submit.body.data.id;

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      await request(app).post(`/api/v1/schedule-changes/${id}/confirm`);
      expect(db.appointments[0].needs_attention).toBe(true);

      // The flagged appointment's patient cancels through the patient cancel endpoint
      mockUser = { id: 'patient-user-1', role: 'PATIENT' };
      const cancel = await request(app)
        .patch(`/api/v1/appointments/${db.appointments[0].id}/cancel`);
      expect(cancel.status).toBe(200);

      const cancelled = db.appointments[0];
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.needs_attention).toBe(false);
      expect(cancelled.needs_attention_reason).toBeNull();
      expect(cancelled.needs_attention_flagged_at).toBeNull();
    });

    it('flagged appointment rescheduled -> flag cleared', async () => {
      const { calculateAvailability } = require('../modules/availability/availabilityService');
      (calculateAvailability as jest.Mock).mockResolvedValue({ status: 'AVAILABLE' });
      const { acquireQueueLocks } = require('../modules/queue/queueService');
      (acquireQueueLocks as jest.Mock).mockResolvedValue(true);

      const app = buildApp();
      const { appts } = seedFridayAppointments(['SCHEDULED']);

      const submit = await postAsDoctor(app, '/api/v1/doctors/me/unavailability')
        .send({ startDate: nextFridayDate(), endDate: nextFridayDate(), reason: 'Leave' });
      const id = submit.body.data.id;

      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };
      await request(app).post(`/api/v1/schedule-changes/${id}/confirm`);
      expect(appts[0].needs_attention).toBe(true);

      const newDate = nextWeekdayDate(5, 1);
      mockUser = { id: 'patient-user-1', role: 'PATIENT' };
      const res = await request(app)
        .patch(`/api/v1/appointments/${appts[0].id}/reschedule`)
        .send({ newAppointmentDate: newDate });

      expect(res.status).toBe(200);
      expect(appts[0].needs_attention).toBe(false);
      expect(appts[0].needs_attention_reason).toBeNull();
    });
  });
});
