import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requirePasswordChange } from '../middleware/auth';

const router = Router();

// Valid sex values
const VALID_SEX_VALUES = ['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'];

// Mobile number regex (Philippine and international formats)
const MOBILE_REGEX = /^[\d\s\-\+\(\)]+$/;

// Get current patient's own profile (authenticated patient only)
router.get('/me', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT
        p.id, p.user_id, p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.sex, p.phone, p.address,
        p.emergency_contact_name, p.emergency_contact_phone, p.medical_history, p.allergies, p.current_medications,
        u.email, u.username
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch patient profile'));
  }
});

// Update current patient's own profile (authenticated patient only)
router.put('/me', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      sex,
      phone,
      address,
      emergencyContactName,
      emergencyContactPhone,
      medicalHistory,
      allergies,
      currentMedications
    } = req.body;

    // Validate required fields
    if (!firstName || typeof firstName !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'First name is required'));
    }

    if (!lastName || typeof lastName !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Last name is required'));
    }

    if (!dateOfBirth || typeof dateOfBirth !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date of birth is required'));
    }

    if (!sex || typeof sex !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Sex is required'));
    }

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Mobile number is required'));
    }

    if (!address || typeof address !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Address is required'));
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
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'First name must be 1-100 characters'));
    }

    if (trimmedMiddleName && trimmedMiddleName.length > 100) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Middle name must be maximum 100 characters'));
    }

    if (trimmedLastName.length === 0 || trimmedLastName.length > 100) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Last name must be 1-100 characters'));
    }

    if (trimmedPhone.length === 0 || trimmedPhone.length > 20) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Mobile number must be 1-20 characters'));
    }

    if (trimmedAddress.length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Address is required'));
    }

    // Validate sex value
    if (!VALID_SEX_VALUES.includes(trimmedSex)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Sex must be one of: MALE, FEMALE, OTHER, NOT_SPECIFIED'));
    }

    // Validate mobile number format
    if (!MOBILE_REGEX.test(trimmedPhone)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Mobile number must contain only digits, spaces, hyphens, plus sign, or parentheses'));
    }

    // Validate date of birth
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid date of birth format'));
    }

    // Ensure date of birth is not in the future
    const now = new Date();
    if (dob > now) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date of birth cannot be in the future'));
    }

    // Update patient profile using authenticated user_id
    const result = await query(
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
       WHERE user_id = $13
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
        userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    res.json(success(result.rows[0], 'Profile updated successfully'));
  } catch (err: any) {
    console.error('Patient profile update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update profile'));
  }
});

// Check if authenticated patient has an existing record with a specific doctor
// This endpoint is used before appointment booking to determine if patient details are needed
router.get('/check-record', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { doctorId } = req.query;

    if (!doctorId) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor ID is required'));
    }

    // Get patient ID
    const patientResult = await query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    const patientId = patientResult.rows[0].id;

    // Check if patient has any association with this doctor (patient_doctor_associations table)
    // An explicit PENDING association must be respected - it overrides the appointment-history fallback
    const associationResult = await query(
      `SELECT details_completion_status
       FROM patient_doctor_associations
       WHERE patient_id = $1 AND doctor_id = $2`,
      [patientId, doctorId]
    );

    if (associationResult.rows.length > 0) {
      // Explicit association exists - respect its status
      const status = associationResult.rows[0].details_completion_status;
      const hasRecord = status === 'COMPLETE';

      return res.json(success({
        hasRecord,
        patientId,
        doctorId
      }, hasRecord ? 'Patient has existing record with this doctor' : 'Patient record is incomplete. Please submit required details.'));
    }

    // No association exists - check appointments table for backward compatibility with legacy records
    const appointmentResult = await query(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2`,
      [patientId, doctorId]
    );

    const hasAppointments = parseInt(appointmentResult.rows[0].count) > 0;

    if (hasAppointments) {
      // Legacy appointment history exists - verify patient profile is complete
      const patientResult = await query(
        'SELECT first_name, last_name, date_of_birth, sex, phone, address FROM patients WHERE id = $1',
        [patientId]
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
      }

      const patient = patientResult.rows[0];
      const isProfileComplete =
        patient.first_name && patient.first_name.trim() !== '' &&
        patient.last_name && patient.last_name.trim() !== '' &&
        patient.date_of_birth !== null &&
        patient.sex !== null && VALID_SEX_VALUES.includes(patient.sex) &&
        patient.phone && patient.phone.trim() !== '' &&
        patient.address && patient.address.trim() !== '';

      if (!isProfileComplete) {
        return res.json(success({
          hasRecord: false,
          patientId,
          doctorId
        }, 'Patient record is incomplete. Please submit required details.'));
      }

      // Legacy patient has complete profile - treat as having a record
      return res.json(success({
        hasRecord: true,
        patientId,
        doctorId
      }, 'Patient has existing record with this doctor'));
    }

    res.json(success({
      hasRecord: false,
      patientId,
      doctorId
    }, 'No existing record with this doctor'));
  } catch (err: any) {
    console.error('Patient record check error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to check patient record'));
  }
});

// Submit patient details for a specific doctor (before first booking)
// This creates a persistent patient-doctor association so the patient can proceed with booking
router.post('/submit-details', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const userId = req.user!.id;
    const { doctorId, firstName, middleName, lastName, dateOfBirth, sex, phone, address, emergencyContactName, emergencyContactPhone, medicalHistory, allergies, currentMedications } = req.body;

    // Validate required fields
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

    // Verify doctor exists and is approved
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE id = $1 AND is_approved = true',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found or not approved'));
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

    // Create or update patient-doctor association with COMPLETE status
    await client.query(
      `INSERT INTO patient_doctor_associations (patient_id, doctor_id, details_completion_status, first_details_submitted_at)
       VALUES ($1, $2, 'COMPLETE', CURRENT_TIMESTAMP)
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
    console.error('Patient details submission error:', err);

    // Handle unique constraint violations
    if (err.code === '23505') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Patient-doctor association already exists'));
    }

    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to submit patient details'));
  } finally {
    client.release();
  }
});

