import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getClient, query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { sendApprovalEmail, sendRejectionEmail } from '../services/emailService';
import * as otpService from '../services/otpService';
import * as auditService from '../services/auditService';

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

// Get dashboard statistics (ADMIN or SUPERADMIN)
router.get('/dashboard/stats', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    // Get doctor status counts
    const doctorStats = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE approval_status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE approval_status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE approval_status = 'REJECTED') as rejected
       FROM doctors`
    );

    // Get user role counts
    const userStats = await query(
      `SELECT
        role,
        COUNT(*) as count
       FROM users
       GROUP BY role`
    );

    // Get secretaries without assigned doctor
    const unassignedSecretaries = await query(
      `SELECT COUNT(*) as count
       FROM secretaries
       WHERE doctor_id IS NULL`
    );

    // Get pending approvals list (oldest first)
    const pendingApprovals = await query(
      `SELECT
        d.id,
        d.first_name,
        d.last_name,
        d.specialty,
        d.profile_submitted_at,
        d.profile_completion_status,
        u.email
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.approval_status = 'PENDING'
       ORDER BY d.profile_submitted_at ASC NULLS LAST
       LIMIT 10`
    );

    // Format pending approvals
    const formattedPending = pendingApprovals.rows.map(d => ({
      id: d.id,
      firstName: d.first_name,
      lastName: d.last_name,
      specialty: d.specialty,
      profileSubmittedAt: d.profile_submitted_at,
      profileCompletionStatus: d.profile_completion_status,
      email: d.email
    }));

    // Format user stats as an object
    const userStatsObj: Record<string, number> = {};
    userStats.rows.forEach(row => {
      userStatsObj[row.role.toLowerCase()] = parseInt(row.count);
    });

    res.json(success({
      doctors: {
        total: parseInt(doctorStats.rows[0].total),
        pending: parseInt(doctorStats.rows[0].pending),
        active: parseInt(doctorStats.rows[0].active),
        rejected: parseInt(doctorStats.rows[0].rejected)
      },
      users: userStatsObj,
      unassignedSecretaries: parseInt(unassignedSecretaries.rows[0].count),
      pendingApprovals: formattedPending
    }));
  } catch (err: any) {
    console.error('Failed to fetch dashboard stats:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch dashboard statistics'));
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
        u.is_active,
        d.first_name,
        d.middle_name,
        d.last_name,
        d.contact_number,
        d.specialty,
        d.credentials,
        d.prc_license_number,
        d.practice_name,
        d.practice_address,
        d.practice_phone,
        d.practice_email,
        d.professional_photo_url,
        d.years_of_experience,
        d.areas_of_expertise,
        d.biography,
        d.consultation_fee,
        d.languages_spoken,
        d.is_approved,
        d.approval_status,
        d.profile_completion_status,
        d.profile_submitted_at,
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
      isActive: doctor.is_active !== undefined ? doctor.is_active : true,
      firstName: doctor.first_name || '',
      middleName: doctor.middle_name || null,
      lastName: doctor.last_name || '',
      contactNumber: doctor.contact_number || null,
      specialty: doctor.specialty || '',
      credentials: doctor.credentials || null,
      prcLicenseNumber: doctor.prc_license_number || '',
      practiceName: doctor.practice_name || '',
      practiceAddress: doctor.practice_address || '',
      practicePhone: doctor.practice_phone || '',
      practiceEmail: doctor.practice_email || '',
      professionalPhotoUrl: doctor.professional_photo_url || null,
      yearsOfExperience: doctor.years_of_experience || null,
      areasOfExpertise: doctor.areas_of_expertise || null,
      biography: doctor.biography || null,
      consultationFee: doctor.consultation_fee || null,
      languagesSpoken: doctor.languages_spoken || null,
      isApproved: doctor.is_approved || false,
      approvalStatus: doctor.approval_status || 'PENDING',
      profileCompletionStatus: doctor.profile_completion_status || 'INCOMPLETE',
      profileSubmittedAt: doctor.profile_submitted_at || null,
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

    // Generate username from email (part before @)
    const username = email.split('@')[0];

    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, must_change_password, username)
       VALUES ($1, $2, 'DOCTOR', false, $3)
       RETURNING id`,
      [email, passwordHash, username]
    );

    const userId = userResult.rows[0].id;

    // Ensure Supabase Auth identity for OTP delivery
    const { ensureDoctorSupabaseIdentity } = await import('../services/otpService');
    await ensureDoctorSupabaseIdentity(email);

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
        d.*, u.email, u.email_verified, u.is_active
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
      isActive: doctor.is_active,
      firstName: doctor.first_name,
      middleName: doctor.middle_name,
      lastName: doctor.last_name,
      contactNumber: doctor.contact_number,
      specialty: doctor.specialty,
      credentials: doctor.credentials,
      prcLicenseNumber: doctor.prc_license_number,
      practiceName: doctor.practice_name,
      practiceAddress: doctor.practice_address,
      practicePhone: doctor.practice_phone,
      practiceEmail: doctor.practice_email,
      professionalPhotoUrl: doctor.professional_photo_url,
      yearsOfExperience: doctor.years_of_experience,
      areasOfExpertise: doctor.areas_of_expertise,
      biography: doctor.biography,
      consultationFee: doctor.consultation_fee,
      languagesSpoken: doctor.languages_spoken,
      approvalStatus: doctor.approval_status,
      isApproved: doctor.is_approved,
      profileCompletionStatus: doctor.profile_completion_status,
      profileSubmittedAt: doctor.profile_submitted_at,
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

