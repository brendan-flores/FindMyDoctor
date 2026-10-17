import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that adds the detailed patient information columns to the
 * pending patient sign-up staging table.
 * This script executes the 026_add_pending_patient_signup_details.sql migration.
 * It is idempotent and can be safely re-run.
 */

export async function applyPendingPatientSignupDetails() {
  try {
    console.log('🔄 Starting pending patient signup details migration...');

    const migrationPath = path.join(
      __dirname,
      '../../database/026_add_pending_patient_signup_details.sql'
    );
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing pending patient signup details migration...');
    await query(migrationSQL);
    console.log('✅ Pending patient signup details migration completed successfully');
  } catch (error: any) {
    console.error('❌ Pending patient signup details migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyPendingPatientSignupDetails()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
