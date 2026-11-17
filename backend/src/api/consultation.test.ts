/**
 * Consultation workspace tests.
 *
 * These exercise the doctor consultation endpoints against an in-memory fake of
 * the small subset of SQL the router issues. That keeps the tests deterministic
 * while still proving the draft, concurrency, lifecycle, and permission rules
 * (not only that a SQL string was produced).
 */

import request from 'supertest';
import express from 'express';
import consultationRouter from './consultation';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/pushService', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  NotificationTypes: {
    PRESCRIPTION_AVAILABLE: 'PRESCRIPTION_AVAILABLE',
    PRESCRIPTION_UPDATED: 'PRESCRIPTION_UPDATED',
  },
}));

jest.mock('../services/prescriptionPdfService', () => ({
  generatePrescriptionPdfFile: jest.fn().mockResolvedValue({ success: true }),
}));

let mockUser = { id: 'user-doc', role: 'DOCTOR' };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  },
}));

const { query, getClient } = require('../database/connection');
const { createNotification } = require('./notifications');
const { generatePrescriptionPdfFile } = require('../services/prescriptionPdfService');

type AnyRow = Record<string, any>;

let db: {
  doctors: AnyRow[];
  patients: AnyRow[];
  users: AnyRow[];
  appointments: AnyRow[];
  queueEntries: AnyRow[];
  visits: AnyRow[];
  prescriptions: AnyRow[];
  items: AnyRow[];
  history: AnyRow[];
  favorites: AnyRow[];
};

let sequence = 0;

const nextId = (prefix: string) => `${prefix}-${++sequence}`;

const visitByAppointment = (appointmentId: string) =>
  db.visits.find((visit) => visit.appointment_id === appointmentId);

const visitById = (id: string) => db.visits.find((visit) => visit.id === id);

const appointmentById = (id: string) => db.appointments.find((appointment) => appointment.id === id);

const latestQueue = (appointmentId: string) =>
  db.queueEntries.filter((entry) => entry.appointment_id === appointmentId).slice(-1)[0];

const paramFromWhere = (sql: string, params: any[], fallbackIndex = 1) => {
  const match = sql.match(/where id = \$(\d+)/i);
  if (match) return params[Number(match[1]) - 1];
  return params[fallbackIndex - 1];
};

const applySetClause = (target: AnyRow, sql: string, params: any[]) => {
  const match = sql.match(/\bset\b([\s\S]*?)\bwhere\b/i);
  if (!match) return;
  const parts = match[1].split(/,\s*(?=[a-z_]+\s*=)/i);
  const seenColumns = new Set<string>();
  for (const part of parts) {
    const assignment = part.match(/^\s*([a-z_]+)\s*=\s*([\s\S]+)$/i);
    if (!assignment) continue;
    const column = assignment[1];
    const expression = assignment[2].trim();

    // Match PostgreSQL, which rejects the same column appearing twice in SET.
    if (seenColumns.has(column)) {
      throw new Error(`multiple assignments to same column "${column}"`);
    }
    seenColumns.add(column);

    if (expression.startsWith('$')) {
      const index = Number(expression.slice(1).split(/[^0-9]/)[0]);
      let value = params[index - 1];
      if (expression.includes('::jsonb') && typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          /* keep the raw string */
        }
      }
      target[column] = value;
    } else if (/^current_timestamp$/i.test(expression)) {
      target[column] = new Date().toISOString();
    } else if (/^null$/i.test(expression)) {
      target[column] = null;
    } else if (expression.startsWith("'") && expression.endsWith("'")) {
      target[column] = expression.slice(1, -1);
    }
  }
};

const withHasPdf = (prescription: AnyRow) => ({
  ...prescription,
  has_pdf: Boolean(prescription.pdf_url),
  items: db.items.filter((item) => item.prescription_id === prescription.id),
});

