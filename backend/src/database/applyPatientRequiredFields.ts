import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that applies patient required fields
 * This script executes the 023_add_patient_required_fields.sql migration
 * It is idempotent and can be safely re-run
 */

export async function applyPatientRequiredFields() {
  try {
    console.log('🔄 Starting patient required fields migration...');

    const migrationPath = path.join(__dirname, '../../database/023_add_patient_required_fields.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing patient required fields migration...');
    await query(migrationSQL);
    console.log('✅ Patient required fields migration completed successfully');
  } catch (error: any) {
    console.error('❌ Patient required fields migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyPatientRequiredFields()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
