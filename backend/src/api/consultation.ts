import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { createNotification, NotificationTypes } from './notifications';
import { sendPushToUser } from '../services/pushService';
import { generatePrescriptionPdfFile } from '../services/prescriptionPdfService';

const router = Router();

const MAX_PRESCRIPTION_ITEMS = 50;
const VALID_SEX_VALUES = ['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'];
const UNSERVICEABLE_APPOINTMENT_STATUSES = ['CANCELLED', 'NO_SHOW'];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function resolveDoctorId(userId: string): Promise<string | null> {
  const result = await query('SELECT id FROM doctors WHERE user_id = $1', [userId]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

async function doctorHasPatientAccess(doctorId: string, patientId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM patients p
     WHERE p.id = $1
       AND (
         EXISTS (
           SELECT 1 FROM patient_doctor_associations pda
           WHERE pda.patient_id = p.id AND pda.doctor_id = $2
         )
         OR EXISTS (
           SELECT 1 FROM appointments a
           WHERE a.patient_id = p.id AND a.doctor_id = $2
         )
       )
     LIMIT 1`,
    [patientId, doctorId]
  );
  return result.rows.length > 0;
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: unknown): number | null {
  const parsed = optionalNumber(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : Math.round(parsed);
}

function sanitizePrescriptionDraft(value: unknown): { items: any[]; notes: string | null } {
  const input = (value && typeof value === 'object' ? value : {}) as any;
  const rawItems = Array.isArray(input.items) ? input.items.slice(0, MAX_PRESCRIPTION_ITEMS) : [];
  const items = rawItems
    .map((item: any) => ({
      id: typeof item?.id === 'string' ? item.id : undefined,
      medicationName: optionalString(item?.medicationName),
      dosage: optionalString(item?.dosage),
      frequency: optionalString(item?.frequency),
      duration: optionalString(item?.duration),
      quantity: optionalInteger(item?.quantity),
      instructions: optionalString(item?.instructions),
    }))
    .filter((item: any) => item.medicationName);

  return { items, notes: optionalString(input.notes) };
}

async function getVisitForDoctor(visitId: string, doctorId: string) {
  const result = await query(
    `SELECT v.*, a.status AS appointment_status, a.appointment_date
     FROM visits v
     JOIN appointments a ON v.appointment_id = a.id
     WHERE v.id = $1 AND v.doctor_id = $2`,
    [visitId, doctorId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function notifyPatient(
  patientId: string,
  type: string,
  title: string,
  message: string,
  prescriptionId: string
) {
  try {
    const patientUserResult = await query('SELECT user_id FROM patients WHERE id = $1', [patientId]);
    if (patientUserResult.rows.length === 0) return false;
    const patientUserId = patientUserResult.rows[0].user_id;

    await createNotification(
      patientUserId,
      type,
      title,
      message,
      'prescription',
      prescriptionId
    );

    await sendPushToUser(patientUserId, {
      title,
      body: message,
      data: {
        type,
        prescriptionId,
      },
    });
    return true;
  } catch (notificationError) {
    // Notifications are best-effort and must never block the clinical action.
    console.error('Failed to notify patient about prescription:', notificationError);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Consultation context
// ---------------------------------------------------------------------------

router.get('/appointments/:appointmentId', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const appointmentResult = await query(
      `SELECT a.*,
              p.id AS patient_id,
              p.first_name AS patient_first_name, p.middle_name AS patient_middle_name,
              p.last_name AS patient_last_name, p.date_of_birth, p.sex, p.phone AS patient_phone,
              p.address AS patient_address, p.allergies, p.allergies_confirmed_none,
              p.current_medications, p.medications_confirmed_none, p.medical_history,
              u.email AS patient_email,
              d.prc_license_number, d.practice_name, d.specialty
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = $1 AND a.doctor_id = $2`,
      [appointmentId, doctorId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];
    const patientId = appointment.patient_id;

    const [queueResult, visitResult, favoritesResult] = await Promise.all([
      query(
        `SELECT id, queue_number, status, started_at, completed_at
         FROM queue_entries
         WHERE appointment_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [appointmentId]
      ),
      query('SELECT * FROM visits WHERE appointment_id = $1', [appointmentId]),
      query(
        `SELECT * FROM prescription_favorites
         WHERE doctor_id = $1
         ORDER BY updated_at DESC, medication_name ASC`,
        [doctorId]
      ),
    ]);

    const queueEntry = queueResult.rows[0] || null;
    const visit = visitResult.rows[0] || null;

    let prescriptions: any[] = [];
    let previousPrescription: any = null;
    let lastVisitDate: string | null = null;
    let editHistory: any[] = [];

    if (visit) {
      const prescriptionsResult = await query(
        `SELECT p.*,
                CASE WHEN p.pdf_url IS NOT NULL AND p.pdf_url <> '' THEN true ELSE false END AS has_pdf
         FROM prescriptions p
         WHERE p.visit_id = $1
         ORDER BY p.created_at DESC`,
        [visit.id]
      );
      prescriptions = prescriptionsResult.rows;

      if (prescriptions.length > 0) {
        const itemsResult = await query(
          `SELECT * FROM prescription_items
           WHERE prescription_id = ANY($1::uuid[])
           ORDER BY created_at ASC`,
          [prescriptions.map((p: any) => p.id)]
        );
        const itemsByPrescription = new Map<string, any[]>();
        for (const item of itemsResult.rows) {
          const list = itemsByPrescription.get(item.prescription_id) || [];
          list.push(item);
          itemsByPrescription.set(item.prescription_id, list);
        }
        prescriptions.forEach((prescription: any) => {
          prescription.items = itemsByPrescription.get(prescription.id) || [];
        });
      }

      const historyResult = await query(
        `SELECT h.*, u.email AS edited_by_email,
                d.first_name AS edited_by_first_name, d.last_name AS edited_by_last_name,
                s.first_name AS edited_by_secretary_first_name, s.last_name AS edited_by_secretary_last_name
         FROM visit_edit_history h
         LEFT JOIN users u ON h.edited_by = u.id
         LEFT JOIN doctors d ON d.user_id = h.edited_by
         LEFT JOIN secretaries s ON s.user_id = h.edited_by
         WHERE h.visit_id = $1
         ORDER BY h.created_at DESC`,
        [visit.id]
      );
      editHistory = historyResult.rows;
    }

    const previousPrescriptionResult = await query(
      `SELECT p.*
       FROM prescriptions p
       WHERE p.patient_id = $1
         AND p.doctor_id = $2
         AND p.status = 'ISSUED'
         AND ($3::uuid IS NULL OR p.visit_id <> $3::uuid)
         AND EXISTS (SELECT 1 FROM prescription_items pi WHERE pi.prescription_id = p.id)
       ORDER BY p.prescription_date DESC, p.created_at DESC
       LIMIT 1`,
      [patientId, doctorId, visit ? visit.id : null]
    );

    if (previousPrescriptionResult.rows.length > 0) {
      previousPrescription = previousPrescriptionResult.rows[0];
      const itemsResult = await query(
        'SELECT * FROM prescription_items WHERE prescription_id = $1 ORDER BY created_at ASC',
        [previousPrescription.id]
      );
      previousPrescription.items = itemsResult.rows;
    }

    const lastVisitResult = await query(
      `SELECT MAX(visit_date) AS last_visit_date
       FROM visits
       WHERE patient_id = $1 AND doctor_id = $2 AND status = 'ISSUED'
         AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [patientId, doctorId, visit ? visit.id : null]
    );
    lastVisitDate = lastVisitResult.rows[0]?.last_visit_date || null;

    const isUnserviceable = UNSERVICEABLE_APPOINTMENT_STATUSES.includes(appointment.status);
    const isInCheckup = queueEntry?.status === 'IN_CHECKUP';
    const canStart = !isUnserviceable && (Boolean(visit) || isInCheckup);
    const missingPatientInfo: string[] = [];
    if (!appointment.date_of_birth) missingPatientInfo.push('dateOfBirth');
    if (!appointment.sex || appointment.sex === 'NOT_SPECIFIED') missingPatientInfo.push('sex');

    res.json(success({
      appointment: {
        id: appointment.id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        appointment_date: appointment.appointment_date,
        status: appointment.status,
        reason_for_visit: appointment.reason_for_visit,
        practice_name: appointment.practice_name,
        specialty: appointment.specialty,
        queue_number: queueEntry?.queue_number ?? null,
        queue_status: queueEntry?.status ?? null,
        queue_started_at: queueEntry?.started_at ?? null,
      },
      patient: {
        id: appointment.patient_id,
        first_name: appointment.patient_first_name,
        middle_name: appointment.patient_middle_name,
        last_name: appointment.patient_last_name,
        date_of_birth: appointment.date_of_birth,
        sex: appointment.sex,
        phone: appointment.patient_phone,
        address: appointment.patient_address,
        email: appointment.patient_email,
        allergies: appointment.allergies,
        allergies_confirmed_none: appointment.allergies_confirmed_none,
        current_medications: appointment.current_medications,
        medications_confirmed_none: appointment.medications_confirmed_none,
        medical_history: appointment.medical_history,
      },
      visit,
      prescriptions,
      previousPrescription,
      favorites: favoritesResult.rows,
      editHistory,
      lastVisitDate,
      firstVisit: !lastVisitDate,
      isInCheckup,
      canStart,
      doctorFinished: Boolean(visit?.doctor_finished_at),
      isDraft: visit?.status === 'DRAFT',
      missingPatientInfo,
      canIssue: canStart && visit?.status === 'DRAFT',
    }));
  } catch (err: any) {
    console.error('Consultation context error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to load consultation'));
  }
});

// ---------------------------------------------------------------------------
// Start / continue consultation (creates the draft exactly once)
// ---------------------------------------------------------------------------

router.post('/appointments/:appointmentId/start', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const appointmentResult = await query(
      'SELECT * FROM appointments WHERE id = $1 AND doctor_id = $2',
      [appointmentId, doctorId]
    );
    if (appointmentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }
    const appointment = appointmentResult.rows[0];

    if (UNSERVICEABLE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      return res.status(400).json(error(
        ErrorCodes.INVALID_APPOINTMENT_STATUS,
        'A consultation cannot be started for a cancelled or no-show appointment'
      ));
    }

    // Reopening an existing draft (or viewing an issued visit) is always allowed.
    const existingVisitResult = await query(
      'SELECT * FROM visits WHERE appointment_id = $1',
      [appointmentId]
    );
    if (existingVisitResult.rows.length > 0) {
      return res.json(success(existingVisitResult.rows[0], 'Consultation reopened'));
    }

    const queueResult = await query(
      `SELECT status FROM queue_entries
       WHERE appointment_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [appointmentId]
    );
    if (queueResult.rows.length === 0 || queueResult.rows[0].status !== 'IN_CHECKUP') {
      return res.status(400).json(error(
        ErrorCodes.CONFLICT,
        'The patient must be In Checkup with you before a consultation can be started'
      ));
    }

    const inserted = await query(
      `INSERT INTO visits
         (appointment_id, patient_id, doctor_id, visit_date, reason_for_visit, status,
          prescription_draft, draft_updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'DRAFT', $5::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (appointment_id) DO NOTHING
       RETURNING *`,
      [
        appointmentId,
        appointment.patient_id,
        doctorId,
        optionalString(appointment.reason_for_visit),
        JSON.stringify({ items: [], notes: null }),
      ]
    );

    if (inserted.rows.length > 0) {
      return res.status(201).json(success(inserted.rows[0], 'Consultation started'));
    }

    const fallback = await query('SELECT * FROM visits WHERE appointment_id = $1', [appointmentId]);
    return res.json(success(fallback.rows[0], 'Consultation reopened'));
  } catch (err: any) {
    console.error('Start consultation error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to start consultation'));
  }
});

