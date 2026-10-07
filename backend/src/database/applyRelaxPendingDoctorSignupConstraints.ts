import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that relaxes pending doctor signup constraints
 * This script executes the 019_relax_pending_doctor_signup_constraints.sql migration
 * It is idempotent and can be safely re-run
 */

export async function applyRelaxPendingDoctorSignupConstraints() {
  try {
    console.log('🔄 Starting pending doctor signup constraint relaxation migration...');

    const migrationPath = path.join(__dirname, '../../database/019_relax_pending_doctor_signup_constraints.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing pending doctor signup constraint relaxation migration...');
    await query(migrationSQL);
    console.log('✅ Pending doctor signup constraint relaxation migration completed successfully');
  } catch (error: any) {
    console.error('❌ Pending doctor signup constraint relaxation migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyRelaxPendingDoctorSignupConstraints()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
