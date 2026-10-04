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

// Get doctor schedules
router.get('/:id/schedules', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM doctor_schedules WHERE doctor_id = $1 AND is_active = true ORDER BY day_of_week',
      [id]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor schedules'));
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

    // Get unavailability periods
    const unavailabilityResult = await query(
      `SELECT * FROM doctor_unavailability
       WHERE doctor_id = $1
       AND (start_date <= $2 AND end_date >= $3)
       ORDER BY start_date`,
      [id, endDate, startDate]
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
      return res.status(409).json(error(ErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already registered'));
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
      return res.status(409).json(error(ErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already registered'));
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

export default router;