import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requirePasswordChange } from '../middleware/auth';
import { calculateAvailability, invalidateAvailabilityCache } from '../modules/availability/availabilityService';
import { getClinicDate, toClinicDateString } from '../utils/date';
import { promoteNextPatient } from '../modules/waitlists/waitlistPromotionService';
import {
  acquireQueueLocks,
  nextQueueNumber,
  renumberQueueAfterRemoval,
} from '../modules/queue/queueService';

const router = Router();

// Creating, cancelling or rescheduling an appointment changes availability.
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        invalidateAvailabilityCache();
      }
    });
  }
  next();
});

// Valid sex values
const VALID_SEX_VALUES = ['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'];

// Get appointments for current user
router.get('/', authenticate, requirePasswordChange, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { status, startDate, endDate, patientId } = req.query;

    let queryText = '';
    const params: any[] = [];

    if (role === 'PATIENT') {
      // Get patient's appointments
      queryText = `
        SELECT
          a.*,
          d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialty,
          d.practice_name, d.practice_address, d.practice_latitude, d.practice_longitude,
          d.consultation_fee, d.professional_photo_url,
          q.queue_number, q.status as queue_status,
          COALESCE(q.registration_source, 'ONLINE') as registration_source,
          p.id as payment_id,
          p.status as payment_status,
          p.payment_method
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        LEFT JOIN payments p ON a.id = p.appointment_id
        WHERE a.patient_id = (SELECT id FROM patients WHERE user_id = $1)
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      // Get doctor's appointments
      queryText = `
        SELECT
          a.*,
          p.first_name as patient_first_name, p.last_name as patient_last_name,
          d.practice_name,
          d.consultation_fee,
          q.queue_number, q.status as queue_status,
          COALESCE(q.registration_source, 'ONLINE') as registration_source,
          pay.id as payment_id,
          pay.status as payment_status,
          pay.payment_method
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        LEFT JOIN payments pay ON a.id = pay.appointment_id
        WHERE a.doctor_id = (SELECT id FROM doctors WHERE user_id = $1)
      `;
      params.push(userId);
    } else if (role === 'SECRETARY') {
      // Get appointments for the doctor the secretary is assigned to
      queryText = `
        SELECT
          a.*,
          p.first_name as patient_first_name, p.last_name as patient_last_name,
          d.practice_name,
          d.consultation_fee,
          q.queue_number, q.status as queue_status,
          COALESCE(q.registration_source, 'ONLINE') as registration_source,
          pay.id as payment_id,
          pay.status as payment_status,
          pay.payment_method
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        LEFT JOIN payments pay ON a.id = pay.appointment_id
        WHERE a.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $1)
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

    // Add patientId filter for DOCTOR role (safe because query already filters by doctor_id)
    if (role === 'DOCTOR' && patientId) {
      params.push(patientId);
      queryText += ` AND a.patient_id = $${params.length}`;
    }

    queryText += ' ORDER BY a.appointment_date DESC';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch appointments'));
  }
});

