import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

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

export default router;