// ---------------------------------------------------------------------------
// Draft autosave
// ---------------------------------------------------------------------------

router.patch('/visits/:visitId/draft', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { visitId } = req.params;
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const visit = await getVisitForDoctor(visitId, doctorId);
    if (!visit) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }
    if (visit.status !== 'DRAFT') {
      return res.status(409).json(error(
        ErrorCodes.CONFLICT,
        'This consultation has already been issued and can no longer be autosaved as a draft'
      ));
    }
    if (UNSERVICEABLE_APPOINTMENT_STATUSES.includes(visit.appointment_status)) {
      return res.status(400).json(error(
        ErrorCodes.INVALID_APPOINTMENT_STATUS,
        'This appointment is cancelled or marked no-show'
      ));
    }

    const { baseUpdatedAt } = req.body || {};
    if (baseUpdatedAt && visit.draft_updated_at) {
      const base = new Date(baseUpdatedAt).getTime();
      const current = new Date(visit.draft_updated_at).getTime();
      if (Number.isFinite(base) && Number.isFinite(current) && Math.abs(current - base) > 1000) {
        return res.status(409).json(error(
          ErrorCodes.CONFLICT,
          'This draft was updated in another tab. Reload it before saving to avoid losing changes.'
        ));
      }
    }

    const prescriptionDraft = sanitizePrescriptionDraft(req.body?.prescriptionDraft ?? visit.prescription_draft);

    const updated = await query(
      `UPDATE visits SET
         reason_for_visit = $1,
         diagnosis = $2,
         notes = $3,
         blood_pressure = $4,
         weight = $5,
         height = $6,
         temperature = $7,
         prescription_draft = $8::jsonb,
         draft_updated_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        optionalString(req.body?.reasonForVisit),
        optionalString(req.body?.diagnosis),
        optionalString(req.body?.notes),
        optionalString(req.body?.bloodPressure),
        optionalNumber(req.body?.weight),
        optionalNumber(req.body?.height),
        optionalNumber(req.body?.temperature),
        JSON.stringify(prescriptionDraft),
        visitId,
      ]
    );

    res.json(success(updated.rows[0], 'Draft autosaved'));
  } catch (err: any) {
    console.error('Autosave consultation error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to autosave draft'));
  }
});

// ---------------------------------------------------------------------------
// Issue consultation (final visit + optional prescription)
// ---------------------------------------------------------------------------

router.post('/visits/:visitId/issue', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  let createdPrescriptionId: string | null = null;
  let patientId: string | null = null;
  let isReplacement = false;

  try {
    const { visitId } = req.params;
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const visit = await getVisitForDoctor(visitId, doctorId);
    if (!visit) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }
    if (visit.status !== 'DRAFT') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'This consultation has already been issued'));
    }
    if (UNSERVICEABLE_APPOINTMENT_STATUSES.includes(visit.appointment_status)) {
      return res.status(400).json(error(
        ErrorCodes.INVALID_APPOINTMENT_STATUS,
        'A cancelled or no-show consultation cannot be issued'
      ));
    }

    const patientResult = await query(
      'SELECT id, date_of_birth, sex FROM patients WHERE id = $1',
      [visit.patient_id]
    );
    if (patientResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }
    const patient = patientResult.rows[0];
    patientId = patient.id;

    const missing: string[] = [];
    if (!patient.date_of_birth) missing.push('dateOfBirth');
    if (!patient.sex || patient.sex === 'NOT_SPECIFIED') missing.push('sex');
    if (missing.length > 0) {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `Add the patient's ${missing.map((item) => (item === 'dateOfBirth' ? 'date of birth' : 'sex')).join(' and ')} before issuing the prescription.`
      ));
    }

    const reasonForVisit = optionalString(req.body?.reasonForVisit) ?? optionalString(visit.reason_for_visit);
    if (!reasonForVisit) {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        'Reason for visit is required before issuing'
      ));
    }

    const prescriptionDraft = sanitizePrescriptionDraft(
      req.body?.prescriptionDraft ?? visit.prescription_draft
    );

    await client.query('BEGIN');

    const locked = await client.query(
      'SELECT * FROM visits WHERE id = $1 AND doctor_id = $2 FOR UPDATE',
      [visitId, doctorId]
    );
    if (locked.rows.length === 0 || locked.rows[0].status !== 'DRAFT') {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'This consultation has already been issued'));
    }

    await client.query(
      `UPDATE visits SET
         reason_for_visit = $1,
         diagnosis = $2,
         notes = $3,
         blood_pressure = $4,
         weight = $5,
         height = $6,
         temperature = $7,
         prescription_draft = $8::jsonb,
         status = 'ISSUED',
         issued_at = CURRENT_TIMESTAMP,
         doctor_finished_at = CURRENT_TIMESTAMP,
         draft_updated_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [
        reasonForVisit,
        optionalString(req.body?.diagnosis) ?? visit.diagnosis,
        optionalString(req.body?.notes) ?? visit.notes,
        optionalString(req.body?.bloodPressure) ?? visit.blood_pressure,
        optionalNumber(req.body?.weight) ?? visit.weight,
        optionalNumber(req.body?.height) ?? visit.height,
        optionalNumber(req.body?.temperature) ?? visit.temperature,
        JSON.stringify(prescriptionDraft),
        visitId,
      ]
    );

    if (prescriptionDraft.items.length > 0) {
      const voidedResult = await client.query(
        `SELECT id FROM prescriptions
         WHERE visit_id = $1 AND status = 'VOIDED'
         ORDER BY voided_at DESC
         LIMIT 1`,
        [visitId]
      );
      const replacesId = voidedResult.rows[0]?.id || null;
      isReplacement = Boolean(replacesId);

      const prescriptionResult = await client.query(
        `INSERT INTO prescriptions
           (visit_id, patient_id, doctor_id, prescription_date, notes, status, replaces_prescription_id)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, 'ISSUED', $5)
         RETURNING *`,
        [visitId, patient.id, doctorId, prescriptionDraft.notes, replacesId]
      );
      createdPrescriptionId = prescriptionResult.rows[0].id;

      for (const item of prescriptionDraft.items) {
        await client.query(
          `INSERT INTO prescription_items
             (prescription_id, medication_name, dosage, frequency, duration, instructions, quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            createdPrescriptionId,
            item.medicationName,
            item.dosage,
            item.frequency,
            item.duration,
            item.instructions,
            item.quantity,
          ]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Issue consultation error:', err);
    return res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to issue consultation'));
  } finally {
    client.release();
  }

  let pdfGenerated = false;
  let pdfError: string | null = null;
  let notificationSent = false;

  if (createdPrescriptionId) {
    const pdfResult = await generatePrescriptionPdfFile(createdPrescriptionId);
    pdfGenerated = pdfResult.success;
    if (!pdfResult.success) {
      pdfError = pdfResult.error || 'Failed to generate PDF';
    }

    notificationSent = await notifyPatient(
      patientId!,
      isReplacement ? NotificationTypes.PRESCRIPTION_UPDATED : NotificationTypes.PRESCRIPTION_AVAILABLE,
      isReplacement ? 'Prescription Updated' : 'New Prescription Available',
      isReplacement
        ? 'Your doctor updated your prescription. View it in your prescriptions.'
        : 'Your doctor has issued a new prescription. View it in your prescriptions.',
      createdPrescriptionId
    );
  }

  try {
    const visitResult = await query('SELECT * FROM visits WHERE id = $1', [req.params.visitId]);
    const prescription = createdPrescriptionId
      ? await query(
          `SELECT p.*,
                  CASE WHEN p.pdf_url IS NOT NULL AND p.pdf_url <> '' THEN true ELSE false END AS has_pdf
           FROM prescriptions p WHERE p.id = $1`,
          [createdPrescriptionId]
        ).then((result) => result.rows[0] || null)
      : null;

    return res.json(success({
      visit: visitResult.rows[0],
      prescription,
      pdfGenerated,
      pdfError,
      notificationSent,
    }, 'Consultation issued'));
  } catch (err: any) {
    console.error('Issue consultation response error:', err);
    return res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Consultation was issued but the response could not be loaded'));
  }
});

