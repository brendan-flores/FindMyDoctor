import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Adds doctors.gcash_qr_updated_at, the timestamp of the last GCash QR upload
 * (cleared on QR deletion). doctors.updated_at cannot serve this role because
 * it is also bumped by profile and photo edits.
 * Idempotent and safe to re-run.
 */
export async function applyGcashQrUpdatedAt() {
  try {
    console.log('🔄 Starting GCash QR updated-at migration...');

    const migrationPath = path.join(
      __dirname,
      '../../database/033_add_gcash_qr_updated_at.sql'
    );
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await query(migrationSQL);
    console.log('✅ GCash QR updated-at migration completed successfully');
  } catch (error: any) {
    console.error('❌ GCash QR updated-at migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  applyGcashQrUpdatedAt()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
