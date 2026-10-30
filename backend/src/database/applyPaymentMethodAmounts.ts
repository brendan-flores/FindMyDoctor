import { query } from '../database/connection';

/**
 * Migration: Add payment method amounts to track GCash and cash separately
 *
 * This migration adds gcash_advance_amount and cash_tendered_amount columns
 * to support mixed payment scenarios where patients pay via GCash advance
 * and also pay cash at the clinic.
 */
async function migrate() {
  try {
    console.log('Starting payment method amounts migration...');

    // Add gcash_advance_amount column
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'payments'
              AND column_name = 'gcash_advance_amount'
          ) THEN
              ALTER TABLE payments
              ADD COLUMN gcash_advance_amount DECIMAL(10,2) DEFAULT 0.00;
          END IF;
      END $$
    `);
    console.log('✓ Added gcash_advance_amount column (if not exists)');

    // Add cash_tendered_amount column
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'payments'
              AND column_name = 'cash_tendered_amount'
          ) THEN
              ALTER TABLE payments
              ADD COLUMN cash_tendered_amount DECIMAL(10,2) DEFAULT 0.00;
          END IF;
      END $$
    `);
    console.log('✓ Added cash_tendered_amount column (if not exists)');

    // Add comments
    await query(`
      COMMENT ON COLUMN payments.gcash_advance_amount IS 'Amount paid via GCash advance payment (with receipt upload)'
    `);
    console.log('✓ Added comment for gcash_advance_amount');

    await query(`
      COMMENT ON COLUMN payments.cash_tendered_amount IS 'Amount paid in cash at the clinic after checkup'
    `);
    console.log('✓ Added comment for cash_tendered_amount');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
