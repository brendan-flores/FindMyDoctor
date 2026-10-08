import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { calculateCapacity, calculateCapacityRange } from '../modules/capacity/capacityService';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { uploadDoctorPhoto, deleteDoctorPhoto, replaceDoctorPhoto, validateImageFile } from '../services/storageService';

const router = Router();

// Configure multer for photo upload (memory storage for Supabase)
const storage = multer.memoryStorage();

// File filter - accept PNG only per architecture requirements
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Only PNG files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB
  }
});

// Get current doctor (authenticated)
router.get('/me', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT
        d.id, d.user_id, d.first_name, d.middle_name, d.last_name, d.specialty, d.credentials,
        d.prc_license_number, d.practice_name, d.practice_phone, d.practice_email, d.room_number,
        d.contact_number, d.professional_photo_url, d.years_of_experience, d.areas_of_expertise,
        d.biography, d.consultation_fee, d.languages_spoken,
        d.two_factor_enabled, d.is_approved, d.approval_status, d.profile_completion_status,
        d.profile_submitted_at, d.rejection_reason
       FROM doctors d
       WHERE d.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor profile'));
  }
});

// List secretaries assigned to the authenticated doctor
router.get('/secretaries', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
        s.id, s.doctor_id, s.first_name, s.middle_name, s.last_name, s.contact_number,
        s.is_approved, s.created_at,
        u.email, u.is_active, u.must_change_password
       FROM doctors d
       INNER JOIN secretaries s ON s.doctor_id = d.id
       INNER JOIN users u ON u.id = s.user_id
       WHERE d.user_id = $1 AND u.role = 'SECRETARY'
       ORDER BY s.created_at DESC`,
      [req.user!.id]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    console.error('Failed to fetch Doctor secretaries:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch secretaries'));
  }
});

// Get all doctors (public search)
router.get('/', async (req: any, res: Response) => {
  try {
    const { specialty, search } = req.query;

    let queryText = `
      SELECT
        d.id, d.first_name, d.middle_name, d.last_name, d.specialty, d.credentials,
        d.biography, d.consultation_fee, d.is_approved, d.approval_status,
        d.practice_name, d.practice_address, d.practice_latitude, d.practice_longitude,
        d.practice_phone, d.practice_email, d.practice_description,
        d.operating_hours_start, d.operating_hours_end,
        d.professional_photo_url, d.years_of_experience, d.areas_of_expertise,
        d.languages_spoken
      FROM doctors d
      WHERE d.approval_status = 'ACTIVE'
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (specialty) {
      paramCount++;
      queryText += ` AND d.specialty = $${paramCount}`;
      params.push(specialty);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (d.first_name ILIKE $${paramCount} OR d.middle_name ILIKE $${paramCount} OR d.last_name ILIKE $${paramCount} OR d.specialty ILIKE $${paramCount} OR d.practice_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryText += ' ORDER BY d.last_name';

    const result = await query(queryText, params);

    // Privacy: PRC license number, contact_number, and email are not selected from the database
    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctors'));
  }
});

// Get doctor by ID (public endpoint - privacy-aware)
router.get('/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        d.id, d.first_name, d.middle_name, d.last_name, d.specialty, d.credentials,
        d.biography, d.consultation_fee, d.is_approved, d.approval_status,
        d.practice_name, d.practice_address, d.practice_latitude, d.practice_longitude,
        d.practice_phone, d.practice_email, d.practice_description,
        d.operating_hours_start, d.operating_hours_end,
        d.professional_photo_url, d.years_of_experience, d.areas_of_expertise,
        d.languages_spoken
       FROM doctors d
       WHERE d.id = $1 AND d.approval_status = 'ACTIVE'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    // Privacy: PRC license number, contact_number, and email are not selected from the database
    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor'));
  }
});

// Get authenticated doctor's schedules (with active/inactive filter) - MUST be before /:id/schedules
router.get('/me/schedules', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;
    const { includeInactive } = req.query;

    let queryText = 'SELECT * FROM doctor_schedules WHERE doctor_id = $1';
    const params = [doctorId];

    if (includeInactive !== 'true') {
      queryText += ' AND is_active = true';
    }

    queryText += ' ORDER BY day_of_week, start_time';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor schedules'));
  }
});

// Get doctor schedules (public - for doctor profile display)
router.get('/:id/schedules', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM doctor_schedules WHERE doctor_id = $1 AND is_active = true ORDER BY day_of_week, start_time',
      [id]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor schedules'));
  }
});

