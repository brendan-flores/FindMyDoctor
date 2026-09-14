import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script to remove clinics from the database
 * This script executes the 003_remove_clinics.sql migration
 * It is idempotent and can be safely re-run
 */

export async function removeClinics() {
  try {
    console.log('🔄 Starting clinics removal migration...');

    const migrationPath = path.join(__dirname, '../../database/003_remove_clinics.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing clinics removal migration...');
    await query(migrationSQL);
    console.log('✅ Clinics removal migration completed successfully');
  } catch (error: any) {
    // Check if error is about existing constraint (migration already partially run)
    if (error.code === '42P07' && error.message.includes('already exists')) {
      console.log('⚠️  Migration appears to be already partially applied. This is safe to ignore.');
      console.log('✅ Clinics removal migration completed (already applied)');
    } else {
      console.error('❌ Clinics removal migration failed:', error);
      throw error;
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  removeClinics()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
