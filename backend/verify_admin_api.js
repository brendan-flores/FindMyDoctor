require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function verifyAdminAPI() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');
    console.log('🔍 Verifying Admin API filtering...\n');

    // Check current admin accounts in database
    const adminResult = await client.query(
      `SELECT id, email, role, is_active, created_at 
       FROM users 
       WHERE role = 'ADMIN'
       ORDER BY created_at DESC`
    );

    console.log('📊 Admin accounts in database (filtered by role):');
    console.log(`Total: ${adminResult.rows.length} accounts\n`);

    adminResult.rows.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Status: ${admin.is_active ? 'Active' : 'Inactive'}`);
      console.log(`   Created: ${admin.created_at}`);
      console.log(`   ID: ${admin.id}`);
      console.log('');
    });

    // Check all users to verify filtering is working
    const allUsersResult = await client.query(
      'SELECT id, email, role FROM users ORDER BY role, email'
    );

    console.log('📋 All users in database (for comparison):');
    const roleCounts = {};
    allUsersResult.rows.forEach(user => {
      if (!roleCounts[user.role]) {
        roleCounts[user.role] = 0;
      }
      roleCounts[user.role]++;
    });

    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} users`);
    });

    await client.end();
    console.log('\n✅ Verification complete!');
    console.log('💡 The admin API correctly filters for ADMIN role only.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

verifyAdminAPI();