import { query } from './connection';
import * as otpService from '../services/otpService';

/**
 * Standalone script to reconcile Supabase Auth identities for all existing Admin/SuperAdmin accounts
 * This script is idempotent and can be safely re-run
 * It does not require authentication - it runs directly against the database
 */

async function reconcileAdminSupabase() {
  try {
    console.log('🔄 Reconciling Supabase identities for all Admin/SuperAdmin accounts...');

    // Get all Admin and SuperAdmin accounts
    const adminUsers = await query(
      `SELECT id, email, role FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')`
    );

    console.log(`Found ${adminUsers.rows.length} Admin/SuperAdmin accounts to reconcile`);

    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;
    const failures: { email: string; error: string }[] = [];

    for (const admin of adminUsers.rows) {
      try {
        const result = await otpService.ensureAdminSupabaseIdentity(admin.email);
        successCount++;
        console.log(`✅ Supabase identity ensured for ${admin.email} (${admin.role})`);
      } catch (err: any) {
        failureCount++;
        failures.push({ email: admin.email, error: err.message || 'Unknown error' });
        console.error(`❌ Failed to ensure Supabase identity for ${admin.email}:`, err.message);
      }
    }

    console.log('\n=== Reconciliation Summary ===');
    console.log(`Total accounts: ${adminUsers.rows.length}`);
    console.log(`Successfully reconciled: ${successCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Failed: ${failureCount}`);

    if (failures.length > 0) {
      console.log('\nFailures:');
      failures.forEach(f => {
        console.log(`  - ${f.email}: ${f.error}`);
      });
    }

    if (failureCount > 0) {
      throw new Error(`${failureCount} accounts failed to reconcile`);
    }

    console.log('\n🎉 All Admin/SuperAdmin accounts now have Supabase Auth identities');
  } catch (error) {
    console.error('❌ Error reconciling Supabase identities:', error);
    throw error;
  }
}

// Run reconciliation if executed directly
if (require.main === module) {
  reconcileAdminSupabase()
    .then(() => {
      console.log('🎉 Reconciliation process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Reconciliation process failed:', error);
      process.exit(1);
    });
}

export { reconcileAdminSupabase };
