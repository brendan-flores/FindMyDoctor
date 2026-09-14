import bcrypt from 'bcryptjs';
import { query } from './connection';

/**
 * Seed script for initial Admin account
 * This script is idempotent - running it multiple times will not create duplicate Admin accounts
 */

async function seedAdmin() {
  try {
    console.log('🌱 Starting Admin account seed...');

    // Check if Admin already exists
    const existingAdmin = await query(
      'SELECT id, email FROM users WHERE role = $1',
      ['ADMIN']
    );

    if (existingAdmin.rows.length > 0) {
      console.log('✅ Admin account already exists. Skipping seed.');
      console.log(`   Email: ${existingAdmin.rows[0].email}`);
      console.log(`   ID: ${existingAdmin.rows[0].id}`);
      return;
    }

    // Generate secure password hash
    const adminPassword = 'Admin@FiDo2024'; // This should be changed immediately after first login
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create initial Admin account
    const adminResult = await query(
      `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, role, must_change_password`,
      ['admin@findmydoctor.local', passwordHash, 'ADMIN', true, true]
    );

    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      console.log('✅ Initial Admin account created successfully!');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   ID: ${admin.id}`);
      console.log('');
      console.log('⚠️  IMPORTANT: Please change the default password immediately after first login!');
    } else {
      console.log('⚠️  Admin account was not created (may already exist).');
    }

  } catch (error) {
    console.error('❌ Error seeding Admin account:', error);
    throw error;
  }
}

// Run seed if executed directly
if (require.main === module) {
  seedAdmin()
    .then(() => {
      console.log('🎉 Admin seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Admin seed failed:', error);
      process.exit(1);
    });
}

export { seedAdmin };
