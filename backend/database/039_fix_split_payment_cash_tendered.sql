-- Fix payments that have gcash_advance_amount > 0 but incorrect cash_tendered_amount
-- This ensures split payments (GCash advance + cash) are calculated correctly

UPDATE payments
SET cash_tendered_amount = GREATEST(0, total_amount - gcash_advance_amount)
WHERE gcash_advance_amount > 0
AND (cash_tendered_amount = total_amount OR cash_tendered_amount = 0)
AND status = 'PAID';
