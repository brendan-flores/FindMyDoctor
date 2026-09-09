import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get all doctors (public search)
router.get('/', async (req: any, res: Response) => {
  try {
    const { specialty, clinicId, search } = req.query;

    let queryText = `
      SELECT 
        d.id, d.first_name, d.last_name, d.specialty, d.credentials, 
        d.biography, d.consultation_fee, d.is_approved,
        c.name as clinic_name, c.address as clinic_address, 
        c.latitude, c.longitude, c.phone as clinic_phone
      FROM doctors d
      LEFT JOIN clinics c ON d.clinic_id = c.id
      WHERE d.is_approved = true
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (specialty) {
      paramCount++;
      queryText += ` AND d.specialty = $${paramCount}`;
      params.push(specialty);
    }

    if (clinicId) {
      paramCount++;
      queryText += ` AND d.clinic_id = $${paramCount}`;
      params.push(clinicId);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (d.first_name ILIKE $${paramCount} OR d.last_name ILIKE $${paramCount} OR d.specialty ILIKE $${paramCount})`;
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
        d.*, 
        c.name as clinic_name, c.address as clinic_address, 
        c.latitude, c.longitude, c.phone as clinic_phone,
        c.operating_hours_start, c.operating_hours_end
       FROM doctors d
       LEFT JOIN clinics c ON d.clinic_id = c.id
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
      params.push(date);
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

    // Get doctor's clinic and consultation duration
    const doctorResult = await query(
      'SELECT clinic_id, consultation_duration_minutes FROM doctors WHERE id = $1',
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
        `INSERT INTO daily_capacities (doctor_id, clinic_id, date, consultation_duration_minutes, calculated_capacity, configured_capacity, final_capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, doctor.clinic_id, date, 30, calculatedCapacity, configuredCapacity, finalCapacity]
      );
    }

    res.json(success(null, 'Capacity set successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to set capacity'));
  }
});

export default router;