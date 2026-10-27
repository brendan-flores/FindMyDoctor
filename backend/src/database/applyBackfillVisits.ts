import { pool } from '../database/connection';

async function applyBackfillVisits() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert visit records for completed queue entries that don't already have visits
    const result = await client.query(`
      INSERT INTO visits (appointment_id, patient_id, doctor_id, visit_date, created_at, updated_at)
      SELECT
        q.appointment_id,
        q.patient_id,
        q.doctor_id,
        q.completed_at as visit_date,
        CURRENT_TIMESTAMP as created_at,
        CURRENT_TIMESTAMP as updated_at
      FROM queue_entries q
      JOIN appointments a ON q.appointment_id = a.id
      WHERE q.status = 'COMPLETED'
        AND q.appointment_id IS NOT NULL
        AND q.completed_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM visits v
          WHERE v.appointment_id = q.appointment_id
        )
      ON CONFLICT (appointment_id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log(`✅ Created ${result.rowCount} visit records for completed checkups`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to backfill visits:', error);
    throw error;
  } finally {
    client.release();
  }
}

applyBackfillVisits()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

