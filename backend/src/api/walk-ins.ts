import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// Valid sex values
const VALID_SEX_VALUES = ['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'];

// Mobile number regex (Philippine and international formats)
const MOBILE_REGEX = /^[\d\s\-\+\(\)]+$/;

// Search for patient by email (restricted to secretary's assigned doctor's patients)
router.get('/search', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email is required'));
    }

    // Get secretary's assigned doctor ID
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Search for patient by email, but only if they have an association with the assigned doctor
    const result = await query(
      `SELECT u.id, u.email, u.role, u.must_change_password,
              p.id as patient_id, p.first_name, p.last_name
       FROM users u
       JOIN patients p ON u.id = p.user_id
       WHERE u.email = $1 AND u.role = 'PATIENT'
       AND EXISTS (
         SELECT 1 FROM patient_doctor_associations pda
         WHERE pda.patient_id = p.id AND pda.doctor_id = $2
       )
       LIMIT 1`,
      [email, assignedDoctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found or not associated with your assigned doctor'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to search for patient'));
  }
});

// Create account for walk-in patient
router.post('/create-account', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { email, firstName, lastName, doctorId } = req.body;

    if (!email || !firstName || !lastName || !doctorId) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email, first name, last name, and doctor ID are required'));
    }

    // Verify secretary is assigned to the requested doctor
    const secretaryResult = await client.query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    if (assignedDoctorId !== doctorId) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only create accounts for your assigned doctor'));
    }

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
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
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, must_change_password)
       VALUES ($1, $2, 'PATIENT', true)
       RETURNING id, email, must_change_password`,
      [email, passwordHash]
    );

    const user = userResult.rows[0];

    // Create patient profile
    const patientResult = await client.query(
      `INSERT INTO patients (user_id, first_name, last_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [user.id, firstName, lastName]
    );

    const patientId = patientResult.rows[0].id;

    // Create patient-doctor association with PENDING status since only basic info (email, first name, last name) was collected
    // Full required details (date of birth, sex, phone, address) must be submitted later via /walk-ins/submit-patient-details
    await client.query(
      `INSERT INTO patient_doctor_associations (patient_id, doctor_id, details_completion_status, first_details_submitted_at)
       VALUES ($1, $2, 'PENDING', CURRENT_TIMESTAMP)
       ON CONFLICT (patient_id, doctor_id) DO UPDATE SET
         details_completion_status = patient_doctor_associations.details_completion_status,
         first_details_submitted_at = LEAST(patient_doctor_associations.first_details_submitted_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP`,
      [patientId, doctorId]
    );

    await client.query('COMMIT');

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
    await client.query('ROLLBACK');
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create account'));
  } finally {
    client.release();
  }
});