// Create schedule for authenticated doctor
router.post('/me/schedules', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { dayOfWeek, startTime, endTime, consultation_duration_minutes } = req.body;

    // Validation
    if (dayOfWeek === undefined || !startTime || !endTime) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'dayOfWeek, startTime, and endTime are required'));
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)'));
    }

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Validate time format and convert to TIME
    const startTimeDate = new Date(`2000-01-01T${startTime}`);
    const endTimeDate = new Date(`2000-01-01T${endTime}`);

    if (isNaN(startTimeDate.getTime()) || isNaN(endTimeDate.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid time format. Use HH:MM format'));
    }

    // Validate start time < end time
    if (startTimeDate >= endTimeDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Start time must be before end time'));
    }

    // Check for overlapping schedules on the same day
    const overlapResult = await client.query(
      `SELECT * FROM doctor_schedules
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true
       AND (
         (start_time < $3 AND end_time > $3) OR
         (start_time < $4 AND end_time > $4) OR
         (start_time >= $3 AND end_time <= $4)
       )`,
      [doctorId, dayOfWeek, startTime, endTime]
    );

    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Schedule overlaps with an existing schedule'));
    }

    // Create schedule
    const result = await client.query(
      `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, consultation_duration_minutes, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [doctorId, dayOfWeek, startTime, endTime, consultation_duration_minutes || 30]
    );

    await client.query('COMMIT');

    res.status(201).json(success(result.rows[0], 'Schedule created successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Schedule creation error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create schedule'));
  } finally {
    client.release();
  }
});

// Update schedule for authenticated doctor
router.put('/me/schedules/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, consultation_duration_minutes } = req.body;

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify the schedule belongs to the authenticated doctor
    const scheduleResult = await client.query(
      'SELECT * FROM doctor_schedules WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (scheduleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Schedule not found or access denied'));
    }

    // Validation
    if (dayOfWeek === undefined || !startTime || !endTime) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'dayOfWeek, startTime, and endTime are required'));
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)'));
    }

    // Validate time format
    const startTimeDate = new Date(`2000-01-01T${startTime}`);
    const endTimeDate = new Date(`2000-01-01T${endTime}`);

    if (isNaN(startTimeDate.getTime()) || isNaN(endTimeDate.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid time format. Use HH:MM format'));
    }

    // Validate start time < end time
    if (startTimeDate >= endTimeDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Start time must be before end time'));
    }

    // Check for overlapping schedules on the same day (excluding current schedule)
    const overlapResult = await client.query(
      `SELECT * FROM doctor_schedules
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true AND id != $3
       AND (
         (start_time < $4 AND end_time > $4) OR
         (start_time < $5 AND end_time > $5) OR
         (start_time >= $4 AND end_time <= $5)
       )`,
      [doctorId, dayOfWeek, id, startTime, endTime]
    );

    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Schedule overlaps with an existing schedule'));
    }

    // Update schedule
    const result = await client.query(
      `UPDATE doctor_schedules
       SET day_of_week = $1, start_time = $2, end_time = $3, consultation_duration_minutes = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND doctor_id = $6
       RETURNING *`,
      [dayOfWeek, startTime, endTime, consultation_duration_minutes || 30, id, doctorId]
    );

    await client.query('COMMIT');

    res.json(success(result.rows[0], 'Schedule updated successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Schedule update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update schedule'));
  } finally {
    client.release();
  }
});

// Delete schedule for authenticated doctor
router.delete('/me/schedules/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify the schedule belongs to the authenticated doctor
    const scheduleResult = await query(
      'SELECT * FROM doctor_schedules WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Schedule not found or access denied'));
    }

    // Delete schedule
    const result = await query(
      `DELETE FROM doctor_schedules WHERE id = $1 AND doctor_id = $2 RETURNING *`,
      [id, doctorId]
    );

    res.json(success(result.rows[0], 'Schedule deleted successfully'));
  } catch (err: any) {
    console.error('Schedule deletion error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete schedule'));
  }
});

// Reactivate schedule for authenticated doctor
router.patch('/me/schedules/:id/reactivate', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify the schedule belongs to the authenticated doctor
    const scheduleResult = await client.query(
      'SELECT * FROM doctor_schedules WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (scheduleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Schedule not found or access denied'));
    }

    const schedule = scheduleResult.rows[0];

    // Check for overlapping schedules on the same day (since we're reactivating)
    const overlapResult = await client.query(
      `SELECT * FROM doctor_schedules
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true AND id != $3
       AND (
         (start_time < $4 AND end_time > $4) OR
         (start_time < $5 AND end_time > $5) OR
         (start_time >= $4 AND end_time <= $5)
       )`,
      [doctorId, schedule.day_of_week, id, schedule.start_time, schedule.end_time]
    );

    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Cannot reactivate: schedule overlaps with an existing active schedule'));
    }

    // Reactivate schedule
    const result = await client.query(
      `UPDATE doctor_schedules
       SET is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND doctor_id = $2
       RETURNING *`,
      [id, doctorId]
    );

    await client.query('COMMIT');

    res.json(success(result.rows[0], 'Schedule reactivated successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Schedule reactivation error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reactivate schedule'));
  } finally {
    client.release();
  }
});

// Get doctor availability for a date range
router.get('/:id/availability', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Start date and end date are required'));
    }

    // Get active unavailability periods (exceptions)
    const unavailabilityResult = await query(
      `SELECT * FROM doctor_unavailability
       WHERE doctor_id = $1 AND is_active = true
       AND (start_date <= $2 AND end_date >= $3)
       ORDER BY start_date`,
      [id, endDate, startDate]
    );

    // Get active break periods for the date range
    const breakPeriodsResult = await query(
      `SELECT * FROM doctor_break_periods
       WHERE doctor_id = $1 AND is_active = true
       AND break_date >= $2 AND break_date <= $3
       ORDER BY break_date, start_time`,
      [id, startDate, endDate]
    );

    // Get daily capacities
    const capacityResult = await query(
      `SELECT date, final_capacity, registered_count
       FROM daily_capacities
       WHERE doctor_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date`,
      [id, startDate, endDate]
    );

    res.json(success({
      unavailability: unavailabilityResult.rows,
      breakPeriods: breakPeriodsResult.rows,
      capacities: capacityResult.rows,
    }));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch availability'));
  }
});

// ============================================
// DOCTOR CAPACITY ENDPOINTS
// ============================================

// Get authenticated doctor's capacity - MUST be before /:id/capacity
router.get('/me/capacity', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, startDate, endDate } = req.query;

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    if (date) {
      // Get capacity for a specific date
      const capacity = await calculateCapacity(doctorId, String(date));
      res.json(success(capacity));
    } else if (startDate && endDate) {
      // Get capacity for a date range
      const capacityMap = await calculateCapacityRange(doctorId, String(startDate), String(endDate));
      const capacityArray = Array.from(capacityMap.entries()).map(([date, capacity]) => ({
        date,
        ...capacity,
      }));
      res.json(success(capacityArray));
    } else {
      // Return error if no date or range provided
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date or date range (startDate and endDate) is required'));
    }
  } catch (err: any) {
    console.error('Error fetching doctor capacity:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch capacity'));
  }
});

// Update authenticated doctor's capacity - MUST be before /:id/capacity
router.put('/me/capacity', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, configuredCapacity } = req.body;

    if (!date || configuredCapacity === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date and configured capacity are required'));
    }

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Calculate current capacity to get the calculated capacity
    const currentCapacity = await calculateCapacity(doctorId, date);

    // Validate configured capacity doesn't exceed calculated capacity
    if (configuredCapacity !== null && configuredCapacity !== undefined && configuredCapacity > currentCapacity.calculated_capacity) {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `Configured capacity cannot exceed calculated capacity of ${currentCapacity.calculated_capacity}`
      ));
    }

    // Check if capacity exists
    const existingResult = await query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
      [doctorId, date]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Capacity record not found'));
    }

    const finalCapacity = configuredCapacity !== null && configuredCapacity !== undefined
      ? Math.min(currentCapacity.calculated_capacity, configuredCapacity)
      : currentCapacity.calculated_capacity;

    await query(
      `UPDATE daily_capacities
       SET configured_capacity = $1, final_capacity = $2, updated_at = CURRENT_TIMESTAMP
       WHERE doctor_id = $3 AND date = $4`,
      [configuredCapacity, finalCapacity, doctorId, date]
    );

    const updatedCapacity = await calculateCapacity(doctorId, date);
    res.json(success(updatedCapacity, 'Capacity updated successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update capacity'));
  }
});

// Set capacity for a specific date for authenticated doctor - MUST be before /:id/capacity/:date
router.post('/me/capacity/:date', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    const { configuredCapacity } = req.body;

    if (configuredCapacity === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Configured capacity is required'));
    }

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Calculate capacity based on actual schedule, breaks, and exceptions
    const calculated_capacityResult = await calculateCapacity(doctorId, date);

    // Validate configured capacity doesn't exceed calculated capacity
    if (configuredCapacity !== null && configuredCapacity !== undefined && configuredCapacity > calculated_capacityResult.calculated_capacity) {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `Configured capacity cannot exceed calculated capacity of ${calculated_capacityResult.calculated_capacity}`
      ));
    }

    const finalCapacity = configuredCapacity !== null && configuredCapacity !== undefined
      ? Math.min(calculated_capacityResult.calculated_capacity, configuredCapacity)
      : calculated_capacityResult.calculated_capacity;

    // Check if capacity exists
    const existingResult = await query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
      [doctorId, date]
    );

    if (existingResult.rows.length > 0) {
      // Update existing
      await query(
        `UPDATE daily_capacities
         SET configured_capacity = $1, final_capacity = $2, consultation_duration_minutes = $3, calculated_capacity = $4, updated_at = CURRENT_TIMESTAMP
         WHERE doctor_id = $5 AND date = $6`,
        [configuredCapacity, finalCapacity, calculated_capacityResult.consultation_duration_minutes, calculated_capacityResult.calculated_capacity, doctorId, date]
      );
    } else {
      // Create new
      await query(
        `INSERT INTO daily_capacities (doctor_id, date, consultation_duration_minutes, calculated_capacity, configured_capacity, final_capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [doctorId, date, calculated_capacityResult.consultation_duration_minutes, calculated_capacityResult.calculated_capacity, configuredCapacity, finalCapacity]
      );
    }

    const updatedCapacity = await calculateCapacity(doctorId, date);
    res.json(success(updatedCapacity, 'Capacity set successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to set capacity'));
  }
});

