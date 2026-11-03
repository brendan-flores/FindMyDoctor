import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { calculateCapacity, calculateCapacityRange } from '../modules/capacity/capacityService';
import { invalidateAvailabilityCache } from '../modules/availability/availabilityService';
import { getClinicDate, toClinicDateString } from '../utils/date';

const router = Router();

// Successful writes here (capacity, exceptions, breaks) can change doctor
// availability. Clear cached date ranges rather than tracking each key.
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

// Get current secretary (authenticated)
router.get('/me', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT
        s.id, s.user_id, s.doctor_id, s.first_name, s.middle_name, s.last_name, s.contact_number,
        s.two_factor_enabled, s.is_approved,
        u.email, u.role, u.must_change_password,
        d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.practice_name, d.room_number
       FROM secretaries s
       INNER JOIN users u ON s.user_id = u.id
       INNER JOIN doctors d ON s.doctor_id = d.id
       WHERE s.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    console.error('Secretary profile fetch error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch secretary profile'));
  }
});

// Update current secretary profile
router.put('/me', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { firstName, middleName, lastName, contactNumber } = req.body;

    // Validation
    if (!firstName || typeof firstName !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'First name is required'));
    }

    if (!lastName || typeof lastName !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Last name is required'));
    }

    if (!contactNumber || typeof contactNumber !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Contact number is required'));
    }

    // Trim whitespace
    const trimmedFirstName = firstName.trim();
    const trimmedMiddleName = middleName ? middleName.trim() : null;
    const trimmedLastName = lastName.trim();
    const trimmedContactNumber = contactNumber.trim();

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

    if (trimmedContactNumber.length === 0 || trimmedContactNumber.length > 20) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Contact number must be 1-20 characters'));
    }

    // Contact number format validation (support Philippine and international formats)
    // Allow: digits, spaces, hyphens, plus sign, parentheses
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(trimmedContactNumber)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Contact number must contain only digits, spaces, hyphens, plus sign, or parentheses'));
    }

    // Update secretary profile using authenticated user_id
    const result = await query(
      `UPDATE secretaries
       SET first_name = $1,
           middle_name = $2,
           last_name = $3,
           contact_number = $4
       WHERE user_id = $5
       RETURNING id, first_name, middle_name, last_name, contact_number`,
      [trimmedFirstName, trimmedMiddleName, trimmedLastName, trimmedContactNumber, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const secretary = result.rows[0];

    res.json(success({
      id: secretary.id,
      firstName: secretary.first_name,
      middleName: secretary.middle_name,
      lastName: secretary.last_name,
      contactNumber: secretary.contact_number
    }, 'Profile updated successfully'));
  } catch (err: any) {
    console.error('Secretary profile update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update profile'));
  }
});

// Update Secretary two-factor authentication setting
router.put('/me/two-factor', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { twoFactorEnabled } = req.body;

    if (typeof twoFactorEnabled !== 'boolean') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'twoFactorEnabled must be a boolean'));
    }

    const result = await query(
      `UPDATE secretaries
       SET two_factor_enabled = $1
       WHERE user_id = $2
       RETURNING id, two_factor_enabled`,
      [twoFactorEnabled, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    res.json(success({
      twoFactorEnabled: result.rows[0].two_factor_enabled
    }, 'Two-factor authentication setting updated'));
  } catch (err: any) {
    console.error('Secretary 2FA setting update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update two-factor setting'));
  }
});

// Get managed doctor's capacity
router.get('/managed-doctors/capacity', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, startDate, endDate } = req.query;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

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
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch capacity'));
  }
});

// Update managed doctor's capacity
router.put('/managed-doctors/capacity', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, configuredCapacity } = req.body;

    if (!date || configuredCapacity === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date and configured capacity are required'));
    }

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

    // Calculate current capacity to get the calculated capacity
    const currentCapacity = await calculateCapacity(doctorId, date);

    // Validate configured capacity doesn't exceed calculated capacity
    if (configuredCapacity > currentCapacity.calculated_capacity) {
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

    if (configuredCapacity !== null && configuredCapacity !== undefined && configuredCapacity > currentCapacity.calculated_capacity) {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `Configured capacity cannot exceed calculated capacity of ${currentCapacity.calculated_capacity}`
      ));
    }

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

    // Fetch the updated capacity to return
    const updatedCapacity = await calculateCapacity(doctorId, date);
    res.json(success(updatedCapacity, 'Capacity updated successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update capacity'));
  }
});