// Register walk-in patient (atomic transaction with concurrency-safe queue assignment)
router.post('/', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { patientId, doctorId, appointmentDate, reasonForVisit } = req.body;

    // Basic validation
    if (!patientId || !doctorId || !appointmentDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Patient ID, doctor ID, and appointment date are required'));
    }

    // Verify secretary is assigned to the requested doctor
    const secretaryResult = await client.query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    if (assignedDoctorId !== doctorId) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only register walk-in patients for your assigned doctor'));
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

    // Verify patient has a COMPLETE association with this doctor before allowing walk-in registration
    // This ensures that preliminary walk-in accounts (PENDING status) cannot book appointments
    const associationCheckResult = await client.query(
      `SELECT details_completion_status
       FROM patient_doctor_associations
       WHERE patient_id = $1 AND doctor_id = $2`,
      [patientId, doctorId]
    );

    if (associationCheckResult.rows.length === 0) {
      // No association exists - check appointments table for backward compatibility with legacy records
      const appointmentHistoryResult = await client.query(
        `SELECT COUNT(*) as count
         FROM appointments
         WHERE patient_id = $1 AND doctor_id = $2`,
        [patientId, doctorId]
      );

      const hasAppointments = appointmentHistoryResult.rows.length > 0 && parseInt(appointmentHistoryResult.rows[0].count) > 0;

      if (!hasAppointments) {
        await client.query('ROLLBACK');
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Patient is not associated with this doctor. Please submit patient details first.'));
      }

      // Legacy appointment history exists - verify patient profile is complete before allowing registration
      const patient = patientResult.rows[0];
      const isProfileComplete =
        patient.first_name && patient.first_name.trim() !== '' &&
        patient.last_name && patient.last_name.trim() !== '' &&
        patient.date_of_birth !== null &&
        patient.sex !== null && ['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'].includes(patient.sex) &&
        patient.phone && patient.phone.trim() !== '' &&
        patient.address && patient.address.trim() !== '';

      if (!isProfileComplete) {
        await client.query('ROLLBACK');
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Patient details are incomplete. Please submit required patient details before registering for an appointment.'));
      }

      // Legacy patient has complete profile - association will be created later in the transaction
    } else {
      // Explicit association exists - respect its status
      if (associationCheckResult.rows[0].details_completion_status !== 'COMPLETE') {
        await client.query('ROLLBACK');
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Patient details are incomplete. Please submit required patient details before registering for an appointment.'));
      }
      // COMPLETE association - proceed with registration
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
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, reason_for_visit, status)
       VALUES ($1, $2, $3, $4, 'SCHEDULED')
       RETURNING id`,
      [patientId, doctorId, appointmentDate, reasonForVisit]
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

    // Create queue entry with WALK_IN source
    await client.query(
      `INSERT INTO queue_entries (patient_id, doctor_id, appointment_id, queue_date, queue_number, registration_source, status)
       VALUES ($1, $2, $3, $4, $5, 'WALK_IN', 'WAITING')`,
      [patientId, doctorId, appointmentId, appointmentDateOnly, queueNumber]
    );

    // Create or update patient-doctor association with COMPLETE status
    // Walk-in registration assumes the patient already has complete details (either from existing account or prior submission)
    await client.query(
      `INSERT INTO patient_doctor_associations (patient_id, doctor_id, details_completion_status, first_details_submitted_at)
       VALUES ($1, $2, 'COMPLETE', CURRENT_TIMESTAMP)
       ON CONFLICT (patient_id, doctor_id) DO UPDATE SET
         details_completion_status = 'COMPLETE',
         first_details_submitted_at = LEAST(patient_doctor_associations.first_details_submitted_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP`,
      [patientId, doctorId]
    );

    // Update registered count
    await client.query(
      'UPDATE daily_capacities SET registered_count = registered_count + 1 WHERE doctor_id = $1 AND date = $2',
      [doctorId, appointmentDateOnly]
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
       VALUES ((SELECT user_id FROM patients WHERE id = $1), 'APPOINTMENT_CONFIRMED', 'Walk-in Registration Confirmed', 'Your walk-in registration has been confirmed', 'appointment', $2)`,
      [patientId, appointmentId]
    );

    await client.query('COMMIT');
    // Advisory lock is automatically released when transaction ends

    res.status(201).json(
      success({
        appointmentId,
        queueNumber,
        totalPatients,
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

// Submit patient details for walk-in registration (secretary-only)
// This endpoint allows secretaries to update patient details during walk-in registration
// It requires the secretary to be assigned to the doctor
router.post('/submit-patient-details', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const userId = req.user!.id;
    const { patientId, doctorId, firstName, middleName, lastName, dateOfBirth, sex, phone, address, emergencyContactName, emergencyContactPhone, medicalHistory, allergies, currentMedications } = req.body;

    // Validate required fields
    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Patient ID is required'));
    }

    if (!doctorId) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor ID is required'));
    }

    if (!firstName || typeof firstName !== 'string') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'First name is required'));
    }

    if (!lastName || typeof lastName !== 'string') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Last name is required'));
    }

    if (!dateOfBirth || typeof dateOfBirth !== 'string') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date of birth is required'));
    }

    if (!sex || typeof sex !== 'string') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Sex is required'));
    }

    if (!phone || typeof phone !== 'string') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Mobile number is required'));
    }

    if (!address || typeof address !== 'string') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Address is required'));
    }

    // Verify secretary is assigned to the requested doctor
    const secretaryResult = await client.query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    if (assignedDoctorId !== doctorId) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only submit patient details for your assigned doctor'));
    }

    // Verify patient exists
    const patientResult = await client.query(
      'SELECT id FROM patients WHERE id = $1',
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }

    // Verify doctor exists and is approved
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE id = $1 AND is_approved = true',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found or not approved'));
    }

    // Verify the patient-doctor relationship exists and is authorized for this secretary
    // The secretary can only submit details for patients associated with their assigned doctor
    const associationResult = await client.query(
      `SELECT id, details_completion_status
       FROM patient_doctor_associations
       WHERE patient_id = $1 AND doctor_id = $2`,
      [patientId, doctorId]
    );

    if (associationResult.rows.length === 0) {
      // No association exists - check appointments table for backward compatibility with legacy records
      // Legacy patients with appointment history but no association should be allowed to complete details
      const appointmentCheckResult = await client.query(
        `SELECT COUNT(*) as count
         FROM appointments
         WHERE patient_id = $1 AND doctor_id = $2`,
        [patientId, doctorId]
      );

      const hasAppointments = appointmentCheckResult.rows.length > 0 && parseInt(appointmentCheckResult.rows[0].count) > 0;

      if (!hasAppointments) {
        await client.query('ROLLBACK');
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Patient is not associated with this doctor. You can only submit details for patients associated with your assigned doctor.'));
      }
      // Legacy appointment history exists - allow details submission
    } else {
      // Explicit association exists - allow regardless of status (PENDING or COMPLETE)
      // Both are valid for details submission
    }

    // Trim whitespace
    const trimmedFirstName = firstName.trim();
    const trimmedMiddleName = middleName ? middleName.trim() : null;
    const trimmedLastName = lastName.trim();
    const trimmedSex = sex.trim().toUpperCase();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();

    // Length validation
    if (trimmedFirstName.length === 0 || trimmedFirstName.length > 100) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'First name must be 1-100 characters'));
    }

    if (trimmedMiddleName && trimmedMiddleName.length > 100) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Middle name must be maximum 100 characters'));
    }

    if (trimmedLastName.length === 0 || trimmedLastName.length > 100) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Last name must be 1-100 characters'));
    }

    if (trimmedPhone.length === 0 || trimmedPhone.length > 20) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Mobile number must be 1-20 characters'));
    }

    if (trimmedAddress.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Address is required'));
    }

    // Validate sex value
    if (!VALID_SEX_VALUES.includes(trimmedSex)) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Sex must be one of: MALE, FEMALE, OTHER, NOT_SPECIFIED'));
    }

    // Validate mobile number format
    if (!MOBILE_REGEX.test(trimmedPhone)) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Mobile number must contain only digits, spaces, hyphens, plus sign, or parentheses'));
    }

    // Validate date of birth
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid date of birth format'));
    }

    // Ensure date of birth is not in the future
    const now = new Date();
    if (dob > now) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date of birth cannot be in the future'));
    }

    // Update patient profile with all required details
    const patientUpdateResult = await client.query(
      `UPDATE patients
       SET first_name = $1,
           middle_name = $2,
           last_name = $3,
           date_of_birth = $4::date,
           sex = $5,
           phone = $6,
           address = $7,
           emergency_contact_name = COALESCE($8, emergency_contact_name),
           emergency_contact_phone = COALESCE($9, emergency_contact_phone),
           medical_history = COALESCE($10, medical_history),
           allergies = COALESCE($11, allergies),
           current_medications = COALESCE($12, current_medications),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING id, first_name, middle_name, last_name, date_of_birth, sex, phone, address,
                emergency_contact_name, emergency_contact_phone, medical_history, allergies, current_medications`,
      [
        trimmedFirstName,
        trimmedMiddleName,
        trimmedLastName,
        dateOfBirth,
        trimmedSex,
        trimmedPhone,
        trimmedAddress,
        emergencyContactName || null,
        emergencyContactPhone || null,
        medicalHistory || null,
        allergies || null,
        currentMedications || null,
        patientId
      ]
    );

    // Create or update patient-doctor association to mark details as COMPLETE
    // This ensures legacy patients with appointment history but no association get a persistent COMPLETE association
    // Existing PENDING associations are upgraded to COMPLETE
    // Existing COMPLETE associations remain COMPLETE with timestamp preservation
    await client.query(
      `INSERT INTO patient_doctor_associations (patient_id, doctor_id, details_completion_status, first_details_submitted_at, updated_at)
       VALUES ($1, $2, 'COMPLETE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (patient_id, doctor_id) DO UPDATE SET
         details_completion_status = 'COMPLETE',
         first_details_submitted_at = LEAST(patient_doctor_associations.first_details_submitted_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP`,
      [patientId, doctorId]
    );

    await client.query('COMMIT');

    res.json(success(patientUpdateResult.rows[0], 'Patient details submitted successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Walk-in patient details submission error:', err);

    // Handle unique constraint violations
    if (err.code === '23505') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Patient-doctor association already exists'));
    }

    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to submit patient details'));
  } finally {
    client.release();
  }
});

export default router;