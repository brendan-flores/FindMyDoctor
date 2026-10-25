import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';

const router = Router();

// Get queue for a specific date
router.get('/:date', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('DOCTOR', 'SECRETARY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    const { doctorId } = req.query;
    const role = req.user!.role;
    const userId = req.user!.id;

    let queryText = `
      SELECT q.*,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.email as patient_email,
             d.first_name as doctor_first_name, d.last_name as doctor_last_name,
             d.consultation_fee,
             COALESCE(q.registration_source, 'ONLINE') as registration_source
      FROM queue_entries q
      JOIN patients p ON q.patient_id = p.id
      JOIN users u ON u.id = p.user_id
      JOIN doctors d ON q.doctor_id = d.id
      WHERE q.queue_date = $1
    `;
    const params = [date];

    // Secretary: automatically filter by assigned doctor
    if (role === 'SECRETARY') {
      const secretaryResult = await query(
        'SELECT doctor_id FROM secretaries WHERE user_id = $1',
        [userId]
      );

      if (secretaryResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
      }

      const assignedDoctorId = secretaryResult.rows[0].doctor_id;
      params.push(assignedDoctorId);
      queryText += ` AND q.doctor_id = $${params.length}`;
    } else if (doctorId) {
      // Doctor and Admin: can optionally filter by doctorId
      params.push(String(doctorId));
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
              d.practice_name
       FROM queue_entries q
       JOIN doctors d ON q.doctor_id = d.id
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
router.post('/:date/next', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    const { doctorId } = req.body;
    const role = req.user!.role;
    const userId = req.user!.id;

    let targetDoctorId = doctorId;

    // Secretary: use assigned doctor
    if (role === 'SECRETARY') {
      const secretaryResult = await query(
        'SELECT doctor_id FROM secretaries WHERE user_id = $1',
        [userId]
      );

      if (secretaryResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
      }

      const assignedDoctorId = secretaryResult.rows[0].doctor_id;

      // If secretary provides doctorId, verify it matches their assignment
      if (doctorId && doctorId !== assignedDoctorId) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only manage queue for your assigned doctor'));
      }

      targetDoctorId = assignedDoctorId;
    } else {
      // Doctor: must provide doctorId
      if (!doctorId) {
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor ID is required'));
      }
    }

    // Find next waiting patient
    const result = await query(
      `SELECT * FROM queue_entries
       WHERE queue_date = $1 AND doctor_id = $2 AND status = 'WAITING'
       ORDER BY queue_number ASC LIMIT 1`,
      [date, targetDoctorId]
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
router.patch('/:id/status', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const role = req.user!.role;
    const userId = req.user!.id;

    if (!status) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Status is required'));
    }

    const validStatuses = ['WAITING', 'CALLED', 'NOT_PRESENT', 'SKIPPED', 'IN_CHECKUP', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid status'));
    }

    // Build query with secretary-to-doctor assignment check
    let updateQuery = 'UPDATE queue_entries SET status = $1, updated_at = CURRENT_TIMESTAMP';
    const params = [status];

    if (status === 'CALLED') {
      updateQuery += ', called_at = CURRENT_TIMESTAMP';
    } else if (status === 'IN_CHECKUP') {
      updateQuery += ', started_at = CURRENT_TIMESTAMP';
    } else if (status === 'COMPLETED') {
      updateQuery += ', completed_at = CURRENT_TIMESTAMP';
    }

    if (role === 'SECRETARY') {
      updateQuery += ' WHERE id = $2 AND doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $3)';
      params.push(id, userId);
    } else {
      // DOCTOR
      updateQuery += ' WHERE id = $2 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $3)';
      params.push(id, userId);
    }

    const result = await query(updateQuery, params);

    if (result.rowCount === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found or access denied'));
    }

    res.json(success(null, 'Queue status updated'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update queue status'));
  }
});

// Start checkup
router.post('/:id/start-checkup', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user!.role;
    const userId = req.user!.id;

    let queryText = '';
    const params = [];

    if (role === 'SECRETARY') {
      queryText = `UPDATE queue_entries
                   SET status = 'IN_CHECKUP', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)`;
      params.push(id, userId);
    } else {
      // DOCTOR
      queryText = `UPDATE queue_entries
                   SET status = 'IN_CHECKUP', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)`;
      params.push(id, userId);
    }

    const result = await query(queryText, params);

    if (result.rowCount === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found or access denied'));
    }

    res.json(success(null, 'Checkup started'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to start checkup'));
  }
});

// Complete checkup
router.post('/:id/complete', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const role = req.user!.role;
    const userId = req.user!.id;

    let queueQueryText = '';
    const queueParams = [];

    if (role === 'SECRETARY') {
      queueQueryText = `UPDATE queue_entries
                   SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)
                   RETURNING appointment_id`;
      queueParams.push(id, userId);
    } else {
      // DOCTOR
      queueQueryText = `UPDATE queue_entries
                   SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
                   RETURNING appointment_id`;
      queueParams.push(id, userId);
    }

    const queueResult = await client.query(queueQueryText, queueParams);

    if (queueResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found or access denied'));
    }

    const appointmentId = queueResult.rows[0].appointment_id;

    // Update the associated appointment status to COMPLETED
    const appointmentResult = await client.query(
      'UPDATE appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['COMPLETED', appointmentId]
    );

    await client.query('COMMIT');

    res.json(success(null, 'Checkup completed'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to complete checkup'));
  } finally {
    client.release();
  }
});

// Skip patient
router.post('/:id/skip', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user!.role;
    const userId = req.user!.id;

    let queryText = '';
    const params = [];

    if (role === 'SECRETARY') {
      queryText = `UPDATE queue_entries
                   SET status = 'SKIPPED', updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)`;
      params.push(id, userId);
    } else {
      // DOCTOR
      queryText = `UPDATE queue_entries
                   SET status = 'SKIPPED', updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)`;
      params.push(id, userId);
    }

    const result = await query(queryText, params);

    if (result.rowCount === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found or access denied'));
    }

    res.json(success(null, 'Patient skipped'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to skip patient'));
  }
});

// Mark as not present
router.post('/:id/not-present', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user!.role;
    const userId = req.user!.id;

    let queryText = '';
    const params = [];

    if (role === 'SECRETARY') {
      queryText = `UPDATE queue_entries
                   SET status = 'NOT_PRESENT', updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)`;
      params.push(id, userId);
    } else {
      // DOCTOR
      queryText = `UPDATE queue_entries
                   SET status = 'NOT_PRESENT', updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)`;
      params.push(id, userId);
    }

    const result = await query(queryText, params);

    if (result.rowCount === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found or access denied'));
    }

    res.json(success(null, 'Patient marked as not present'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to mark patient as not present'));
  }
});

export default router;