import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that applies doctor profile fields
 * This script executes the 016_doctor_profile_fields.sql migration
 * It is idempotent and can be safely re-run
 */

export async function applyDoctorProfileFields() {
  try {
    console.log('🔄 Starting doctor profile fields migration...');

    const migrationPath = path.join(__dirname, '../../database/016_doctor_profile_fields.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing doctor profile fields migration...');
    await query(migrationSQL);
    console.log('✅ Doctor profile fields migration completed successfully');
  } catch (error: any) {
    // Column or index already present means the migration was already applied
    if (error.code === '42P07' || error.code === '42701') {
      console.log('⚠️  Migration appears to be already applied. This is safe to ignore.');
      console.log('✅ Doctor profile fields migration completed (already applied)');
    } else {
      console.error('❌ Doctor profile fields migration failed:', error);
      throw error;
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyDoctorProfileFields()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