// Set capacity for a specific date for managed doctor
router.post('/managed-doctors/capacity/:date', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    const { configuredCapacity } = req.body;

    if (configuredCapacity === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Configured capacity is required'));
    }

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

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

    // Fetch the updated capacity to return
    const updatedCapacity = await calculateCapacity(doctorId, date);
    res.json(success(updatedCapacity, 'Capacity set successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to set capacity'));
  }
});

// ============================================
// SECRETARY SCHEDULE ENDPOINTS
// ============================================

// Get managed doctor's schedules (read-only)
router.get('/managed-doctors/schedules', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;
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

// Get managed doctor's unavailability periods (exceptions)
router.get('/managed-doctors/unavailability', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;
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

// Create unavailability period (exception) for managed doctor
router.post('/managed-doctors/unavailability', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { startDate, endDate, reason } = req.body;

    // Validation
    if (!startDate || !endDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'startDate and endDate are required'));
    }

    // Get doctor_id from authenticated secretary
    const secretaryResult = await client.query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

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

// Update unavailability period for managed doctor
router.put('/managed-doctors/unavailability/:id', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { startDate, endDate, reason } = req.body;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await client.query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

    // Verify the unavailability period belongs to the managed doctor
    const unavailabilityResult = await client.query(
      'SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (unavailabilityResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Unavailability period not found or access denied'));
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

// Delete unavailability period for managed doctor
router.delete('/managed-doctors/unavailability/:id', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

    // Verify the unavailability period belongs to the managed doctor
    const unavailabilityResult = await query(
      'SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (unavailabilityResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Unavailability period not found or access denied'));
    }

    // Delete unavailability period
    const result = await query(
      'DELETE FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2 RETURNING *',
      [id, doctorId]
    );

    res.json(success(result.rows[0], 'Unavailability period deleted successfully'));
  } catch (err: any) {
    console.error('Unavailability deletion error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete unavailability period'));
  }
});

// Get managed doctor's break periods
router.get('/managed-doctors/break-periods', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;
    const { includeInactive, startDate, endDate } = req.query;

    let queryText = 'SELECT * FROM doctor_break_periods WHERE doctor_id = $1';
    const params = [doctorId];

    if (includeInactive !== 'true') {
      queryText += ' AND is_active = true';
    }

    if (startDate) {
      queryText += ' AND break_date >= $2';
      params.push(startDate);
    }

    if (endDate) {
      queryText += ' AND break_date <= $' + (params.length + 1);
      params.push(endDate);
    }

    queryText += ' ORDER BY break_date, start_time';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor break periods'));
  }
});

// Create break period for managed doctor
router.post('/managed-doctors/break-periods', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { breakDate, startTime, endTime, reason } = req.body;

    // Validation
    if (!breakDate || !startTime || !endTime) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'breakDate, startTime, and endTime are required'));
    }

    // Get doctor_id from authenticated secretary
    const secretaryResult = await client.query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

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

// Update break period for managed doctor
router.put('/managed-doctors/break-periods/:id', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { breakDate, startTime, endTime, reason } = req.body;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await client.query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

    // Verify the break period belongs to the managed doctor
    const breakResult = await client.query(
      'SELECT * FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (breakResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Break period not found or access denied'));
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

// Delete break period for managed doctor
router.delete('/managed-doctors/break-periods/:id', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

    // Verify the break period belongs to the managed doctor
    const breakResult = await query(
      'SELECT * FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (breakResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Break period not found or access denied'));
    }

    // Delete break period
    const result = await query(
      'DELETE FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2 RETURNING *',
      [id, doctorId]
    );

    res.json(success(result.rows[0], 'Break period deleted successfully'));
  } catch (err: any) {
    console.error('Break period deletion error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete break period'));
  }
});

// ============================================
// SECRETARY DASHBOARD ENDPOINT
// ============================================

