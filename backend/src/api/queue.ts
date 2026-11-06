import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requirePasswordChange, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';
import { getClinicDate } from '../utils/date';

const router = Router();

// Get the authenticated patient's live queue for today.
// The patient is identified from the token - never from a client-supplied id.
router.get('/today/me', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = getClinicDate();

    const patientResult = await query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    const patientId = patientResult.rows[0].id;

    const result = await query(
      `SELECT q.id as queue_entry_id,
              q.appointment_id,
              q.queue_number,
              q.status as queue_status,
              q.queue_date,
              q.doctor_id,
              d.first_name as doctor_first_name,
              d.last_name as doctor_last_name,
              d.specialty,
              d.practice_name,
              d.room_number,
              d.professional_photo_url,
              d.consultation_fee,
              dc.consultation_duration_minutes,
              COALESCE(
                (SELECT MAX(q2.queue_number)
                 FROM queue_entries q2
                 WHERE q2.queue_date = q.queue_date
                 AND q2.doctor_id = q.doctor_id
                 AND q2.status IN ('CALLED', 'IN_CHECKUP')),
                (SELECT MAX(q3.queue_number)
                 FROM queue_entries q3
                 WHERE q3.queue_date = q.queue_date
                 AND q3.doctor_id = q.doctor_id
                 AND q3.status = 'COMPLETED')
              ) as now_serving,
              (SELECT COUNT(*)
               FROM queue_entries q4
               WHERE q4.queue_date = q.queue_date
               AND q4.doctor_id = q.doctor_id
               AND q4.queue_number < q.queue_number
               AND q4.status IN ('WAITING', 'CALLED')) as patients_ahead
       FROM queue_entries q
       JOIN doctors d ON q.doctor_id = d.id
       LEFT JOIN daily_capacities dc
         ON dc.doctor_id = q.doctor_id AND dc.date = q.queue_date
       WHERE q.patient_id = $1 AND q.queue_date = $2
       ORDER BY q.queue_number`,
      [patientId, today]
    );

    const queues = result.rows.map((row: any) => {
      const duration = Number(row.consultation_duration_minutes ?? 30);
      const patientsAhead = Number(row.patients_ahead ?? 0);

      return {
        queueEntryId: row.queue_entry_id,
        appointmentId: row.appointment_id,
        queueNumber: row.queue_number,
        queueStatus: row.queue_status,
        doctorId: row.doctor_id,
        doctorName: `Dr. ${row.doctor_first_name} ${row.doctor_last_name}`.trim(),
        specialty: row.specialty,
        practiceName: row.practice_name,
        roomNumber: row.room_number,
        professionalPhotoUrl: row.professional_photo_url,
        consultationFee: row.consultation_fee,
        nowServing: row.now_serving === null ? null : Number(row.now_serving),
        patientsAhead,
        estimatedWaitMinutes: patientsAhead * duration,
        consultationDurationMinutes: duration,
      };
    });

    res.json(success({ date: today, queues }));
  } catch (err: any) {
    console.error('Error fetching today\'s queue:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch today\'s queue'));
  }
});

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

