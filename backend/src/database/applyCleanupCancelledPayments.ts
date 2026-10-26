import { query } from './connection';

export async function applyCleanupCancelledPayments() {
  console.log('Cleaning up payments for cancelled appointments...');

  try {
    // First, let's see what we have
    const checkResult = await query(`
      SELECT 
        a.appointment_date,
        p.payment_method,
        p.status as payment_status,
        pat.first_name,
        pat.last_name
      FROM payments p
      JOIN appointments a ON p.appointment_id = a.id
      JOIN patients pat ON a.patient_id = pat.id
      WHERE a.status = 'CANCELLED'
    `);

    console.log(`Found ${checkResult.rows.length} payments for cancelled appointments:`);
    console.table(checkResult.rows);

    // Delete CASH payments for cancelled appointments
    const deleteChargesResult = await query(`
      DELETE FROM payment_charges
      WHERE payment_id IN (
        SELECT p.id FROM payments p
        JOIN appointments a ON p.appointment_id = a.id
        WHERE a.status = 'CANCELLED' AND p.payment_method = 'CASH'
      )
    `);

    const deletePaymentsResult = await query(`
      DELETE FROM payments
      WHERE appointment_id IN (
        SELECT id FROM appointments WHERE status = 'CANCELLED'
      )
      AND payment_method = 'CASH'
    `);

    console.log(`Deleted ${deletePaymentsResult.rowCount} CASH payments for cancelled appointments`);

    // Mark GCASH payments as CANCELLED for cancelled appointments
    const updateResult = await query(`
      UPDATE payments
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE appointment_id IN (
        SELECT id FROM appointments WHERE status = 'CANCELLED'
      )
      AND payment_method = 'GCASH'
      AND status != 'CANCELLED'
    `);

    console.log(`Marked ${updateResult.rowCount} GCASH payments as CANCELLED`);

    console.log('✓ Cleanup complete');
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}
