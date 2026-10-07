import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const router = Router();

// Configure multer for photo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = config.upload.dir;
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: doctor_photo_<timestamp>_<random>.png
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `doctor_photo_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter - only PNG allowed
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
        d.biography, d.consultation_fee, d.consultation_type, d.languages_spoken,
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
        d.consultation_type, d.languages_spoken
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
        d.consultation_type, d.languages_spoken
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

// Get current doctor's schedules
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

    // Get schedules
    const result = await query(
      'SELECT * FROM doctor_schedules WHERE doctor_id = $1 ORDER BY day_of_week',
      [doctorId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    console.error('Failed to fetch doctor schedules:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch schedules'));
  }
});

// Create schedule for current doctor
router.post('/me/schedules', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { day_of_week, start_time, end_time, consultation_duration_minutes, is_active } = req.body;

    // Validation
    if (day_of_week === undefined || start_time === undefined || end_time === undefined) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'day_of_week, start_time, and end_time are required'));
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'day_of_week must be between 0 and 6'));
    }

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Check if schedule already exists for this day
    const existingSchedule = await query(
      'SELECT id FROM doctor_schedules WHERE doctor_id = $1 AND day_of_week = $2',
      [doctorId, day_of_week]
    );

    if (existingSchedule.rows.length > 0) {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Schedule already exists for this day'));
    }

    // Create schedule
    const result = await query(
      `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, consultation_duration_minutes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        doctorId,
        day_of_week,
        start_time,
        end_time,
        consultation_duration_minutes || 30,
        is_active !== undefined ? is_active : true
      ]
    );

    res.status(201).json(success(result.rows[0], 'Schedule created successfully'));
  } catch (err: any) {
    console.error('Failed to create schedule:', err);

    // Handle unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Schedule already exists for this day'));
    }

    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create schedule'));
  }
});

// Update schedule for current doctor
router.put('/me/schedules/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { day_of_week, start_time, end_time, consultation_duration_minutes, is_active } = req.body;

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify schedule belongs to this doctor
    const scheduleResult = await query(
      'SELECT * FROM doctor_schedules WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Schedule not found'));
    }

    // Validate day_of_week if provided
    if (day_of_week !== undefined && (day_of_week < 0 || day_of_week > 6)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'day_of_week must be between 0 and 6'));
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (day_of_week !== undefined) {
      paramCount++;
      updates.push(`day_of_week = $${paramCount}`);
      values.push(day_of_week);
    }
    if (start_time !== undefined) {
      paramCount++;
      updates.push(`start_time = $${paramCount}`);
      values.push(start_time);
    }
    if (end_time !== undefined) {
      paramCount++;
      updates.push(`end_time = $${paramCount}`);
      values.push(end_time);
    }
    if (consultation_duration_minutes !== undefined) {
      paramCount++;
      updates.push(`consultation_duration_minutes = $${paramCount}`);
      values.push(consultation_duration_minutes);
    }
    if (is_active !== undefined) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'No fields to update'));
    }

    // Add schedule_id and doctor_id parameters
    paramCount++;
    values.push(id);
    paramCount++;
    values.push(doctorId);

    const result = await query(
      `UPDATE doctor_schedules
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount - 1} AND doctor_id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(success(result.rows[0], 'Schedule updated successfully'));
  } catch (err: any) {
    console.error('Failed to update schedule:', err);

    // Handle unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'Schedule already exists for this day'));
    }

    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update schedule'));
  }
});

// Delete schedule for current doctor
router.delete('/me/schedules/:id', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Verify schedule belongs to this doctor and delete
    const result = await query(
      'DELETE FROM doctor_schedules WHERE id = $1 AND doctor_id = $2 RETURNING *',
      [id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Schedule not found'));
    }

    res.json(success(null, 'Schedule deleted successfully'));
  } catch (err: any) {
    console.error('Failed to delete schedule:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete schedule'));
  }
});

// Get doctor schedules (public endpoint)
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

// Upload doctor professional photo
router.post('/me/photo', authenticate, authorize('DOCTOR'), upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    if (!req.file) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'No file uploaded'));
    }

    // Verify actual PNG file signature (magic number)
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const fileBuffer = fs.readFileSync(req.file.path);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    if (fileBuffer.length < 8 || !fileBuffer.subarray(0, 8).equals(pngSignature)) {
      // Delete the file if it's not a valid PNG
      fs.unlinkSync(req.file.path);
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Only PNG files are allowed'));
    }

    // Get doctor_id from authenticated user
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      // Clean up uploaded file if doctor not found
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }

    const doctorId = doctorResult.rows[0].id;

    // Store the file path in the database
    const photoUrl = `/uploads/${req.file.filename}`;

    const result = await query(
      `UPDATE doctors
       SET professional_photo_url = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING professional_photo_url`,
      [photoUrl, userId]
    );

    res.json(success({
      photoUrl: result.rows[0].professional_photo_url
    }, 'Photo uploaded successfully'));
  } catch (err: any) {
    console.error('Photo upload error:', err);

    // Clean up uploaded file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

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

    // Clear database field
    await query(
      'UPDATE doctors SET professional_photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );

    // Delete file if it exists and is a managed local file
    if (currentPhotoUrl && currentPhotoUrl.startsWith('/uploads/')) {
      const filename = currentPhotoUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(config.upload.dir, filename);
        // Verify the file is within the upload directory to prevent path traversal
        const resolvedUploadDir = path.resolve(config.upload.dir);
        const resolvedFilePath = path.resolve(filePath);

        if (resolvedFilePath.startsWith(resolvedUploadDir) && fs.existsSync(resolvedFilePath)) {
          fs.unlinkSync(resolvedFilePath);
        }
      }
    }

    res.json(success(null, 'Photo deleted successfully'));
  } catch (err: any) {
    console.error('Photo deletion error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete photo'));
  }
});

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
      consultation_type,
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
    if (consultation_type !== undefined) {
      paramCount++;
      updates.push(`consultation_type = $${paramCount}`);
      values.push(consultation_type);
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

export default router;