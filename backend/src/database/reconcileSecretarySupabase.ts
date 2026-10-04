import { query } from '../database/connection';
import * as otpService from '../services/otpService';

/**
 * Reconcile Secretary Supabase identities
 *
 * This script provisions Supabase Auth identities for existing Secretary accounts
 * that don't have them yet. This is required because login OTP uses
 * shouldCreateUser: false, which means the user must already exist in Supabase Auth.
 *
 * This script is idempotent - it will not create duplicate identities.
 *
 * Usage: npx tsx src/database/reconcileSecretarySupabase.ts
 */

async function reconcileSecretarySupabase() {
  try {
    console.log('🔍 Reconciling Supabase identities for Secretary accounts...');

    // Get all Secretary accounts
    const secretaryUsers = await query(
      `SELECT id, email, role FROM users WHERE role = 'SECRETARY'`
    );

    console.log(`Found ${secretaryUsers.rows.length} Secretary accounts`);

    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;
    const failures: { email: string; error: string }[] = [];

    for (const secretary of secretaryUsers.rows) {
      try {
        const result = await otpService.ensureSecretarySupabaseIdentity(secretary.email);
        successCount++;
        console.log(`✅ Supabase identity ensured for ${secretary.email} (${secretary.role})`);
      } catch (err: any) {
        failureCount++;
        failures.push({ email: secretary.email, error: err.message || 'Unknown error' });
        console.error(`❌ Failed to ensure Supabase identity for ${secretary.email}:`, err.message);
      }
    }

    console.log('\n📊 Reconciliation Summary:');
    console.log(`✅ Success: ${successCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Failed: ${failureCount}`);

    if (failures.length > 0) {
      console.log('\n❌ Failures:');
      failures.forEach(f => {
        console.log(`  - ${f.email}: ${f.error}`);
      });
    }

    console.log('\n🎉 Reconciliation complete!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Reconciliation failed:', error);
    process.exit(1);
  }
}

// Run reconciliation if executed directly
if (require.main === module) {
  reconcileSecretarySupabase();
}

export { reconcileSecretarySupabase };
