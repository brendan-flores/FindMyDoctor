import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { calculateCapacity, calculateCapacityRange } from '../modules/capacity/capacityService';

const router = Router();

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

export default router;
