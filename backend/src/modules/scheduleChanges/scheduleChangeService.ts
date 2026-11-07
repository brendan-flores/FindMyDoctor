/**
 * Schedule-change confirmation workflow.
 *
 * Proposed doctor/secretary changes to exceptions (date ranges) and break
 * periods wait for secretary confirmation when they affect active future
 * appointments. Requests are stored in `schedule_change_requests`; nothing
 * is applied until a secretary confirms.
 *
 * Date-only appointments (time component 00:00:00) are considered to fall on
 * the whole day. Appointments created with a real time of day (walk-in
 * account registrations) are matched by time overlap with the break window.
 * Date extraction uses the same `DATE(appointment_date) = $n` convention as
 * the availability service and queue. "Future" means the clinic date in
 * Asia/Manila is today or later.
 */
import { getClinicDate } from '../../utils/date';

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
  /** Snapshot of the target record at proposal time (UPDATE/DELETE only). */
  targetSnapshot: Record<string, any> | null;
}

export interface PendingSummary {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISMISSED';
  pending: boolean;
  changeType: ScheduleChangeType;
  operation: ScheduleChangeOperation;
  doctorId: string;
  targetId: string | null;
  affectedCount: number;
  affectedAppointmentIds: string[];
  reason: string | null;
  createdAt: string | null;
}

export const ACTIVE_APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] as const;

const TIME_ZERO = '00:00:00';

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
 * affected set — the caller applies it directly.
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
 * True when an identical or overlapping PENDING request already exists for
 * the same doctor and target. Callers run this inside a transaction that
 * holds a lock on the doctor row so concurrent proposals serialize.
 */
