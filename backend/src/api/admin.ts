import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get all users
router.get('/users', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, email, role, is_active, must_change_password, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch users'));
  }
});

// Create doctor
router.post('/doctors', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName, specialty, credentials, biography, consultationFee, practiceName, practiceAddress, practiceLatitude, practiceLongitude, practicePhone, practiceEmail, practiceDescription, operatingHoursStart, operatingHoursEnd } = req.body;

    if (!email || !password || !firstName || !lastName || !specialty || !consultationFee || !practiceName || !practiceAddress || !practiceLatitude || !practiceLongitude) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Required fields missing'));
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, must_change_password)
       VALUES ($1, $2, 'DOCTOR', false)
       RETURNING id`,
      [email, passwordHash]
    );

    const userId = userResult.rows[0].id;

    // Create doctor profile with practice information
    const doctorResult = await query(
      `INSERT INTO doctors (user_id, first_name, last_name, specialty, credentials, biography, consultation_fee, practice_name, practice_address, practice_latitude, practice_longitude, practice_phone, practice_email, practice_description, operating_hours_start, operating_hours_end, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
       RETURNING *`,
      [userId, firstName, lastName, specialty, credentials, biography, consultationFee, practiceName, practiceAddress, practiceLatitude, practiceLongitude, practicePhone, practiceEmail, practiceDescription, operatingHoursStart, operatingHoursEnd]
    );

    res.status(201).json(success(doctorResult.rows[0], 'Doctor created successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create doctor'));
  }
});

// Approve doctor
router.patch('/doctors/:id/approve', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      "UPDATE doctors SET is_approved = true WHERE id = $1",
      [id]
    );

    res.json(success(null, 'Doctor approved successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to approve doctor'));
  }
});

// Create secretary
router.post('/secretaries', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName, doctorId } = req.body;

    if (!email || !password || !firstName || !lastName || !doctorId) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Required fields missing'));
    }

    // Verify doctor exists
    const doctorResult = await query(
      'SELECT id FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, must_change_password)
       VALUES ($1, $2, 'SECRETARY', false)
       RETURNING id`,
      [email, passwordHash]
    );

    const userId = userResult.rows[0].id;

    // Create secretary profile associated with doctor
    const secretaryResult = await query(
      `INSERT INTO secretaries (user_id, doctor_id, first_name, last_name, is_approved)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [userId, doctorId, firstName, lastName]
    );

    res.status(201).json(success(secretaryResult.rows[0], 'Secretary created successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create secretary'));
  }
});

// Approve secretary
router.patch('/secretaries/:id/approve', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      "UPDATE secretaries SET is_approved = true WHERE id = $1",
      [id]
    );

    res.json(success(null, 'Secretary approved successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to approve secretary'));
  }
});

// Create additional Admin account (SUPERADMIN only)
router.post('/admins', authenticate, authorize('SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log('Creating admin account:', { email, role: 'ADMIN' });

    if (!email || !password) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Email and password are required'));
    }

    // Check if email already exists
    const existingUser = await query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log('Email already exists:', existingUser.rows[0]);
      return res.status(409).json(error(ErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already registered'));
    }

    // Hash password securely
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');

    // Create Admin user (always ADMIN role)
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, is_active, must_change_password, created_at`,
      [email, passwordHash, 'ADMIN', true, true]
    );

    const admin = userResult.rows[0];
    console.log('Admin account created:', admin);

    res.status(201).json(success(admin, 'Admin account created successfully'));
  } catch (err: any) {
    console.error('Error creating admin account:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create admin account'));
  }
});

// Get all admin accounts (SUPERADMIN only) - excludes SUPERADMIN from list
router.get('/admins', authenticate, authorize('SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, role, is_active, must_change_password, created_at 
       FROM users 
       WHERE role = 'ADMIN'
       ORDER BY created_at DESC`
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch admin accounts'));
  }
});

// Update admin account status (SUPERADMIN only)
router.patch('/admins/:id', authenticate, authorize('SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    // Prevent SUPERADMIN from deactivating themselves
    if (id === req.user.id && is_active === false) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot deactivate your own account'));
    }

    // Verify the target is an ADMIN account (not SUPERADMIN)
    const targetUser = await query(
      'SELECT role FROM users WHERE id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Admin account not found'));
    }

    if (targetUser.rows[0].role !== 'ADMIN') {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Can only modify ADMIN accounts'));
    }

    await query(
      "UPDATE users SET is_active = $1 WHERE id = $2",
      [is_active, id]
    );

    res.json(success(null, 'Admin account updated successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update admin account'));
  }
});

// Delete admin account (SUPERADMIN only)
router.delete('/admins/:id', authenticate, authorize('SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent SUPERADMIN from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot delete your own account'));
    }

    // Verify the target is an ADMIN account (not SUPERADMIN)
    const targetUser = await query(
      'SELECT role FROM users WHERE id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Admin account not found'));
    }

    if (targetUser.rows[0].role !== 'ADMIN') {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Can only delete ADMIN accounts'));
    }

    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json(success(null, 'Admin account deleted successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete admin account'));
  }
});

export default router;