import { Router, Response } from 'express';
import { getClient, query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { invalidateAvailabilityCache } from '../modules/availability/availabilityService';
import { sendPushToUser } from '../services/pushService';
import {
  applyProposal,
  computeAffectedAppointmentIds,
  presentRequest,
  targetSnapshotMatches,
  toPendingSummary,
  validateBreakProposal,
  validateExceptionProposal,
  ScheduleChangeProposal,
  ScheduleChangeType,
} from '../modules/scheduleChanges/scheduleChangeService';

const router = Router();

const NOTICE_TITLE = 'Schedule Change Notice';
const NOTICE_MESSAGE = "The clinic changed the doctor's schedule. They will contact you about your appointment.";

/**
 * Resolve the managed doctor id for the authenticated secretary.
 */
async function secretaryDoctorId(userId: string) {
  const result = await query(
    'SELECT doctor_id FROM secretaries WHERE user_id = $1',
    [userId]
  );
  return result.rows.length === 0 ? null : result.rows[0].doctor_id;
}

/**
 * Shared SELECT for pending-request lists (secretary and doctor read-only).
 * Joins doctor and requester names without exposing patient data.
 */
export const REQUEST_SELECT = `
  SELECT r.*,
         d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
         du.first_name AS req_doctor_first_name, du.last_name AS req_doctor_last_name,
         s.first_name AS req_secretary_first_name, s.last_name AS req_secretary_last_name,
         u.role AS requested_by_role
  FROM schedule_change_requests r
  JOIN doctors d ON d.id = r.doctor_id
  JOIN users u ON u.id = r.requested_by
  LEFT JOIN doctors du ON du.user_id = r.requested_by
  LEFT JOIN secretaries s ON s.user_id = r.requested_by
`;

// List PENDING requests for the secretary's assigned doctor (secretary only)
router.get('/', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = await secretaryDoctorId(req.user!.id);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const result = await query(
      `${REQUEST_SELECT} WHERE r.doctor_id = $1 AND r.status = 'PENDING' ORDER BY r.created_at DESC`,
      [doctorId]
    );

    res.json(success(result.rows.map(presentRequest)));
  } catch (err: any) {
    console.error('Failed to fetch schedule change requests:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch schedule change requests'));
  }
});

interface RevalidationResult {
  ok: boolean;
  code?: string;
  message?: string;
  proposal?: ScheduleChangeProposal;
}

/**
 * Re-validate the proposal against the current schedule. Returns ok=false
 * with a conflict message when the change can no longer be applied.
 */
async function revalidateProposal(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  request: any
): Promise<RevalidationResult> {
  const payload = typeof request.proposed_payload === 'string'
    ? JSON.parse(request.proposed_payload)
    : request.proposed_payload;

  const changeType = request.change_type as ScheduleChangeType;
  const operation = request.operation as 'CREATE' | 'UPDATE' | 'DELETE';
  const targetId: string | null = request.target_id ?? payload?.targetId ?? null;

  // Re-run the proposer-role rules: doctor proposals use doctor rules,
  // secretary proposals use secretary rules.
  const roleResult = await client.query('SELECT role FROM users WHERE id = $1', [request.requested_by]);
  const proposerRole = roleResult.rows[0]?.role ?? 'SECRETARY';
  const enforceDoctorRules = proposerRole === 'DOCTOR';

  // Fetch the current target and verify it is unchanged (UPDATE/DELETE)
  let targetRow: any = null;
  if (operation === 'UPDATE' || operation === 'DELETE') {
    if (!targetId) {
      return { ok: false, code: ErrorCodes.CONFLICT, message: 'The proposed change has no target record.' };
    }
    const table = changeType === 'EXCEPTION' ? 'doctor_unavailability' : 'doctor_break_periods';
    const targetResult = await client.query(
      `SELECT * FROM ${table} WHERE id = $1 AND doctor_id = $2`,
      [targetId, request.doctor_id]
    );
    if (targetResult.rows.length === 0) {
      return { ok: false, code: ErrorCodes.CONFLICT, message: 'The target record no longer exists.' };
    }
    targetRow = targetResult.rows[0];
    if (!targetSnapshotMatches(targetRow, payload?.targetSnapshot ?? null, changeType)) {
      return {
        ok: false,
        code: ErrorCodes.CONFLICT,
        message: 'The proposed change is no longer valid because the target record was modified.',
      };
    }
  }

  const proposal: ScheduleChangeProposal = {
    changeType,
    operation,
    targetId,
    proposed: changeType === 'EXCEPTION'
      ? { startDate: payload?.startDate, endDate: payload?.endDate, reason: payload?.reason ?? null }
      : { breakDate: payload?.breakDate, startTime: payload?.startTime, endTime: payload?.endTime, reason: payload?.reason ?? null },
    targetSnapshot: payload?.targetSnapshot ?? null,
  };

  // Re-run the same payload validation the direct endpoints use (DELETE has
  // no proposed values to re-validate — only the target check matters)
  if (operation !== 'DELETE') {
    const validation = changeType === 'EXCEPTION'
      ? validateExceptionProposal(proposal.proposed as any)
      : await validateBreakProposal(client, request.doctor_id, proposal.proposed as any, {
          enforceDoctorRules,
          excludeBreakId: operation === 'UPDATE' ? targetId : null,
        });

    if (validation) {
      return { ok: false, code: ErrorCodes.CONFLICT, message: validation.message };
    }
  }

  return { ok: true, proposal };
}

