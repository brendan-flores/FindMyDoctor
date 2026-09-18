import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that applies the doctor sign-up OTP flow support
 * This script executes the 006_doctor_signup_otp_flow.sql migration.
 * It is idempotent and can be safely re-run.
 */

export async function applyDoctorSignupOtp() {
  try {
    console.log('🔄 Starting doctor sign-up OTP flow migration...');

    const migrationPath = path.join(__dirname, '../../database/006_doctor_signup_otp_flow.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing doctor sign-up OTP flow migration...');
    await query(migrationSQL);
    console.log('✅ Doctor sign-up OTP flow migration completed successfully');
  } catch (error: any) {
    // Column, index or table already present means the migration was already applied
    if (error.code === '42P07' || error.code === '42701' || error.code === '42P16') {
      console.log('⚠️  Migration appears to be already applied. This is safe to ignore.');
      console.log('✅ Doctor sign-up OTP flow migration completed (already applied)');
    } else {
      console.error('❌ Doctor sign-up OTP flow migration failed:', error);
      throw error;
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyDoctorSignupOtp()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}