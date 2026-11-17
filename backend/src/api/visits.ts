import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * Resolve the SQL scope that limits which visits the caller may read.
 * Patients only see their own issued visits and doctors only visits they
 * authored. Secretaries and admins get no clinical-record access at all.
 */
async function resolveVisitScope(
  userId: string,
  role: string
): Promise<{ allowed: false } | { allowed: true; clause: string; param: string }> {
  if (role === 'PATIENT') {
    const patientResult = await query('SELECT id FROM patients WHERE user_id = $1', [userId]);
    if (patientResult.rows.length === 0) return { allowed: false };
    return { allowed: true, clause: 'v.patient_id = $2', param: patientResult.rows[0].id };
  }

  if (role === 'DOCTOR') {
    const doctorResult = await query('SELECT id FROM doctors WHERE user_id = $1', [userId]);
    if (doctorResult.rows.length === 0) return { allowed: false };
    return { allowed: true, clause: 'v.doctor_id = $2', param: doctorResult.rows[0].id };
  }

  return { allowed: false };
}


// Get authenticated patient's visits (PATIENT-only)
router.get('/me', authenticate, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get patient ID from user
    const patientResult = await query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }

    const patientId = patientResult.rows[0].id;

    // Get all visits for this patient
    const result = await query(
      `SELECT v.*,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name,
              d.professional_photo_url as doctor_professional_photo_url,
              a.appointment_date,
              a.id as appointment_id
       FROM visits v
       JOIN doctors d ON v.doctor_id = d.id
       LEFT JOIN appointments a ON v.appointment_id = a.id
       WHERE v.patient_id = $1 AND v.status = 'ISSUED'
       ORDER BY v.visit_date DESC`,
      [patientId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    console.error('Error fetching patient visits:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch visits'));
  }
});

// Get specific visit for authenticated patient (PATIENT-only)
router.get('/me/:id', authenticate, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get patient ID from user
    const patientResult = await query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }

    const patientId = patientResult.rows[0].id;

    // Get specific visit for this patient
    const result = await query(
      `SELECT v.*,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name,
              a.appointment_date,
              a.id as appointment_id
       FROM visits v
       JOIN doctors d ON v.doctor_id = d.id
       LEFT JOIN appointments a ON v.appointment_id = a.id
       WHERE v.id = $1 AND v.patient_id = $2 AND v.status = 'ISSUED'`,
      [id, patientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    console.error('Error fetching patient visit:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch visit'));
  }
});

// Create or update a visit record (for recording during checkup)
router.post('/', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId, reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature } = req.body;

    if (!appointmentId) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Appointment ID is required'));
    }

    const doctorResult = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user!.id]);
    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }
    const doctorId = doctorResult.rows[0].id;

    // Get appointment details
    const appointmentResult = await query(
      'SELECT * FROM appointments WHERE id = $1',
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.doctor_id !== doctorId) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You do not have access to this appointment'));
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') {
      return res.status(400).json(error(
        ErrorCodes.INVALID_APPOINTMENT_STATUS,
        'A cancelled or no-show appointment cannot be recorded'
      ));
    }

    // Check if visit already exists for this appointment
    const existingVisit = await query(
      'SELECT * FROM visits WHERE appointment_id = $1',
      [appointmentId]
    );

    if (existingVisit.rows.length > 0) {
      const existing = existingVisit.rows[0];

      // Issued visits keep an audit trail of what changed.
      if (existing.status === 'ISSUED') {
        const changedFields: Record<string, { from: any; to: any }> = {};
        const compare = (field: string, next: any) => {
          const currentValue = existing[field] ?? null;
          const nextValue = next ?? null;
          if (String(currentValue ?? '') !== String(nextValue ?? '')) {
            changedFields[field] = { from: currentValue, to: nextValue };
          }
        };
        if (reasonForVisit !== undefined) compare('reason_for_visit', reasonForVisit);
        if (diagnosis !== undefined) compare('diagnosis', diagnosis);
        if (notes !== undefined) compare('notes', notes);
        if (bloodPressure !== undefined) compare('blood_pressure', bloodPressure);
        if (weight !== undefined) compare('weight', weight);
        if (height !== undefined) compare('height', height);
        if (temperature !== undefined) compare('temperature', temperature);

        if (Object.keys(changedFields).length > 0) {
          await query(
            'INSERT INTO visit_edit_history (visit_id, edited_by, changes, reason) VALUES ($1, $2, $3::jsonb, $4)',
            [existing.id, req.user!.id, JSON.stringify(changedFields), req.body?.editReason || null]
          );
        }
      }

      const result = await query(
        `UPDATE visits
         SET reason_for_visit = COALESCE($1, reason_for_visit),
             diagnosis = COALESCE($2, diagnosis),
             notes = COALESCE($3, notes),
             blood_pressure = COALESCE($4, blood_pressure),
             weight = COALESCE($5, weight),
             height = COALESCE($6, height),
             temperature = COALESCE($7, temperature),
             is_edited = CASE WHEN status = 'ISSUED' THEN true ELSE is_edited END,
             edited_at = CASE WHEN status = 'ISSUED' THEN CURRENT_TIMESTAMP ELSE edited_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE appointment_id = $8
         RETURNING *`,
        [reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature, appointmentId]
      );

      return res.status(200).json(success(result.rows[0], 'Visit updated successfully'));
    }

    // The legacy "record visit" path treats a new record as final.
    const result = await query(
      `INSERT INTO visits
         (appointment_id, patient_id, doctor_id, visit_date, reason_for_visit, diagnosis, notes,
          blood_pressure, weight, height, temperature, status, issued_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10, 'ISSUED', CURRENT_TIMESTAMP)
       RETURNING *`,
      [appointmentId, appointment.patient_id, appointment.doctor_id, reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature]
    );

    res.status(201).json(success(result.rows[0], 'Visit recorded successfully'));
  } catch (err: any) {
    console.error('Record visit error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to record visit'));
  }
});