// ---------------------------------------------------------------------------
// Replacement prescription for an already issued visit (after a void)
// ---------------------------------------------------------------------------

router.post('/visits/:visitId/prescriptions', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { visitId } = req.params;
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const visit = await getVisitForDoctor(visitId, doctorId);
    if (!visit) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }
    if (visit.status !== 'ISSUED') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'The visit must be issued first'));
    }

    const activeResult = await query(
      `SELECT id FROM prescriptions WHERE visit_id = $1 AND status = 'ISSUED' LIMIT 1`,
      [visitId]
    );
    if (activeResult.rows.length > 0) {
      return res.status(409).json(error(
        ErrorCodes.CONFLICT,
        'Void the current prescription before issuing a replacement'
      ));
    }

    const prescriptionDraft = sanitizePrescriptionDraft(req.body?.prescriptionDraft ?? req.body);
    if (prescriptionDraft.items.length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'At least one medication is required'));
    }

    const voidedResult = await query(
      `SELECT id FROM prescriptions
       WHERE visit_id = $1 AND status = 'VOIDED'
       ORDER BY voided_at DESC
       LIMIT 1`,
      [visitId]
    );
    const replacesId = voidedResult.rows[0]?.id || null;

    const client = await getClient();
    let createdPrescription;
    try {
      await client.query('BEGIN');

      // Re-check under lock: a concurrent request may have issued one already.
      const lockedActive = await client.query(
        `SELECT id FROM prescriptions WHERE visit_id = $1 AND status = 'ISSUED' LIMIT 1`,
        [visitId]
      );
      if (lockedActive.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json(error(
          ErrorCodes.CONFLICT,
          'Void the current prescription before issuing a replacement'
        ));
      }

      const prescriptionResult = await client.query(
        `INSERT INTO prescriptions
           (visit_id, patient_id, doctor_id, prescription_date, notes, status, replaces_prescription_id)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, 'ISSUED', $5)
         RETURNING *`,
        [visitId, visit.patient_id, doctorId, prescriptionDraft.notes, replacesId]
      );
      createdPrescription = prescriptionResult.rows[0];

      for (const item of prescriptionDraft.items) {
        await client.query(
          `INSERT INTO prescription_items
             (prescription_id, medication_name, dosage, frequency, duration, instructions, quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            createdPrescription.id,
            item.medicationName,
            item.dosage,
            item.frequency,
            item.duration,
            item.instructions,
            item.quantity,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

    const prescriptionId = createdPrescription.id;

    const pdfResult = await generatePrescriptionPdfFile(prescriptionId);
    const notificationSent = await notifyPatient(
      visit.patient_id,
      NotificationTypes.PRESCRIPTION_UPDATED,
      'Prescription Updated',
      'Your doctor updated your prescription. View it in your prescriptions.',
      prescriptionId
    );

    const result = await query(
      `SELECT p.*,
              CASE WHEN p.pdf_url IS NOT NULL AND p.pdf_url <> '' THEN true ELSE false END AS has_pdf
       FROM prescriptions p WHERE p.id = $1`,
      [prescriptionId]
    );

    res.status(201).json(success({
      prescription: result.rows[0],
      pdfGenerated: pdfResult.success,
      pdfError: pdfResult.success ? null : pdfResult.error,
      notificationSent,
    }, 'Replacement prescription issued'));
  } catch (err: any) {
    console.error('Replacement prescription error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to issue replacement prescription'));
  }
});

// ---------------------------------------------------------------------------
// Void a prescription (never edited or deleted)
// ---------------------------------------------------------------------------

router.post('/prescriptions/:prescriptionId/void', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { prescriptionId } = req.params;
    const reason = optionalString(req.body?.reason);
    if (!reason || reason.length < 3) {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        'A reason is required to void a prescription'
      ));
    }

    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const prescriptionResult = await query(
      `SELECT * FROM prescriptions WHERE id = $1 AND doctor_id = $2`,
      [prescriptionId, doctorId]
    );
    if (prescriptionResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Prescription not found'));
    }
    const prescription = prescriptionResult.rows[0];
    if (prescription.status !== 'ISSUED') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'This prescription is already voided'));
    }

    const updated = await query(
      `UPDATE prescriptions SET
         status = 'VOIDED',
         voided_at = CURRENT_TIMESTAMP,
         void_reason = $1,
         voided_by = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [reason, req.user!.id, prescriptionId]
    );

    const notificationSent = await notifyPatient(
      prescription.patient_id,
      NotificationTypes.PRESCRIPTION_UPDATED,
      'Prescription Updated',
      'Your doctor updated your prescription. View it in your prescriptions.',
      prescriptionId
    );

    res.json(success({ prescription: updated.rows[0], notificationSent }, 'Prescription voided'));
  } catch (err: any) {
    console.error('Void prescription error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to void prescription'));
  }
});

