import { query } from '../database/connection';

async function applyFixSplitPaymentCashTendered() {
  try {
    console.log('Fixing split payment cash_tendered_amount values...');

    // Get payments that have gcash_advance_amount > 0 but incorrect cash_tendered_amount
    const result = await query(`
      SELECT id, total_amount, gcash_advance_amount, cash_tendered_amount, amount_paid
      FROM payments
      WHERE gcash_advance_amount > 0
      AND (cash_tendered_amount = total_amount OR cash_tendered_amount = 0)
      AND status = 'PAID'
    `);

    console.log(`Found ${result.rows.length} payments to fix`);

    for (const payment of result.rows) {
      const advancePayment = parseFloat(payment.gcash_advance_amount || '0');
      const totalAmount = parseFloat(payment.total_amount || '0');
      const correctCashTendered = Math.max(0, totalAmount - advancePayment);

      console.log(`Payment ${payment.id}: total=${totalAmount}, advance=${advancePayment}, current cash=${payment.cash_tendered_amount}, correct cash=${correctCashTendered}`);

      await query(`
        UPDATE payments
        SET cash_tendered_amount = $1
        WHERE id = $2
      `, [correctCashTendered, payment.id]);
    }

    console.log('Payments fixed successfully');
  } catch (error) {
    console.error('Error fixing payments:', error);
    throw error;
  }
}

applyFixSplitPaymentCashTendered()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