// Get doctor schedules for admin review
router.get('/doctors/:id/schedules', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM doctor_schedules WHERE doctor_id = $1 ORDER BY day_of_week',
      [id]
    );

    // Convert snake_case to camelCase for frontend consistency
    const formattedSchedules = result.rows.map(schedule => ({
      id: schedule.id,
      doctorId: schedule.doctor_id,
      dayOfWeek: schedule.day_of_week,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      consultationDurationMinutes: schedule.consultation_duration_minutes,
      isActive: schedule.is_active,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
    }));

    res.json(success(formattedSchedules));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch doctor schedules'));
  }
});

// Approve doctor
router.patch('/doctors/:id/approve', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check current state and get complete doctor info
    const current = await query(
      `SELECT
        d.approval_status,
        d.first_name,
        d.last_name,
        d.contact_number,
        d.specialty,
        d.credentials,
        d.prc_license_number,
        d.practice_name,
        u.email,
        u.email_verified
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.id = $1`,
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    if (current.rows[0].approval_status === 'ACTIVE') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor is already active'));
    }

    if (current.rows[0].approval_status === 'REJECTED') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot approve a rejected doctor'));
    }

    // Validate critical information before approval
    const doctor = current.rows[0];
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
      return res.status(400).json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot approve doctor: Missing required fields - ${missingFields.map(f => f.name).join(', ')}`
        )
      );
    }

    // Validate email verification
    if (!doctor.email_verified || doctor.email_verified !== true) {
      return res.status(400).json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot approve doctor: Email must be verified'
        )
      );
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

    const doctorName = `${doctor.first_name} ${doctor.last_name}`;

    // Send approval email (non-blocking)
    sendApprovalEmail(doctor.email, doctorName).catch(err => {
      console.error('Failed to send approval email:', err);
    });

    // Log audit entry
    await auditService.logDoctorApproval(req.user.id, doctor.id, doctorName);

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

    // Validate that reason is provided
    if (!reason || (typeof reason === 'string' && reason.trim() === '')) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Rejection reason is required'));
    }

    // Check current state and get doctor info
    const current = await query('SELECT approval_status, d.first_name, d.last_name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    if (current.rows[0].approval_status === 'ACTIVE') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot reject an active doctor'));
    }

    if (current.rows[0].approval_status === 'REJECTED') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor is already rejected'));
    }

    await query(
      `UPDATE doctors
       SET approval_status = 'REJECTED',
           is_approved = false,
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = $1,
           rejection_reason = $2
       WHERE id = $3`,
      [req.user.id, reason, id]
    );

    const doctor = current.rows[0];
    const doctorName = `${doctor.first_name} ${doctor.last_name}`;

    // Send rejection email (non-blocking)
    sendRejectionEmail(doctor.email, doctorName, reason).catch(err => {
      console.error('Failed to send rejection email:', err);
    });

    // Log audit entry
    await auditService.logDoctorRejection(req.user.id, doctor.id, doctorName, reason);

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

    // SAFETY: Ensure Supabase Auth identity exists BEFORE creating PostgreSQL account
    // Secretary 2FA is optional, but if enabled, OTP requires the user to exist in Supabase Auth
    // This is idempotent - will not create duplicate identities
    try {
      const { ensureSecretarySupabaseIdentity } = await import('../services/otpService');
      await ensureSecretarySupabaseIdentity(email);
      console.log('Supabase identity ensured for secretary:', email);
    } catch (supabaseErr: any) {
      console.error('Failed to ensure Supabase identity:', supabaseErr);
      // FAIL FAST: Do not create PostgreSQL account if Supabase provisioning fails
      // This prevents creating a Secretary that cannot complete 2FA login if enabled
      return res.status(500).json(
        error(ErrorCodes.SERVER_ERROR, 'Failed to create Supabase identity for OTP. Secretary account not created.')
      );
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate username from email (part before @)
    const username = email.split('@')[0];

    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, must_change_password, username)
       VALUES ($1, $2, 'SECRETARY', false, $3)
       RETURNING id`,
      [email, passwordHash, username]
    );

    const userId = userResult.rows[0].id;

    // Create secretary profile associated with doctor
    const secretaryResult = await query(
      `INSERT INTO secretaries (user_id, doctor_id, first_name, last_name, is_approved)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [userId, doctorId, firstName, lastName]
    );

    // Log audit entry
    await auditService.logSecretaryCreation(req.user.id, userId, email, doctorId);

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

// Get all secretaries with profile and doctor information
router.get('/secretaries', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
        s.id,
        s.user_id,
        u.email,
        u.is_active,
        u.must_change_password,
        s.first_name,
        s.last_name,
        s.doctor_id,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialty as doctor_specialty,
        s.is_approved,
        s.created_at
       FROM secretaries s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN doctors d ON s.doctor_id = d.id
       ORDER BY s.created_at DESC`
    );

    // Convert snake_case to camelCase for frontend consistency
    const formattedSecretaries = result.rows.map(secretary => ({
      id: secretary.id,
      userId: secretary.user_id,
      email: secretary.email,
      isActive: secretary.is_active,
      mustChangePassword: secretary.must_change_password,
      firstName: secretary.first_name || '',
      lastName: secretary.last_name || '',
      doctorId: secretary.doctor_id,
      doctorFirstName: secretary.doctor_first_name,
      doctorLastName: secretary.doctor_last_name,
      doctorSpecialty: secretary.doctor_specialty,
      isApproved: secretary.is_approved,
      createdAt: secretary.created_at
    }));

    res.json(success(formattedSecretaries));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch secretaries'));
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

    // SAFETY: Ensure Supabase Auth identity exists BEFORE creating PostgreSQL account
    // Admin OTP is mandatory with NO bypass, so we must not create a broken Admin account
    // This is idempotent - will not create duplicate identities
    try {
      await otpService.ensureAdminSupabaseIdentity(email);
      console.log('Supabase identity ensured for admin:', email);
    } catch (supabaseErr: any) {
      console.error('Failed to ensure Supabase identity:', supabaseErr);
      // FAIL FAST: Do not create PostgreSQL account if Supabase provisioning fails
      // This prevents creating an Admin that cannot complete mandatory OTP login
      return res.status(500).json(
        error(ErrorCodes.SERVER_ERROR, 'Failed to create Supabase identity for OTP. Admin account not created.')
      );
    }

    // Hash password securely
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');

    // Generate username from email (part before @)
    const username = email.split('@')[0];

    // Create Admin user (always ADMIN role)
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, is_active, must_change_password, username)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, is_active, must_change_password, created_at`,
      [email, passwordHash, 'ADMIN', true, true, username]
    );

    const admin = userResult.rows[0];
    console.log('Admin account created:', admin);

    // Log audit entry
    await auditService.logAdminCreation(req.user.id, admin.id, email);

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

// Reconcile Admin Supabase identities (SUPERADMIN only)
// This endpoint provisions Supabase Auth identities for existing Admin accounts
// that don't have them yet. This is server-side, idempotent, and duplicate-safe.
router.post('/admins/reconcile-supabase', authenticate, authorize('SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    console.log('Reconciling Supabase identities for Admin accounts');

    // Get all Admin and SuperAdmin accounts
    const adminUsers = await query(
      `SELECT id, email, role FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')`
    );

    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;
    const failures: { email: string; error: string }[] = [];

    for (const admin of adminUsers.rows) {
      try {
        const result = await otpService.ensureAdminSupabaseIdentity(admin.email);
        successCount++;
        console.log(`✅ Supabase identity ensured for ${admin.email} (${admin.role})`);
      } catch (err: any) {
        failureCount++;
        failures.push({ email: admin.email, error: err.message || 'Unknown error' });
        console.error(`❌ Failed to ensure Supabase identity for ${admin.email}:`, err.message);
      }
    }

    res.json(success({
      successCount,
      skippedCount,
      failureCount,
      failures
    }, `Reconciliation complete: ${successCount} succeeded, ${failureCount} failed`));
  } catch (err: any) {
    console.error('Error reconciling Supabase identities:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reconcile Supabase identities'));
  }
});

