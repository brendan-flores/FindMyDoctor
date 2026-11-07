-- Migration: Extend payments.status CHECK constraint for billing redesign
-- Source: billing redesign (derived billing statuses PARTIAL and OVERPAID)
-- recalculateBill() writes UNPAID | PENDING_VERIFICATION (for FOR_REVIEW) |
-- PARTIAL | PAID | OVERPAID into payments.status. The old constraint rejected
-- PARTIAL and OVERPAID, so it must be widened.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('UNPAID', 'PENDING_VERIFICATION', 'PARTIAL', 'PAID', 'OVERPAID', 'REJECTED', 'CANCELLED'));