// ---------------------------------------------------------------------------
// Visit edit history (doctor)
// ---------------------------------------------------------------------------

router.get('/visits/:visitId/edit-history', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }
    const visit = await getVisitForDoctor(req.params.visitId, doctorId);
    if (!visit) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    const result = await query(
      `SELECT h.*, u.email AS edited_by_email
       FROM visit_edit_history h
       LEFT JOIN users u ON h.edited_by = u.id
       WHERE h.visit_id = $1
       ORDER BY h.created_at DESC`,
      [req.params.visitId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch edit history'));
  }
});

// ---------------------------------------------------------------------------
// Patient medical information / demographics (doctor)
// ---------------------------------------------------------------------------

router.patch('/patients/:patientId', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }
    if (!(await doctorHasPatientAccess(doctorId, patientId))) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }

    const updates: string[] = [];
    const params: any[] = [patientId];
    const assignmentIndex = new Map<string, number>();
    const add = (column: string, value: any) => {
      // A column can be touched by more than one payload key (for example
      // `allergies` and `allergiesConfirmedNone`). PostgreSQL rejects the same
      // column appearing twice in SET, so keep one placeholder per column and
      // let the later value win.
      const existingIndex = assignmentIndex.get(column);
      if (existingIndex !== undefined) {
        params[existingIndex] = value;
        return;
      }
      params.push(value);
      assignmentIndex.set(column, params.length - 1);
      updates.push(`${column} = $${params.length}`);
    };

    if ('allergiesConfirmedNone' in req.body) {
      const confirmed = Boolean(req.body.allergiesConfirmedNone);
      add('allergies_confirmed_none', confirmed);
      if (confirmed) add('allergies', null);
    }
    if ('allergies' in req.body) {
      const allergies = optionalString(req.body.allergies);
      add('allergies', allergies);
      if (allergies) add('allergies_confirmed_none', false);
    }
    if ('medicationsConfirmedNone' in req.body) {
      const confirmed = Boolean(req.body.medicationsConfirmedNone);
      add('medications_confirmed_none', confirmed);
      if (confirmed) add('current_medications', null);
    }
    if ('currentMedications' in req.body) {
      const medications = optionalString(req.body.currentMedications);
      add('current_medications', medications);
      if (medications) add('medications_confirmed_none', false);
    }
    if ('dateOfBirth' in req.body) {
      const dateOfBirth = optionalString(req.body.dateOfBirth);
      if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date of birth must be in YYYY-MM-DD format'));
      }
      const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed > new Date()) {
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid date of birth'));
      }
      add('date_of_birth', dateOfBirth);
    }
    if ('sex' in req.body) {
      const sex = optionalString(req.body.sex)?.toUpperCase();
      if (!sex || !VALID_SEX_VALUES.includes(sex)) {
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Sex must be one of: MALE, FEMALE, OTHER, NOT_SPECIFIED'));
      }
      add('sex', sex);
    }

    if (updates.length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'No patient fields to update'));
    }

    const result = await query(
      `UPDATE patients SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, first_name, middle_name, last_name, date_of_birth, sex, allergies,
                 allergies_confirmed_none, current_medications, medications_confirmed_none`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }

    res.json(success(result.rows[0], 'Patient updated'));
  } catch (err: any) {
    console.error('Patient medical info update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update patient'));
  }
});

