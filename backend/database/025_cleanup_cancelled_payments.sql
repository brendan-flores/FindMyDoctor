-- Clean up payments for cancelled appointments
-- Delete CASH payments for cancelled appointments (no refund needed)
-- Mark GCASH payments as CANCELLED (for refund proof)

BEGIN;

-- Delete CASH payments for cancelled appointments
DELETE FROM payment_charges
WHERE payment_id IN (
  SELECT p.id FROM payments p
  JOIN appointments a ON p.appointment_id = a.id
  WHERE a.status = 'CANCELLED' AND p.payment_method = 'CASH'
);

DELETE FROM payments
WHERE appointment_id IN (
  SELECT id FROM appointments WHERE status = 'CANCELLED'
)
AND payment_method = 'CASH';

-- Mark GCASH payments as CANCELLED for cancelled appointments
UPDATE payments
SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
WHERE appointment_id IN (
  SELECT id FROM appointments WHERE status = 'CANCELLED'
)
AND payment_method = 'GCASH'
AND status != 'CANCELLED';

COMMIT;
