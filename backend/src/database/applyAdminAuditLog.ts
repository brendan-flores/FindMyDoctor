import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that creates the admin_audit_log table for tracking admin actions.
 * This script executes the 031_add_admin_audit_log.sql migration.
 * It is idempotent and can be safely re-run.
 */

export async function applyAdminAuditLog() {
  try {
    console.log('🔄 Starting admin audit log migration...');

    const migrationPath = path.join(
      __dirname,
      '../../database/031_add_admin_audit_log.sql'
    );
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing admin audit log migration...');
    await query(migrationSQL);
    console.log('✅ Admin audit log migration completed successfully');
  } catch (error: any) {
    console.error('❌ Admin audit log migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyAdminAuditLog()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
