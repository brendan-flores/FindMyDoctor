import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration script that applies AI daily limits table
 * This script executes the 034_add_ai_daily_limits.sql migration
 * It is idempotent and can be safely re-run
 */

export async function applyAiDailyLimits() {
  try {
    console.log('🔄 Starting AI daily limits migration...');

    const migrationPath = path.join(__dirname, '../../database/034_add_ai_daily_limits.sql');
    console.log('Reading migration from:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      throw new Error('Migration file not found');
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing AI daily limits migration...');
    await query(migrationSQL);
    console.log('✅ AI daily limits migration completed successfully');
  } catch (error: any) {
    console.error('❌ AI daily limits migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  applyAiDailyLimits()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}
