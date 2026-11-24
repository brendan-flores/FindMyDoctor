/**
 * Schedule-change side effects.
 *
 * Doctor and secretary exception/break-period changes apply immediately —
 * there is no approval step. When a CREATE or UPDATE affects active future
 * appointments, those appointments are flagged `needs_attention` and each
 * affected patient receives a SCHEDULE_CHANGE_NOTICE. DELETE restores
 * availability and never flags or notifies.
 *
 * Date-only appointments (time component 00:00:00) are considered to fall on
 * the whole day. Appointments created with a real time of day (walk-in
 * account registrations) are matched by time overlap with the break window.
 * Date extraction uses the same `DATE(appointment_date) = $n` convention as
 * the availability service and queue. "Future" means the clinic date in
 * Asia/Manila is today or later.
 */
import { getClinicDate } from '../../utils/date';
import { sendPushToUser } from '../../services/pushService';

export type ScheduleChangeType = 'EXCEPTION' | 'BREAK';
export type ScheduleChangeOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface ExceptionProposal {
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface BreakProposal {
  breakDate: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

export interface ScheduleChangeProposal {
  changeType: ScheduleChangeType;
  operation: ScheduleChangeOperation;
  /** Target exception/break id for UPDATE and DELETE. */
  targetId: string | null;
  /** Sanitized proposal (whitelisted fields only). */
  proposed: ExceptionProposal | BreakProposal;
  /** Snapshot of the target record before an UPDATE (old values). */
  targetSnapshot: Record<string, any> | null;
}

export const ACTIVE_APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] as const;

const TIME_ZERO = '00:00:00';

const NOTICE_TITLE = 'Schedule Change Notice';
const NOTICE_MESSAGE = "The clinic changed the doctor's schedule. They will contact you about your appointment.";

/**
 * Format a DATE value coming from the pg driver as 'YYYY-MM-DD'. DATE
 * columns parse as local midnight (postgres-date forces local time), so
 * local components round-trip the exact stored date.
 */
export function toDateOnlyString(v: any): string {
  if (v instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  const s = String(v ?? '');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

/**
 * Build the parameter list and WHERE predicate for appointments in conflict
 * with an EXCEPTION proposal (date-range based, no time component).
 */
function exceptionConflictPredicate(paramStart: string, paramEnd: string, alias = 'a'): string {
  return `DATE(${alias}.appointment_date) BETWEEN ${paramStart}::date AND ${paramEnd}::date`;
}

/** Predicate for appointments in conflict with a BREAK proposal (break_date). */
function breakConflictPredicate(
  paramDate: string,
  paramStartTime: string,
  paramEndTime: string,
  alias = 'a'
): string {
  // Date-only appointments occupy the whole day; timed appointments overlap
  // the break window (a consultation occupies ~30 minutes, matching the
  // duration used by the availability service for booked intervals).
  return `(
    DATE(${alias}.appointment_date) = ${paramDate}::date
    AND (
      ${alias}.appointment_date::time = TIME '${TIME_ZERO}'
      OR (${alias}.appointment_date::time < ${paramEndTime}::time
          AND (${alias}.appointment_date + INTERVAL '30 minutes')::time > ${paramStartTime}::time)
    )
  )`;
}

/**
 * Return the ids of active future appointments newly in conflict with the
 * proposal. For UPDATE, only appointments newly covered by the new values are
 * returned (new conflict set minus the old one). DELETE intentionally has no
 * affected set — removing an exception or break restores availability.
 */
export async function computeAffectedAppointmentIds(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  doctorId: string,
  proposal: ScheduleChangeProposal
): Promise<string[]> {
  if (proposal.operation === 'DELETE') {
    return [];
  }

  const today = getClinicDate();

  if (proposal.changeType === 'EXCEPTION') {
    const p = proposal.proposed as ExceptionProposal;
    const params: any[] = [doctorId, today, p.startDate, p.endDate];
    let sql = `
      SELECT a.id
      FROM appointments a
      WHERE a.doctor_id = $1
        AND a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
        AND DATE(a.appointment_date) >= $2::date
        AND ${exceptionConflictPredicate('$3', '$4')}
    `;
    if (proposal.operation === 'UPDATE' && proposal.targetSnapshot) {
      const snap = proposal.targetSnapshot;
      params.push(toDateOnlyString(snap.start_date), toDateOnlyString(snap.end_date));
      sql += `
        AND NOT (DATE(a.appointment_date) BETWEEN $5::date AND $6::date)
      `;
    }
    const result = await client.query(sql, params);
    return result.rows.map((row: any) => row.id);
  }

  // BREAK
  const p = proposal.proposed as BreakProposal;
  const params: any[] = [doctorId, today, p.breakDate, p.startTime, p.endTime];
  let sql = `
    SELECT a.id
    FROM appointments a
    WHERE a.doctor_id = $1
      AND a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
      AND DATE(a.appointment_date) >= $2::date
      AND ${breakConflictPredicate('$3', '$4', '$5')}
  `;
  if (proposal.operation === 'UPDATE' && proposal.targetSnapshot) {
    const snap = proposal.targetSnapshot;
    params.push(toDateOnlyString(snap.break_date), snap.start_time, snap.end_time);
    sql += `
      AND NOT ${breakConflictPredicate('$6', '$7', '$8')}
    `;
  }
  const result = await client.query(sql, params);
  return result.rows.map((row: any) => row.id);
}

/**
 * Snapshot the validity-relevant fields of a target record before an UPDATE.
 * Only the fields that determine the old conflict set are needed.
 */
export function snapshotTarget(row: any, changeType: ScheduleChangeType): Record<string, any> {
  if (!row) return row;
  if (changeType === 'EXCEPTION') {
    return {
      start_date: toDateOnlyString(row.start_date),
      end_date: toDateOnlyString(row.end_date),
    };
  }
  return {
    break_date: toDateOnlyString(row.break_date),
    start_time: row.start_time,
    end_time: row.end_time,
  };
}

export interface ScheduleChangeNoticeRecipient {
  userId: string;
  appointmentId: string;
}

/**
 * Flag appointments newly in conflict with an applied CREATE/UPDATE proposal
 * and create one SCHEDULE_CHANGE_NOTICE per affected patient. Appointments
 * are never cancelled or rescheduled. Caller must be inside the write
 * transaction, after the change was applied. Returns the recipients for
 * post-commit push delivery.
 */
export async function flagAndNotifyAffectedAppointments(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  doctorId: string,
  proposal: ScheduleChangeProposal
): Promise<ScheduleChangeNoticeRecipient[]> {
  const affectedIds = await computeAffectedAppointmentIds(client, doctorId, proposal);
  if (affectedIds.length === 0) {
    return [];
  }

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

  const notified: ScheduleChangeNoticeRecipient[] = [];
  for (const row of patients.rows) {
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'SCHEDULE_CHANGE_NOTICE', $2, $3, 'appointment', $4)`,
      [row.user_id, NOTICE_TITLE, NOTICE_MESSAGE, row.appointment_id]
    );
    notified.push({ userId: row.user_id, appointmentId: row.appointment_id });
  }

  return notified;
}

/**
 * Deliver the generic push for each affected patient. Best-effort: failures
 * are logged and never thrown, so they cannot fail the schedule write.
 */
export async function pushScheduleChangeNotices(notified: ScheduleChangeNoticeRecipient[]): Promise<void> {
  for (const recipient of notified) {
    try {
      await sendPushToUser(recipient.userId, {
        title: NOTICE_TITLE,
        body: NOTICE_MESSAGE,
        data: {
          type: 'SCHEDULE_CHANGE_NOTICE',
          appointmentId: recipient.appointmentId,
        },
      });
    } catch (pushErr) {
      console.error('Push delivery failed for schedule change notice:', pushErr);
    }
  }
}
