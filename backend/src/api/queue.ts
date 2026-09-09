import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get queue for a specific date
router.get('/:date', authenticate, authorize('DOCTOR', 'SECRETARY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    const { doctorId } = req.query;

    let queryText = `
      SELECT q.*, 
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             d.first_name as doctor_first_name, d.last_name as doctor_last_name
      FROM queue_entries q
      JOIN patients p ON q.patient_id = p.id
      JOIN doctors d ON q.doctor_id = d.id
      WHERE q.queue_date = $1
    `;
    const params = [date];

    if (doctorId) {
      params.push(doctorId);
      queryText += ` AND q.doctor_id = $${params.length}`;
    }

    queryText += ' ORDER BY q.queue_number';

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch queue'));
  }
});

// Get patient's queue position
router.get('/:date/patient/:patientId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date, patientId } = req.params;

    const result = await query(
      `SELECT q.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialty,
              c.name as clinic_name
       FROM queue_entries q
       JOIN doctors d ON q.doctor_id = d.id
       JOIN clinics c ON q.clinic_id = c.id
       WHERE q.queue_date = $1 AND q.patient_id = $2`,
      [date, patientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch queue position'));
  }
});

// Call next patient
router.post('/:date/next', authenticate, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor ID is required'));
    }

    // Find next waiting patient
    const result = await query(
      `SELECT * FROM queue_entries 
       WHERE queue_date = $1 AND doctor_id = $2 AND status = 'WAITING'
       ORDER BY queue_number ASC LIMIT 1`,
      [date, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'No waiting patients found'));
    }

    const queueEntry = result.rows[0];

    // Update status to CALLED
    await query(
      `UPDATE queue_entries 
       SET status = 'CALLED', called_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [queueEntry.id]
    );

    res.json(success(queueEntry, 'Next patient called'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to call next patient'));
  }
});

// Update queue status
router.patch('/:id/status', authenticate, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Status is required'));
    }

    const validStatuses = ['WAITING', 'CALLED', 'NOT_PRESENT', 'SKIPPED', 'IN_CHECKUP', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid status'));
    }

    // Update status and appropriate timestamp
    let updateQuery = 'UPDATE queue_entries SET status = $1, updated_at = CURRENT_TIMESTAMP';
    const params = [status];

    if (status === 'CALLED') {
      updateQuery += ', called_at = CURRENT_TIMESTAMP';
    } else if (status === 'IN_CHECKUP') {
      updateQuery += ', started_at = CURRENT_TIMESTAMP';
    } else if (status === 'COMPLETED') {
      updateQuery += ', completed_at = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = $2';
    params.push(id);

    await query(updateQuery, params);

    res.json(success(null, 'Queue status updated'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update queue status'));
  }
});

// Start checkup
router.post('/:id/start-checkup', authenticate, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      `UPDATE queue_entries 
       SET status = 'IN_CHECKUP', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    res.json(success(null, 'Checkup started'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to start checkup'));
  }
});

// Complete checkup
router.post('/:id/complete', authenticate, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      `UPDATE queue_entries 
       SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    res.json(success(null, 'Checkup completed'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to complete checkup'));
  }
});

// Skip patient
router.post('/:id/skip', authenticate, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      `UPDATE queue_entries 
       SET status = 'SKIPPED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    res.json(success(null, 'Patient skipped'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to skip patient'));
  }
});

// Mark as not present
router.post('/:id/not-present', authenticate, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      `UPDATE queue_entries 
       SET status = 'NOT_PRESENT', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    res.json(success(null, 'Patient marked as not present'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to mark patient as not present'));
  }
});

export default router;