// Get patient's queue position.
// Patients may only read their own entry; doctors and secretaries are scoped to
// the doctor/date they are responsible for. Unauthorised access returns 403.
router.get('/:date/patient/:patientId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date, patientId } = req.params;
    const role = req.user!.role;
    const userId = req.user!.id;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Date must be in YYYY-MM-DD format'));
    }

    // Resolve who the caller is allowed to look at.
    let scopedDoctorId: string | null = null;

    if (role === 'PATIENT') {
      const ownPatientResult = await query(
        'SELECT id FROM patients WHERE user_id = $1',
        [userId]
      );

      if (ownPatientResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
      }

      if (ownPatientResult.rows[0].id !== patientId) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only access your own queue information'));
      }
    } else if (role === 'DOCTOR') {
      const doctorResult = await query(
        'SELECT id FROM doctors WHERE user_id = $1',
        [userId]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Doctor profile not found'));
      }

      scopedDoctorId = doctorResult.rows[0].id;
    } else if (role === 'SECRETARY') {
      const secretaryResult = await query(
        'SELECT doctor_id FROM secretaries WHERE user_id = $1',
        [userId]
      );

      if (secretaryResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
      }

      scopedDoctorId = secretaryResult.rows[0].doctor_id;
    } else if (role !== 'ADMIN') {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role for queue access'));
    }

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

    // Patients only ever match their own entry above; staff must match scope.
    if (scopedDoctorId && result.rows.some((row: any) => row.doctor_id !== scopedDoctorId)) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only access queue entries for your assigned doctor'));
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
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { status } = req.body;
    const role = req.user!.role;
    const userId = req.user!.id;

    if (!status) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Status is required'));
    }

    const validStatuses = ['WAITING', 'CALLED', 'NOT_PRESENT', 'SKIPPED', 'IN_CHECKUP', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid status'));
    }

    // Get current queue entry details before updating
    let getQuery = '';
    const getParams = [id];

    if (role === 'SECRETARY') {
      getQuery = `SELECT q.*, a.id as appointment_id, a.status as appointment_status
                  FROM queue_entries q
                  LEFT JOIN appointments a ON q.appointment_id = a.id
                  WHERE q.id = $1 AND q.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)`;
      getParams.push(userId);
    } else {
      // DOCTOR
      getQuery = `SELECT q.*, a.id as appointment_id, a.status as appointment_status
                  FROM queue_entries q
                  LEFT JOIN appointments a ON q.appointment_id = a.id
                  WHERE q.id = $1 AND q.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)`;
      getParams.push(userId);
    }

    const currentEntryResult = await client.query(getQuery, getParams);

    if (currentEntryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found or access denied'));
    }

    const currentEntry = currentEntryResult.rows[0];
    const previousStatus = currentEntry.status;

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

    const result = await client.query(updateQuery, params);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found or access denied'));
    }

    // Handle capacity update when cancelling an appointment
    // Only decrement capacity if:
    // 1. New status is CANCELLED or NO_SHOW
    // 2. Previous status was not already CANCELLED or NO_SHOW (to avoid double-decrement)
    if ((status === 'CANCELLED' || status === 'NO_SHOW') &&
        previousStatus !== 'CANCELLED' && previousStatus !== 'NO_SHOW') {

      // Update associated appointment status if it exists
      if (currentEntry.appointment_id) {
        await client.query(
          "UPDATE appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [status, currentEntry.appointment_id]
        );
      }

      // Decrement daily capacity
      const queueDate = currentEntry.queue_date;
      await client.query(
        'UPDATE daily_capacities SET registered_count = registered_count - 1 WHERE doctor_id = $1 AND date = $2',
        [currentEntry.doctor_id, queueDate]
      );
    }

    await client.query('COMMIT');

    res.json(success(null, 'Queue status updated'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Queue status update error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update queue status'));
  } finally {
    client.release();
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
                   RETURNING appointment_id, patient_id, doctor_id`;
      queueParams.push(id, userId);
    } else {
      // DOCTOR
      queueQueryText = `UPDATE queue_entries
                   SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
                   RETURNING appointment_id, patient_id, doctor_id`;
      queueParams.push(id, userId);
    }

    const queueResult = await client.query(queueQueryText, queueParams);

    if (queueResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Queue entry not found or access denied'));
    }

    const { appointment_id, patient_id, doctor_id } = queueResult.rows[0];

    // Update the associated appointment status to COMPLETED
    await client.query(
      'UPDATE appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['COMPLETED', appointment_id]
    );

    // Create a visit record for the completed checkup if it doesn't already exist
    // Note: reason_for_visit, diagnosis, notes, and vitals are initially null
    // and can be filled in later by the doctor via the visits API
    await client.query(
      `INSERT INTO visits (appointment_id, patient_id, doctor_id, visit_date)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (appointment_id) DO NOTHING`,
      [appointment_id, patient_id, doctor_id]
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