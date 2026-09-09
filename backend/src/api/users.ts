import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let userProfile: any = {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      mustChangePassword: req.user!.mustChangePassword,
    };

    // Get role-specific profile
    if (role === 'PATIENT') {
      const patientResult = await query(
        'SELECT * FROM patients WHERE user_id = $1',
        [userId]
      );
      if (patientResult.rows.length > 0) {
        userProfile = { ...userProfile, ...patientResult.rows[0] };
      }
    } else if (role === 'DOCTOR') {
      const doctorResult = await query(
        'SELECT d.*, c.name as clinic_name, c.address as clinic_address FROM doctors d LEFT JOIN clinics c ON d.clinic_id = c.id WHERE d.user_id = $1',
        [userId]
      );
      if (doctorResult.rows.length > 0) {
        userProfile = { ...userProfile, ...doctorResult.rows[0] };
      }
    } else if (role === 'SECRETARY') {
      const secretaryResult = await query(
        'SELECT s.*, c.name as clinic_name, c.address as clinic_address FROM secretaries s JOIN clinics c ON s.clinic_id = c.id WHERE s.user_id = $1',
        [userId]
      );
      if (secretaryResult.rows.length > 0) {
        userProfile = { ...userProfile, ...secretaryResult.rows[0] };
      }
    }

    res.json(success(userProfile));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch user profile'));
  }
});

// Update current user profile
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const updates = req.body;

    // Update base user fields
    if (updates.email) {
      await query('UPDATE users SET email = $1 WHERE id = $2', [updates.email, userId]);
    }

    // Update role-specific profile
    if (role === 'PATIENT') {
      const { firstName, lastName, phone, address, emergencyContactName, emergencyContactPhone } = updates;
      await query(
        `UPDATE patients 
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             phone = COALESCE($3, phone),
             address = COALESCE($4, address),
             emergency_contact_name = COALESCE($5, emergency_contact_name),
             emergency_contact_phone = COALESCE($6, emergency_contact_phone)
         WHERE user_id = $7`,
        [firstName, lastName, phone, address, emergencyContactName, emergencyContactPhone, userId]
      );
    }

    res.json(success(null, 'Profile updated successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update profile'));
  }
});

export default router;