// ---------------------------------------------------------------------------
// Medication favorites (per doctor)
// ---------------------------------------------------------------------------

router.get('/favorites', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }
    const result = await query(
      'SELECT * FROM prescription_favorites WHERE doctor_id = $1 ORDER BY updated_at DESC, medication_name ASC',
      [doctorId]
    );
    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch favorites'));
  }
});

router.post('/favorites', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const medicationName = optionalString(req.body?.medicationName);
    if (!medicationName) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Medication name is required'));
    }

    const result = await query(
      `INSERT INTO prescription_favorites
         (doctor_id, medication_name, dosage, frequency, duration, instructions)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (doctor_id, medication_name, dosage) DO UPDATE SET
         frequency = EXCLUDED.frequency,
         duration = EXCLUDED.duration,
         instructions = EXCLUDED.instructions,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        doctorId,
        medicationName,
        optionalString(req.body?.dosage),
        optionalString(req.body?.frequency),
        optionalString(req.body?.duration),
        optionalString(req.body?.instructions),
      ]
    );

    res.status(201).json(success(result.rows[0], 'Favorite saved'));
  } catch (err: any) {
    console.error('Save favorite error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to save favorite'));
  }
});

router.delete('/favorites/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }
    const result = await query(
      'DELETE FROM prescription_favorites WHERE id = $1 AND doctor_id = $2 RETURNING id',
      [req.params.id, doctorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Favorite not found'));
    }
    res.json(success(null, 'Favorite removed'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to remove favorite'));
  }
});

router.get('/medication-suggestions', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = await resolveDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const result = await query(
      `SELECT DISTINCT medication_name
       FROM prescription_items pi
       JOIN prescriptions p ON pi.prescription_id = p.id
       WHERE p.doctor_id = $1
       ORDER BY medication_name ASC
       LIMIT 200`,
      [doctorId]
    );
    const favoritesResult = await query(
      'SELECT medication_name FROM prescription_favorites WHERE doctor_id = $1',
      [doctorId]
    );

    const names = new Set<string>();
    result.rows.forEach((row: any) => names.add(row.medication_name));
    favoritesResult.rows.forEach((row: any) => names.add(row.medication_name));

    res.json(success(Array.from(names).sort((a, b) => a.localeCompare(b))));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch medication suggestions'));
  }
});

export default router;
