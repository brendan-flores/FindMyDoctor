import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// Search for patient by email
router.get('/search', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email is required'));
    }

    const result = await query(
      `SELECT u.id, u.email, u.role, u.must_change_password,
              p.first_name, p.last_name, p.phone
       FROM users u
       LEFT JOIN patients p ON u.id = p.user_id
       WHERE u.email = $1 AND u.role = 'PATIENT'
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to search for patient'));
  }
});

// Create account for walk-in patient
router.post('/create-account', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, firstName, lastName, phone } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email, first name, and last name are required'));
    }

    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already registered'));
    }

    // Generate random temporary password
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Create user with temporary password
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, must_change_password) 
       VALUES ($1, $2, 'PATIENT', true) 
       RETURNING id, email, must_change_password`,
      [email, passwordHash]
    );

    const user = userResult.rows[0];

    // Create patient profile
    const patientResult = await query(
      `INSERT INTO patients (user_id, first_name, last_name, phone) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [user.id, firstName, lastName, phone]
    );

    res.status(201).json(success({
      user: {
        id: user.id,
        email: user.email,
        mustChangePassword: user.must_changePassword,
      },
      patient: patientResult.rows[0],
      temporaryPassword, // Only show this once to the secretary
    }, 'Account created successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create account'));
  }
});

// Register walk-in patient (atomic transaction)
router.post('/', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { patientId, doctorId, appointmentDate, reasonForVisit } = req.body;

    // Basic validation
    if (!patientId || !doctorId || !appointmentDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Patient ID, doctor ID, and appointment date are required'));
    }

    // Verify patient exists
    const patientResult = await client.query(
      'SELECT * FROM patients WHERE id = $1',
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }

    // Get doctor info
    const doctorResult = await client.query(
      'SELECT * FROM doctors WHERE id = $1 AND is_approved = true',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found or not approved'));
    }

    const doctor = doctorResult.rows[0];

    // Check capacity
    const appointmentDateOnly = new Date(appointmentDate).toISOString().split('T')[0];
    const capacityResult = await client.query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
      [doctorId, appointmentDateOnly]
    );

    if (capacityResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.APPOINTMENT_SLOT_UNAVAILABLE, 'No capacity configured for this date'));
    }

    const capacity = capacityResult.rows[0];

    if (capacity.registered_count >= capacity.final_capacity) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.CAPACITY_FULL, 'No available slots for this date'));
    }

    // Check for conflicting appointment
    const conflictResult = await client.query(
      `SELECT * FROM appointments 
       WHERE patient_id = $1 AND doctor_id = $2 
       AND appointment_date = $3 AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [patientId, doctorId, appointmentDate]
    );

    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Patient already has an appointment with this doctor at this time'));
    }

    // Create appointment
    const appointmentResult = await client.query(
      `INSERT INTO appointments (patient_id, doctor_id, clinic_id, appointment_date, reason_for_visit, status)
       VALUES ($1, $2, $3, $4, $5, 'SCHEDULED')
       RETURNING id`,
      [patientId, doctorId, doctor.clinic_id, appointmentDate, reasonForVisit]
    );

    const appointmentId = appointmentResult.rows[0].id;

    // Get next queue number (concurrency-safe)
    const queueResult = await client.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 as next_queue 
       FROM queue_entries 
       WHERE queue_date = $1 AND doctor_id = $2`,
      [appointmentDateOnly, doctorId]
    );

    const queueNumber = queueResult.rows[0].next_queue;

    // Create queue entry with WALK_IN source
    await client.query(
      `INSERT INTO queue_entries (patient_id, doctor_id, clinic_id, appointment_id, queue_date, queue_number, registration_source, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'WALK_IN', 'WAITING')`,
      [patientId, doctorId, doctor.clinic_id, appointmentId, appointmentDateOnly, queueNumber]
    );

    // Update registered count
    await client.query(
      'UPDATE daily_capacities SET registered_count = registered_count + 1 WHERE doctor_id = $1 AND date = $2',
      [doctorId, appointmentDateOnly]
    );

    // Create notification
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ((SELECT user_id FROM patients WHERE id = $1), 'APPOINTMENT_CONFIRMED', 'Walk-in Registration Confirmed', 'Your walk-in registration has been confirmed', 'appointment', $2)`,
      [patientId, appointmentId]
    );

    await client.query('COMMIT');

    res.status(201).json(
      success({
        appointmentId,
        queueNumber,
      }, 'Walk-in registration successful')
    );
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Walk-in registration error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to register walk-in patient'));
  } finally {
    client.release();
  }
});

export default router;