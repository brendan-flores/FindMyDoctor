import fs from 'fs';
import path from 'path';
import { query } from './connection';

const MIGRATIONS_DIR = path.join(__dirname, '../../database');

export async function applySecretaryDoctorRelationship() {
  console.log('Applying Secretary-Doctor relationship migration...');

  try {
    const migrationPath = path.join(MIGRATIONS_DIR, '015_enforce_secretary_doctor_relationship.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await query(migrationSQL);
    console.log('Secretary-Doctor relationship migration applied successfully');
  } catch (error) {
    console.error('Secretary-Doctor relationship migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  applySecretaryDoctorRelationship()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}
