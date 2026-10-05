import bcrypt from 'bcryptjs';
import { query } from './connection';
import * as otpService from '../services/otpService';

/**
 * Seed script for initial SuperAdmin and Admin accounts
 * This script is idempotent - running it multiple times will not create duplicate accounts
 *
 * Creates:
 * - SuperAdmin account (adminsisiglovers@gmail.com / SisigLovers@2026)
 * - Default SuperAdmin account (superadmin@findmydoctor.local / SuperAdmin@2026)
 * - Regular Admin account (admin@findmydoctor.local / Admin@2026)
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
      const specificSuperAdminPassword = 'SisigLovers@2026';
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
      // Update existing account password
      const specificSuperAdminPassword = 'SisigLovers@2026';
      const specificSuperAdminPasswordHash = await bcrypt.hash(specificSuperAdminPassword, 10);

      await query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [specificSuperAdminPasswordHash, 'adminsisiglovers@gmail.com']
      );

      console.log('✅ SuperAdmin account password updated successfully!');
      console.log(`   Email: ${specificSuperAdmin.rows[0].email}`);
      console.log(`   Password: ${specificSuperAdminPassword}`);
      console.log(`   ID: ${specificSuperAdmin.rows[0].id}`);
    }

    // Check if default SuperAdmin already exists (for backward compatibility)
    const existingSuperAdmin = await query(
      'SELECT id, email FROM users WHERE email = $1',
      ['superadmin@findmydoctor.local']
    );

    if (existingSuperAdmin.rows.length === 0) {
      // Generate secure password hash for default SuperAdmin
      const superAdminPassword = 'SuperAdmin@2026'; // This should be changed immediately after first login
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
      // Update existing account password
      const superAdminPassword = 'SuperAdmin@2026';
      const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

      await query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [superAdminPasswordHash, 'superadmin@findmydoctor.local']
      );

      console.log('✅ Default SuperAdmin account password updated successfully!');
      console.log(`   Email: ${existingSuperAdmin.rows[0].email}`);
      console.log(`   Password: ${superAdminPassword}`);
      console.log(`   ID: ${existingSuperAdmin.rows[0].id}`);
    }

    // Check if regular Admin already exists
    const existingAdmin = await query(
      'SELECT id, email FROM users WHERE role = $1 AND email != $2 AND email != $3',
      ['ADMIN', 'superadmin@findmydoctor.local', 'adminsisiglovers@gmail.com']
    );

    if (existingAdmin.rows.length === 0) {
      // SAFETY: Ensure Supabase Auth identity exists BEFORE creating PostgreSQL account
      // Admin OTP is mandatory with NO bypass, so we must not create a broken Admin account
      try {
        await otpService.ensureAdminSupabaseIdentity('admin@findmydoctor.local');
        console.log('✅ Supabase identity ensured for regular Admin');
      } catch (supabaseErr: any) {
        console.error('❌ Failed to ensure Supabase identity:', supabaseErr.message);
        console.log('❌ HALTING: Cannot create Admin without Supabase identity for mandatory OTP');
        throw new Error('Supabase identity provisioning failed. Cannot create Admin account.');
      }

      // Generate secure password hash for regular Admin
      const adminPassword = 'Admin@2026'; // This should be changed immediately after first login
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
      // Update existing admin account password
      const adminPassword = 'Admin@2026';
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

      await query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [adminPasswordHash, 'admin@findmydoctor.local']
      );

      console.log('✅ Regular Admin account password updated successfully!');
      console.log(`   Email: ${existingAdmin.rows[0].email}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   ID: ${existingAdmin.rows[0].id}`);

      // Ensure Supabase Auth identity exists for mandatory OTP (for existing accounts)
      try {
        await otpService.ensureAdminSupabaseIdentity('admin@findmydoctor.local');
        console.log('✅ Supabase identity ensured for regular Admin');
      } catch (supabaseErr: any) {
        console.error('⚠️  Failed to ensure Supabase identity:', supabaseErr.message);
        console.log('⚠️  WARNING: Existing Admin may not be able to complete mandatory OTP login');
        console.log('   Manually create Supabase user for this email to fix');
      }
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
