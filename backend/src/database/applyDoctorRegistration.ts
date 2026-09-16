import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that applies doctor self-registration support
 * This script executes the 005_doctor_self_registration.sql migration
 * It is idempotent and can be safely re-run
 */

export async function applyDoctorRegistration() {
  try {
    console.log('🔄 Starting doctor self-registration migration...');

    const migrationPath = path.join(__dirname, '../../database/005_doctor_self_registration.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing doctor self-registration migration...');
    await query(migrationSQL);
    console.log('✅ Doctor self-registration migration completed successfully');
  } catch (error: any) {
    // Column or index already present means the migration was already applied
    if (error.code === '42P07' || error.code === '42701') {
      console.log('⚠️  Migration appears to be already applied. This is safe to ignore.');
      console.log('✅ Doctor self-registration migration completed (already applied)');
    } else {
      console.error('❌ Doctor self-registration migration failed:', error);
      throw error;
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyDoctorRegistration()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