// Reconcile Secretary Supabase identities (ADMIN or SUPERADMIN only)
// This endpoint provisions Supabase Auth identities for existing Secretary accounts
// that don't have them yet. This is server-side, idempotent, and duplicate-safe.
router.post('/secretaries/reconcile-supabase', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    console.log('Reconciling Supabase identities for Secretary accounts');

    // Get all Secretary accounts
    const secretaryUsers = await query(
      `SELECT id, email, role FROM users WHERE role = 'SECRETARY'`
    );

    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;
    const failures: { email: string; error: string }[] = [];

    for (const secretary of secretaryUsers.rows) {
      try {
        const { ensureSecretarySupabaseIdentity } = await import('../services/otpService');
        const result = await ensureSecretarySupabaseIdentity(secretary.email);
        successCount++;
        console.log(`✅ Supabase identity ensured for ${secretary.email} (${secretary.role})`);
      } catch (err: any) {
        failureCount++;
        failures.push({ email: secretary.email, error: err.message || 'Unknown error' });
        console.error(`❌ Failed to ensure Supabase identity for ${secretary.email}:`, err.message);
      }
    }

    res.json(success({
      successCount,
      skippedCount,
      failureCount,
      failures
    }, `Reconciliation complete: ${successCount} succeeded, ${failureCount} failed`));
  } catch (err: any) {
    console.error('Error reconciling Supabase identities:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reconcile Supabase identities'));
  }
});

