import fs from 'fs';
import path from 'path';
import { query } from './connection';

async function runUsernameMigration() {
  console.log('Running patient username migration...');

  try {
    const migrationPath = path.join(__dirname, '../../database/009_patient_username_migration.sql');
    console.log('Reading migration from:', migrationPath);
    
    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing patient username migration...');
    await query(migrationSQL);
    console.log('Patient username migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runUsernameMigration()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}

export { runUsernameMigration };
