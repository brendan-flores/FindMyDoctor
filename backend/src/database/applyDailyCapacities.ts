import { query } from '../database/connection';
import fs from 'fs';
import path from 'path';

async function applyDailyCapacitiesMigration() {
  try {
    const migrationPath = path.join(__dirname, '../../database/018_add_daily_capacities.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Applying daily_capacities migration...');
    await query(migrationSQL);
    console.log('✅ daily_capacities migration applied successfully');
  } catch (error) {
    console.error('❌ Error applying daily_capacities migration:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  applyDailyCapacitiesMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { applyDailyCapacitiesMigration };
