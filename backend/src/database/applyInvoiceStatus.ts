import { query } from '../database/connection';

/**
 * Migration: Add status field to invoices table for voiding and reissue workflow
 *
 * This migration adds a status column to the invoices table to support voiding
 * invoices while preserving data for audit trail.
 */
async function migrate() {
  try {
    console.log('Starting invoice status migration...');

    // Add status column with default ACTIVE
    await query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
    `);
    console.log('✓ Added status column to invoices table');

    // Add check constraint to ensure only valid status values
    // PostgreSQL doesn't support IF NOT EXISTS for constraints, so we check first
    const constraintCheck = await query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'invoices' AND constraint_name = 'chk_invoice_status'
    `);

    if (constraintCheck.rows.length === 0) {
      await query(`
        ALTER TABLE invoices
        ADD CONSTRAINT chk_invoice_status
        CHECK (status IN ('ACTIVE', 'VOID'))
      `);
      console.log('✓ Added check constraint for status values');
    } else {
      console.log('✓ Check constraint already exists');
    }

    // Add index on status for efficient filtering
    await query(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
    console.log('✓ Created index on status');

    // Update any existing invoices to ACTIVE (should already be default, but ensuring consistency)
    await query(`UPDATE invoices SET status = 'ACTIVE' WHERE status IS NULL`);
    console.log('✓ Updated existing invoices to ACTIVE status');

    // Add comment to clarify the status field
    await query(`
      COMMENT ON COLUMN invoices.status IS 'Invoice status: ACTIVE (current/valid) or VOID (cancelled/for audit only). Voided invoices cannot be downloaded or edited.'
    `);
    console.log('✓ Added column comment');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