// Get secretary dashboard summary
router.get('/me/dashboard', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    const userId = req.user!.id;

    // Get secretary's assigned doctor
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Use provided date or default to clinic date
    const targetDate = date ? String(date) : getClinicDate();

    // All dashboard reads are independent. Running them together keeps the
    // endpoint to two round trips instead of one per query.
    const [
      queueCountsResult,
      capacity,
      pendingPaymentsResult,
      unreadMessagesResult,
      queueResult,
      paymentsResult,
      conversationsResult,
    ] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'WAITING') as waiting,
           COUNT(*) FILTER (WHERE status = 'IN_CHECKUP') as inConsultation,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') as done
         FROM queue_entries
         WHERE doctor_id = $1 AND queue_date = $2`,
        [assignedDoctorId, targetDate]
      ),
      calculateCapacity(assignedDoctorId, targetDate),
      query(
        `SELECT COUNT(*) as count
         FROM payments p
         JOIN appointments a ON p.appointment_id = a.id
         WHERE a.doctor_id = $1 AND p.status = 'PENDING_VERIFICATION'`,
        [assignedDoctorId]
      ),
      // Count unread messages directly instead of running a correlated
      // subquery for every patient of the doctor.
      query(
        `SELECT COUNT(*) as total_unread
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.doctor_id = $2
           AND m.read_at IS NULL
           AND m.sender_user_id <> $1
           AND EXISTS (
             SELECT 1 FROM appointments a
             WHERE a.patient_id = c.patient_id AND a.doctor_id = c.doctor_id
           )`,
        [userId, assignedDoctorId]
      ),
      query(
        `SELECT q.queue_number, p.first_name, p.last_name, a.reason_for_visit, q.status, q.appointment_id, COALESCE(q.registration_source, 'ONLINE') as registration_source
         FROM queue_entries q
         JOIN patients p ON q.patient_id = p.id
         LEFT JOIN appointments a ON q.appointment_id = a.id
         WHERE q.doctor_id = $1 AND q.queue_date = $2
         ORDER BY q.queue_number ASC`,
        [assignedDoctorId, targetDate]
      ),
      query(
        `SELECT p.id, p.appointment_id, p.status, p.payment_method, p.total_amount,
                p.created_at, pat.first_name as patient_first_name, pat.last_name as patient_last_name,
                a.appointment_date, a.status as appointment_status,
                CASE WHEN i.id IS NULL OR i.status = 'VOID' THEN true ELSE false END as invoice_not_sent
         FROM payments p
         JOIN patients pat ON p.patient_id = pat.id
         JOIN appointments a ON p.appointment_id = a.id
         LEFT JOIN invoices i ON p.id = i.payment_id
         WHERE a.doctor_id = $1
           AND (
             p.status = 'PENDING_VERIFICATION' OR
             (p.status = 'UNPAID' AND a.status = 'COMPLETED') OR
             (p.status = 'PAID' AND (i.id IS NULL OR i.status = 'VOID'))
           )
         ORDER BY
           CASE WHEN p.status = 'PENDING_VERIFICATION' THEN 0 ELSE 1 END,
           p.created_at ASC
         LIMIT 10`,
        [assignedDoctorId]
      ),
      query(
        `SELECT c.id, c.patient_id, p.first_name as patient_first_name, p.last_name as patient_last_name,
                c.updated_at,
                CASE WHEN c.id IS NULL THEN 0 ELSE
                  (SELECT COUNT(*) FROM messages m
                    WHERE m.conversation_id = c.id
                      AND m.read_at IS NULL
                      AND m.sender_user_id <> $1)
                END AS unread_count
         FROM patients p
         JOIN doctors d ON d.id = $2
         LEFT JOIN conversations c ON c.patient_id = p.id AND c.doctor_id = d.id
         WHERE EXISTS (
           SELECT 1 FROM appointments a
           WHERE a.patient_id = p.id AND a.doctor_id = d.id
         )
         ORDER BY COALESCE(c.updated_at, (SELECT MAX(a2.appointment_date) FROM appointments a2 WHERE a2.patient_id = p.id AND a2.doctor_id = d.id)) DESC
         LIMIT 5`,
        [userId, assignedDoctorId]
      ),
    ]);

    const queueCounts = queueCountsResult.rows[0];

    const pendingPaymentsCount = parseInt(pendingPaymentsResult.rows[0].count) || 0;

    const unreadMessagesCount = parseInt(unreadMessagesResult.rows[0].total_unread) || 0;

    res.json(success({
      date: targetDate,
      queueCounts: {
        waiting: parseInt(queueCounts.waiting) || 0,
        inConsultation: parseInt(queueCounts.inConsultation) || 0,
        done: parseInt(queueCounts.done) || 0,
      },
      capacity: {
        remaining: capacity.remaining_capacity,
        total: capacity.final_capacity,
      },
      pendingVerificationPayments: pendingPaymentsCount,
      unreadMessages: unreadMessagesCount,
      todayQueue: queueResult.rows.map(row => ({
        queueNumber: row.queue_number,
        patientName: `${row.first_name} ${row.last_name}`,
        reason: row.reason_for_visit,
        status: row.status,
        appointmentId: row.appointment_id,
        registrationSource: row.registration_source,
      })),
      paymentsNeedingAction: paymentsResult.rows.map(row => ({
        id: row.id,
        appointmentId: row.appointment_id,
        status: row.status,
        paymentMethod: row.payment_method,
        totalAmount: row.total_amount,
        patientName: `${row.patient_first_name} ${row.patient_last_name}`,
        appointmentDate: row.appointment_date,
        appointmentStatus: row.appointment_status,
        invoiceNotSent: row.invoice_not_sent,
      })),
      recentConversations: conversationsResult.rows.map(row => ({
        id: row.id,
        patientId: row.patient_id,
        patientName: `${row.patient_first_name} ${row.patient_last_name}`,
        unreadCount: parseInt(row.unread_count) || 0,
        updatedAt: row.updated_at,
      })),
    }));
  } catch (err: any) {
    console.error('Secretary dashboard error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch secretary dashboard'));
  }
});

// ============================================
// SECRETARY INVOICE SETTINGS ENDPOINTS
// ============================================

// Get invoice details for assigned doctor
router.get('/me/invoice-details', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

    // Fetch invoice settings for the assigned doctor
    const result = await query(
      'SELECT * FROM invoice_settings WHERE doctor_id = $1',
      [doctorId]
    );

    if (result.rows.length === 0) {
      // Return null if no settings exist yet
      return res.json(success(null));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    console.error('Invoice details fetch error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch invoice details'));
  }
});

// Update invoice details for assigned doctor
router.put('/me/invoice-details', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { clinicName, address, contactNumber, footerLine } = req.body;

    // Validation
    if (!clinicName || typeof clinicName !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Clinic name is required'));
    }

    if (!address || typeof address !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Address is required'));
    }

    if (!contactNumber || typeof contactNumber !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Contact number is required'));
    }

    if (!footerLine || typeof footerLine !== 'string') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Footer line is required'));
    }

    // Trim whitespace
    const trimmedClinicName = clinicName.trim();
    const trimmedAddress = address.trim();
    const trimmedContactNumber = contactNumber.trim();
    const trimmedFooterLine = footerLine.trim();

    // Length validation
    if (trimmedClinicName.length === 0 || trimmedClinicName.length > 200) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Clinic name must be 1-200 characters'));
    }

    if (trimmedAddress.length === 0 || trimmedAddress.length > 500) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Address must be 1-500 characters'));
    }

    if (trimmedContactNumber.length === 0 || trimmedContactNumber.length > 50) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Contact number must be 1-50 characters'));
    }

    if (trimmedFooterLine.length > 200) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Footer line must be maximum 200 characters'));
    }

    // Get doctor_id from authenticated secretary
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

    // Check if invoice settings exist for the doctor
    const existingResult = await query(
      'SELECT * FROM invoice_settings WHERE doctor_id = $1',
      [doctorId]
    );

    let result;
    if (existingResult.rows.length === 0) {
      // Insert new invoice settings
      result = await query(
        `INSERT INTO invoice_settings (doctor_id, clinic_name, address, contact_number, footer_line)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [doctorId, trimmedClinicName, trimmedAddress, trimmedContactNumber, trimmedFooterLine]
      );
    } else {
      // Update existing invoice settings
      result = await query(
        `UPDATE invoice_settings
         SET clinic_name = $1, address = $2, contact_number = $3, footer_line = $4, updated_at = CURRENT_TIMESTAMP
         WHERE doctor_id = $5
         RETURNING *`,
        [trimmedClinicName, trimmedAddress, trimmedContactNumber, trimmedFooterLine, doctorId]
      );
    }

    res.json(success(result.rows[0], 'Invoice details updated successfully'));
  } catch (err: any) {
    console.error('Invoice details update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update invoice details'));
  }
});

export default router;
