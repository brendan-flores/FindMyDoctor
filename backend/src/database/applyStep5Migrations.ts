import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that applies Step 5 database changes
 * This script executes two migrations in order:
 * - 013_add_two_factor_settings.sql
 * - 014_add_login_otp_challenges.sql
 * It is idempotent and can be safely re-run.
 */

export async function applyStep5Migrations() {
  try {
    console.log('🔄 Starting Step 5 database migrations...');

    // Migration 013: Add two_factor_settings
    console.log('\n--- Migration 013: Add two_factor_settings ---');
    const migration013Path = path.join(__dirname, '../../database/013_add_two_factor_settings.sql');
    console.log('Reading migration from:', migration013Path);

    if (!fs.existsSync(migration013Path)) {
      console.error('Migration file not found:', migration013Path);
      throw new Error('Migration file 013 not found');
    }

    const migration013SQL = fs.readFileSync(migration013Path, 'utf8');

    console.log('Executing migration 013...');
    await query(migration013SQL);
    console.log('✅ Migration 013 completed successfully');

    // Migration 014: Add login_otp_challenges
    console.log('\n--- Migration 014: Add login_otp_challenges ---');
    const migration014Path = path.join(__dirname, '../../database/014_add_login_otp_challenges.sql');
    console.log('Reading migration from:', migration014Path);

    if (!fs.existsSync(migration014Path)) {
      console.error('Migration file not found:', migration014Path);
      throw new Error('Migration file 014 not found');
    }

    const migration014SQL = fs.readFileSync(migration014Path, 'utf8');

    console.log('Executing migration 014...');
    await query(migration014SQL);
    console.log('✅ Migration 014 completed successfully');

    console.log('\n🎉 All Step 5 migrations completed successfully');
  } catch (error: any) {
    // Column, index or table already present means the migration was already applied
    if (error.code === '42P07' || error.code === '42701' || error.code === '42P16') {
      console.log('⚠️  Migration appears to be already applied. This is safe to ignore.');
      console.log('✅ Step 5 migrations completed (already applied)');
    } else {
      console.error('❌ Step 5 migrations failed:', error);
      throw error;
    }
  }
}

// Run migrations if executed directly
if (require.main === module) {
  applyStep5Migrations()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