export async function hasConflictingPendingRequest(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  doctorId: string,
  proposal: ScheduleChangeProposal,
  excludeRequestId?: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT id, change_type, operation, target_id, proposed_payload
     FROM schedule_change_requests
     WHERE doctor_id = $1 AND status = 'PENDING'`,
    [doctorId]
  );

  for (const row of result.rows) {
    if (excludeRequestId && row.id === excludeRequestId) continue;
    if (pendingRequestsOverlap(row, proposal)) {
      return true;
    }
  }
  return false;
}

function pendingRequestsOverlap(
  existing: { change_type: string; operation: string; target_id: string | null; proposed_payload: any },
  proposal: ScheduleChangeProposal
): boolean {
  const p = proposal.proposed as any;
  const e = typeof existing.proposed_payload === 'string'
    ? JSON.parse(existing.proposed_payload)
    : existing.proposed_payload;
  const existingTargetId = existing.target_id ?? e?.targetId ?? null;

  // Same target record: identical or overlapping regardless of operation
  if (proposal.targetId && existingTargetId === proposal.targetId) {
    return true;
  }

  // Only same-type CREATEs can overlap each other
  if (existing.operation !== 'CREATE' || proposal.operation !== 'CREATE') {
    return false;
  }
  if (existing.change_type !== proposal.changeType) {
    return false;
  }

  if (proposal.changeType === 'EXCEPTION') {
    const proposed = p as ExceptionProposal;
    return dateRangesOverlap(proposed.startDate, proposed.endDate, e?.startDate, e?.endDate);
  }

  const proposed = p as BreakProposal;
  return e?.breakDate === proposed.breakDate && timeRangesOverlap(proposed.startTime, proposed.endTime, e?.startTime, e?.endTime);
}

function dateRangesOverlap(aStart: string, aEnd: string, bStart?: string, bEnd?: string): boolean {
  if (!bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

function timeRangesOverlap(aStart: string, aEnd: string, bStart?: string, bEnd?: string): boolean {
  if (!bStart || !bEnd) return false;
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

function toMinutes(t: string): number {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Snapshot the validity-relevant fields of a target record. Reason is
 * deliberately excluded: an unrelated reason edit does not invalidate a
 * pending proposal, so the snapshot only covers the fields that determine
 * whether the change is still valid.
 */
export function snapshotTarget(row: any, changeType: ScheduleChangeType): Record<string, any> {
  if (!row) return row;
  if (changeType === 'EXCEPTION') {
    return {
      start_date: toDateOnlyString(row.start_date),
      end_date: toDateOnlyString(row.end_date),
      reason: row.reason ?? null,
      is_active: row.is_active,
    };
  }
  return {
    break_date: toDateOnlyString(row.break_date),
    start_time: row.start_time,
    end_time: row.end_time,
    reason: row.reason ?? null,
    is_active: row.is_active,
  };
}

/**
 * True when the target record is still in the state the proposal was based
 * on. Compares the validity-relevant fields only.
 */
export function targetSnapshotMatches(
  current: any,
  snapshot: Record<string, any> | null | undefined,
  changeType: ScheduleChangeType
): boolean {
  if (!current || !snapshot) return false;
  if (changeType === 'EXCEPTION') {
    return (
      toDateOnlyString(current.start_date) === snapshot.start_date &&
      toDateOnlyString(current.end_date) === snapshot.end_date &&
      Boolean(current.is_active) === Boolean(snapshot.is_active)
    );
  }
  return (
    toDateOnlyString(current.break_date) === snapshot.break_date &&
    String(current.start_time) === String(snapshot.start_time) &&
    String(current.end_time) === String(snapshot.end_time) &&
    Boolean(current.is_active) === Boolean(snapshot.is_active)
  );
}

export function sanitizeProposal(proposal: ScheduleChangeProposal) {
  const p = proposal.proposed as any;
  const base = {
    changeType: proposal.changeType,
    operation: proposal.operation,
    targetId: proposal.targetId,
    reason: p.reason ?? null,
  };
  if (proposal.changeType === 'EXCEPTION') {
    return { ...base, startDate: p.startDate, endDate: p.endDate };
  }
  return { ...base, breakDate: p.breakDate, startTime: p.startTime, endTime: p.endTime };
}

export function previousValuesOf(snapshot: any) {
  if (!snapshot) return null;
  if ('start_date' in snapshot) {
    return { startDate: toDateOnlyString(snapshot.start_date), endDate: toDateOnlyString(snapshot.end_date), reason: snapshot.reason ?? null };
  }
  return {
    breakDate: toDateOnlyString(snapshot.break_date),
    startTime: snapshot.start_time,
    endTime: snapshot.end_time,
    reason: snapshot.reason ?? null,
  };
}

export function toPendingSummary(row: any, doctorId?: string): PendingSummary {
  const payload = typeof row.proposed_payload === 'string'
    ? JSON.parse(row.proposed_payload)
    : row.proposed_payload;
  return {
    id: row.id,
    status: row.status,
    pending: row.status === 'PENDING',
    changeType: row.change_type,
    operation: row.operation,
    doctorId: doctorId ?? row.doctor_id,
    targetId: row.target_id ?? payload?.targetId ?? null,
    affectedCount: row.affected_count ?? 0,
    affectedAppointmentIds: row.affected_appointment_ids ?? [],
    reason: payload?.reason ?? null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

export interface GateProceed {
  kind: 'proceed';
}
export interface GateConflict {
  kind: 'conflict';
  message: string;
}
export interface GatePending {
  kind: 'pending';
  request: any;
}
export type GateResult = GateProceed | GateConflict | GatePending;

/**
 * Serialize concurrent proposals per doctor, reject duplicates/overlapping
 * PENDING requests, and decide whether the change may be applied immediately
 * or must wait for secretary confirmation.
 *
 * Caller must be inside a transaction.
 */
export async function evaluateProposal(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  doctorId: string,
  requestedByUserId: string,
  proposal: ScheduleChangeProposal
): Promise<GateResult> {
  // Serialize proposals for this doctor so two concurrent overlapping
  // submissions cannot both reach the duplicate check.
  await client.query('SELECT id FROM doctors WHERE id = $1 FOR UPDATE', [doctorId]);

  const duplicate = await hasConflictingPendingRequest(client, doctorId, proposal);
  if (duplicate) {
    return {
      kind: 'conflict',
      message: 'An identical or overlapping change is already waiting for secretary confirmation for this doctor.',
    };
  }

  if (proposal.operation === 'DELETE') {
    // No affected set is computed for deletes: they normally apply immediately.
    return { kind: 'proceed' };
  }

  const affectedIds = await computeAffectedAppointmentIds(client, doctorId, proposal);
  if (affectedIds.length === 0) {
    return { kind: 'proceed' };
  }

  const p = proposal.proposed as ExceptionProposal | BreakProposal;
  const payload = {
    ...p,
    targetId: proposal.targetId,
    ...(proposal.targetSnapshot ? { targetSnapshot: proposal.targetSnapshot } : {}),
    ...(proposal.targetSnapshot ? { previous: previousValuesOf(proposal.targetSnapshot) } : {}),
  };

  const inserted = await client.query(
    `INSERT INTO schedule_change_requests
       (doctor_id, requested_by, change_type, operation, proposed_payload, target_id, affected_count, affected_appointment_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      doctorId,
      requestedByUserId,
      proposal.changeType,
      proposal.operation,
      JSON.stringify(payload),
      proposal.targetId,
      affectedIds.length,
      affectedIds,
    ]
  );

  return { kind: 'pending', request: inserted.rows[0] };
}