// Update admin account status (SUPERADMIN only)
router.patch('/admins/:id', authenticate, authorize('SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    const { id } = req.params;
    const { is_active } = req.body;

    // Prevent SUPERADMIN from deactivating themselves
    if (id === req.user.id && is_active === false) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot deactivate your own account'));
    }

    // Verify the target is an ADMIN account (not SUPERADMIN)
    const targetUser = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Admin account not found'));
    }

    if (targetUser.rows[0].role !== 'ADMIN') {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Can only modify ADMIN accounts'));
    }

    const admin = targetUser.rows[0];

    await client.query('BEGIN');

    // Update is_active status
    await client.query(
      "UPDATE users SET is_active = $1 WHERE id = $2",
      [is_active, id]
    );

    // If deactivating, invalidate all push device tokens
    if (is_active === false) {
      await client.query('DELETE FROM device_tokens WHERE user_id = $1', [id]);
    }

    await client.query('COMMIT');

    // Log audit entry
    if (is_active === false) {
      await auditService.logAdminDeactivation(req.user.id, admin.id, admin.email);
    } else {
      await auditService.logAdminReactivation(req.user.id, admin.id, admin.email);
    }

    res.json(success(null, 'Admin account updated successfully'));
  } catch (err: any) {
    const client = await getClient();
    await client.query('ROLLBACK');
    client.release();
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update admin account'));
  }
});

