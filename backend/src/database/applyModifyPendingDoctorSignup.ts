import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that adds contact_number field to pending_doctor_signups table
 * This script executes the 017_modify_pending_doctor_signup_for_basic_flow.sql migration
 * It is idempotent and can be safely re-run
 */

export async function applyModifyPendingDoctorSignup() {
  try {
    console.log('🔄 Starting pending doctor signup contact number field migration...');

    const migrationPath = path.join(__dirname, '../../database/017_modify_pending_doctor_signup_for_basic_flow.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing pending doctor signup contact number field migration...');
    await query(migrationSQL);
    console.log('✅ Pending doctor signup contact number field migration completed successfully');
  } catch (error: any) {
    // Column already present means the migration was already applied
    if (error.code === '42701') {
      console.log('⚠️  Migration appears to be already applied. This is safe to ignore.');
      console.log('✅ Pending doctor signup contact number field migration completed (already applied)');
    } else {
      console.error('❌ Pending doctor signup contact number field migration failed:', error);
      throw error;
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyModifyPendingDoctorSignup()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
