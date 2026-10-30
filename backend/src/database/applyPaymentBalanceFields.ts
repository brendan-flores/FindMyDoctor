import { query } from './connection';

export async function applyPaymentBalanceFields() {
  console.log('Starting payment balance fields migration...');

  try {
    // Add amount_paid column if it doesn't exist
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'payments'
              AND column_name = 'amount_paid'
          ) THEN
              ALTER TABLE payments
              ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0.00 NOT NULL;
          END IF;
      END $$
    `);
    console.log('✓ Added amount_paid column (if not exists)');

    // Backfill existing PAID payments
    await query(`
      UPDATE payments
      SET amount_paid = total_amount
      WHERE status = 'PAID' AND amount_paid = 0;
    `);
    console.log('✓ Backfilled existing PAID payments');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

applyPaymentBalanceFields()
  .then(() => {
    console.log('Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
