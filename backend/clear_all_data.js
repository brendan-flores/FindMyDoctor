require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function clearAllData() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');
    
    console.log('⚠️  WARNING: This will delete ALL data from your database!');
    console.log('⚠️  Table structure will be preserved, but all data will be lost.\n');
    
    // Read the clear data SQL file
    const clearDataPath = path.join(__dirname, 'database', '004_clear_all_data.sql');
    console.log('📋 Reading clear data script from:', clearDataPath);
    
    if (!fs.existsSync(clearDataPath)) {
      console.error('❌ Clear data script not found:', clearDataPath);
      process.exit(1);
    }
    
    const clearDataSQL = fs.readFileSync(clearDataPath, 'utf8');

    console.log('🗑️  Clearing all data from database...\n');
    
    // Execute the clear data script
    await client.query(clearDataSQL);
    
    console.log('\n✅ All data cleared successfully!');
    console.log('💡 Database structure preserved - tables are now empty.\n');

    // Show current state
    const tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    
    console.log('📊 Current table structure:');
    tablesResult.rows.forEach(row => {
      console.log('  -', row.table_name);
    });

    await client.end();
    console.log('\n✅ Database is now ready for fresh data insertion');
    
  } catch (error) {
    console.error('❌ Error clearing data:', error.message);
    await client.end();
    process.exit(1);
  }
}

// Run the clear data function
clearAllData();