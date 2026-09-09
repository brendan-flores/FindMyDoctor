import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Create visit record
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

    // Create visit
    const result = await query(
      `INSERT INTO visits (appointment_id, patient_id, doctor_id, visit_date, reason_for_visit, diagnosis, notes, blood_pressure, weight, height, temperature)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [appointmentId, appointment.patient_id, appointment.doctor_id, reasonForVisit, diagnosis, notes, bloodPressure, weight, height, temperature]
    );

    // Update appointment status
    await query(
      "UPDATE appointments SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [appointmentId]
    );

    res.status(201).json(success(result.rows[0], 'Visit recorded successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create visit'));
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

// Update visit
router.put('/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { diagnosis, notes, bloodPressure, weight, height, temperature } = req.body;

    await query(
      `UPDATE visits 
       SET diagnosis = COALESCE($1, diagnosis),
           notes = COALESCE($2, notes),
           blood_pressure = COALESCE($3, blood_pressure),
           weight = COALESCE($4, weight),
           height = COALESCE($5, height),
           temperature = COALESCE($6, temperature),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [diagnosis, notes, bloodPressure, weight, height, temperature, id]
    );

    res.json(success(null, 'Visit updated successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update visit'));
  }
});

export default router;