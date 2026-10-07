import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// Get current doctor (authenticated)
router.get('/me', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT
        d.id, d.user_id, d.first_name, d.middle_name, d.last_name, d.specialty, d.credentials,
        d.prc_license_number, d.practice_name, d.practice_phone, d.practice_email, d.room_number,
        d.two_factor_enabled, d.is_approved, d.approval_status
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
        d.operating_hours_start, d.operating_hours_end
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

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctors'));
  }
});

// Get doctor by ID
router.get('/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        d.*
       FROM doctors d
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

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

    const { dayOfWeek, startTime, endTime, consultationDurationMinutes } = req.body;

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
      [doctorId, dayOfWeek, startTime, endTime, consultationDurationMinutes || 30]
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
    const { dayOfWeek, startTime, endTime, consultationDurationMinutes } = req.body;

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
      [dayOfWeek, startTime, endTime, consultationDurationMinutes || 30, id, doctorId]
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

// Get doctor capacity configuration
router.get('/:id/capacity', authenticate, authorize('DOCTOR', 'SECRETARY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    let queryText = 'SELECT * FROM daily_capacities WHERE doctor_id = $1';
    const params = [id];

    if (date) {
      queryText += ' AND date = $2';
      params.push(String(date));
    }

    queryText += ' ORDER BY date DESC LIMIT 30';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch capacity'));
  }
});

// Update doctor capacity configuration
router.put('/:id/capacity', authenticate, authorize('DOCTOR', 'SECRETARY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date, configuredCapacity } = req.body;

    if (!date || configuredCapacity === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date and configured capacity are required'));
    }

    // Check if capacity exists
    const existingResult = await query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
      [id, date]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Capacity record not found'));
    }

    const capacity = existingResult.rows[0];
    const finalCapacity = Math.min(capacity.calculated_capacity, configuredCapacity);

    await query(
      `UPDATE daily_capacities
       SET configured_capacity = $1, final_capacity = $2, updated_at = CURRENT_TIMESTAMP
       WHERE doctor_id = $3 AND date = $4`,
      [configuredCapacity, finalCapacity, id, date]
    );

    res.json(success(null, 'Capacity updated successfully'));
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

    if (configuredCapacity === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Configured capacity is required'));
    }

    // Get doctor's consultation duration
    const doctorResult = await query(
      'SELECT consultation_duration_minutes FROM doctors WHERE id = $1',
      [id]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    const doctor = doctorResult.rows[0];

    // Calculate capacity based on schedule (simplified for MVP)
    const calculatedCapacity = 16; // Default: 8 hours / 30 min = 16 patients
    const finalCapacity = Math.min(calculatedCapacity, configuredCapacity);

    // Check if capacity exists
    const existingResult = await query(
      'SELECT * FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
      [id, date]
    );

    if (existingResult.rows.length > 0) {
      // Update existing
      await query(
        `UPDATE daily_capacities
         SET configured_capacity = $1, final_capacity = $2, updated_at = CURRENT_TIMESTAMP
         WHERE doctor_id = $3 AND date = $4`,
        [configuredCapacity, finalCapacity, id, date]
      );
    } else {
      // Create new
      await query(
        `INSERT INTO daily_capacities (doctor_id, date, consultation_duration_minutes, calculated_capacity, configured_capacity, final_capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, date, 30, calculatedCapacity, configuredCapacity, finalCapacity]
      );
    }

    res.json(success(null, 'Capacity set successfully'));
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