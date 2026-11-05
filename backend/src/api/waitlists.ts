import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requirePasswordChange } from '../middleware/auth';
import { calculateAvailability } from '../modules/availability/availabilityService';

const router = Router();

// Join a waitlist
router.post('/', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const userId = req.user!.id;
    const { doctorId, waitlistDate } = req.body;

    // Basic validation
    if (!doctorId || !waitlistDate) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor ID and waitlist date are required'));
    }

    // Get patient ID
    const patientResult = await client.query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    const patientId = patientResult.rows[0].id;

    // Verify doctor exists and is active
    const doctorResult = await client.query(
      'SELECT * FROM doctors WHERE id = $1 AND is_approved = true',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found or not approved'));
    }

    // Validate waitlist date is in the future
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const waitlistDateObj = new Date(waitlistDate);
    if (waitlistDateObj < now) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot join waitlist for past dates'));
    }

    // Check if schedule is genuinely FULL
    const availability = await calculateAvailability(doctorId, waitlistDate);
    if (availability.status !== 'FULL') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot join waitlist: slots are still available'));
    }

    // Check for existing active entry for same doctor/date
    const existingResult = await client.query(
      `SELECT * FROM waitlists
       WHERE patient_id = $1 AND doctor_id = $2 AND waitlist_date = $3
       AND status IN ('WAITING', 'OFFERED')`,
      [patientId, doctorId, waitlistDate]
    );

    if (existingResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'You already have an active waitlist entry for this doctor and date'));
    }

    // Calculate position based on existing entries
    const positionResult = await client.query(
      `SELECT COALESCE(MAX(position), 0) + 1 as next_position
       FROM waitlists
       WHERE doctor_id = $1 AND waitlist_date = $2 AND status = 'WAITING'`,
      [doctorId, waitlistDate]
    );

    const position = positionResult.rows[0].next_position;

    // Create waitlist entry
    const waitlistResult = await client.query(
      `INSERT INTO waitlists (patient_id, doctor_id, waitlist_date, status, position)
       VALUES ($1, $2, $3, 'WAITING', $4)
       RETURNING id, position`,
      [patientId, doctorId, waitlistDate, position]
    );

    await client.query('COMMIT');

    res.status(201).json(
      success({
        waitlistId: waitlistResult.rows[0].id,
        position: waitlistResult.rows[0].position,
      }, 'Successfully joined waitlist')
    );
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Waitlist join error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to join waitlist'));
  } finally {
    client.release();
  }
});

// Get authenticated patient's waitlist entries
router.get('/me', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT
        w.*,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialty,
        d.practice_name
       FROM waitlists w
       JOIN doctors d ON w.doctor_id = d.id
       WHERE w.patient_id = (SELECT id FROM patients WHERE user_id = $1)
       ORDER BY w.waitlist_date DESC, w.position ASC`,
      [userId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch waitlist entries'));
  }
});

// Check waitlist status for specific doctor and date
router.get('/check', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId, waitlistDate } = req.query;
    const userId = req.user!.id;

    if (!doctorId || !waitlistDate) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor ID and waitlist date are required'));
    }

    const result = await query(
      `SELECT
        w.*,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialty,
        d.practice_name
       FROM waitlists w
       JOIN doctors d ON w.doctor_id = d.id
       WHERE w.patient_id = (SELECT id FROM patients WHERE user_id = $1)
       AND w.doctor_id = $2
       AND w.waitlist_date = $3
       AND w.status IN ('WAITING', 'OFFERED')`,
      [userId, doctorId, waitlistDate]
    );

    if (result.rows.length === 0) {
      return res.json(success(null, 'No active waitlist entry found'));
    }

    res.json(success(result.rows[0], 'Waitlist entry found'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to check waitlist status'));
  }
});

// Get waitlist count for authenticated patient
router.get('/count', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT COUNT(*) as count FROM waitlists
       WHERE patient_id = (SELECT id FROM patients WHERE user_id = $1)
       AND status IN ('WAITING', 'OFFERED')`,
      [userId]
    );
    res.json(success({ count: result.rows[0].count }));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to get waitlist count'));
  }
});

// Get individual waitlist entry
router.get('/:id', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await query(
      `SELECT
        w.id,
        w.patient_id,
        w.doctor_id,
        to_char(w.waitlist_date, 'YYYY-MM-DD') AS waitlist_date,
        w.status,
        w.position,
        w.offered_at,
        w.expires_at,
        w.created_at,
        w.updated_at,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialty,
        d.practice_name
       FROM waitlists w
       JOIN doctors d ON w.doctor_id = d.id
       WHERE w.id = $1 AND w.patient_id = (SELECT id FROM patients WHERE user_id = $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Waitlist entry not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch waitlist entry'));
  }
});

// Leave a waitlist
router.delete('/:id', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const waitlistResult = await client.query(
      `SELECT * FROM waitlists
       WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)`,
      [id, userId]
    );

    if (waitlistResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Waitlist entry not found'));
    }

    const waitlist = waitlistResult.rows[0];

    if (waitlist.status !== 'WAITING' && waitlist.status !== 'OFFERED') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.INVALID_APPOINTMENT_STATUS, 'Cannot leave waitlist: entry is not active'));
    }

    // Update status to CANCELLED
    await client.query(
      "UPDATE waitlists SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    // Recalculate positions for remaining WAITING entries
    if (waitlist.status === 'WAITING') {
      await client.query(
        `UPDATE waitlists
         SET position = new_position
         FROM (
           SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_position
           FROM waitlists
           WHERE doctor_id = $1
           AND waitlist_date = $2
           AND status = 'WAITING'
         ) as ranked
         WHERE waitlists.id = ranked.id`,
        [waitlist.doctor_id, waitlist.waitlist_date]
      );
    }

    await client.query('COMMIT');

    res.json(success(null, 'Successfully left waitlist'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Waitlist leave error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to leave waitlist'));
  } finally {
    client.release();
  }
});

export default router;
