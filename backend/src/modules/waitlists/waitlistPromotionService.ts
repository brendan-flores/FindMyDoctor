import { getClient } from '../../database/connection';
import { createNotification } from '../../api/notifications';

/**
 * Promote the next waiting patient for a specific doctor and date.
 * Called when an appointment is cancelled or rescheduled (slot becomes available).
 *
 * @param doctorId - The doctor's ID
 * @param date - The date (yyyy-MM-dd format)
 * @returns The promoted waitlist entry, or null if no waiting patients
 */
export async function promoteNextPatient(doctorId: string, date: string): Promise<any | null> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Find the earliest WAITING patient for that doctor/date
    const result = await client.query(
      `SELECT * FROM waitlists
       WHERE doctor_id = $1 AND waitlist_date = $2 AND status = 'WAITING'
       ORDER BY position ASC
       LIMIT 1
       FOR UPDATE`,
      [doctorId, date]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return null; // No waiting patients
    }

    const waitlist = result.rows[0];

    // Update status to OFFERED
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    await client.query(
      `UPDATE waitlists
       SET status = 'OFFERED',
           offered_at = $1,
           expires_at = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [now, expiresAt, waitlist.id]
    );

    // Get user ID for notification
    const userResult = await client.query(
      'SELECT user_id FROM patients WHERE id = $1',
      [waitlist.patient_id]
    );

    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].user_id;

      // Create notification
      await createNotification(
        userId,
        'WAITLIST_UPDATE',
        'You\'re Next in Line!',
        'A slot is now available! You\'re position #1. Book within 24 hours to secure your appointment.',
        'waitlist',
        waitlist.id
      );
    }

    await client.query('COMMIT');

    return {
      id: waitlist.id,
      patientId: waitlist.patient_id,
      doctorId: waitlist.doctor_id,
      waitlistDate: waitlist.waitlist_date,
      status: 'OFFERED',
      position: waitlist.position,
      offeredAt: now,
      expiresAt: expiresAt,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Waitlist promotion error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Expire offered waitlists whose 24-hour window has passed.
 * Can be called periodically (e.g., via cron job or on-demand).
 *
 * @returns Count of expired entries
 */
export async function expireOfferedWaitlists(): Promise<number> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Find all OFFERED entries where expires_at < CURRENT_TIMESTAMP
    const result = await client.query(
      `SELECT * FROM waitlists
       WHERE status = 'OFFERED' AND expires_at < CURRENT_TIMESTAMP
       FOR UPDATE`
    );

    const expiredEntries = result.rows;
    let expiredCount = 0;

    for (const entry of expiredEntries) {
      // Update status to EXPIRED
      await client.query(
        `UPDATE waitlists
         SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [entry.id]
      );

      // Recalculate positions for remaining WAITING entries
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
        [entry.doctor_id, entry.waitlist_date]
      );

      // Try to promote the next patient for that doctor/date
      await promoteNextPatient(entry.doctor_id, entry.waitlist_date);

      expiredCount++;
    }

    await client.query('COMMIT');

    return expiredCount;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Waitlist expiration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Recalculate positions for WAITING entries for a specific doctor and date.
 * Called when a patient leaves or is promoted to maintain queue order.
 *
 * @param doctorId - The doctor's ID
 * @param date - The date (yyyy-MM-dd format)
 */
export async function recalculatePositions(doctorId: string, date: string): Promise<void> {
  const client = await getClient();

  try {
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
      [doctorId, date]
    );
  } catch (error) {
    console.error('Position recalculation error:', error);
    throw error;
  } finally {
    client.release();
  }
}