// Get doctor capacity configuration
router.get('/:id/capacity', authenticate, authorize('DOCTOR', 'SECRETARY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date, startDate, endDate } = req.query;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid doctor ID'));
    }

    if (date) {
      // Get capacity for a specific date
      const capacity = await calculateCapacity(id, String(date));
      res.json(success(capacity));
    } else if (startDate && endDate) {
      // Get capacity for a date range
      const capacityMap = await calculateCapacityRange(id, String(startDate), String(endDate));
      const capacityArray = Array.from(capacityMap.entries()).map(([date, capacity]) => ({
        date,
        ...capacity,
      }));
      res.json(success(capacityArray));
    } else {
      // Return error if no date or range provided
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date or date range (startDate and endDate) is required'));
    }
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch capacity'));
  }
});

// Update doctor capacity configuration
router.put('/:id/capacity', authenticate, authorize('DOCTOR', 'SECRETARY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date, configuredCapacity } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid doctor ID'));
    }

    if (!date || configuredCapacity === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date and configured capacity are required'));
    }

    // Ownership check for doctors
    if (req.user!.role === 'DOCTOR') {
      const doctorResult = await query(
        'SELECT id FROM doctors WHERE user_id = $1',
        [req.user!.id]
      );
      if (doctorResult.rows.length === 0 || doctorResult.rows[0].id !== id) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only manage your own capacity'));
      }
    }

    // Ownership check for secretaries
    if (req.user!.role === 'SECRETARY') {
      const secretaryResult = await query(
        'SELECT doctor_id FROM secretaries WHERE user_id = $1',
        [req.user!.id]
      );
      if (secretaryResult.rows.length === 0 || secretaryResult.rows[0].doctor_id !== id) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only manage capacity for doctors you are assigned to'));
      }
    }

    // Calculate current capacity to get the calculated capacity
    const currentCapacity = await calculateCapacity(id, date);

    // Validate configured capacity doesn't exceed calculated capacity
    if (configuredCapacity !== null && configuredCapacity !== undefined && configuredCapacity > currentCapacity.calculated_capacity) {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `Configured capacity cannot exceed calculated capacity of ${currentCapacity.calculated_capacity}`
      ));
    }

    // Check if capacity exists
    const existingResult = await query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
      [id, date]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Capacity record not found'));
    }

    const finalCapacity = configuredCapacity !== null && configuredCapacity !== undefined
      ? Math.min(currentCapacity.calculated_capacity, configuredCapacity)
      : currentCapacity.calculated_capacity;

    await query(
      `UPDATE daily_capacities
       SET configured_capacity = $1, final_capacity = $2, updated_at = CURRENT_TIMESTAMP
       WHERE doctor_id = $3 AND date = $4`,
      [configuredCapacity, finalCapacity, id, date]
    );

    const updatedCapacity = await calculateCapacity(id, date);
    res.json(success(updatedCapacity, 'Capacity updated successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update capacity'));
  }
});