/**
 * Send the generic push for a confirmed schedule change. Best-effort: push
 * failures must never roll back a confirmation.
 */
async function pushNotices(userIds: string[], appointmentIds: string[]) {
  for (let i = 0; i < userIds.length; i++) {
    try {
      await sendPushToUser(userIds[i], {
        title: NOTICE_TITLE,
        body: NOTICE_MESSAGE,
        data: {
          type: 'SCHEDULE_CHANGE_NOTICE',
          appointmentId: appointmentIds[i],
        },
      });
    } catch (pushErr) {
      console.error('Push delivery failed for schedule change notice:', pushErr);
    }
  }
}

// Confirm a PENDING request (secretary only, own doctor only)
router.post('/:id/confirm', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const doctorId = await secretaryDoctorId(userId);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    await client.query('BEGIN');

    // Lock the request row so two secretaries cannot confirm twice
    const locked = await client.query(
      `SELECT * FROM schedule_change_requests WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (locked.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Schedule change request not found'));
    }

    const request = locked.rows[0];

    if (request.doctor_id !== doctorId) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only act on requests for your assigned doctor'));
    }

    if (request.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'This request has already been confirmed or dismissed.'));
    }

    // Re-validate against the current schedule; if no longer valid the
    // request stays PENDING so it can be dismissed, and nothing is applied.
    const revalidation = await revalidateProposal(client, request);
    if (!revalidation.ok || !revalidation.proposal) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, revalidation.message ?? 'The proposed change is no longer valid.'));
    }

    // Apply the schedule change. If an UPDATE/DELETE target vanished between
    // the re-validation and the apply, nothing was modified — report the
    // conflict and leave the request PENDING instead of pretending success.
    const appliedRow = await applyProposal(client, revalidation.proposal, request.doctor_id);
    if (revalidation.proposal.operation !== 'CREATE' && !appliedRow) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'The target record is no longer valid.'));
    }

    // Recompute the affected set against current data, flag those
    // appointments, and create one SCHEDULE_CHANGE_NOTICE per affected
    // patient. Appointments are never cancelled or rescheduled.
    const affectedIds = await computeAffectedAppointmentIds(client, request.doctor_id, revalidation.proposal);

    const notified: Array<{ userId: string; appointmentId: string }> = [];

    if (affectedIds.length > 0) {
      await client.query(
        `UPDATE appointments
         SET needs_attention = true, needs_attention_reason = 'SCHEDULE_CHANGE', needs_attention_flagged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1::uuid[])`,
        [affectedIds]
      );

      const patients = await client.query(
        `SELECT a.id AS appointment_id, p.user_id
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.id = ANY($1::uuid[])`,
        [affectedIds]
      );

      for (const row of patients.rows) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
           VALUES ($1, 'SCHEDULE_CHANGE_NOTICE', $2, $3, 'appointment', $4)`,
          [row.user_id, NOTICE_TITLE, NOTICE_MESSAGE, row.appointment_id]
        );
        notified.push({ userId: row.user_id, appointmentId: row.appointment_id });
      }
    }

    // Mark the request CONFIRMED with the resolving secretary recorded
    const resolved = await client.query(
      `UPDATE schedule_change_requests
       SET status = 'CONFIRMED', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
       WHERE id = $2 AND status = 'PENDING'
       RETURNING *`,
      [userId, id]
    );

    if (resolved.rows.length === 0) {
      // Lost the race against another confirm/dismiss after all
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'This request has already been confirmed or dismissed.'));
    }

    await client.query('COMMIT');

    // The change alters availability: clear the cached date ranges
    invalidateAvailabilityCache();

    // Deliver pushes after the commit; failures must not affect the confirmation
    if (notified.length > 0) {
      pushNotices(
        notified.map((n) => n.userId),
        notified.map((n) => n.appointmentId)
      ).catch((pushErr) => console.error('Push delivery failed:', pushErr));
    }

    res.json(success({
      ...toPendingSummary(resolved.rows[0]),
      status: 'CONFIRMED',
      pending: false,
      affectedCount: affectedIds.length,
      affectedAppointmentIds: affectedIds,
      notifiedCount: notified.length,
    }, 'Schedule change confirmed and applied'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    console.error('Schedule change confirmation error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to confirm schedule change'));
  } finally {
    client.release();
  }
});

// Dismiss a PENDING request (secretary only, own doctor only)
router.post('/:id/dismiss', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();

  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const doctorId = await secretaryDoctorId(userId);
    if (!doctorId) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    await client.query('BEGIN');

    const locked = await client.query(
      `SELECT * FROM schedule_change_requests WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (locked.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Schedule change request not found'));
    }

    const request = locked.rows[0];

    if (request.doctor_id !== doctorId) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only act on requests for your assigned doctor'));
    }

    if (request.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'This request has already been confirmed or dismissed.'));
    }

    const resolved = await client.query(
      `UPDATE schedule_change_requests
       SET status = 'DISMISSED', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
       WHERE id = $2 AND status = 'PENDING'
       RETURNING *`,
      [userId, id]
    );

    if (resolved.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'This request has already been confirmed or dismissed.'));
    }

    await client.query('COMMIT');

    res.json(success({
      ...toPendingSummary(resolved.rows[0]),
      status: 'DISMISSED',
      pending: false,
    }, 'Schedule change request dismissed'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    console.error('Schedule change dismissal error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to dismiss schedule change'));
  } finally {
    client.release();
  }
});

export default router;