/**
 * Apply a proposal to doctor_unavailability / doctor_break_periods. Mirrors
 * the apply statements used by the direct endpoints. Caller must be inside a
 * transaction that has already re-validated the proposal.
 */
export async function applyProposal(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  proposal: ScheduleChangeProposal,
  doctorId: string
): Promise<any> {
  const p = proposal.proposed as any;

  if (proposal.changeType === 'EXCEPTION') {
    if (proposal.operation === 'CREATE') {
      const result = await client.query(
        `INSERT INTO doctor_unavailability (doctor_id, start_date, end_date, reason, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [doctorId, p.startDate, p.endDate, p.reason || null]
      );
      return result.rows[0];
    }
    if (proposal.operation === 'UPDATE') {
      const result = await client.query(
        `UPDATE doctor_unavailability
         SET start_date = $1, end_date = $2, reason = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND doctor_id = $5
         RETURNING *`,
        [p.startDate, p.endDate, p.reason || null, proposal.targetId, doctorId]
      );
      return result.rows[0];
    }
    // DELETE
    const result = await client.query(
      `DELETE FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2 RETURNING *`,
      [proposal.targetId, doctorId]
    );
    return result.rows[0];
  }

  // BREAK
  if (proposal.operation === 'CREATE') {
    const result = await client.query(
      `INSERT INTO doctor_break_periods (doctor_id, break_date, start_time, end_time, reason, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [doctorId, p.breakDate, p.startTime, p.endTime, p.reason || null]
    );
    return result.rows[0];
  }
  if (proposal.operation === 'UPDATE') {
    const result = await client.query(
      `UPDATE doctor_break_periods
       SET break_date = $1, start_time = $2, end_time = $3, reason = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND doctor_id = $6
       RETURNING *`,
      [p.breakDate, p.startTime, p.endTime, p.reason || null, proposal.targetId, doctorId]
    );
    return result.rows[0];
  }
  // DELETE
  const result = await client.query(
    `DELETE FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2 RETURNING *`,
    [proposal.targetId, doctorId]
  );
  return result.rows[0];
}

/**
 * Presentation shape for the pending-request lists (secretary and doctor).
 * Patient personal data is never included — only the affected count and
 * appointment ids. Internal fields (targetSnapshot) are stripped.
 */
export function presentRequest(row: any) {
  const payload = typeof row.proposed_payload === 'string'
    ? JSON.parse(row.proposed_payload)
    : (row.proposed_payload ?? {});

  const doctorFirst = row.doctor_first_name ?? '';
  const doctorLast = row.doctor_last_name ?? '';

  const reqDoctorFirst = row.req_doctor_first_name ?? '';
  const reqDoctorLast = row.req_doctor_last_name ?? '';
  const reqSecretaryFirst = row.req_secretary_first_name ?? '';
  const reqSecretaryLast = row.req_secretary_last_name ?? '';
  const requestedByRole = row.requested_by_role ?? null;
  const requestedByName = ['DOCTOR'].includes(requestedByRole) || reqDoctorFirst || reqDoctorLast
    ? [reqDoctorFirst, reqDoctorLast].filter(Boolean).join(' ').trim()
    : [reqSecretaryFirst, reqSecretaryLast].filter(Boolean).join(' ').trim();

  const base = {
    id: row.id,
    status: row.status,
    changeType: row.change_type,
    operation: row.operation,
    affectedCount: row.affected_count ?? 0,
    affectedAppointmentIds: row.affected_appointment_ids ?? [],
    targetId: row.target_id ?? payload?.targetId ?? null,
    reason: payload?.reason ?? null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolvedBy: row.resolved_by ?? null,
    doctor: {
      id: row.doctor_id,
      name: [doctorFirst, doctorLast].filter(Boolean).join(' ').trim(),
    },
    requestedBy: {
      userId: row.requested_by,
      role: requestedByRole,
      name: requestedByName || null,
    },
  };

  if (row.change_type === 'EXCEPTION') {
    return {
      ...base,
      proposed: { startDate: payload?.startDate ?? null, endDate: payload?.endDate ?? null, reason: payload?.reason ?? null },
      previous: payload?.previous ?? null,
    };
  }

  return {
    ...base,
    proposed: { breakDate: payload?.breakDate ?? null, startTime: payload?.startTime ?? null, endTime: payload?.endTime ?? null, reason: payload?.reason ?? null },
    previous: payload?.previous ?? null,
  };
}

export interface ProposalValidationError {
  status: number;
  code: string;
  message: string;
}

/** Exception validation shared by the direct endpoints and confirm re-validation. */
export function validateExceptionProposal(input: { startDate?: any; endDate?: any }): ProposalValidationError | null {
  const { startDate, endDate } = input;

  if (!startDate || !endDate) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'startDate and endDate are required' };
  }

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid date format' };
  }

  if (startDateObj > endDateObj) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Start date must be before or equal to end date' };
  }

  return null;
}