// Get patients for a specific doctor (authenticated doctor only)
// Returns all patients who have associations or appointments with this doctor
router.get('/doctor/:doctorId', authenticate, requirePasswordChange, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.params;
    const userId = req.user!.id;

    // Verify the authenticated user is the requested doctor
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE id = $1 AND user_id = $2',
      [doctorId, userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Access denied'));
    }

    // Get all patients who have associations or appointments with this doctor
    const result = await query(
      `SELECT DISTINCT
        p.id, p.user_id, p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.sex, p.phone, p.address,
        p.emergency_contact_name, p.emergency_contact_phone, p.medical_history, p.allergies, p.current_medications,
        u.email
       FROM patients p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN patient_doctor_associations pda ON pda.patient_id = p.id AND pda.doctor_id = $1
       LEFT JOIN appointments a ON a.patient_id = p.id AND a.doctor_id = $1
       WHERE pda.doctor_id = $1 OR a.doctor_id = $1
       ORDER BY p.last_name, p.first_name`,
      [doctorId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    console.error('Doctor patients fetch error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch patients'));
  }
});

// Search patients (for secretaries to find patients for walk-in registration)
// Restricted to patients of the secretary's assigned doctor
router.get('/search', authenticate, requirePasswordChange, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, phone, firstName, lastName } = req.query;

    if (!email && !phone && !firstName && !lastName) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'At least one search parameter is required'));
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

    let queryText = `
      SELECT
        p.id, p.user_id, p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.sex, p.phone, p.address,
        p.emergency_contact_name, p.emergency_contact_phone, p.medical_history, p.allergies, p.current_medications,
        u.email, u.username
      FROM patients p
      JOIN users u ON u.id = p.user_id
      WHERE u.role = 'PATIENT'
      AND (
        EXISTS (
          SELECT 1 FROM patient_doctor_associations pda
          WHERE pda.patient_id = p.id AND pda.doctor_id = $1
        )
        OR EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.patient_id = p.id AND a.doctor_id = $1
        )
      )
    `;
    const params: any[] = [assignedDoctorId];
    let paramCount = 1;

    if (email) {
      paramCount++;
      queryText += ` AND u.email ILIKE $${paramCount}`;
      params.push(`%${email}%`);
    }

    if (phone) {
      paramCount++;
      queryText += ` AND p.phone ILIKE $${paramCount}`;
      params.push(`%${phone}%`);
    }

    if (firstName) {
      paramCount++;
      queryText += ` AND p.first_name ILIKE $${paramCount}`;
      params.push(`%${firstName}%`);
    }

    if (lastName) {
      paramCount++;
      queryText += ` AND p.last_name ILIKE $${paramCount}`;
      params.push(`%${lastName}%`);
    }

    queryText += ' ORDER BY p.last_name, p.first_name LIMIT 50';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    console.error('Patient search error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to search patients'));
  }
});

// Get patient by ID (for doctors and secretaries to view patient details)
// Doctor: can only view patients they have associations or appointments with
// Secretary: can only view patients of their assigned doctor
router.get('/:id', authenticate, requirePasswordChange, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'DOCTOR') {
      // Doctor can only view patients they have associations or appointments with
      queryText = `
        SELECT
          p.id, p.user_id, p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.sex, p.phone, p.address,
          p.emergency_contact_name, p.emergency_contact_phone, p.medical_history, p.allergies, p.current_medications,
          u.email
        FROM patients p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = $1
        AND (
          EXISTS (
            SELECT 1 FROM patient_doctor_associations pda
            WHERE pda.patient_id = p.id AND pda.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
          )
          OR EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.patient_id = p.id AND a.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
          )
        )
      `;
      params.push(userId);
    } else if (role === 'SECRETARY') {
      // Secretary can only view patients of their assigned doctor
      queryText = `
        SELECT
          p.id, p.user_id, p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.sex, p.phone, p.address,
          p.emergency_contact_name, p.emergency_contact_phone, p.medical_history, p.allergies, p.current_medications,
          u.email
        FROM patients p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = $1
        AND (
          EXISTS (
            SELECT 1 FROM patient_doctor_associations pda
            WHERE pda.patient_id = p.id AND pda.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)
          )
          OR EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.patient_id = p.id AND a.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)
          )
        )
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found or access denied'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    console.error('Patient fetch error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch patient'));
  }
});

export default router;
