import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Create prescription
router.post('/', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { visitId, items, notes } = req.body;

    if (!visitId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Visit ID and items are required'));
    }

    // Get visit details
    const visitResult = await query(
      'SELECT * FROM visits WHERE id = $1',
      [visitId]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    const visit = visitResult.rows[0];

    // Create prescription
    const prescriptionResult = await query(
      `INSERT INTO prescriptions (visit_id, patient_id, doctor_id, prescription_date, notes)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)
       RETURNING *`,
      [visitId, visit.patient_id, visit.doctor_id, notes]
    );

    const prescriptionId = prescriptionResult.rows[0].id;

    // Add prescription items
    for (const item of items) {
      await query(
        `INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, instructions)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [prescriptionId, item.medicationName, item.dosage, item.frequency, item.duration, item.instructions]
      );
    }

    res.status(201).json(success(prescriptionResult.rows[0], 'Prescription created successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create prescription'));
  }
});

// Get prescription by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'PATIENT') {
      queryText = `
        SELECT p.*, 
               d.first_name as doctor_first_name, d.last_name as doctor_last_name,
               v.visit_date
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        JOIN visits v ON p.visit_id = v.id
        WHERE p.id = $1 AND p.patient_id = (SELECT id FROM patients WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      queryText = `
        SELECT p.*, 
               pat.first_name as patient_first_name, pat.last_name as patient_last_name,
               v.visit_date
        FROM prescriptions p
        JOIN patients pat ON p.patient_id = pat.id
        JOIN visits v ON p.visit_id = v.id
        WHERE p.id = $1 AND p.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Prescription not found'));
    }

    // Get prescription items
    const itemsResult = await query(
      'SELECT * FROM prescription_items WHERE prescription_id = $1',
      [id]
    );

    const prescription = result.rows[0];
    prescription.items = itemsResult.rows;

    res.json(success(prescription));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch prescription'));
  }
});

// Get patient's prescriptions
router.get('/patients/:id', authenticate, authorize('PATIENT', 'DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'PATIENT') {
      // Verify patient owns the records
      const patientResult = await query(
        'SELECT id FROM patients WHERE user_id = $1',
        [userId]
      );

      if (patientResult.rows.length === 0 || patientResult.rows[0].id !== id) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Access denied'));
      }

      queryText = `
        SELECT p.*, 
               d.first_name as doctor_first_name, d.last_name as doctor_last_name
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        WHERE p.patient_id = $1
        ORDER BY p.prescription_date DESC
      `;
    } else if (role === 'DOCTOR') {
      queryText = `
        SELECT p.*, 
               d.first_name as doctor_first_name, d.last_name as doctor_last_name
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        WHERE p.patient_id = $1 AND p.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
        ORDER BY p.prescription_date DESC
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch prescriptions'));
  }
});

export default router;