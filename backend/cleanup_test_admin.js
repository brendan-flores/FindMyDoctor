require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function cleanupTestAdmin() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');
    console.log('🧹 Cleaning up test admin account...\n');

    // Delete the test admin account
    const result = await client.query(
      "DELETE FROM users WHERE email LIKE 'testadmin%' RETURNING email"
    );

    if (result.rows.length > 0) {
      console.log('✅ Test admin accounts deleted:');
      result.rows.forEach(row => {
        console.log(`   - ${row.email}`);
      });
    } else {
      console.log('ℹ️  No test admin accounts found to clean up');
    }

    await client.end();
    console.log('\n✅ Cleanup completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

cleanupTestAdmin();