// Set capacity for a specific date
router.post('/:id/capacity/:date', authenticate, authorize('DOCTOR', 'SECRETARY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date } = req.params;
    const { configuredCapacity } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid doctor ID'));
    }

    if (configuredCapacity === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Configured capacity is required'));
    }

    // Ownership check for doctors
    if (req.user!.role === 'DOCTOR') {
      const doctorResult = await query(
        'SELECT id FROM doctors WHERE user_id = $1',
        [req.user!.id]
      );
      if (doctorResult.rows.length === 0 || doctorResult.rows[0].id !== id) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only manage your own capacity'));
      }
    }

    // Ownership check for secretaries
    if (req.user!.role === 'SECRETARY') {
      const secretaryResult = await query(
        'SELECT doctor_id FROM secretaries WHERE user_id = $1',
        [req.user!.id]
      );
      if (secretaryResult.rows.length === 0 || secretaryResult.rows[0].doctor_id !== id) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only manage capacity for doctors you are assigned to'));
      }
    }

    // Calculate capacity based on actual schedule, breaks, and exceptions
    const calculated_capacityResult = await calculateCapacity(id, date);

    // Validate configured capacity doesn't exceed calculated capacity
    if (configuredCapacity !== null && configuredCapacity !== undefined && configuredCapacity > calculated_capacityResult.calculated_capacity) {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `Configured capacity cannot exceed calculated capacity of ${calculated_capacityResult.calculated_capacity}`
      ));
    }

    const finalCapacity = configuredCapacity !== null && configuredCapacity !== undefined
      ? Math.min(calculated_capacityResult.calculated_capacity, configuredCapacity)
      : calculated_capacityResult.calculated_capacity;

    // Check if capacity exists
    const existingResult = await query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
      [id, date]
    );

    if (existingResult.rows.length > 0) {
      // Update existing
      await query(
        `UPDATE daily_capacities
         SET configured_capacity = $1, final_capacity = $2, consultation_duration_minutes = $3, calculated_capacity = $4, updated_at = CURRENT_TIMESTAMP
         WHERE doctor_id = $5 AND date = $6`,
        [configuredCapacity, finalCapacity, calculated_capacityResult.consultation_duration_minutes, calculated_capacityResult.calculated_capacity, id, date]
      );
    } else {
      // Create new
      await query(
        `INSERT INTO daily_capacities (doctor_id, date, consultation_duration_minutes, calculated_capacity, configured_capacity, final_capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, date, calculated_capacityResult.consultation_duration_minutes, calculated_capacityResult.calculated_capacity, configuredCapacity, finalCapacity]
      );
    }

    const updatedCapacity = await calculateCapacity(id, date);
    res.json(success(updatedCapacity, 'Capacity set successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to set capacity'));
  }
});

// Create secretary for authenticated doctor
router.post('/secretaries', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email and password are required'));
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid email format'));
    }

    // Get authenticated doctor's doctor_id
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1 AND approval_status = $2',
      [req.user!.id, 'ACTIVE']
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Only active doctors can create secretaries'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Check for duplicate email
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Email already registered'));
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with SECRETARY role
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, 'SECRETARY', true, true)
       RETURNING id, email, role, is_active, must_change_password`,
      [email, passwordHash]
    );

    const userId = userResult.rows[0].id;

    // Create secretary profile with NULL names (to be completed in Step 3)
    const secretaryResult = await client.query(
      `INSERT INTO secretaries (user_id, doctor_id, first_name, last_name, is_approved)
       VALUES ($1, $2, NULL, NULL, true)
       RETURNING id, user_id, doctor_id, first_name, last_name, is_approved, created_at`,
      [userId, doctorId]
    );

    await client.query('COMMIT');

    res.status(201).json(
      success({
        secretary: secretaryResult.rows[0],
        user: {
          id: userId,
          email: userResult.rows[0].email,
          role: userResult.rows[0].role,
        },
      }, 'Secretary created successfully')
    );
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Secretary creation error:', err);

    // Handle unique constraint violation (race condition)
    if (err.code === '23505') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Email already registered'));
    }

    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create secretary'));
  } finally {
    client.release();
  }
});

