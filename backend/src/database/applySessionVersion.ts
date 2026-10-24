import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Adds users.session_version, used to revoke refresh tokens on password
 * change/reset, account deactivation, and "sign out of all devices".
 * Idempotent and safe to re-run.
 */
export async function applySessionVersion() {
  try {
    console.log('🔄 Starting session version migration...');

    const migrationPath = path.join(
      __dirname,
      '../../database/032_add_session_version.sql'
    );
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await query(migrationSQL);
    console.log('✅ Session version migration completed successfully');
  } catch (error: any) {
    console.error('❌ Session version migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  applySessionVersion()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
