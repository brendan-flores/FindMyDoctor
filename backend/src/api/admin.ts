import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get all users
router.get('/users', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, email, role, is_active, must_change_password, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch users'));
  }
});

// Create doctor
router.post('/doctors', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName, specialty, credentials, biography, consultationFee, clinicId } = req.body;

    if (!email || !password || !firstName || !lastName || !specialty || !consultationFee) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Required fields missing'));
    }

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, must_change_password) 
       VALUES ($1, crypt(gen_salt(), $2), 'DOCTOR', false) 
       RETURNING id`,
      [email, password]
    );

    const userId = userResult.rows[0].id;

    // Create doctor profile
    const doctorResult = await query(
      `INSERT INTO doctors (user_id, clinic_id, first_name, last_name, specialty, credentials, biography, consultation_fee, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [userId, clinicId, firstName, lastName, specialty, credentials, biography, consultationFee]
    );

    res.status(201).json(success(doctorResult.rows[0], 'Doctor created successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create doctor'));
  }
});

// Approve doctor
router.patch('/doctors/:id/approve', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      "UPDATE doctors SET is_approved = true WHERE id = $1",
      [id]
    );

    res.json(success(null, 'Doctor approved successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to approve doctor'));
  }
});

// Create clinic
router.post('/clinics', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, latitude, longitude, phone, email, description, operatingHoursStart, operatingHoursEnd } = req.body;

    if (!name || !address || !latitude || !longitude) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Required fields missing'));
    }

    const result = await query(
      `INSERT INTO clinics (name, address, latitude, longitude, phone, email, description, operating_hours_start, operating_hours_end, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [name, address, latitude, longitude, phone, email, description, operatingHoursStart, operatingHoursEnd]
    );

    res.status(201).json(success(result.rows[0], 'Clinic created successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create clinic'));
  }
});

// Approve clinic
router.patch('/clinics/:id/approve', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      "UPDATE clinics SET is_approved = true WHERE id = $1",
      [id]
    );

    res.json(success(null, 'Clinic approved successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to approve clinic'));
  }
});

// Get all appointments (admin view)
router.get('/appointments', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, startDate, endDate } = req.query;

    let queryText = `
      SELECT 
        a.*,
        p.first_name as patient_first_name, p.last_name as patient_last_name,
        d.first_name as doctor_first_name, d.last_name as doctor_last_name,
        c.name as clinic_name,
        q.queue_number
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN clinics c ON a.clinic_id = c.id
      LEFT JOIN queue_entries q ON a.id = q.appointment_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      queryText += ` AND a.status = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      queryText += ` AND a.appointment_date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND a.appointment_date <= $${params.length}`;
    }

    queryText += ' ORDER BY a.appointment_date DESC';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch appointments'));
  }
});

export default router;