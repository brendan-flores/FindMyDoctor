require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function seedAdminAccounts() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');
    console.log('🌱 Starting Admin account seed...');

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await client.query(
      'SELECT id, email FROM users WHERE role = $1',
      ['SUPERADMIN']
    );

    if (existingSuperAdmin.rows.length === 0) {
      // Generate secure password hash for SuperAdmin
      const superAdminPassword = 'SuperAdmin@FiDo2024';
      const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

      // Create initial SuperAdmin account
      const superAdminResult = await client.query(
        `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role, must_change_password`,
        ['superadmin@findmydoctor.local', superAdminPasswordHash, 'SUPERADMIN', true, true]
      );

      if (superAdminResult.rows.length > 0) {
        const superAdmin = superAdminResult.rows[0];
        console.log('✅ Initial SuperAdmin account created successfully!');
        console.log(`   Email: ${superAdmin.email}`);
        console.log(`   Password: ${superAdminPassword}`);
        console.log(`   Role: ${superAdmin.role}`);
        console.log(`   ID: ${superAdmin.id}`);
        console.log('');
        console.log('⚠️  IMPORTANT: Please change the default password immediately after first login!');
      }
    } else {
      console.log('✅ SuperAdmin account already exists. Skipping seed.');
      console.log(`   Email: ${existingSuperAdmin.rows[0].email}`);
      console.log(`   ID: ${existingSuperAdmin.rows[0].id}`);
    }

    // Check if regular Admin already exists
    const existingAdmin = await client.query(
      'SELECT id, email FROM users WHERE role = $1 AND email != $2',
      ['ADMIN', 'superadmin@findmydoctor.local']
    );

    if (existingAdmin.rows.length === 0) {
      // Generate secure password hash for regular Admin
      const adminPassword = 'Admin@FiDo2024';
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

      // Create initial regular Admin account
      const adminResult = await client.query(
        `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role, must_change_password`,
        ['admin@findmydoctor.local', adminPasswordHash, 'ADMIN', true, true]
      );

      if (adminResult.rows.length > 0) {
        const admin = adminResult.rows[0];
        console.log('✅ Initial regular Admin account created successfully!');
        console.log(`   Email: ${admin.email}`);
        console.log(`   Password: ${adminPassword}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   ID: ${admin.id}`);
        console.log('');
        console.log('⚠️  IMPORTANT: Please change the default password immediately after first login!');
      }
    } else {
      console.log('✅ Regular Admin account already exists. Skipping seed.');
      console.log(`   Email: ${existingAdmin.rows[0].email}`);
      console.log(`   ID: ${existingAdmin.rows[0].id}`);
    }

    await client.end();
    console.log('\n🎉 Admin seed completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding Admin accounts:', error.message);
    await client.end();
    process.exit(1);
  }
}

seedAdminAccounts();