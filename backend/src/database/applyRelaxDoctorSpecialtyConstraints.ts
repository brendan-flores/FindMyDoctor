import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that relaxes doctor specialty constraint for basic registration flow
 * This script executes the 018_relax_doctor_specialty_constraints_for_basic_flow.sql migration
 * It is idempotent and can be safely re-run
 */

export async function applyRelaxDoctorSpecialtyConstraints() {
  try {
    console.log('🔄 Starting doctor specialty constraint relaxation migration...');

    const migrationPath = path.join(__dirname, '../../database/018_relax_doctor_specialty_constraints_for_basic_flow.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing doctor specialty constraint relaxation migration...');
    await query(migrationSQL);
    console.log('✅ Doctor specialty constraint relaxation migration completed successfully');
  } catch (error: any) {
    // Constraint already removed means the migration was already applied
    if (error.code === '42P16' || error.code === '42704') {
      console.log('⚠️  Migration appears to be already applied. This is safe to ignore.');
      console.log('✅ Doctor specialty constraint relaxation migration completed (already applied)');
    } else {
      console.error('❌ Doctor specialty constraint relaxation migration failed:', error);
      throw error;
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyRelaxDoctorSpecialtyConstraints()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
