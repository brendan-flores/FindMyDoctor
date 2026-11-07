import { query, getClient } from '../database/connection';
import { BillingStatus, PaymentTransaction, Payment } from '../types/invoice';

/**
 * Recalculate billing status for a payment based on bill total and transactions
 * This is the single source of truth for billing status
 */
export async function recalculateBill(paymentId: string, existingClient?: any, knownBillTotal?: number): Promise<BillingStatus> {
  // When called inside an open transaction, reuse that client so the
  // recalculation sees uncommitted rows and stays atomic.
  const ownClient = !existingClient;
  const client = existingClient || await getClient();
  try {
    if (ownClient) await client.query('BEGIN');

    let billTotal: number;

    if (knownBillTotal !== undefined) {
      // Caller already holds the locked payment row and computed the total.
      billTotal = knownBillTotal;
    } else {
      // Get payment details
      const paymentResult = await client.query(
        `SELECT p.*, 
                COALESCE(p.consultation_amount, 0) + COALESCE(p.total_additional_charges, 0) as bill_total
         FROM payments p
         WHERE p.id = $1`,
        [paymentId]
      );

      if (paymentResult.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const payment = paymentResult.rows[0];
      billTotal = parseFloat(payment.bill_total);
    }

    // Get accepted payments and refunds
    const transactionsResult = await client.query(
      `SELECT 
         SUM(CASE WHEN kind = 'PAYMENT' AND status = 'ACCEPTED' THEN amount ELSE 0 END) as accepted_payments,
         SUM(CASE WHEN kind = 'REFUND' AND status = 'ACCEPTED' THEN amount ELSE 0 END) as accepted_refunds,
         SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count
       FROM payment_transactions
       WHERE payment_id = $1`,
      [paymentId]
    );

    const txRow = transactionsResult.rows[0] || {};
    const acceptedPayments = parseFloat(txRow.accepted_payments || 0);
    const acceptedRefunds = parseFloat(txRow.accepted_refunds || 0);
    const pendingCount = parseInt(txRow.pending_count || 0);

    // Calculate net paid amount
    const netPaid = acceptedPayments - acceptedRefunds;

    // Derive billing status
    let billingStatus: BillingStatus;
    if (pendingCount > 0) {
      billingStatus = 'FOR_REVIEW';
    } else if (netPaid === 0) {
      billingStatus = 'UNPAID';
    } else if (netPaid < billTotal) {
      billingStatus = 'PARTIAL';
    } else if (netPaid === billTotal) {
      billingStatus = 'PAID';
    } else {
      billingStatus = 'OVERPAID';
    }

    // Update payment status AND amount_paid cache
    await client.query(
      'UPDATE payments SET status = $1, amount_paid = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [billingStatus === 'FOR_REVIEW' ? 'PENDING_VERIFICATION' : billingStatus, netPaid, paymentId]
    );

    if (ownClient) await client.query('COMMIT');
    return billingStatus;
  } catch (err) {
    if (ownClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownClient) client.release();
  }
}

/**
 * Get billing summary for a payment
 */
export async function getBillingSummary(paymentId: string): Promise<{
  billTotal: number;
  acceptedPayments: number;
  acceptedRefunds: number;
  netPaid: number;
  balance: number;
  billingStatus: BillingStatus;
  pendingCount: number;
}> {
  const paymentResult = await query(
    `SELECT p.*, 
            COALESCE(p.consultation_amount, 0) + COALESCE(p.total_additional_charges, 0) as bill_total
     FROM payments p
     WHERE p.id = $1`,
    [paymentId]
  );

  if (paymentResult.rows.length === 0) {
    throw new Error('Payment not found');
  }

  const payment = paymentResult.rows[0];
  const billTotal = parseFloat(payment.bill_total);

  const transactionsResult = await query(
    `SELECT 
       SUM(CASE WHEN kind = 'PAYMENT' AND status = 'ACCEPTED' THEN amount ELSE 0 END) as accepted_payments,
       SUM(CASE WHEN kind = 'REFUND' AND status = 'ACCEPTED' THEN amount ELSE 0 END) as accepted_refunds,
       SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count
     FROM payment_transactions
     WHERE payment_id = $1`,
    [paymentId]
  );

  const acceptedPayments = parseFloat(transactionsResult.rows[0].accepted_payments || 0);
  const acceptedRefunds = parseFloat(transactionsResult.rows[0].accepted_refunds || 0);
  const pendingCount = parseInt(transactionsResult.rows[0].pending_count || 0);
  const netPaid = acceptedPayments - acceptedRefunds;
  const balance = Math.max(0, billTotal - netPaid);

  const billingStatus = await recalculateBill(paymentId);

  return {
    billTotal,
    acceptedPayments,
    acceptedRefunds,
    netPaid,
    balance,
    billingStatus,
    pendingCount,
  };
}

/**
 * Log billing action to audit log
 */
export async function logBillingAction(
  paymentId: string,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  stateBefore: any,
  stateAfter: any,
  reason?: string,
  existingClient?: any
): Promise<void> {
  const db = existingClient || query;
  await db.query(
    `INSERT INTO billing_audit_log (
      payment_id, actor_user_id, action, entity_type, entity_id,
      state_before, state_after, reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [paymentId, actorUserId, action, entityType, entityId, stateBefore, stateAfter, reason]
  );
}

/**
 * Get payment with full billing details
 */
export async function getPaymentWithBilling(paymentId: string): Promise<{
  payment: Payment;
  charges: any[];
  transactions: PaymentTransaction[];
  billingSummary: any;
  activeInvoice: any;
}> {
  // payments has no doctor_id column; the doctor is reached via the appointment.
  // Walk-in payments may have appointment_id NULL, so use LEFT JOINs.
  const paymentResult = await query(
    `SELECT p.*, a.doctor_id, d.first_name as doctor_first_name, d.last_name as doctor_last_name,
            pat.first_name as patient_first_name, pat.last_name as patient_last_name,
            (SELECT qe.queue_number
               FROM queue_entries qe
               WHERE qe.appointment_id = p.appointment_id
               ORDER BY qe.created_at DESC
               LIMIT 1) AS queue_number
     FROM payments p
     LEFT JOIN appointments a ON p.appointment_id = a.id
     LEFT JOIN doctors d ON a.doctor_id = d.id
     JOIN patients pat ON p.patient_id = pat.id
     WHERE p.id = $1`,
    [paymentId]
  );

  if (paymentResult.rows.length === 0) {
    throw new Error('Payment not found');
  }

  const payment = paymentResult.rows[0];

  // Get charges
  const chargesResult = await query(
    `SELECT * FROM payment_charges 
     WHERE payment_id = $1 AND deleted_at IS NULL 
     ORDER BY created_at ASC`,
    [paymentId]
  );

  // Get transactions
  const transactionsResult = await query(
    `SELECT * FROM payment_transactions 
     WHERE payment_id = $1 
     ORDER BY created_at ASC`,
    [paymentId]
  );

  // Get active invoice
  const invoiceResult = await query(
    `SELECT * FROM invoices 
     WHERE payment_id = $1 AND status = 'ACTIVE' 
     ORDER BY created_at DESC LIMIT 1`,
    [paymentId]
  );

  const billingSummary = await getBillingSummary(paymentId);

  return {
    payment,
    charges: chargesResult.rows,
    transactions: transactionsResult.rows,
    billingSummary,
    activeInvoice: invoiceResult.rows[0] || null,
  };
}

/**
 * Group payment transactions by method for invoice payment breakdown.
 * Combines all Cash payments into one line, all GCash payments into one line
 * with reference numbers listed, and handles refunds as negative lines.
 * 
 * Returns the formatted lines and the total paid amount.
 */
export function groupTransactionsByMethod(
  transactions: Array<{ kind: string; method: string; amount: number; status: string; reference_no?: string }>
): { lines: string[]; totalPaid: number } {
  // Separate payments and refunds by method
  const cashPayments: number[] = [];
  const gcashPayments: { amount: number; reference_no?: string }[] = [];
  let totalPaid = 0;

  for (const tx of transactions) {
    if (tx.status !== 'ACCEPTED') continue; // Only accepted transactions

    const amount = Number(tx.amount) || 0;

    if (tx.kind === 'REFUND') {
      // Refunds reduce the total paid
      if (tx.method === 'CASH') {
        totalPaid -= amount;
      } else if (tx.method === 'GCASH') {
        totalPaid -= amount;
      }
      continue;
    }

    // Kind === 'PAYMENT'
    totalPaid += amount;

    if (tx.method === 'CASH') {
      cashPayments.push(amount);
    } else if (tx.method === 'GCASH') {
      gcashPayments.push({ amount, reference_no: tx.reference_no });
    }
  }

  // Build the lines: Cash first, then GCash
  const lines: string[] = [];

  // Cash line - sum all cash payments
  const cashTotal = cashPayments.reduce((sum, amt) => sum + amt, 0).toFixed(2);
  lines.push(`Cash                          ₱${cashTotal}`);

  // GCash line - sum all GCash payments and list reference numbers
  if (gcashPayments.length > 0) {
    const gcashTotal = gcashPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2);
    const refs = gcashPayments
      .map(p => p.reference_no)
      .filter((ref): ref is string => ref !== null && ref !== undefined && ref !== '')
      .join(', ');
    lines.push(`GCash · Ref: ${refs}          ₱${gcashTotal}`);
  }

  return { lines, totalPaid: Number(totalPaid.toFixed(2)) };
}