// Update Doctor two-factor authentication setting
router.put('/me/two-factor', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { twoFactorEnabled } = req.body;

    if (typeof twoFactorEnabled !== 'boolean') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'twoFactorEnabled must be a boolean'));
    }

    const result = await query(
      `UPDATE doctors
       SET two_factor_enabled = $1
       WHERE user_id = $2
       RETURNING id, two_factor_enabled`,
      [twoFactorEnabled, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    res.json(success({
      twoFactorEnabled: result.rows[0].two_factor_enabled
    }, 'Two-factor authentication setting updated'));
  } catch (err: any) {
    console.error('Doctor 2FA setting update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update two-factor setting'));
  }
});

// ============================================
// DOCTOR PHOTO ENDPOINTS
// ============================================

// Upload doctor professional photo
router.post('/me/photo', authenticate, authorize('DOCTOR'), upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    if (!req.file) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'No file uploaded'));
    }

    // Validate image file type and size
    const validation = validateImageFile(req.file.buffer, req.file.mimetype);
    if (!validation.valid) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, validation.error));
    }

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id, professional_photo_url FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;
    const currentPhotoUrl = doctorResult.rows[0].professional_photo_url;

    // Generate unique filename: doctor_photo_<doctor_id>_<timestamp>_<random>.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `doctor_photo_${doctorId}_${uniqueSuffix}${fileExtension}`;

    // Upload to Supabase Storage (handles replacement if old photo exists)
    const uploadResult = currentPhotoUrl
      ? await replaceDoctorPhoto(currentPhotoUrl, req.file.buffer, fileName, req.file.mimetype)
      : await uploadDoctorPhoto(req.file.buffer, fileName, req.file.mimetype);

    if (!uploadResult.success) {
      return res.status(500).json(error(ErrorCodes.SERVER_ERROR, uploadResult.error || 'Failed to upload photo'));
    }

    // Update database with new photo URL
    const result = await query(
      `UPDATE doctors
       SET professional_photo_url = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING professional_photo_url`,
      [uploadResult.url, userId]
    );

    res.json(success({
      photoUrl: result.rows[0].professional_photo_url
    }, 'Photo uploaded successfully'));
  } catch (err: any) {
    console.error('Photo upload error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to upload photo'));
  }
});

// Delete doctor professional photo
router.delete('/me/photo', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get current photo URL
    const doctorResult = await query(
      'SELECT professional_photo_url FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const currentPhotoUrl = doctorResult.rows[0].professional_photo_url;

    // Delete from Supabase Storage if photo exists
    if (currentPhotoUrl) {
      const deleteResult = await deleteDoctorPhoto(currentPhotoUrl);
      if (!deleteResult.success) {
        console.error('Failed to delete photo from storage:', deleteResult.error);
        // Continue with database update even if storage deletion fails
      }
    }

    // Clear database field
    await query(
      'UPDATE doctors SET professional_photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );

    res.json(success(null, 'Photo deleted successfully'));
  } catch (err: any) {
    console.error('Photo deletion error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete photo'));
  }
});

// ============================================
// DOCTOR PROFILE ENDPOINTS
// ============================================

