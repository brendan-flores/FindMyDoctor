import { pool } from './connection';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const client = await pool.connect();

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../../database/020_remove_consultation_type.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration: 020_remove_consultation_type.sql');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully: consultation_type column removed from doctors table');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
