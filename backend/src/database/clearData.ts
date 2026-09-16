import fs from 'fs';
import path from 'path';
import { query } from './connection';

const CLEAR_DATA_SCRIPT = path.join(__dirname, '../../database/004_clear_all_data.sql');

/**
 * Clear all data from database tables while preserving table structure
 * WARNING: This will delete ALL data - use with caution!
 */
export async function clearAllData() {
  console.log('🗑️  Clearing all data from database...');
  console.log('⚠️  WARNING: This will delete ALL data from your database!');
  console.log('⚠️  Table structure will be preserved, but all data will be lost.\n');

  try {
    // Check if clear data script exists
    if (!fs.existsSync(CLEAR_DATA_SCRIPT)) {
      throw new Error(`Clear data script not found: ${CLEAR_DATA_SCRIPT}`);
    }

    // Read and execute the clear data SQL
    const clearDataSQL = fs.readFileSync(CLEAR_DATA_SCRIPT, 'utf8');
    await query(clearDataSQL);

    console.log('✅ All data cleared successfully!');
    console.log('💡 Database structure preserved - tables are now empty.\n');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

// Run clear data if this file is executed directly
if (require.main === module) {
  clearAllData()
    .then(() => {
      console.log('Data clearing process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Data clearing process failed:', error);
      process.exit(1);
    });
}