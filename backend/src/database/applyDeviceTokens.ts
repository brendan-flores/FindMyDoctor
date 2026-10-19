import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that creates the device_tokens table used to associate
 * authenticated users' FCM/APNs device tokens for push notifications.
 * This script executes the 028_add_device_tokens.sql migration.
 * It is idempotent and can be safely re-run.
 */

export async function applyDeviceTokens() {
  try {
    console.log('🔄 Starting device tokens migration...');

    const migrationPath = path.join(
      __dirname,
      '../../database/028_add_device_tokens.sql'
    );
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing device tokens migration...');
    await query(migrationSQL);
    console.log('✅ Device tokens migration completed successfully');
  } catch (error: any) {
    console.error('❌ Device tokens migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyDeviceTokens()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
