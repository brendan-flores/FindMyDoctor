import fs from 'fs';
import path from 'path';
import { query } from './connection';

const MIGRATIONS_DIR = path.join(__dirname, '../../database');

export async function applySecretaryProfileFields() {
  console.log('Applying Secretary profile fields migration...');

  try {
    const migrationPath = path.join(MIGRATIONS_DIR, '012_add_secretary_profile_fields.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...');
    await query(migrationSQL);
    console.log('Migration applied successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  applySecretaryProfileFields()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}