// Update Doctor professional profile
router.put('/me/profile', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      professional_photo_url,
      specialty,
      credentials,
      prc_license_number,
      practice_name,
      years_of_experience,
      areas_of_expertise,
      biography,
      consultation_fee,
      languages_spoken,
    } = req.body;

    // Validate PRC license number format if provided
    const PRC_LICENSE_PATTERN = /^\d{7}$/;
    if (prc_license_number && !PRC_LICENSE_PATTERN.test(prc_license_number)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'PRC license number must be 7 digits'));
    }

    // Check if PRC license number is already taken by another doctor
    if (prc_license_number) {
      const existingLicense = await query(
        'SELECT id FROM doctors WHERE prc_license_number = $1 AND user_id <> $2',
        [prc_license_number, userId]
      );

      if (existingLicense.rows.length > 0) {
        return res.status(409).json(error(ErrorCodes.CONFLICT, 'PRC license number is already registered'));
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (professional_photo_url !== undefined) {
      paramCount++;
      updates.push(`professional_photo_url = $${paramCount}`);
      values.push(professional_photo_url);
    }
    if (specialty !== undefined) {
      paramCount++;
      updates.push(`specialty = $${paramCount}`);
      values.push(specialty);
    }
    if (credentials !== undefined) {
      paramCount++;
      updates.push(`credentials = $${paramCount}`);
      values.push(credentials);
    }
    if (prc_license_number !== undefined) {
      paramCount++;
      updates.push(`prc_license_number = $${paramCount}`);
      values.push(prc_license_number);
    }
    if (practice_name !== undefined) {
      paramCount++;
      updates.push(`practice_name = $${paramCount}`);
      values.push(practice_name);
    }
    if (years_of_experience !== undefined) {
      paramCount++;
      updates.push(`years_of_experience = $${paramCount}`);
      values.push(years_of_experience);
    }
    if (areas_of_expertise !== undefined) {
      paramCount++;
      updates.push(`areas_of_expertise = $${paramCount}`);
      values.push(areas_of_expertise);
    }
    if (biography !== undefined) {
      paramCount++;
      updates.push(`biography = $${paramCount}`);
      values.push(biography);
    }
    if (consultation_fee !== undefined) {
      paramCount++;
      updates.push(`consultation_fee = $${paramCount}`);
      values.push(consultation_fee);
    }
    if (languages_spoken !== undefined) {
      paramCount++;
      updates.push(`languages_spoken = $${paramCount}`);
      values.push(languages_spoken);
    }

    if (updates.length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'No fields to update'));
    }

    // Add user_id parameter
    paramCount++;
    values.push(userId);

    const result = await query(
      `UPDATE doctors
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    // Determine profile completion status based on required fields
    const doctor = result.rows[0];

    // Get user email verification status for profile completion check
    const userResult = await query(
      `SELECT email_verified FROM users WHERE id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    const hasRequiredFields =
      doctor.first_name &&
      doctor.last_name &&
      doctor.contact_number &&
      doctor.specialty &&
      doctor.credentials &&
      doctor.prc_license_number &&
      doctor.practice_name;

    const hasVerifiedEmail = user.email_verified === true;

    if (hasRequiredFields && hasVerifiedEmail && doctor.profile_completion_status === 'INCOMPLETE') {
      await query(
        `UPDATE doctors
         SET profile_completion_status = 'COMPLETE'
         WHERE user_id = $1`,
        [userId]
      );
      doctor.profile_completion_status = 'COMPLETE';
    }

    res.json(success(doctor, 'Profile updated successfully'));
  } catch (err: any) {
    console.error('Doctor profile update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update profile'));
  }
});