/**
 * Break-period validation shared by the direct endpoints and confirm
 * re-validation. Reproduces the per-role rule asymmetry of the existing
 * endpoints: doctor proposals require the break to fall within working
 * hours and to not overlap another active break on the same date; secretary
 * proposals only check presence, time format, and ordering.
 *
 * @param rules.enforceDoctorRules true for DOCTOR proposers (and for doctor
 *   proposals re-validated at confirm time), false for SECRETARY proposers.
 * @param excludeBreakId break id to exclude from the overlap check (UPDATE).
 */
export async function validateBreakProposal(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  doctorId: string,
  input: { breakDate?: any; startTime?: any; endTime?: any },
  rules: { enforceDoctorRules: boolean; excludeBreakId?: string | null }
): Promise<ProposalValidationError | null> {
  const { breakDate, startTime, endTime } = input;

  if (!breakDate || !startTime || !endTime) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'breakDate, startTime, and endTime are required' };
  }

  const breakDateObj = new Date(breakDate);
  if (isNaN(breakDateObj.getTime())) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid break date format' };
  }

  const startTimeDate = new Date(`2000-01-01T${startTime}`);
  const endTimeDate = new Date(`2000-01-01T${endTime}`);

  if (isNaN(startTimeDate.getTime()) || isNaN(endTimeDate.getTime())) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid time format. Use HH:MM format' };
  }

  if (startTimeDate >= endTimeDate) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Start time must be before end time' };
  }

  if (!rules.enforceDoctorRules) {
    return null;
  }

  // Doctor rules: break must fall completely within a working-hours block.
  const dayOfWeek = breakDateObj.getDay();
  const scheduleResult = await client.query(
    `SELECT start_time, end_time FROM doctor_schedules
     WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true`,
    [doctorId, dayOfWeek]
  );

  if (scheduleResult.rows.length === 0) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'No working hours defined for this date' };
  }

  let breakWithinWorkingHours = false;
  for (const schedule of scheduleResult.rows) {
    const scheduleStart = new Date(`2000-01-01T${schedule.start_time}`);
    const scheduleEnd = new Date(`2000-01-01T${schedule.end_time}`);
    if (startTimeDate >= scheduleStart && endTimeDate <= scheduleEnd) {
      breakWithinWorkingHours = true;
      break;
    }
  }

  if (!breakWithinWorkingHours) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Break period must fall completely within working hours' };
  }

  // Doctor rules: no overlap with another active break on the same date.
  const exclude = rules.excludeBreakId ?? null;
  const overlapResult = await client.query(
    `SELECT * FROM doctor_break_periods
     WHERE doctor_id = $1 AND break_date = $2 AND is_active = true
       ${exclude ? 'AND id != $5' : ''}
       AND (
         (start_time < $3 AND end_time > $3) OR
         (start_time < $4 AND end_time > $4) OR
         (start_time >= $3 AND end_time <= $4)
       )`,
    exclude
      ? [doctorId, breakDate, startTime, endTime, exclude]
      : [doctorId, breakDate, startTime, endTime]
  );

  if (overlapResult.rows.length > 0) {
    return { status: 409, code: 'CONFLICT', message: 'Break period overlaps with an existing break' };
  }

  return null;
}
