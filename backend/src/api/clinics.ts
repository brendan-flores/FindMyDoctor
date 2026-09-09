import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get all clinics
router.get('/', async (req: any, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM clinics WHERE is_approved = true ORDER BY name'
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch clinics'));
  }
});

// Get clinic by ID
router.get('/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM clinics WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Clinic not found'));
    }

    // Get doctors at this clinic
    const doctorsResult = await query(
      'SELECT id, first_name, last_name, specialty FROM doctors WHERE clinic_id = $1 AND is_approved = true',
      [id]
    );

    const clinic = result.rows[0];
    clinic.doctors = doctorsResult.rows;

    res.json(success(clinic));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch clinic'));
  }
});

// Get clinic location
router.get('/:id/location', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT id, name, address, latitude, longitude FROM clinics WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Clinic not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch clinic location'));
  }
});

// Update clinic location (admin only)
router.patch('/:id/location', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, address } = req.body;

    if (!latitude || !longitude || !address) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Latitude, longitude, and address are required'));
    }

    await query(
      'UPDATE clinics SET latitude = $1, longitude = $2, address = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [latitude, longitude, address, id]
    );

    res.json(success(null, 'Clinic location updated successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update clinic location'));
  }
});

export default router;