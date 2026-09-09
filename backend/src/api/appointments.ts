import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requirePasswordChange } from '../middleware/auth';

const router = Router();

// Get appointments for current user
router.get('/', authenticate, requirePasswordChange, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { status, startDate, endDate } = req.query;

    let queryText = '';
    const params: any[] = [];

    if (role === 'PATIENT') {
      // Get patient's appointments
      queryText = `
        SELECT 
          a.*,
          d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialty,
          c.name as clinic_name, c.address as clinic_address,
          q.queue_number, q.status as queue_status
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN clinics c ON a.clinic_id = c.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        WHERE a.patient_id = (SELECT id FROM patients WHERE user_id = $1)
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      // Get doctor's appointments
      queryText = `
        SELECT 
          a.*,
          p.first_name as patient_first_name, p.last_name as patient_last_name,
          c.name as clinic_name,
          q.queue_number, q.status as queue_status
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN clinics c ON a.clinic_id = c.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        WHERE a.doctor_id = (SELECT id FROM doctors WHERE user_id = $1)
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role for appointments'));
    }

    // Add filters
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

// Create appointment (atomic transaction)
router.post('/', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const userId = req.user!.id;
    const { doctorId, appointmentDate, reasonForVisit } = req.body;

    // Basic validation
    if (!doctorId || !appointmentDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor ID and appointment date are required'));
    }

    // Get patient ID
    const patientResult = await client.query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    const patientId = patientResult.rows[0].id;

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
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'You already have an appointment with this doctor at this time'));
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

    // Create queue entry
    await client.query(
      `INSERT INTO queue_entries (patient_id, doctor_id, clinic_id, appointment_id, queue_date, queue_number, registration_source, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ONLINE', 'WAITING')`,
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
       VALUES ($1, 'APPOINTMENT_CONFIRMED', 'Appointment Confirmed', 'Your appointment has been confirmed', 'appointment', $2)`,
      [userId, appointmentId]
    );

    await client.query('COMMIT');

    res.status(201).json(
      success({
        appointmentId,
        queueNumber,
      }, 'Appointment booked successfully')
    );
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Appointment booking error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to book appointment'));
  } finally {
    client.release();
  }
});

// Get appointment by ID
router.get('/:id', authenticate, requirePasswordChange, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'PATIENT') {
      queryText = `
        SELECT a.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialty,
               c.name as clinic_name, c.address as clinic_address, c.phone as clinic_phone,
               q.queue_number, q.status as queue_status
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN clinics c ON a.clinic_id = c.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        WHERE a.id = $1 AND a.patient_id = (SELECT id FROM patients WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      queryText = `
        SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
               c.name as clinic_name,
               q.queue_number, q.status as queue_status
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN clinics c ON a.clinic_id = c.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        WHERE a.id = $1 AND a.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch appointment'));
  }
});

// Cancel appointment
router.patch('/:id/cancel', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const appointmentResult = await query(
      `SELECT * FROM appointments 
       WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)`,
      [id, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      return res.status(400).json(error(ErrorCodes.INVALID_APPOINTMENT_STATUS, 'Cannot cancel this appointment'));
    }

    // Update appointment status
    await query(
      "UPDATE appointments SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    // Update queue entry
    await query(
      "UPDATE queue_entries SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE appointment_id = $1",
      [id]
    );

    // Update capacity
    const appointmentDate = new Date(appointment.appointment_date).toISOString().split('T')[0];
    await query(
      'UPDATE daily_capacities SET registered_count = registered_count - 1 WHERE doctor_id = $1 AND date = $2',
      [appointment.doctor_id, appointmentDate]
    );

    res.json(success(null, 'Appointment cancelled successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to cancel appointment'));
  }
});

// Reschedule appointment
router.patch('/:id/reschedule', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newAppointmentDate } = req.body;
    const userId = req.user!.id;

    if (!newAppointmentDate) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'New appointment date is required'));
    }

    // Get current appointment
    const appointmentResult = await query(
      `SELECT * FROM appointments 
       WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)`,
      [id, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];

    // Check capacity for new date
    const newDateOnly = new Date(newAppointmentDate).toISOString().split('T')[0];
    const capacityResult = await query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
      [appointment.doctor_id, newDateOnly]
    );

    if (capacityResult.rows.length === 0 || capacityResult.rows[0].registered_count >= capacityResult.rows[0].final_capacity) {
      return res.status(400).json(error(ErrorCodes.CAPACITY_FULL, 'No available slots for the new date'));
    }

    // Update appointment
    await query(
      'UPDATE appointments SET appointment_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newAppointmentDate, id]
    );

    // Update queue entry
    await query(
      'UPDATE queue_entries SET queue_date = $1, updated_at = CURRENT_TIMESTAMP WHERE appointment_id = $2',
      [newDateOnly, id]
    );

    res.json(success(null, 'Appointment rescheduled successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reschedule appointment'));
  }
});

export default router;