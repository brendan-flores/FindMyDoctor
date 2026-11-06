import type { PoolClient } from 'pg';

/**
 * Queue helpers shared by every flow that creates, moves, or removes a queue
 * entry for a doctor/date pair.
 *
 * The daily queue is serialised with a PostgreSQL transaction-scoped advisory
 * lock keyed on (doctor, date). Booking, walk-in registration, cancellation and
 * rescheduling must all use the SAME key text, otherwise two of them can hand
 * out the same queue number at the same time.
 */

/**
 * Build the advisory-lock key for a doctor/date pair.
 *
 * NOTE: the `md5(...::text || ...::text)` string is intentional. It is the
 * literal key used by appointment booking and walk-in registration; the value
 * is only hashed on the server through `hashtext($1)` and never executed as
 * SQL. Do not "simplify" this into a real md5() call - that would start a new
 * lock namespace and silently remove mutual exclusion with those flows.
 */
export function queueLockKey(doctorId: string, date: string): string {
  return `md5(${doctorId}::text || ${date}::text)`;
}

/**
 * Take the queue lock for one or more dates in a deterministic order.
 * Dates are sorted (and de-duplicated) so concurrent multi-date operations -
 * such as a reschedule - can never deadlock against each other.
 *
 * Returns false when a lock is already held by another transaction.
 */
export async function acquireQueueLocks(
  client: PoolClient,
  doctorId: string,
  dates: string[]
): Promise<boolean> {
  const orderedDates = Array.from(new Set(dates.filter(Boolean))).sort();

  for (const date of orderedDates) {
    const result = await client.query(
      'SELECT pg_try_advisory_xact_lock(hashtext($1)) as lock_acquired',
      [queueLockKey(doctorId, date)]
    );

    if (!result.rows[0]?.lock_acquired) {
      return false;
    }
  }

  return true;
}

/**
 * Next queue number for a doctor/date. Must be called while holding the queue
 * lock for that date.
 */
export async function nextQueueNumber(
  client: PoolClient,
  doctorId: string,
  date: string
): Promise<number> {
  const result = await client.query(
    `SELECT COALESCE(MAX(queue_number), 0) + 1 as next_queue
     FROM queue_entries
     WHERE queue_date = $1 AND doctor_id = $2`,
    [date, doctorId]
  );

  return result.rows[0].next_queue;
}

export interface RenumberedQueueEntry {
  id: string;
  patientId: string;
  oldQueueNumber: number;
  newQueueNumber: number;
}

/**
 * Close the gap left behind by a removed queue entry: every higher number on
 * the same doctor/date shifts down by one and its patient is notified.
 *
 * Numbers are updated in ascending order, so the slot being freed is always
 * consumed before it can collide with the UNIQUE (queue_date, doctor_id,
 * queue_number) constraint. Terminal statuses (CANCELLED, NO_SHOW) are left
 * out for the same reason the patient cancellation flow always has: they no
 * longer occupy a live position.
 *
 * Must be called while holding the queue lock for that date.
 */
export async function renumberQueueAfterRemoval(
  client: PoolClient,
  doctorId: string,
  date: string,
  removedQueueNumber: number
): Promise<RenumberedQueueEntry[]> {
  if (!removedQueueNumber) {
    return [];
  }

  const affectedResult = await client.query(
    `SELECT q.id, q.patient_id, q.queue_number as old_queue_number
     FROM queue_entries q
     WHERE q.queue_date = $1
     AND q.doctor_id = $2
     AND q.queue_number > $3
     AND q.status NOT IN ('CANCELLED', 'NO_SHOW')
     ORDER BY q.queue_number ASC`,
    [date, doctorId, removedQueueNumber]
  );

  const renumbered: RenumberedQueueEntry[] = [];

  for (const entry of affectedResult.rows) {
    const newQueueNumber = entry.old_queue_number - 1;

    await client.query(
      `UPDATE queue_entries
       SET queue_number = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newQueueNumber, entry.id]
    );

    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES (
         (SELECT user_id FROM patients WHERE id = $1),
         'QUEUE_UPDATED',
         'Queue Number Updated',
         $2,
         'queue',
         $3
       )`,
      [
        entry.patient_id,
        `Your queue number has been updated from ${entry.old_queue_number} to ${newQueueNumber}`,
        entry.id,
      ]
    );

    renumbered.push({
      id: entry.id,
      patientId: entry.patient_id,
      oldQueueNumber: entry.old_queue_number,
      newQueueNumber,
    });
  }

  return renumbered;
}
