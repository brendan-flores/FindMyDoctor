/**
 * Script to ensure all existing doctors have Supabase Auth identities
 * This is needed for the login OTP flow which uses shouldCreateUser: false
 *
 * Run this script after deployment to ensure existing doctors can log in with OTP
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config';
import { query } from '../src/database/connection';

const supabaseAdmin = config.supabase.url && config.supabase.serviceRoleKey
  ? createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null;

async function ensureDoctorSupabaseIdentity(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!supabaseAdmin) {
      return { success: false, message: 'Supabase is not configured' };
    }

    console.log('Ensuring Supabase Auth identity for Doctor:', email);

    // Check if user already exists in Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listError) {
      console.error('Supabase Auth listUsers error:', listError);
      return { success: false, message: 'Failed to check Supabase users' };
    }

    const existingUser = users?.find(user => user.email === email);

    if (existingUser) {
      console.log('Supabase Auth user already exists for:', email);
      return { success: true, message: 'Supabase identity already exists' };
    }

    // Create Supabase Auth user without password (passwordless OTP only)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        role: 'DOCTOR',
        created_via: 'migration_script'
      }
    });

    if (createError) {
      console.error('Supabase Auth createUser error:', createError);
      if (createError.message?.includes('duplicate') || createError.message?.includes('already exists')) {
        console.log('Supabase Auth user already exists (race condition):', email);
        return { success: true, message: 'Supabase identity already exists' };
      }
      return { success: false, message: createError.message || 'Failed to create Supabase identity' };
    }

    console.log('Supabase Auth identity created for Doctor:', email);
    return { success: true, message: 'Supabase identity created successfully' };
  } catch (err: any) {
    console.error('Error ensuring Supabase identity:', err);
    return { success: false, message: err.message || 'Error ensuring Supabase identity' };
  }
}

async function main() {
  console.log('Starting migration to ensure all doctors have Supabase Auth identities...');

  try {
    // Get all doctors from PostgreSQL
    const result = await query(
      `SELECT u.email, u.id, d.first_name, d.last_name
       FROM users u
       JOIN doctors d ON u.id = d.user_id
       WHERE u.role = 'DOCTOR'`
    );

    const doctors = result.rows;
    console.log(`Found ${doctors.length} doctors in PostgreSQL`);

    let successCount = 0;
    let failureCount = 0;

    for (const doctor of doctors) {
      console.log(`\nProcessing: ${doctor.email} (${doctor.first_name} ${doctor.last_name})`);
      const result = await ensureDoctorSupabaseIdentity(doctor.email);

      if (result.success) {
        successCount++;
        console.log(`✓ ${result.message}`);
      } else {
        failureCount++;
        console.log(`✗ ${result.message}`);
      }
    }

    console.log(`\nMigration complete: ${successCount} succeeded, ${failureCount} failed`);

    if (failureCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