// Delete admin account (SUPERADMIN only)
router.delete('/admins/:id', authenticate, authorize('SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    const { id } = req.params;

    // Prevent SUPERADMIN from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot delete your own account'));
    }

    await client.query('BEGIN');

    // Verify the target is an ADMIN account (not SUPERADMIN)
    const targetUser = await client.query(
      'SELECT role FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (targetUser.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Admin account not found'));
    }

    if (targetUser.rows[0].role !== 'ADMIN') {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Can only delete ADMIN accounts'));
    }

    // Keep doctor review records while removing their optional admin reference.
    await client.query('UPDATE doctors SET reviewed_by = NULL WHERE reviewed_by = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    await client.query('COMMIT');

    res.json(success(null, 'Admin account deleted successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Failed to delete admin account:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete admin account'));
  } finally {
    client.release();
  }
});

// ============================================
// DOCTOR ACCOUNT STATUS CONTROLS
// ============================================

// Deactivate doctor account (ADMIN or SUPERADMIN)
router.patch('/doctors/:id/deactivate', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    const { id } = req.params;

    // Prevent deactivating self
    const targetUser = await query(
      'SELECT u.id, u.role, d.first_name, d.last_name FROM users u JOIN doctors d ON u.id = d.user_id WHERE d.id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    if (targetUser.rows[0].id === req.user.id) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot deactivate your own account'));
    }

    const doctor = targetUser.rows[0];
    const doctorName = `${doctor.first_name} ${doctor.last_name}`;

    await client.query('BEGIN');

    // Deactivate user account
    await client.query('UPDATE users SET is_active = false WHERE id = $1', [doctor.id]);

    // Invalidate all push device tokens for this user
    await client.query('DELETE FROM device_tokens WHERE user_id = $1', [doctor.id]);

    await client.query('COMMIT');

    // Log audit entry
    await auditService.logDoctorDeactivation(req.user.id, doctor.id, doctorName);

    res.json(success(null, 'Doctor account deactivated successfully'));
  } catch (err: any) {
    const client = await getClient();
    await client.query('ROLLBACK');
    client.release();
    console.error('Failed to deactivate doctor:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to deactivate doctor account'));
  }
});

// Reactivate doctor account (ADMIN or SUPERADMIN)
router.patch('/doctors/:id/reactivate', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const targetUser = await query(
      'SELECT u.id, d.first_name, d.last_name FROM users u JOIN doctors d ON u.id = d.user_id WHERE d.id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    const doctor = targetUser.rows[0];
    const doctorName = `${doctor.first_name} ${doctor.last_name}`;

    await query('UPDATE users SET is_active = true WHERE id = $1', [doctor.id]);

    // Log audit entry
    await auditService.logDoctorReactivation(req.user.id, doctor.id, doctorName);

    res.json(success(null, 'Doctor account reactivated successfully'));
  } catch (err: any) {
    console.error('Failed to reactivate doctor:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reactivate doctor account'));
  }
});

// ============================================
// SECRETARY ACCOUNT STATUS CONTROLS
// ============================================

// Deactivate secretary account (ADMIN or SUPERADMIN)
router.patch('/secretaries/:id/deactivate', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    const { id } = req.params;

    // Prevent deactivating self
    const targetUser = await query(
      'SELECT u.id, u.role, s.first_name, s.last_name FROM users u JOIN secretaries s ON u.id = s.user_id WHERE s.id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary not found'));
    }

    if (targetUser.rows[0].id === req.user.id) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot deactivate your own account'));
    }

    const secretary = targetUser.rows[0];
    const secretaryName = `${secretary.first_name} ${secretary.last_name}`;

    await client.query('BEGIN');

    // Deactivate user account
    await client.query('UPDATE users SET is_active = false WHERE id = $1', [secretary.id]);

    // Invalidate all push device tokens for this user
    await client.query('DELETE FROM device_tokens WHERE user_id = $1', [secretary.id]);

    await client.query('COMMIT');

    // Log audit entry
    await auditService.logSecretaryDeactivation(req.user.id, secretary.id, secretaryName);

    res.json(success(null, 'Secretary account deactivated successfully'));
  } catch (err: any) {
    const client = await getClient();
    await client.query('ROLLBACK');
    client.release();
    console.error('Failed to deactivate secretary:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to deactivate secretary account'));
  }
});

