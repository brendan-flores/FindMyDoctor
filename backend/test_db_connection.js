require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection for API operations...\n');
    
    await client.connect();
    console.log('✅ Connected to database');

    // Test simple query
    console.log('📝 Testing simple query...');
    const timeResult = await client.query('SELECT NOW()');
    console.log('✅ Query successful:', timeResult.rows[0].now);

    // Test user count query
    console.log('📊 Testing user count query...');
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log('✅ User count query successful:', userCount.rows[0].count, 'users');

    // Test doctor query
    console.log('👨‍⚕️ Testing doctor query...');
    const doctors = await client.query('SELECT COUNT(*) as count FROM doctors');
    console.log('✅ Doctor query successful:', doctors.rows[0].count, 'doctors');

    // Test a more complex query
    console.log('🔗 Testing complex join query...');
    const appointments = await client.query(`
      SELECT COUNT(*) as count 
      FROM appointments 
      WHERE status = 'SCHEDULED'
    `);
    console.log('✅ Complex query successful:', appointments.rows[0].count, 'scheduled appointments');

    await client.end();
    console.log('\n✅ All database connection tests passed!');
    console.log('💡 Database is ready for API operations.\n');

  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    await client.end();
    process.exit(1);
  }
}

testDatabaseConnection();