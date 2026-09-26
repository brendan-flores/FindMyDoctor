import fs from 'fs';
import path from 'path';
import { query } from './connection';

async function runPatientSignupMigration() {
  console.log('Running patient signup OTP flow migration...');

  try {
    const migrationPath = path.join(__dirname, '../../database/008_patient_signup_otp_flow.sql');
    console.log('Reading migration from:', migrationPath);
    
    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing patient signup OTP flow migration...');
    await query(migrationSQL);
    console.log('Patient signup OTP flow migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runPatientSignupMigration()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}

export { runPatientSignupMigration };