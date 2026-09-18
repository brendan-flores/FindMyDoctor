import bcrypt from 'bcryptjs';
import { query } from './connection';

/**
 * Seed script for initial SuperAdmin and Admin accounts
 * This script is idempotent - running it multiple times will not create duplicate accounts
 * 
 * Creates:
 * - SuperAdmin account (adminsisiglovers@gmail.com / SisigLoversSD2)
 * - Default SuperAdmin account (superadmin@findmydoctor.local / SuperAdmin@FiDo2024)
 * - Regular Admin account (admin@findmydoctor.local / Admin@FiDo2024)
 */

async function seedAdmin() {
  try {
    console.log('🌱 Starting Admin account seed...');

    // Check if the specific SuperAdmin account already exists
    const specificSuperAdmin = await query(
      'SELECT id, email FROM users WHERE email = $1',
      ['adminsisiglovers@gmail.com']
    );

    if (specificSuperAdmin.rows.length === 0) {
      // Generate secure password hash for the specific SuperAdmin
      const specificSuperAdminPassword = 'SisigLoversSD2';
      const specificSuperAdminPasswordHash = await bcrypt.hash(specificSuperAdminPassword, 10);

      // Create the specific SuperAdmin account
      const specificSuperAdminResult = await query(
        `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role, must_change_password`,
        ['adminsisiglovers@gmail.com', specificSuperAdminPasswordHash, 'SUPERADMIN', true, false]
      );

      if (specificSuperAdminResult.rows.length > 0) {
        const superAdmin = specificSuperAdminResult.rows[0];
        console.log('✅ SuperAdmin account created successfully!');
        console.log(`   Email: ${superAdmin.email}`);
        console.log(`   Password: ${specificSuperAdminPassword}`);
        console.log(`   Role: ${superAdmin.role}`);
        console.log(`   ID: ${superAdmin.id}`);
      }
    } else {
      console.log('✅ SuperAdmin account already exists. Skipping seed.');
      console.log(`   Email: ${specificSuperAdmin.rows[0].email}`);
      console.log(`   ID: ${specificSuperAdmin.rows[0].id}`);
    }

    // Check if default SuperAdmin already exists (for backward compatibility)
    const existingSuperAdmin = await query(
      'SELECT id, email FROM users WHERE email = $1',
      ['superadmin@findmydoctor.local']
    );

    if (existingSuperAdmin.rows.length === 0) {
      // Generate secure password hash for default SuperAdmin
      const superAdminPassword = 'SuperAdmin@FiDo2024'; // This should be changed immediately after first login
      const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

      // Create initial default SuperAdmin account
      const superAdminResult = await query(
        `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role, must_change_password`,
        ['superadmin@findmydoctor.local', superAdminPasswordHash, 'SUPERADMIN', true, true]
      );

      if (superAdminResult.rows.length > 0) {
        const superAdmin = superAdminResult.rows[0];
        console.log('✅ Default SuperAdmin account created successfully!');
        console.log(`   Email: ${superAdmin.email}`);
        console.log(`   Password: ${superAdminPassword}`);
        console.log(`   Role: ${superAdmin.role}`);
        console.log(`   ID: ${superAdmin.id}`);
        console.log('');
        console.log('⚠️  IMPORTANT: Please change the default password immediately after first login!');
      }
    } else {
      console.log('✅ Default SuperAdmin account already exists. Skipping seed.');
      console.log(`   Email: ${existingSuperAdmin.rows[0].email}`);
      console.log(`   ID: ${existingSuperAdmin.rows[0].id}`);
    }

    // Check if regular Admin already exists
    const existingAdmin = await query(
      'SELECT id, email FROM users WHERE role = $1 AND email != $2 AND email != $3',
      ['ADMIN', 'superadmin@findmydoctor.local', 'adminsisiglovers@gmail.com']
    );

    if (existingAdmin.rows.length === 0) {
      // Generate secure password hash for regular Admin
      const adminPassword = 'Admin@FiDo2024'; // This should be changed immediately after first login
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

      // Create initial regular Admin account
      const adminResult = await query(
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

  } catch (error) {
    console.error('❌ Error seeding Admin accounts:', error);
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
