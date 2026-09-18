import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { sendApprovalEmail, sendRejectionEmail } from '../services/emailService';

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

// Get all doctors with complete profile information
router.get('/doctors', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        d.id,
        d.user_id,
        u.email,
        u.email_verified,
        d.first_name,
        d.last_name,
        d.specialty,
        d.credentials,
        d.prc_license_number,
        d.practice_name,
        d.practice_address,
        d.practice_phone,
        d.practice_email,
        d.is_approved,
        d.approval_status,
        d.reviewed_at,
        d.reviewed_by,
        d.rejection_reason,
        d.created_at
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE u.role = 'DOCTOR'
       ORDER BY d.created_at DESC`
    );

    // Ensure data is properly formatted with default values for null fields
    // Convert snake_case to camelCase to match frontend interface
    const formattedDoctors = result.rows.map(doctor => ({
      id: doctor.id,
      userId: doctor.user_id,
      email: doctor.email || '',
      emailVerified: doctor.email_verified || false,
      firstName: doctor.first_name || '',
      lastName: doctor.last_name || '',
      specialty: doctor.specialty || '',
      credentials: doctor.credentials || null,
      prcLicenseNumber: doctor.prc_license_number || '',
      practiceName: doctor.practice_name || '',
      practiceAddress: doctor.practice_address || '',
      practicePhone: doctor.practice_phone || '',
      practiceEmail: doctor.practice_email || '',
      isApproved: doctor.is_approved || false,
      approvalStatus: doctor.approval_status || 'PENDING',
      reviewedAt: doctor.reviewed_at || null,
      reviewedBy: doctor.reviewed_by || null,
      rejectionReason: doctor.rejection_reason || null,
      createdAt: doctor.created_at
    }));

    res.json(success(formattedDoctors));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctors'));
  }
});

// Create doctor
router.post('/doctors', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName, specialty, credentials, biography, consultationFee, prcLicenseNumber, practiceName, practiceAddress, practiceLatitude, practiceLongitude, practicePhone, practiceEmail, practiceDescription, operatingHoursStart, operatingHoursEnd } = req.body;

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
      `INSERT INTO doctors (user_id, first_name, last_name, specialty, credentials, biography, consultation_fee, prc_license_number, practice_name, practice_address, practice_latitude, practice_longitude, practice_phone, practice_email, practice_description, operating_hours_start, operating_hours_end, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true)
       RETURNING *`,
      [userId, firstName, lastName, specialty, credentials, biography, consultationFee, prcLicenseNumber, practiceName, practiceAddress, practiceLatitude, practiceLongitude, practicePhone, practiceEmail, practiceDescription, operatingHoursStart, operatingHoursEnd]
    );

    res.status(201).json(success(doctorResult.rows[0], 'Doctor created successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create doctor'));
  }
});

// Get doctor by ID
router.get('/doctors/:id', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        d.*, u.email, u.email_verified
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }
    
    const doctor = result.rows[0];
    const formatted = {
      id: doctor.id,
      userId: doctor.user_id,
      email: doctor.email,
      emailVerified: doctor.email_verified,
      firstName: doctor.first_name,
      lastName: doctor.last_name,
      specialty: doctor.specialty,
      credentials: doctor.credentials,
      prcLicenseNumber: doctor.prc_license_number,
      practiceName: doctor.practice_name,
      practiceAddress: doctor.practice_address,
      practicePhone: doctor.practice_phone,
      practiceEmail: doctor.practice_email,
      approvalStatus: doctor.approval_status,
      isApproved: doctor.is_approved,
      reviewedAt: doctor.reviewed_at,
      reviewedBy: doctor.reviewed_by,
      rejectionReason: doctor.rejection_reason,
      createdAt: doctor.created_at
    };
    
    res.json(success(formatted));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor'));
  }
});

// Approve doctor
router.patch('/doctors/:id/approve', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check current state and get doctor info
    const current = await query('SELECT approval_status, d.first_name, d.last_name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }
    
    if (current.rows[0].approval_status === 'ACTIVE') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor is already active'));
    }
    
    if (current.rows[0].approval_status === 'REJECTED') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot approve a rejected doctor'));
    }

    await query(
      `UPDATE doctors 
       SET approval_status = 'ACTIVE', 
           is_approved = true,
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = $1
       WHERE id = $2`,
      [req.user.id, id]
    );

    const doctor = current.rows[0];
    const doctorName = `${doctor.first_name} ${doctor.last_name}`;
    
    // Send approval email (non-blocking)
    sendApprovalEmail(doctor.email, doctorName).catch(err => {
      console.error('Failed to send approval email:', err);
    });

    console.log('Doctor approved successfully:', id);
    res.json(success(null, 'Doctor approved successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to approve doctor'));
  }
});

// Reject doctor
router.patch('/doctors/:id/reject', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Check current state and get doctor info
    const current = await query('SELECT approval_status, d.first_name, d.last_name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }
    
    if (current.rows[0].approval_status === 'ACTIVE') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot reject an active doctor'));
    }
    
    if (current.rows[0].approval_status === 'REJECTED') {
      return res.status(400).json(ErrorCodes.VALIDATION_ERROR, 'Doctor is already rejected');
    }
    
    await query(
      `UPDATE doctors 
       SET approval_status = 'REJECTED',
           is_approved = false,
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = $1,
           rejection_reason = $2
       WHERE id = $3`,
      [req.user.id, reason || null, id]
    );

    const doctor = current.rows[0];
    const doctorName = `${doctor.first_name} ${doctor.last_name}`;
    
    // Send rejection email (non-blocking)
    sendRejectionEmail(doctor.email, doctorName, reason).catch(err => {
      console.error('Failed to send rejection email:', err);
    });
    
    res.json(success(null, 'Doctor rejected successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reject doctor'));
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