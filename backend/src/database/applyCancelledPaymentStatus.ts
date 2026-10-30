import { query } from './connection';

export async function applyCancelledPaymentStatus() {
  console.log('Starting cancelled payment status migration...');

  try {
    // Drop the existing constraint
    await query(`
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
    `);
    console.log('✓ Dropped existing payments_status_check constraint');

    // Add the new constraint with CANCELLED status
    await query(`
      ALTER TABLE payments ADD CONSTRAINT payments_status_check
      CHECK (status::text = ANY(ARRAY['UNPAID'::text, 'PENDING_VERIFICATION'::text, 'PAID'::text, 'REJECTED'::text, 'CANCELLED'::text]));
    `);
    console.log('✓ Added new payments_status_check constraint with CANCELLED status');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
applyCancelledPaymentStatus()
  .then(() => {
    console.log('Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
