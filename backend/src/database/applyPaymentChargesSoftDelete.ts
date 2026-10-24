import { query } from '../database/connection';

/**
 * Migration: Add soft-delete support to payment_charges table
 *
 * This migration adds a deleted_at column to the payment_charges table
 * to support audit-preserving soft-delete. When a charge is deleted,
 * deleted_at is set instead of removing the row. This preserves audit
 * history while excluding deleted charges from total calculations via
 * WHERE deleted_at IS NULL filters.
 */
async function migrate() {
  try {
    console.log('Starting payment charges soft-delete migration...');

    // Add deleted_at column if it doesn't exist
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'payment_charges'
              AND column_name = 'deleted_at'
          ) THEN
              ALTER TABLE payment_charges
              ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
          END IF;
      END $$
    `);
    console.log('✓ Added deleted_at column (if not exists)');

    // Add index on deleted_at for efficient filtering of active charges
    await query(`
      CREATE INDEX IF NOT EXISTS idx_payment_charges_deleted_at
      ON payment_charges(deleted_at) WHERE deleted_at IS NULL
    `);
    console.log('✓ Created index on deleted_at column');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