// Reactivate secretary account (ADMIN or SUPERADMIN)
router.patch('/secretaries/:id/reactivate', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const targetUser = await query(
      'SELECT u.id, s.first_name, s.last_name FROM users u JOIN secretaries s ON u.id = s.user_id WHERE s.id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary not found'));
    }

    const secretary = targetUser.rows[0];
    const secretaryName = `${secretary.first_name} ${secretary.last_name}`;

    await query('UPDATE users SET is_active = true WHERE id = $1', [secretary.id]);

    // Log audit entry
    await auditService.logSecretaryReactivation(req.user.id, secretary.id, secretaryName);

    res.json(success(null, 'Secretary account reactivated successfully'));
  } catch (err: any) {
    console.error('Failed to reactivate secretary:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reactivate secretary account'));
  }
});

// ============================================
// SECRETARY PASSWORD RESET
// ============================================

// Reset secretary password (ADMIN or SUPERADMIN)
// This generates a new temporary password and requires the secretary to change it on first login
router.post('/secretaries/:id/reset-password', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const targetUser = await query(
      'SELECT u.id, u.email, s.first_name, s.last_name FROM users u JOIN secretaries s ON u.id = s.user_id WHERE s.id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary not found'));
    }

    const secretary = targetUser.rows[0];

    // Generate a random temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Update password and set must_change_password flag
    await query(
      'UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2',
      [passwordHash, secretary.id]
    );

    // Log audit entry
    await auditService.logSecretaryPasswordReset(req.user.id, secretary.id, secretary.email);

    // Return the temporary password (this should be communicated securely)
    res.json(success({
      email: secretary.email,
      temporaryPassword: tempPassword
    }, 'Secretary password reset successfully. The secretary must change this password on first login.'));
  } catch (err: any) {
    console.error('Failed to reset secretary password:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reset secretary password'));
  }
});

// ============================================
// AUDIT LOG ENDPOINTS
// ============================================

// Get audit log entries with filters and pagination (ADMIN or SUPERADMIN)
router.get('/audit-log', authenticate, authorize('ADMIN', 'SUPERADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      action,
      actorId,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (actorId) {
      conditions.push(`actor_user_id = $${paramIndex}`);
      params.push(actorId);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total FROM admin_audit_log ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated audit log entries with actor and target user details
    const result = await query(
      `SELECT
        al.id,
        al.actor_user_id,
        actor.email as actor_email,
        actor.role as actor_role,
        al.action,
        al.target_user_id,
        target.email as target_email,
        target.role as target_role,
        al.target_type,
        al.timestamp,
        al.reason,
        al.metadata,
        al.created_at
       FROM admin_audit_log al
       LEFT JOIN users actor ON al.actor_user_id = actor.id
       LEFT JOIN users target ON al.target_user_id = target.id
       ${whereClause}
       ORDER BY al.timestamp DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );

    // Convert snake_case to camelCase
    const formattedEntries = result.rows.map(entry => ({
      id: entry.id,
      actorUserId: entry.actor_user_id,
      actorEmail: entry.actor_email,
      actorRole: entry.actor_role,
      action: entry.action,
      targetUserId: entry.target_user_id,
      targetEmail: entry.target_email,
      targetRole: entry.target_role,
      targetType: entry.target_type,
      timestamp: entry.timestamp,
      reason: entry.reason,
      metadata: entry.metadata,
      createdAt: entry.created_at
    }));

    res.json(success({
      entries: formattedEntries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }));
  } catch (err: any) {
    console.error('Failed to fetch audit log:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch audit log'));
  }
});

export default router;