async function runQuery(rawSql: string, rawParams: any[] = []): Promise<{ rows: AnyRow[]; rowCount?: number }> {
  const sql = rawSql.replace(/\s+/g, ' ').trim();
  const lowered = sql.toLowerCase();
  const params = rawParams || [];

  // Resolve the authenticated doctor.
  if (lowered.includes('from doctors where user_id')) {
    const doctor = db.doctors.find((entry) => entry.user_id === params[0]);
    return { rows: doctor ? [{ id: doctor.id }] : [] };
  }

  // Doctor-patient access check.
  if (lowered.includes('from patients p where p.id = $1') && lowered.includes('patient_doctor_associations')) {
    const patient = db.patients.find((entry) => entry.id === params[0]);
    if (!patient) return { rows: [] };
    const hasAccess = db.appointments.some(
      (appointment) => appointment.patient_id === patient.id && appointment.doctor_id === params[1]
    );
    return { rows: hasAccess ? [{ '?column?': 1 }] : [] };
  }

  // Consultation context (joined appointment row).
  if (lowered.includes('from appointments a') && lowered.includes('join patients p') && lowered.includes('join users u')) {
    const appointment = db.appointments.find(
      (entry) => entry.id === params[0] && entry.doctor_id === params[1]
    );
    if (!appointment) return { rows: [] };
    const patient = db.patients.find((entry) => entry.id === appointment.patient_id)!;
    const user = db.users.find((entry) => entry.id === patient.user_id);
    const doctor = db.doctors.find((entry) => entry.id === appointment.doctor_id);
    return {
      rows: [{
        ...appointment,
        patient_id: patient.id,
        patient_first_name: patient.first_name,
        patient_middle_name: patient.middle_name,
        patient_last_name: patient.last_name,
        date_of_birth: patient.date_of_birth,
        sex: patient.sex,
        patient_phone: patient.phone,
        patient_address: patient.address,
        allergies: patient.allergies,
        allergies_confirmed_none: patient.allergies_confirmed_none,
        current_medications: patient.current_medications,
        medications_confirmed_none: patient.medications_confirmed_none,
        medical_history: patient.medical_history,
        patient_email: user?.email,
        prc_license_number: doctor?.prc_license_number,
        practice_name: doctor?.practice_name,
        specialty: doctor?.specialty,
      }],
    };
  }

  // Start consultation: appointment ownership.
  if (lowered.startsWith('select * from appointments where id = $1 and doctor_id = $2')) {
    const appointment = db.appointments.find(
      (entry) => entry.id === params[0] && entry.doctor_id === params[1]
    );
    return { rows: appointment ? [{ ...appointment }] : [] };
  }

  // Start consultation: queue state.
  if (lowered.startsWith('select status from queue_entries')) {
    const entry = latestQueue(params[0]);
    return { rows: entry ? [{ status: entry.status }] : [] };
  }

  // Consultation context: queue entry.
  if (lowered.includes('from queue_entries') && lowered.includes('where appointment_id = $1') && lowered.includes('order by created_at desc')) {
    const entry = latestQueue(params[0]);
    return { rows: entry ? [{ ...entry }] : [] };
  }

  // Visit lookup by appointment (context and start).
  if (lowered.startsWith('select * from visits where appointment_id = $1')) {
    const visit = visitByAppointment(params[0]);
    return { rows: visit ? [{ ...visit }] : [] };
  }

  // Draft/issue lookup with appointment status.
  if (lowered.includes('from visits v') && lowered.includes('join appointments a')) {
    const visit = visitById(params[0]);
    if (!visit || visit.doctor_id !== params[1]) return { rows: [] };
    const appointment = appointmentById(visit.appointment_id);
    return {
      rows: [{
        ...visit,
        appointment_status: appointment?.status,
        appointment_date: appointment?.appointment_date,
      }],
    };
  }

  // Transaction lock on a visit.
  if (lowered.includes('from visits where id = $1 and doctor_id = $2 for update')) {
    const visit = visitById(params[0]);
    return { rows: visit && visit.doctor_id === params[1] ? [{ ...visit }] : [] };
  }

  // Visit by id (final issue response).
  if (lowered.startsWith('select * from visits where id = $1')) {
    const visit = visitById(params[0]);
    return { rows: visit ? [{ ...visit }] : [] };
  }

  // Start consultation insert.
  if (lowered.startsWith('insert into visits') && lowered.includes('on conflict (appointment_id)')) {
    const appointmentId = params[0];
    if (visitByAppointment(appointmentId)) return { rows: [] };
    const visit = {
      id: nextId('visit'),
      appointment_id: appointmentId,
      patient_id: params[1],
      doctor_id: params[2],
      visit_date: new Date().toISOString(),
      reason_for_visit: params[3],
      diagnosis: null,
      notes: null,
      blood_pressure: null,
      weight: null,
      height: null,
      temperature: null,
      status: 'DRAFT',
      prescription_draft: JSON.parse(params[4]),
      draft_updated_at: new Date().toISOString(),
      issued_at: null,
      doctor_finished_at: null,
      is_edited: false,
      edited_at: null,
    };
    db.visits.push(visit);
    return { rows: [{ ...visit }] };
  }

  // Draft autosave / issue visit update.
  if (lowered.startsWith('update visits set')) {
    const id = paramFromWhere(sql, params);
    const visit = visitById(id);
    if (!visit) return { rows: [] };
    applySetClause(visit, sql, params);
    return { rows: [{ ...visit }] };
  }

  // Visit edit history insert.
  if (lowered.startsWith('insert into visit_edit_history')) {
    db.history.push({
      id: nextId('history'),
      visit_id: params[0],
      edited_by: params[1],
      changes: JSON.parse(params[2]),
      reason: params[3],
      created_at: new Date().toISOString(),
    });
    return { rows: [] };
  }

  // Visit edit history read.
  if (lowered.includes('from visit_edit_history')) {
    const rows = db.history
      .filter((entry) => entry.visit_id === params[0])
      .map((entry) => ({
        ...entry,
        edited_by_email: db.users.find((user) => user.id === entry.edited_by)?.email || null,
      }));
    return { rows: rows.slice().reverse() };
  }

  // Latest issued visit date.
  if (lowered.startsWith('select max(visit_date) as last_visit_date')) {
    const issued = db.visits
      .filter(
        (visit) =>
          visit.patient_id === params[0] &&
          visit.doctor_id === params[1] &&
          visit.status === 'ISSUED' &&
          (!params[2] || visit.id !== params[2])
      )
      .map((visit) => visit.visit_date)
      .sort();
    return { rows: [{ last_visit_date: issued.length > 0 ? issued[issued.length - 1] : null }] };
  }

  // Prescriptions for a visit.
  if (lowered.includes('from prescriptions p') && lowered.includes('p.visit_id = $1')) {
    const rows = db.prescriptions
      .filter((prescription) => prescription.visit_id === params[0])
      .map(withHasPdf);
    return { rows };
  }

  // Previous prescription for the doctor/patient.
  if (lowered.includes('from prescriptions p') && lowered.includes('p.patient_id = $1')) {
    const candidate = db.prescriptions
      .filter(
        (prescription) =>
          prescription.patient_id === params[0] &&
          prescription.doctor_id === params[1] &&
          prescription.status === 'ISSUED' &&
          (!params[2] || prescription.visit_id !== params[2]) &&
          db.items.some((item) => item.prescription_id === prescription.id)
      )
      .slice(-1)[0];
    return { rows: candidate ? [withHasPdf(candidate)] : [] };
  }

  // Items for one prescription.
  if (lowered.startsWith('select * from prescription_items where prescription_id = $1')) {
    return {
      rows: db.items
        .filter((item) => item.prescription_id === params[0])
        .map((item) => ({ ...item })),
    };
  }

  // Items for many prescriptions.
  if (lowered.includes('from prescription_items') && lowered.includes('= any($1::uuid[])')) {
    const ids: string[] = params[0] || [];
    return {
      rows: db.items.filter((item) => ids.includes(item.prescription_id)).map((item) => ({ ...item })),
    };
  }

  // Medication suggestions from prior items.
  if (lowered.startsWith('select distinct medication_name')) {
    const names = db.items
      .filter((item) => {
        const prescription = db.prescriptions.find((entry) => entry.id === item.prescription_id);
        return prescription?.doctor_id === params[0];
      })
      .map((item) => item.medication_name);
    return { rows: Array.from(new Set(names)).sort().map((name) => ({ medication_name: name })) };
  }

  // Favorite names (for suggestions).
  if (lowered.startsWith('select medication_name from prescription_favorites')) {
    return {
      rows: db.favorites
        .filter((favorite) => favorite.doctor_id === params[0])
        .map((favorite) => ({ medication_name: favorite.medication_name })),
    };
  }

  // List favorites.
  if (lowered.startsWith('select * from prescription_favorites where doctor_id = $1')) {
    return {
      rows: db.favorites
        .filter((favorite) => favorite.doctor_id === params[0])
        .map((favorite) => ({ ...favorite })),
    };
  }

  // Save favorite.
  if (lowered.startsWith('insert into prescription_favorites')) {
    const existing = db.favorites.find(
      (favorite) =>
        favorite.doctor_id === params[0] &&
        favorite.medication_name === params[1] &&
        (favorite.dosage ?? null) === (params[2] ?? null)
    );
    if (existing) {
      existing.frequency = params[3];
      existing.duration = params[4];
      existing.instructions = params[5];
      existing.updated_at = new Date().toISOString();
      return { rows: [{ ...existing }] };
    }
    const favorite = {
      id: nextId('favorite'),
      doctor_id: params[0],
      medication_name: params[1],
      dosage: params[2],
      frequency: params[3],
      duration: params[4],
      instructions: params[5],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.favorites.push(favorite);
    return { rows: [{ ...favorite }] };
  }

  // Remove favorite.
  if (lowered.startsWith('delete from prescription_favorites')) {
    const index = db.favorites.findIndex(
      (favorite) => favorite.id === params[0] && favorite.doctor_id === params[1]
    );
    if (index === -1) return { rows: [] };
    const [removed] = db.favorites.splice(index, 1);
    return { rows: [{ id: removed.id }] };
  }

  // Patient lookup for issuing.
  if (lowered.startsWith('select id, date_of_birth, sex from patients')) {
    const patient = db.patients.find((entry) => entry.id === params[0]);
    return {
      rows: patient ? [{ id: patient.id, date_of_birth: patient.date_of_birth, sex: patient.sex }] : [],
    };
  }

  // Patient notification target.
  if (lowered.startsWith('select user_id from patients where id = $1')) {
    const patient = db.patients.find((entry) => entry.id === params[0]);
    return { rows: patient ? [{ user_id: patient.user_id }] : [] };
  }

  // Active prescription check.
  if (lowered.includes('from prescriptions where visit_id = $1 and status = \'issued\'')) {
    return {
      rows: db.prescriptions
        .filter((prescription) => prescription.visit_id === params[0] && prescription.status === 'ISSUED')
        .map((prescription) => ({ id: prescription.id })),
    };
  }

  // Latest voided prescription.
  if (lowered.includes('from prescriptions where visit_id = $1 and status = \'voided\'')) {
    const candidate = db.prescriptions
      .filter((prescription) => prescription.visit_id === params[0] && prescription.status === 'VOIDED')
      .slice(-1)[0];
    return { rows: candidate ? [{ id: candidate.id }] : [] };
  }

  // Create prescription.
  if (lowered.startsWith('insert into prescriptions')) {
    const prescription = {
      id: nextId('rx'),
      visit_id: params[0],
      patient_id: params[1],
      doctor_id: params[2],
      prescription_date: '2026-11-15',
      notes: params[3],
      status: 'ISSUED',
      voided_at: null,
      void_reason: null,
      voided_by: null,
      replaces_prescription_id: params[4] ?? null,
      pdf_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.prescriptions.push(prescription);
    return { rows: [{ ...prescription }] };
  }

  // Create prescription item.
  if (lowered.startsWith('insert into prescription_items')) {
    const item = {
      id: nextId('item'),
      prescription_id: params[0],
      medication_name: params[1],
      dosage: params[2],
      frequency: params[3],
      duration: params[4],
      instructions: params[5],
      quantity: params[6],
      created_at: new Date().toISOString(),
    };
    db.items.push(item);
    return { rows: [{ ...item }] };
  }

  // Prescription by id (used by response shaping and void).
  if (lowered.startsWith('select * from prescriptions where id = $1 and doctor_id = $2')) {
    const prescription = db.prescriptions.find(
      (entry) => entry.id === params[0] && entry.doctor_id === params[1]
    );
    return { rows: prescription ? [{ ...prescription }] : [] };
  }

  if (lowered.includes('from prescriptions p where p.id = $1')) {
    const prescription = db.prescriptions.find((entry) => entry.id === params[0]);
    return { rows: prescription ? [withHasPdf(prescription)] : [] };
  }

  // Void a prescription.
  if (lowered.startsWith('update prescriptions set')) {
    const id = paramFromWhere(sql, params);
    const prescription = db.prescriptions.find((entry) => entry.id === id);
    if (!prescription) return { rows: [] };
    applySetClause(prescription, sql, params);
    return { rows: [{ ...prescription }] };
  }

  // Update patient medical fields.
  if (lowered.startsWith('update patients set')) {
    const id = paramFromWhere(sql, params);
    const patient = db.patients.find((entry) => entry.id === id);
    if (!patient) return { rows: [] };
    applySetClause(patient, sql, params);
    return {
      rows: [{
        id: patient.id,
        first_name: patient.first_name,
        middle_name: patient.middle_name,
        last_name: patient.last_name,
        date_of_birth: patient.date_of_birth,
        sex: patient.sex,
        allergies: patient.allergies,
        allergies_confirmed_none: patient.allergies_confirmed_none,
        current_medications: patient.current_medications,
        medications_confirmed_none: patient.medications_confirmed_none,
      }],
    };
  }

  // Transaction control and anything else.
  return { rows: [] };
}

function resetDatabase() {
  sequence = 0;
  db = {
    doctors: [
      {
        id: 'doc-1',
        user_id: 'user-doc',
        prc_license_number: 'PRC-123',
        practice_name: 'Test Clinic',
        specialty: 'General Medicine',
      },
      {
        id: 'doc-2',
        user_id: 'user-doc-2',
        prc_license_number: 'PRC-999',
        practice_name: 'Other Clinic',
        specialty: 'General Medicine',
      },
    ],
    patients: [
      {
        id: 'pat-1',
        user_id: 'user-pat',
        first_name: 'Pat',
        middle_name: null,
        last_name: 'One',
        date_of_birth: '1990-01-01',
        sex: 'MALE',
        phone: '09170000000',
        address: '123 Test Street',
        allergies: null,
        allergies_confirmed_none: false,
        current_medications: null,
        medications_confirmed_none: false,
        medical_history: null,
        email: 'pat@example.com',
      },
    ],
    users: [{ id: 'user-pat', email: 'pat@example.com' }, { id: 'user-doc', email: 'doc@example.com' }],
    appointments: [
      {
        id: 'appt-1',
        patient_id: 'pat-1',
        doctor_id: 'doc-1',
        appointment_date: '2026-11-15T09:00:00.000Z',
        status: 'SCHEDULED',
        reason_for_visit: 'Checkup',
        practice_name: 'Test Clinic',
        specialty: 'General Medicine',
      },
    ],
    queueEntries: [
      {
        id: 'queue-1',
        appointment_id: 'appt-1',
        queue_number: 1,
        status: 'IN_CHECKUP',
        started_at: '2026-11-15T09:05:00.000Z',
        completed_at: null,
        created_at: '2026-11-15T08:00:00.000Z',
      },
    ],
    visits: [],
    prescriptions: [],
    items: [],
    history: [],
    favorites: [],
  };
}

describe('Consultation workspace API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/consultation', consultationRouter);
    jest.clearAllMocks();
    mockUser = { id: 'user-doc', role: 'DOCTOR' };
    resetDatabase();
    query.mockImplementation(runQuery);
    getClient.mockImplementation(() =>
      Promise.resolve({
        query: (sql: string, params?: any[]) => runQuery(sql, params),
        release: jest.fn(),
      })
    );
    (generatePrescriptionPdfFile as jest.Mock).mockResolvedValue({ success: true });
  });

  const startConsultation = () =>
    request(app).post('/api/v1/consultation/appointments/appt-1/start');

  const autosave = (visitId: string, body: AnyRow) =>
    request(app).patch(`/api/v1/consultation/visits/${visitId}/draft`).send(body);

  const issue = (visitId: string, body: AnyRow = {}) =>
    request(app).post(`/api/v1/consultation/visits/${visitId}/issue`).send(body);

  describe('start', () => {
    it('creates the draft exactly once and reopens it on a second call', async () => {
      const first = await startConsultation();
      expect(first.status).toBe(201);
      expect(first.body.data.status).toBe('DRAFT');
      expect(db.visits).toHaveLength(1);

      const second = await startConsultation();
      expect(second.status).toBe(200);
      expect(second.body.data.id).toBe(first.body.data.id);
      expect(db.visits).toHaveLength(1);
    });

    it('rejects a patient who is not In Checkup', async () => {
      db.queueEntries[0].status = 'WAITING';

      const response = await startConsultation();

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/In Checkup/i);
      expect(db.visits).toHaveLength(0);
    });

    it('rejects a cancelled or no-show appointment', async () => {
      db.appointments[0].status = 'CANCELLED';

      const response = await startConsultation();

      expect(response.status).toBe(400);
      expect(db.visits).toHaveLength(0);
    });

    it('does not start a consultation for another doctor', async () => {
      mockUser = { id: 'user-doc-2', role: 'DOCTOR' };

      const response = await startConsultation();

      expect(response.status).toBe(404);
      expect(db.visits).toHaveLength(0);
    });
  });

  describe('draft autosave', () => {
    it('persists visit fields and the prescription draft across reloads', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;

      const saved = await autosave(visitId, {
        reasonForVisit: 'Fever',
        diagnosis: 'Influenza',
        notes: 'Rest and fluids',
        bloodPressure: '120/80',
        weight: 70,
        height: 175,
        temperature: 38.4,
        prescriptionDraft: {
          notes: 'Take with food',
          items: [
            { medicationName: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours', duration: '3 days', quantity: 12 },
            { medicationName: 'Ibuprofen', dosage: '200mg', frequency: 'Twice daily', duration: '3 days', quantity: 6 },
          ],
        },
      });

      expect(saved.status).toBe(200);

      const context = await request(app).get('/api/v1/consultation/appointments/appt-1');
      expect(context.status).toBe(200);
      expect(context.body.data.visit.diagnosis).toBe('Influenza');
      expect(context.body.data.visit.prescription_draft.items).toHaveLength(2);
      expect(context.body.data.visit.prescription_draft.items[0].medicationName).toBe('Paracetamol');
    });

    it('rejects a stale write from a second tab with 409', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;

      await autosave(visitId, { diagnosis: 'First tab' });

      const response = await autosave(visitId, {
        diagnosis: 'Second tab',
        baseUpdatedAt: new Date(Date.now() - 60_000).toISOString(),
      });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/another tab/i);
      expect(visitById(visitId)!.diagnosis).toBe('First tab');
    });

    it('refuses to autosave an issued visit', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;
      db.visits[0].status = 'ISSUED';

      const response = await autosave(visitId, { diagnosis: 'Late edit' });

      expect(response.status).toBe(409);
    });
  });

  describe('issue', () => {
    const twoMedications = {
      prescriptionDraft: {
        notes: 'Take with food',
        items: [
          { medicationName: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7 days', quantity: 21 },
          { medicationName: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours', duration: '3 days', quantity: 12 },
        ],
      },
    };

    it('finalizes the visit, creates one prescription with two items, and sends one generic notification', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;

      const response = await issue(visitId, { reasonForVisit: 'Fever', ...twoMedications });

      expect(response.status).toBe(200);
      expect(response.body.data.visit.status).toBe('ISSUED');
      expect(response.body.data.visit.doctor_finished_at).toBeTruthy();
      expect(response.body.data.prescription.status).toBe('ISSUED');
      expect(response.body.data.pdfGenerated).toBe(true);
      expect(db.prescriptions).toHaveLength(1);
      expect(db.items.filter((item) => item.prescription_id === response.body.data.prescription.id)).toHaveLength(2);
      expect(createNotification).toHaveBeenCalledTimes(1);

      const [userId, type, title, message] = (createNotification as jest.Mock).mock.calls[0];
      expect(userId).toBe('user-pat');
      expect(type).toBe('PRESCRIPTION_AVAILABLE');
      expect(title).toBe('New Prescription Available');
      expect(message).not.toContain('Amoxicillin');
      expect(message).not.toContain('Paracetamol');
      expect(message).toMatch(/prescription/i);
    });

    it('issues without a prescription when there are no medications', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;

      const response = await issue(visitId, { reasonForVisit: 'Follow-up' });

      expect(response.status).toBe(200);
      expect(response.body.data.visit.status).toBe('ISSUED');
      expect(response.body.data.prescription).toBeNull();
      expect(db.prescriptions).toHaveLength(0);
      expect(createNotification).not.toHaveBeenCalled();
    });

    it('requires a reason for visit', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;
      db.visits[0].reason_for_visit = null;

      const response = await issue(visitId, {});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/reason for visit/i);
      expect(db.visits[0].status).toBe('DRAFT');
    });

    it('blocks issuing until date of birth and sex are recorded, then succeeds after they are added', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;
      db.patients[0].date_of_birth = null;
      db.patients[0].sex = 'NOT_SPECIFIED';

      const blocked = await issue(visitId, { reasonForVisit: 'Fever' });
      expect(blocked.status).toBe(400);
      expect(blocked.body.error.message).toMatch(/date of birth/i);

      const patched = await request(app)
        .patch('/api/v1/consultation/patients/pat-1')
        .send({ dateOfBirth: '1990-01-01', sex: 'FEMALE' });
      expect(patched.status).toBe(200);
      expect(db.patients[0].sex).toBe('FEMALE');

      const issued = await issue(visitId, { reasonForVisit: 'Fever', ...twoMedications });
      expect(issued.status).toBe(200);
      expect(issued.body.data.visit.status).toBe('ISSUED');
    });

    it('rejects issuing an already issued consultation', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;
      await issue(visitId, { reasonForVisit: 'Fever' });

      const response = await issue(visitId, { reasonForVisit: 'Fever' });

      expect(response.status).toBe(409);
    });

    it('keeps the issued record and reports a retryable PDF failure', async () => {
      (generatePrescriptionPdfFile as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'storage unavailable',
      });

      const started = await startConsultation();
      const visitId = started.body.data.id;
      const response = await issue(visitId, { reasonForVisit: 'Fever', ...twoMedications });

      expect(response.status).toBe(200);
      expect(response.body.data.visit.status).toBe('ISSUED');
      expect(response.body.data.pdfGenerated).toBe(false);
      expect(response.body.data.pdfError).toMatch(/storage unavailable/);
      expect(db.prescriptions).toHaveLength(1);
    });
  });

  describe('allergy and medication banner states', () => {
    it('distinguishes not recorded, confirmed none, and recorded values', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;

      let context = await request(app).get('/api/v1/consultation/appointments/appt-1');
      expect(context.body.data.patient.allergies).toBeNull();
      expect(context.body.data.patient.allergies_confirmed_none).toBe(false);

      const confirmed = await request(app)
        .patch('/api/v1/consultation/patients/pat-1')
        .send({ allergiesConfirmedNone: true });
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.data.allergies_confirmed_none).toBe(true);

      const recorded = await request(app)
        .patch('/api/v1/consultation/patients/pat-1')
        .send({ allergies: 'Penicillin' });
      expect(recorded.status).toBe(200);
      expect(recorded.body.data.allergies).toBe('Penicillin');
      expect(recorded.body.data.allergies_confirmed_none).toBe(false);

      context = await request(app).get('/api/v1/consultation/appointments/appt-1');
      expect(context.body.data.patient.allergies).toBe('Penicillin');
    });

    it('saves an entered allergy value with the confirmed-none flag present', async () => {
      const response = await request(app)
        .patch('/api/v1/consultation/patients/pat-1')
        .send({ allergies: 'Penicillin', allergiesConfirmedNone: false });

      expect(response.status).toBe(200);
      expect(response.body.data.allergies).toBe('Penicillin');
      expect(response.body.data.allergies_confirmed_none).toBe(false);
      expect(db.patients[0].allergies).toBe('Penicillin');
      expect(db.patients[0].allergies_confirmed_none).toBe(false);
    });

    it('saves confirmed-no-allergies with the allergies value key present', async () => {
      db.patients[0].allergies = 'Penicillin';
      db.patients[0].allergies_confirmed_none = false;

      const response = await request(app)
        .patch('/api/v1/consultation/patients/pat-1')
        .send({ allergies: null, allergiesConfirmedNone: true });

      expect(response.status).toBe(200);
      expect(response.body.data.allergies).toBeNull();
      expect(response.body.data.allergies_confirmed_none).toBe(true);
      expect(db.patients[0].allergies).toBeNull();
      expect(db.patients[0].allergies_confirmed_none).toBe(true);
    });

    it('saves entered current medications with the confirmed-none flag present', async () => {
      const response = await request(app)
        .patch('/api/v1/consultation/patients/pat-1')
        .send({ currentMedications: 'Metformin 500mg twice daily', medicationsConfirmedNone: false });

      expect(response.status).toBe(200);
      expect(response.body.data.current_medications).toBe('Metformin 500mg twice daily');
      expect(response.body.data.medications_confirmed_none).toBe(false);
      expect(db.patients[0].current_medications).toBe('Metformin 500mg twice daily');
      expect(db.patients[0].medications_confirmed_none).toBe(false);
    });

    it('saves confirmed-no-current-medications with the medications value key present', async () => {
      db.patients[0].current_medications = 'Metformin 500mg twice daily';
      db.patients[0].medications_confirmed_none = false;

      const response = await request(app)
        .patch('/api/v1/consultation/patients/pat-1')
        .send({ currentMedications: null, medicationsConfirmedNone: true });

      expect(response.status).toBe(200);
      expect(response.body.data.current_medications).toBeNull();
      expect(response.body.data.medications_confirmed_none).toBe(true);
      expect(db.patients[0].current_medications).toBeNull();
      expect(db.patients[0].medications_confirmed_none).toBe(true);
    });

    it('marks a first-time patient as a first visit', async () => {
      await startConsultation();

      const context = await request(app).get('/api/v1/consultation/appointments/appt-1');

      expect(context.body.data.firstVisit).toBe(true);
      expect(context.body.data.lastVisitDate).toBeNull();
    });
  });

  describe('copy from previous and favorites', () => {
    it('returns no previous prescription for a first prescription', async () => {
      await startConsultation();

      const context = await request(app).get('/api/v1/consultation/appointments/appt-1');

      expect(context.body.data.previousPrescription).toBeNull();
    });

    it('saves, lists, and removes a medication favorite', async () => {
      const saved = await request(app)
        .post('/api/v1/consultation/favorites')
        .send({ medicationName: 'Cetirizine', dosage: '10mg', frequency: 'Once daily', duration: '5 days' });
      expect(saved.status).toBe(201);

      const listed = await request(app).get('/api/v1/consultation/favorites');
      expect(listed.body.data).toHaveLength(1);
      expect(listed.body.data[0].medication_name).toBe('Cetirizine');

      const removed = await request(app).delete(`/api/v1/consultation/favorites/${saved.body.data.id}`);
      expect(removed.status).toBe(200);
      expect(db.favorites).toHaveLength(0);
    });
  });

  describe('void and replace', () => {
    const medications = {
      prescriptionDraft: {
        items: [{ medicationName: 'Amoxicillin', dosage: '500mg' }],
      },
    };

    const issuedConsultation = async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;
      const issued = await issue(visitId, { reasonForVisit: 'Fever', ...medications });
      return { visitId, prescriptionId: issued.body.data.prescription.id };
    };

    it('requires a reason to void and never deletes the prescription', async () => {
      const { prescriptionId } = await issuedConsultation();

      const missing = await request(app)
        .post(`/api/v1/consultation/prescriptions/${prescriptionId}/void`)
        .send({ reason: '  ' });
      expect(missing.status).toBe(400);

      const voided = await request(app)
        .post(`/api/v1/consultation/prescriptions/${prescriptionId}/void`)
        .send({ reason: 'Wrong dosage' });
      expect(voided.status).toBe(200);
      expect(voided.body.data.prescription.status).toBe('VOIDED');
      expect(voided.body.data.prescription.void_reason).toBe('Wrong dosage');
      expect(db.prescriptions).toHaveLength(1);

      const again = await request(app)
        .post(`/api/v1/consultation/prescriptions/${prescriptionId}/void`)
        .send({ reason: 'Wrong dosage' });
      expect(again.status).toBe(409);
    });

    it('requires the current prescription to be voided before a replacement', async () => {
      const { visitId } = await issuedConsultation();

      const blocked = await request(app)
        .post(`/api/v1/consultation/visits/${visitId}/prescriptions`)
        .send(medications);
      expect(blocked.status).toBe(409);

      const prescriptionId = db.prescriptions[0].id;
      await request(app)
        .post(`/api/v1/consultation/prescriptions/${prescriptionId}/void`)
        .send({ reason: 'Wrong dosage' });

      const replacement = await request(app)
        .post(`/api/v1/consultation/visits/${visitId}/prescriptions`)
        .send({ prescriptionDraft: { items: [{ medicationName: 'Azithromycin', dosage: '250mg' }] } });

      expect(replacement.status).toBe(201);
      expect(replacement.body.data.prescription.replaces_prescription_id).toBe(prescriptionId);
      expect(db.prescriptions).toHaveLength(2);
      expect(db.prescriptions[0].status).toBe('VOIDED');
      expect(db.prescriptions[1].status).toBe('ISSUED');

      const [userId, type, , message] = (createNotification as jest.Mock).mock.calls.slice(-1)[0];
      expect(userId).toBe('user-pat');
      expect(type).toBe('PRESCRIPTION_UPDATED');
      expect(message).not.toContain('Azithromycin');
    });
  });

  describe('authorization', () => {
    it('denies secretaries and admins', async () => {
      for (const role of ['SECRETARY', 'ADMIN', 'PATIENT']) {
        mockUser = { id: 'other-user', role };
        const response = await startConsultation();
        expect(response.status).toBe(403);
      }
      expect(db.visits).toHaveLength(0);
    });

    it('does not let another doctor read or change the draft, visit, or prescription', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;
      const issued = await issue(visitId, {
        reasonForVisit: 'Fever',
        prescriptionDraft: { items: [{ medicationName: 'Amoxicillin', dosage: '500mg' }] },
      });
      const prescriptionId = issued.body.data.prescription.id;
      expect(prescriptionId).toBeTruthy();

      mockUser = { id: 'user-doc-2', role: 'DOCTOR' };

      const draftRead = await request(app).patch(`/api/v1/consultation/visits/${visitId}/draft`).send({ diagnosis: 'Hack' });
      expect(draftRead.status).toBe(404);

      const issueAttempt = await issue(visitId, { reasonForVisit: 'Hack' });
      expect(issueAttempt.status).toBe(404);

      const voidAttempt = await request(app)
        .post(`/api/v1/consultation/prescriptions/${prescriptionId}/void`)
        .send({ reason: 'Hack' });
      expect(voidAttempt.status).toBe(404);

      const history = await request(app).get(`/api/v1/consultation/visits/${visitId}/edit-history`);
      expect(history.status).toBe(404);

      expect(db.visits[0].status).toBe('ISSUED');
      expect(db.prescriptions[0].status).toBe('ISSUED');
      expect(db.prescriptions[0].void_reason).toBeNull();
    });

    it('scopes patient medical updates to the doctor’s own patients', async () => {
      mockUser = { id: 'user-doc-2', role: 'DOCTOR' };

      const response = await request(app)
        .patch('/api/v1/consultation/patients/pat-1')
        .send({ allergies: 'Latex' });

      expect(response.status).toBe(404);
      expect(db.patients[0].allergies).toBeNull();
    });
  });

  describe('edit history', () => {
    it('returns the recorded trail for an edited visit', async () => {
      const started = await startConsultation();
      const visitId = started.body.data.id;
      db.history.push({
        id: 'history-1',
        visit_id: visitId,
        edited_by: 'user-doc',
        changes: { diagnosis: { from: 'Flu', to: 'Influenza' } },
        reason: 'Corrected diagnosis',
        created_at: new Date().toISOString(),
      });

      const response = await request(app).get(`/api/v1/consultation/visits/${visitId}/edit-history`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].changes.diagnosis.to).toBe('Influenza');
      expect(response.body.data[0].reason).toBe('Corrected diagnosis');
    });
  });
});