// Create appointment (atomic transaction with concurrency-safe queue assignment)
router.post('/', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const userId = req.user!.id;
    const { doctorId, appointmentDate, reasonForVisit, paymentMethod } = req.body;

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

    // Check if patient has an association with this doctor (doctor-specific check)
    // An explicit PENDING association must be respected - it overrides the appointment-history fallback
    const associationResult = await client.query(
      `SELECT details_completion_status
       FROM patient_doctor_associations
       WHERE patient_id = $1 AND doctor_id = $2`,
      [patientId, doctorId]
    );

    if (associationResult.rows.length > 0) {
      // Explicit association exists - respect its status
      const status = associationResult.rows[0].details_completion_status;

      if (status !== 'COMPLETE') {
        await client.query('ROLLBACK');
        return res.status(400).json(error(
          ErrorCodes.VALIDATION_ERROR,
          'Patient record is incomplete. Please submit required details for this doctor before booking. Use POST /api/v1/patients/submit-details first.'
        ));
      }
      // COMPLETE association - proceed with booking
    } else {
      // No association exists - check appointments table for backward compatibility with legacy records
      const appointmentRecordResult = await client.query(
        `SELECT COUNT(*) as count
         FROM appointments
         WHERE patient_id = $1 AND doctor_id = $2`,
        [patientId, doctorId]
      );

      const hasAppointments = parseInt(appointmentRecordResult.rows[0].count) > 0;

      if (!hasAppointments) {
        await client.query('ROLLBACK');
        return res.status(400).json(error(
          ErrorCodes.VALIDATION_ERROR,
          'Patient must submit required details for this doctor before booking. Use POST /api/v1/patients/submit-details first.'
        ));
      }

      // Legacy appointment history exists - verify patient profile is complete before allowing booking
      const patientProfileResult = await client.query(
        'SELECT first_name, last_name, date_of_birth, sex, phone, address FROM patients WHERE id = $1',
        [patientId]
      );

      if (patientProfileResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
      }

      const patient = patientProfileResult.rows[0];
      const isProfileComplete =
        patient.first_name && patient.first_name.trim() !== '' &&
        patient.last_name && patient.last_name.trim() !== '' &&
        patient.date_of_birth !== null &&
        patient.sex !== null && VALID_SEX_VALUES.includes(patient.sex) &&
        patient.phone && patient.phone.trim() !== '' &&
        patient.address && patient.address.trim() !== '';

      if (!isProfileComplete) {
        await client.query('ROLLBACK');
        return res.status(400).json(error(
          ErrorCodes.VALIDATION_ERROR,
          'Patient record is incomplete. Please submit required details for this doctor before booking. Use POST /api/v1/patients/submit-details first.'
        ));
      }

      // Legacy patient has complete profile - proceed with booking
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

    // Get appointment date (date-only format expected: yyyy-MM-dd)
    const appointmentDateOnly = appointmentDate; // Already in yyyy-MM-dd format from frontend

    // Validate appointment is not in the past
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const appointmentDateObj = new Date(appointmentDateOnly);
    if (appointmentDateObj < now) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot book appointments in the past'));
    }

    // Get availability for the date to validate working hours, breaks, exceptions
    const availability = await calculateAvailability(doctorId, appointmentDateOnly);

    // Check if date is available
    if (availability.status !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      const statusMessage = {
        'FULL': 'No available slots for this date',
        'UNAVAILABLE': 'Doctor is not available on this date',
        'PAST': 'Cannot book appointments in the past',
        'NON_WORKING': 'Doctor is not working on this date'
      }[availability.status] || 'Date not available';
      return res.status(400).json(error(ErrorCodes.APPOINTMENT_SLOT_UNAVAILABLE, statusMessage));
    }

    // Acquire advisory lock for queue assignment (based on doctor_id and date hash)
    // This ensures concurrent requests for the same doctor/date are serialized
    const lockHash = `md5(${doctorId}::text || ${appointmentDateOnly}::text)`;
    const lockResult = await client.query(
      `SELECT pg_try_advisory_xact_lock(hashtext($1)) as lock_acquired`,
      [lockHash]
    );

    if (!lockResult.rows[0].lock_acquired) {
      await client.query('ROLLBACK');
      return res.status(429).json(error(ErrorCodes.SERVER_ERROR, 'System is busy, please try again'));
    }

    // Check capacity (re-check after acquiring lock to ensure capacity hasn't been filled)
    const capacityResult = await client.query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2 FOR UPDATE',
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

    // Check for existing appointment on the same date (no specific time slot - first-come-first-served)
    const conflictResult = await client.query(
      `SELECT * FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2
       AND DATE(appointment_date) = $3
       AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [patientId, doctorId, appointmentDateOnly]
    );

    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'You already have an appointment with this doctor on this date'));
    }

    // Create appointment (store as date at start of day)
    const appointmentResult = await client.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, reason_for_visit, status)
       VALUES ($1, $2, $3, $4, 'SCHEDULED')
       RETURNING id`,
      [patientId, doctorId, appointmentDateOnly, reasonForVisit]
    );

    const appointmentId = appointmentResult.rows[0].id;

    // Get next queue number (now safe due to advisory lock)
    const queueResult = await client.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 as next_queue
       FROM queue_entries
       WHERE queue_date = $1 AND doctor_id = $2`,
      [appointmentDateOnly, doctorId]
    );

    const queueNumber = queueResult.rows[0].next_queue;

    // Create queue entry
    await client.query(
      `INSERT INTO queue_entries (patient_id, doctor_id, appointment_id, queue_date, queue_number, registration_source, status)
       VALUES ($1, $2, $3, $4, $5, 'ONLINE', 'WAITING')`,
      [patientId, doctorId, appointmentId, appointmentDateOnly, queueNumber]
    );

    // Update registered count
    await client.query(
      'UPDATE daily_capacities SET registered_count = registered_count + 1 WHERE doctor_id = $1 AND date = $2',
      [doctorId, appointmentDateOnly]
    );

    // Create payment record with specified payment method (default to CASH)
    // GCash payments start as PENDING_VERIFICATION, Cash payments start as UNPAID
    const finalPaymentMethod = paymentMethod || 'CASH';
    const paymentStatus = finalPaymentMethod.toUpperCase() === 'GCASH' ? 'PENDING_VERIFICATION' : 'UNPAID';
    await client.query(
      `INSERT INTO payments (patient_id, appointment_id, payment_method, consultation_amount, total_amount, status)
       VALUES ($1, $2, $3, $4, $4, $5)`,
      [patientId, appointmentId, finalPaymentMethod.toUpperCase(), doctor.consultation_fee, paymentStatus]
    );

    // Get total configured capacity for that day
    const totalCapacityResult = await client.query(
      `SELECT final_capacity as total_capacity
       FROM daily_capacities
       WHERE doctor_id = $1 AND date = $2`,
      [doctorId, appointmentDateOnly]
    );

    let totalPatients = 0;
    if (totalCapacityResult.rows.length > 0) {
      totalPatients = totalCapacityResult.rows[0].total_capacity;
    } else {
      // If no capacity record exists, calculate from working hours (30 min per consultation)
      const scheduleResult = await client.query(
        `SELECT start_time, end_time FROM doctor_schedules
         WHERE doctor_id = $1 AND day_of_week = EXTRACT(DOW FROM DATE($2))
         AND is_active = true`,
        [doctorId, appointmentDateOnly]
      );

      if (scheduleResult.rows.length > 0) {
        const schedule = scheduleResult.rows[0];
        const startMinutes = parseInt(schedule.start_time.split(':')[0]) * 60 + parseInt(schedule.start_time.split(':')[1]);
        const endMinutes = parseInt(schedule.end_time.split(':')[0]) * 60 + parseInt(schedule.end_time.split(':')[1]);
        totalPatients = Math.floor((endMinutes - startMinutes) / 30); // 30 min per consultation
      }
    }

    // Create notification
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'APPOINTMENT_CONFIRMED', 'Appointment Confirmed', 'Your appointment has been confirmed', 'appointment', $2)`,
      [userId, appointmentId]
    );

    await client.query('COMMIT');
    // Advisory lock is automatically released when transaction ends

    res.status(201).json(
      success({
        appointmentId,
        queueNumber,
        totalPatients,
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
               d.practice_name, d.practice_address, d.practice_latitude, d.practice_longitude, d.practice_phone,
               d.consultation_fee, d.professional_photo_url,
               q.queue_number, q.status as queue_status,
               COALESCE(q.registration_source, 'ONLINE') as registration_source,
               p.id as payment_id,
               p.status as payment_status,
               p.payment_method
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        LEFT JOIN payments p ON a.id = p.appointment_id
        WHERE a.id = $1 AND a.patient_id = (SELECT id FROM patients WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      queryText = `
        SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
               d.practice_name,
               d.consultation_fee,
               q.queue_number, q.status as queue_status,
               pay.id as payment_id,
               pay.status as payment_status,
               pay.payment_method
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN queue_entries q ON a.id = q.appointment_id
        LEFT JOIN payments pay ON a.id = pay.appointment_id
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

// Cancel appointment with queue reassignment
router.patch('/:id/cancel', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const userId = req.user!.id;

    // Load the appointment first, then authorise it, so a patient targeting
    // another patient's appointment gets 403 instead of a silent 404.
    const patientResult = await client.query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    const patientId = patientResult.rows[0].id;

    const appointmentResult = await client.query(
      `SELECT a.*, q.queue_number, q.queue_date
       FROM appointments a
       LEFT JOIN queue_entries q ON a.id = q.appointment_id
       WHERE a.id = $1`,
      [id]
    );

    if (appointmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.patient_id !== patientId) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only cancel your own appointments'));
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.INVALID_APPOINTMENT_STATUS, 'Cannot cancel this appointment'));
    }

    const appointmentDate = toClinicDateString(new Date(appointment.appointment_date));
    const cancelledQueueNumber = appointment.queue_number;
    // `queue_date` arrives as a Date from the driver; normalise it to the same
    // YYYY-MM-DD key used by booking/walk-ins so the advisory lock is shared.
    const queueDate = appointment.queue_date
      ? toClinicDateString(new Date(appointment.queue_date))
      : null;

    // Serialise queue reassignment for this doctor/date.
    const lockAcquired = await acquireQueueLocks(client, appointment.doctor_id, queueDate ? [queueDate] : []);

    if (!lockAcquired) {
      await client.query('ROLLBACK');
      return res.status(429).json(error(ErrorCodes.SERVER_ERROR, 'System is busy, please try again'));
    }

    // Update appointment status
    await client.query(
      "UPDATE appointments SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    // Handle payment based on payment method
    const paymentResult = await client.query(
      'SELECT id, payment_method, status FROM payments WHERE appointment_id = $1',
      [id]
    );

    if (paymentResult.rows.length > 0) {
      const payment = paymentResult.rows[0];

      if (payment.payment_method === 'CASH') {
        // Delete CASH payments on cancellation (no refund needed)
        await client.query('DELETE FROM payment_charges WHERE payment_id = $1', [payment.id]);
        await client.query('DELETE FROM payments WHERE id = $1', [payment.id]);
      } else if (payment.payment_method === 'GCASH') {
        // Mark GCASH payments as CANCELLED (for refund proof)
        await client.query(
          "UPDATE payments SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [payment.id]
        );
      }
    }

    // Delete the queue entry to free the queue slot (prevents unique constraint violation during renumbering)
    // The appointment record remains for audit purposes
    await client.query(
      "DELETE FROM queue_entries WHERE appointment_id = $1",
      [id]
    );

    // Close the gap left by the cancelled entry and notify affected patients
    await renumberQueueAfterRemoval(client, appointment.doctor_id, queueDate ?? '', cancelledQueueNumber);

    // Update capacity
    await client.query(
      'UPDATE daily_capacities SET registered_count = registered_count - 1 WHERE doctor_id = $1 AND date = $2',
      [appointment.doctor_id, appointmentDate]
    );

    // Notify the patient whose appointment was cancelled
    const cancellationMessage = cancelledQueueNumber
      ? `Your appointment on ${appointmentDate} has been cancelled. Queue number #${cancelledQueueNumber} has been released.`
      : `Your appointment on ${appointmentDate} has been cancelled.`;

    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'APPOINTMENT_CANCELLED', 'Appointment Cancelled', $2, 'appointment', $3)`,
      [userId, cancellationMessage, id]
    );

    await client.query('COMMIT');

    // Promote next patient from waitlist (after transaction commits)
    try {
      await promoteNextPatient(appointment.doctor_id, appointmentDate);
    } catch (promotionError) {
      console.error('Waitlist promotion error (non-blocking):', promotionError);
      // Don't fail the cancellation if promotion fails
    }

    res.json(success(null, 'Appointment cancelled successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Appointment cancellation error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to cancel appointment'));
  } finally {
    client.release();
  }
});

// Reschedule appointment
// Transactional flow: validate the target date against the doctor's schedule
// and capacity, move the appointment's queue entry to the end of the new
// date's queue, close the gap on the old date, keep both daily capacities in
// sync, and notify the patient with the old and new schedules.
router.patch('/:id/reschedule', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { newAppointmentDate } = req.body;
    const userId = req.user!.id;

    if (!newAppointmentDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'New appointment date is required'));
    }

    // Load the appointment first, then authorise it, so a patient targeting
    // another patient's appointment gets 403 instead of a silent 404.
    const patientResult = await client.query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    const patientId = patientResult.rows[0].id;

    const appointmentResult = await client.query(
      `SELECT a.*,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name,
              q.id as queue_entry_id, q.queue_number, q.queue_date,
              q.status as queue_status, q.started_at
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN queue_entries q ON a.id = q.appointment_id
       WHERE a.id = $1`,
      [id]
    );

    if (appointmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.patient_id !== patientId) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only reschedule your own appointments'));
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.INVALID_APPOINTMENT_STATUS, 'Only scheduled appointments can be rescheduled'));
    }

    // A patient cannot move a visit that has already started.
    const startedQueueStatuses = ['CALLED', 'IN_CHECKUP', 'COMPLETED'];
    if (appointment.started_at || startedQueueStatuses.includes(appointment.queue_status)) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.INVALID_APPOINTMENT_STATUS, 'This appointment has already started'));
    }

    const parsedNewDate = new Date(newAppointmentDate);
    if (Number.isNaN(parsedNewDate.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid appointment date'));
    }

    const oldDateOnly = toClinicDateString(new Date(appointment.appointment_date));
    const newDateOnly = toClinicDateString(parsedNewDate);
    const today = getClinicDate();

    if (newDateOnly === oldDateOnly) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'The new date must be different from the current appointment date'));
    }

    if (newDateOnly < today) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot reschedule to a past date'));
    }

    // Validate the target date against working hours, breaks, exceptions and
    // capacity before touching any data.
    const availability = await calculateAvailability(appointment.doctor_id, newDateOnly, patientId);

    if (availability.status === 'ALREADY_BOOKED') {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'You already have an appointment with this doctor on this date'));
    }

    if (availability.status !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      const statusMessage = {
        'FULL': 'No available slots for the new date',
        'UNAVAILABLE': 'Doctor is not available on this date',
        'PAST': 'Cannot reschedule to a past date',
        'NON_WORKING': 'Doctor is not working on this date'
      }[availability.status] || 'Date not available';
      const statusCode = availability.status === 'FULL'
        ? ErrorCodes.CAPACITY_FULL
        : ErrorCodes.APPOINTMENT_SLOT_UNAVAILABLE;
      return res.status(400).json(error(statusCode, statusMessage));
    }

    // Lock both dates (sorted inside the helper) so concurrent bookings,
    // walk-ins, cancellations and reschedules cannot interleave.
    const lockAcquired = await acquireQueueLocks(
      client,
      appointment.doctor_id,
      [oldDateOnly, newDateOnly]
    );

    if (!lockAcquired) {
      await client.query('ROLLBACK');
      return res.status(429).json(error(ErrorCodes.SERVER_ERROR, 'System is busy, please try again'));
    }

    // Re-read both capacity rows under lock; availability above may be stale.
    const capacityResult = await client.query(
      `SELECT date, final_capacity, registered_count
       FROM daily_capacities
       WHERE doctor_id = $1 AND date = ANY($2::date[])
       FOR UPDATE`,
      [appointment.doctor_id, [oldDateOnly, newDateOnly]]
    );

    const capacityByDate: Record<string, any> = {};
    for (const row of capacityResult.rows) {
      capacityByDate[toClinicDateString(new Date(row.date))] = row;
    }

    const newCapacity = capacityByDate[newDateOnly];

    if (!newCapacity) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.APPOINTMENT_SLOT_UNAVAILABLE, 'No capacity configured for the new date'));
    }

    if (Number(newCapacity.registered_count) >= Number(newCapacity.final_capacity)) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.CAPACITY_FULL, 'No available slots for the new date'));
    }

    // Reject a second visit with the same doctor on the target date.
    const conflictResult = await client.query(
      `SELECT id FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2
       AND DATE(appointment_date) = $3
       AND id <> $4
       AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [patientId, appointment.doctor_id, newDateOnly, id]
    );

    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'You already have an appointment with this doctor on this date'));
    }

    // Move the queue entry to the end of the new date's queue.
    let newQueueNumber: number | null = null;

    if (appointment.queue_entry_id) {
      newQueueNumber = await nextQueueNumber(client, appointment.doctor_id, newDateOnly);

      await client.query(
        `UPDATE queue_entries
         SET queue_date = $1,
             queue_number = $2,
             status = 'WAITING',
             called_at = NULL,
             started_at = NULL,
             completed_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newDateOnly, newQueueNumber, appointment.queue_entry_id]
      );

      // The moved entry now leaves a gap at its old position.
      await renumberQueueAfterRemoval(
        client,
        appointment.doctor_id,
        oldDateOnly,
        appointment.queue_number
      );
    }

    await client.query(
      'UPDATE appointments SET appointment_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newDateOnly, id]
    );

    // Update registered_count: decrement for old date, increment for new date
    await client.query(
      'UPDATE daily_capacities SET registered_count = GREATEST(registered_count - 1, 0) WHERE doctor_id = $1 AND date = $2',
      [appointment.doctor_id, oldDateOnly]
    );

    await client.query(
      'UPDATE daily_capacities SET registered_count = registered_count + 1 WHERE doctor_id = $1 AND date = $2',
      [appointment.doctor_id, newDateOnly]
    );

    // Notify the patient with both schedules (old and new).
    const doctorName = `Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}`.trim();
    const oldSchedule = appointment.queue_number
      ? `${oldDateOnly} (queue #${appointment.queue_number})`
      : oldDateOnly;
    const newSchedule = newQueueNumber
      ? `${newDateOnly} (queue #${newQueueNumber})`
      : newDateOnly;
    const rescheduleMessage =
      `Your appointment with ${doctorName} has been rescheduled from ${oldSchedule} to ${newSchedule}.`;

    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'APPOINTMENT_RESCHEDULED', 'Appointment Rescheduled', $2, 'appointment', $3)`,
      [userId, rescheduleMessage, id]
    );

    await client.query('COMMIT');

    // Promote next patient from waitlist for the old date (after transaction commits)
    try {
      await promoteNextPatient(appointment.doctor_id, oldDateOnly);
    } catch (promotionError) {
      console.error('Waitlist promotion error (non-blocking):', promotionError);
      // Don't fail the reschedule if promotion fails
    }

    res.json(success({
      appointmentId: id,
      previousDate: oldDateOnly,
      previousQueueNumber: appointment.queue_number ?? null,
      appointmentDate: newDateOnly,
      queueNumber: newQueueNumber,
    }, 'Appointment rescheduled successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Appointment reschedule error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reschedule appointment'));
  } finally {
    client.release();
  }
});

export default router;