// Get visit by ID (scoped to the owning patient or doctor)
router.get('/:id', authenticate, authorize('PATIENT', 'DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const scope = await resolveVisitScope(userId, req.user!.role);
    if (!scope.allowed) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You do not have access to this visit'));
    }

    const result = await query(
      `SELECT v.*, 
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name
       FROM visits v
       JOIN patients p ON v.patient_id = p.id
       JOIN doctors d ON v.doctor_id = d.id
       WHERE v.id = $1 AND ${scope.clause}${req.user!.role === 'PATIENT' ? " AND v.status = 'ISSUED'" : ''}`,
      [id, scope.param]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch visit'));
  }
});

// Get visit by appointment ID (scoped to the owning patient or doctor)
router.get('/appointment/:appointmentId', authenticate, authorize('PATIENT', 'DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user!.id;

    const scope = await resolveVisitScope(userId, req.user!.role);
    if (!scope.allowed) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You do not have access to this visit'));
    }

    const result = await query(
      `SELECT v.*, 
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name,
              a.appointment_date
       FROM visits v
       JOIN patients p ON v.patient_id = p.id
       JOIN doctors d ON v.doctor_id = d.id
       LEFT JOIN appointments a ON v.appointment_id = a.id
       WHERE v.appointment_id = $1 AND ${scope.clause}${req.user!.role === 'PATIENT' ? " AND v.status = 'ISSUED'" : ''}`,
      [appointmentId, scope.param]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch visit'));
  }
});

// Update visit (doctor must own the visit)
router.put('/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature, editReason } = req.body;

    const doctorResult = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user!.id]);
    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }
    const doctorId = doctorResult.rows[0].id;

    const existingResult = await query(
      'SELECT * FROM visits WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }
    const existing = existingResult.rows[0];

    if (existing.status === 'ISSUED') {
      const changedFields: Record<string, { from: any; to: any }> = {};
      const compare = (field: string, next: any) => {
        if (next === undefined) return;
        const currentValue = existing[field] ?? null;
        const nextValue = next ?? null;
        if (String(currentValue ?? '') !== String(nextValue ?? '')) {
          changedFields[field] = { from: currentValue, to: nextValue };
        }
      };
      compare('reason_for_visit', reasonForVisit);
      compare('diagnosis', diagnosis);
      compare('notes', notes);
      compare('blood_pressure', bloodPressure);
      compare('weight', weight);
      compare('height', height);
      compare('temperature', temperature);

      if (Object.keys(changedFields).length > 0) {
        await query(
          'INSERT INTO visit_edit_history (visit_id, edited_by, changes, reason) VALUES ($1, $2, $3::jsonb, $4)',
          [id, req.user!.id, JSON.stringify(changedFields), editReason || null]
        );
      }
    }

    const result = await query(
      `UPDATE visits
       SET reason_for_visit = COALESCE($1, reason_for_visit),
           diagnosis = COALESCE($2, diagnosis),
           notes = COALESCE($3, notes),
           blood_pressure = COALESCE($4, blood_pressure),
           weight = COALESCE($5, weight),
           height = COALESCE($6, height),
           temperature = COALESCE($7, temperature),
           is_edited = CASE WHEN status = 'ISSUED' THEN true ELSE is_edited END,
           edited_at = CASE WHEN status = 'ISSUED' THEN CURRENT_TIMESTAMP ELSE edited_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND doctor_id = $9
       RETURNING *`,
      [reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature, id, doctorId]
    );

    res.json(success(result.rows[0], 'Visit updated successfully'));
  } catch (err: any) {
    console.error('Update visit error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update visit'));
  }
});

// Get visits for a specific patient (doctor only, with authorization)
router.get('/patient/:patientId', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = req.user!.id;

    // Verify the doctor has authorization to view this patient's visits
    // Doctor can only view visits for patients they have associations or appointments with
    const result = await query(
      `SELECT v.*,
              a.appointment_date,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name
       FROM visits v
       LEFT JOIN appointments a ON v.appointment_id = a.id
       LEFT JOIN doctors d ON v.doctor_id = d.id
       WHERE v.patient_id = $1
       AND v.status = 'ISSUED'
       AND (
         EXISTS (
           SELECT 1 FROM patient_doctor_associations pda
           WHERE pda.patient_id = $1
           AND pda.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
         )
         OR EXISTS (
           SELECT 1 FROM appointments a
           WHERE a.patient_id = $1
           AND a.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
         )
       )
       ORDER BY v.visit_date DESC`,
      [patientId, userId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    console.error('Patient visits fetch error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch patient visits'));
  }
});

export default router;