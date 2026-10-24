import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that adds the gcash_qr_url column to the doctors table.
 * This allows each doctor to have their own GCash QR code for payments.
 * The QR code is managed by secretaries through the web dashboard.
 * This script executes the 029_add_gcash_qr_url.sql migration.
 * It is idempotent and can be safely re-run.
 */

export async function applyGcashQrUrl() {
  try {
    console.log('🔄 Starting GCash QR URL migration...');

    const migrationPath = path.join(
      __dirname,
      '../../database/029_add_gcash_qr_url.sql'
    );
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing GCash QR URL migration...');
    await query(migrationSQL);
    console.log('✅ GCash QR URL migration completed successfully');
  } catch (error: any) {
    console.error('❌ GCash QR URL migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyGcashQrUrl()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