// Submit Doctor profile for approval
router.post('/me/profile/submit', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const userId = req.user!.id;

    // Get current doctor profile
    const doctorResult = await client.query(
      `SELECT * FROM doctors WHERE user_id = $1`,
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctor = doctorResult.rows[0];

    // Validate approval status - only allow submission for PENDING or REJECTED doctors
    // ACTIVE doctors should not be able to submit onboarding applications again
    if (doctor.approval_status === 'ACTIVE') {
      await client.query('ROLLBACK');
      return res.status(409).json(
        error(
          ErrorCodes.CONFLICT,
          'Your account is already approved. You cannot submit an onboarding application again.'
        )
      );
    }

    // Get user email verification status
    const userResult = await client.query(
      `SELECT email, email_verified FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'User not found'));
    }

    const user = userResult.rows[0];

    // Validate required fields before submission
    const requiredFields = [
      { field: 'first_name', value: doctor.first_name, name: 'First Name' },
      { field: 'last_name', value: doctor.last_name, name: 'Last Name' },
      { field: 'contact_number', value: doctor.contact_number, name: 'Contact Number' },
      { field: 'specialty', value: doctor.specialty, name: 'Specialty' },
      { field: 'credentials', value: doctor.credentials, name: 'Credentials' },
      { field: 'prc_license_number', value: doctor.prc_license_number, name: 'PRC License Number' },
      { field: 'practice_name', value: doctor.practice_name, name: 'Hospital/Clinic' },
    ];

    const missingFields = requiredFields.filter(f => {
      if (f.value === null || f.value === undefined) {
        return true;
      }
      if (typeof f.value === 'string' && f.value.trim() === '') {
        return true;
      }
      return false;
    });

    if (missingFields.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          `Missing required fields: ${missingFields.map(f => f.name).join(', ')}`
        )
      );
    }

    // Validate email verification status
    if (!user.email_verified || user.email_verified !== true) {
      await client.query('ROLLBACK');
      return res.status(400).json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          'Email must be verified before submitting profile for approval'
        )
      );
    }

    // If the doctor was REJECTED, restore them to PENDING status on resubmission
    // This allows rejected doctors to correct their profile and resubmit for review
    const wasRejected = doctor.approval_status === 'REJECTED';

    // Update profile completion status to SUBMITTED
    // If resubmitting from REJECTED, also restore approval_status to PENDING and clear rejection_reason
    const result = await client.query(
      `UPDATE doctors
       SET profile_completion_status = 'SUBMITTED',
           profile_submitted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
           ${wasRejected ? ', approval_status = \'PENDING\', rejection_reason = NULL' : ''}
       WHERE user_id = $1
       RETURNING *`,
      [userId]
    );

    await client.query('COMMIT');

    res.json(success(
      result.rows[0],
      'Profile submitted for administrator approval. You will be notified once your account is approved.'
    ));
  } catch (err: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    console.error('Doctor profile submission error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to submit profile'));
  } finally {
    if (client) {
      client.release();
    }
  }
});

// ============================================
// DOCTOR UNAVAILABILITY (EXCEPTIONS) ENDPOINTS
// ============================================

// Get authenticated doctor's unavailability periods (exceptions)
router.get('/me/unavailability', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;
    const { includeInactive } = req.query;

    let queryText = 'SELECT * FROM doctor_unavailability WHERE doctor_id = $1';
    const params = [doctorId];

    if (includeInactive !== 'true') {
      queryText += ' AND is_active = true';
    }

    queryText += ' ORDER BY start_date';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor unavailability periods'));
  }
});

// Create unavailability period (exception) for authenticated doctor
router.post('/me/unavailability', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { startDate, endDate, reason } = req.body;

    // Validation
    if (!startDate || !endDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'startDate and endDate are required'));
    }

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Validate date format
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid date format'));
    }

    // Validate start date <= end date
    if (startDateObj > endDateObj) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Start date must be before or equal to end date'));
    }

    // Create unavailability period
    const result = await client.query(
      `INSERT INTO doctor_unavailability (doctor_id, start_date, end_date, reason, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [doctorId, startDate, endDate, reason || null]
    );

    await client.query('COMMIT');

    res.status(201).json(success(result.rows[0], 'Unavailability period created successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Unavailability creation error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create unavailability period'));
  } finally {
    client.release();
  }
});

// Update unavailability period for authenticated doctor
router.put('/me/unavailability/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { startDate, endDate, reason } = req.body;

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify the unavailability period belongs to the authenticated doctor
    const unavailabilityResult = await client.query(
      'SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (unavailabilityResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Unavailability period not found or access denied'));
    }

    // Validation
    if (!startDate || !endDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'startDate and endDate are required'));
    }

    // Validate date format
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid date format'));
    }

    // Validate start date <= end date
    if (startDateObj > endDateObj) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Start date must be before or equal to end date'));
    }

    // Update unavailability period
    const result = await client.query(
      `UPDATE doctor_unavailability
       SET start_date = $1, end_date = $2, reason = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND doctor_id = $5
       RETURNING *`,
      [startDate, endDate, reason || null, id, doctorId]
    );

    await client.query('COMMIT');

    res.json(success(result.rows[0], 'Unavailability period updated successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Unavailability update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update unavailability period'));
  } finally {
    client.release();
  }
});

// Delete unavailability period
router.delete('/me/unavailability/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify the unavailability period belongs to the authenticated doctor and delete it
    const result = await client.query(
      `DELETE FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2 RETURNING *`,
      [id, doctorId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Unavailability period not found or access denied'));
    }

    await client.query('COMMIT');

    res.json(success(result.rows[0], 'Unavailability period deleted successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Unavailability deletion error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete unavailability period'));
  } finally {
    client.release();
  }
});

// ============================================
// DOCTOR BREAK PERIODS ENDPOINTS
// ============================================

// Get authenticated doctor's break periods
router.get('/me/break-periods', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;
    const { includeInactive, startDate, endDate } = req.query;

    let queryText = 'SELECT * FROM doctor_break_periods WHERE doctor_id = $1';
    const params = [doctorId];

    if (includeInactive !== 'true') {
      queryText += ' AND is_active = true';
    }

    if (startDate) {
      queryText += ' AND break_date >= $2';
      params.push(String(startDate));
    }

    if (endDate) {
      const paramIndex = params.length + 1;
      queryText += ` AND break_date <= $${paramIndex}`;
      params.push(String(endDate));
    }

    queryText += ' ORDER BY break_date, start_time';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor break periods'));
  }
});

