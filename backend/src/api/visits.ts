import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Create visit record (for recording during checkup)
router.post('/', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId, reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature } = req.body;

    if (!appointmentId) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Appointment ID is required'));
    }

    // Get appointment details
    const appointmentResult = await query(
      'SELECT * FROM appointments WHERE id = $1',
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];

    // Check if visit already exists for this appointment
    const existingVisit = await query(
      'SELECT id FROM visits WHERE appointment_id = $1',
      [appointmentId]
    );

    if (existingVisit.rows.length > 0) {
      // Update existing visit instead of creating new one
      const result = await query(
        `UPDATE visits
         SET reason_for_visit = COALESCE($1, reason_for_visit),
             diagnosis = COALESCE($2, diagnosis),
             notes = COALESCE($3, notes),
             blood_pressure = COALESCE($4, blood_pressure),
             weight = COALESCE($5, weight),
             height = COALESCE($6, height),
             temperature = COALESCE($7, temperature),
             updated_at = CURRENT_TIMESTAMP
         WHERE appointment_id = $8
         RETURNING *`,
        [reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature, appointmentId]
      );

      res.status(200).json(success(result.rows[0], 'Visit updated successfully'));
    } else {
      // Create new visit
      const result = await query(
        `INSERT INTO visits (appointment_id, patient_id, doctor_id, visit_date, reason_for_visit, diagnosis, notes, blood_pressure, weight, height, temperature)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [appointmentId, appointment.patient_id, appointment.doctor_id, reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature]
      );

      res.status(201).json(success(result.rows[0], 'Visit recorded successfully'));
    }
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to record visit'));
  }
});

// Get visit by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT v.*, 
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name
       FROM visits v
       JOIN patients p ON v.patient_id = p.id
       JOIN doctors d ON v.doctor_id = d.id
       WHERE v.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch visit'));
  }
});

// Get visit by appointment ID
router.get('/appointment/:appointmentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;

    const result = await query(
      `SELECT v.*, 
              p.first_name as patient_first_name, p.last_name as patient_last_name,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name,
              a.appointment_date
       FROM visits v
       JOIN patients p ON v.patient_id = p.id
       JOIN doctors d ON v.doctor_id = d.id
       LEFT JOIN appointments a ON v.appointment_id = a.id
       WHERE v.appointment_id = $1`,
      [appointmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch visit'));
  }
});

// Update visit
router.put('/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature } = req.body;

    await query(
      `UPDATE visits
       SET reason_for_visit = COALESCE($1, reason_for_visit),
           diagnosis = COALESCE($2, diagnosis),
           notes = COALESCE($3, notes),
           blood_pressure = COALESCE($4, blood_pressure),
           weight = COALESCE($5, weight),
           height = COALESCE($6, height),
           temperature = COALESCE($7, temperature),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature, id]
    );

    res.json(success(null, 'Visit updated successfully'));
  } catch (err: any) {
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