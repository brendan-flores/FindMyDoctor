import { readFileSync } from 'fs';
import { join } from 'path';
import { getClient } from '../database/connection';

/**
 * Migration: Add waitlists table for patient waitlist feature
 *
 * This migration enables patients to join waitlists when appointments are fully booked.
 * Patients can be automatically promoted when slots become available (e.g., after cancellation).
 * The table includes position tracking, 24-hour offer expiration, and status management.
 */
async function migrate() {
  const client = await getClient();
  try {
    console.log('Starting waitlists migration...');

    // Drop existing table and function if they exist (for clean migration)
    try {
      await client.query('DROP TABLE IF EXISTS waitlists CASCADE');
      console.log('✓ Dropped existing waitlists table');
    } catch (e) {
      console.log('⚠ No existing waitlists table to drop');
    }

    try {
      await client.query('DROP FUNCTION IF EXISTS update_waitlists_updated_at()');
      console.log('✓ Dropped existing update_waitlists_updated_at function');
    } catch (e) {
      console.log('⚠ No existing function to drop');
    }

    // Read and execute the SQL file directly
    const sqlFilePath = join(process.cwd(), 'database', '041_add_waitlists.sql');
    const sql = readFileSync(sqlFilePath, 'utf-8');

    await client.query(sql);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