// Create break period for authenticated doctor
router.post('/me/break-periods', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { breakDate, startTime, endTime, reason } = req.body;

    // Validation
    if (!breakDate || !startTime || !endTime) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'breakDate, startTime, and endTime are required'));
    }

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Validate date format
    const breakDateObj = new Date(breakDate);
    if (isNaN(breakDateObj.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid break date format'));
    }

    // Validate time format
    const startTimeDate = new Date(`2000-01-01T${startTime}`);
    const endTimeDate = new Date(`2000-01-01T${endTime}`);

    if (isNaN(startTimeDate.getTime()) || isNaN(endTimeDate.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid time format. Use HH:MM format'));
    }

    // Validate start time < end time
    if (startTimeDate >= endTimeDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Start time must be before end time'));
    }

    // Get day of week for the break date
    const dayOfWeek = breakDateObj.getDay();

    // Get working hours for this day
    const scheduleResult = await client.query(
      `SELECT start_time, end_time FROM doctor_schedules
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true`,
      [doctorId, dayOfWeek]
    );

    if (scheduleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'No working hours defined for this date'));
    }

    // Validate break falls completely within at least one working hour block
    let breakWithinWorkingHours = false;
    for (const schedule of scheduleResult.rows) {
      const scheduleStart = new Date(`2000-01-01T${schedule.start_time}`);
      const scheduleEnd = new Date(`2000-01-01T${schedule.end_time}`);

      if (startTimeDate >= scheduleStart && endTimeDate <= scheduleEnd) {
        breakWithinWorkingHours = true;
        break;
      }
    }

    if (!breakWithinWorkingHours) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Break period must fall completely within working hours'));
    }

    // Check for overlapping break periods on the same date
    const overlapResult = await client.query(
      `SELECT * FROM doctor_break_periods
       WHERE doctor_id = $1 AND break_date = $2 AND is_active = true
       AND (
         (start_time < $3 AND end_time > $3) OR
         (start_time < $4 AND end_time > $4) OR
         (start_time >= $3 AND end_time <= $4)
       )`,
      [doctorId, breakDate, startTime, endTime]
    );

    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Break period overlaps with an existing break'));
    }

    // Create break period
    const result = await client.query(
      `INSERT INTO doctor_break_periods (doctor_id, break_date, start_time, end_time, reason, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [doctorId, breakDate, startTime, endTime, reason || null]
    );

    await client.query('COMMIT');

    res.status(201).json(success(result.rows[0], 'Break period created successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Break period creation error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create break period'));
  } finally {
    client.release();
  }
});

// Update break period for authenticated doctor
router.put('/me/break-periods/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { breakDate, startTime, endTime, reason } = req.body;

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify the break period belongs to the authenticated doctor
    const breakResult = await client.query(
      'SELECT * FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (breakResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Break period not found or access denied'));
    }

    // Validation
    if (!breakDate || !startTime || !endTime) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'breakDate, startTime, and endTime are required'));
    }

    // Validate date format
    const breakDateObj = new Date(breakDate);
    if (isNaN(breakDateObj.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid break date format'));
    }

    // Validate time format
    const startTimeDate = new Date(`2000-01-01T${startTime}`);
    const endTimeDate = new Date(`2000-01-01T${endTime}`);

    if (isNaN(startTimeDate.getTime()) || isNaN(endTimeDate.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid time format. Use HH:MM format'));
    }

    // Validate start time < end time
    if (startTimeDate >= endTimeDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Start time must be before end time'));
    }

    // Get day of week for the break date
    const dayOfWeek = breakDateObj.getDay();

    // Get working hours for this day
    const scheduleResult = await client.query(
      `SELECT start_time, end_time FROM doctor_schedules
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true`,
      [doctorId, dayOfWeek]
    );

    if (scheduleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'No working hours defined for this date'));
    }

    // Validate break falls completely within at least one working hour block
    let breakWithinWorkingHours = false;
    for (const schedule of scheduleResult.rows) {
      const scheduleStart = new Date(`2000-01-01T${schedule.start_time}`);
      const scheduleEnd = new Date(`2000-01-01T${schedule.end_time}`);

      if (startTimeDate >= scheduleStart && endTimeDate <= scheduleEnd) {
        breakWithinWorkingHours = true;
        break;
      }
    }

    if (!breakWithinWorkingHours) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Break period must fall completely within working hours'));
    }

    // Check for overlapping break periods on the same date (excluding current break)
    const overlapResult = await client.query(
      `SELECT * FROM doctor_break_periods
       WHERE doctor_id = $1 AND break_date = $2 AND is_active = true AND id != $3
       AND (
         (start_time < $4 AND end_time > $4) OR
         (start_time < $5 AND end_time > $5) OR
         (start_time >= $4 AND end_time <= $5)
       )`,
      [doctorId, breakDate, id, startTime, endTime]
    );

    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Break period overlaps with an existing break'));
    }

    // Update break period
    const result = await client.query(
      `UPDATE doctor_break_periods
       SET break_date = $1, start_time = $2, end_time = $3, reason = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND doctor_id = $6
       RETURNING *`,
      [breakDate, startTime, endTime, reason || null, id, doctorId]
    );

    await client.query('COMMIT');

    res.json(success(result.rows[0], 'Break period updated successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Break period update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update break period'));
  } finally {
    client.release();
  }
});

// Delete break period
router.delete('/me/break-periods/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get doctor_id from authenticated user
    const doctorResult = await client.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [req.user!.id]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify the break period belongs to the authenticated doctor and delete it
    const result = await client.query(
      `DELETE FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2 RETURNING *`,
      [id, doctorId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Break period not found or access denied'));
    }

    await client.query('COMMIT');

    res.json(success(result.rows[0], 'Break period deleted successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Break period deletion error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete break period'));
  } finally {
    client.release();
  }
});

export default router;