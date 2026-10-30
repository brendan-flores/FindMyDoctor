-- Add amount_paid field to payments table for balance tracking
-- This enables tracking partial payments and calculating balances

-- Add amount_paid column with default 0
ALTER TABLE payments
ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0.00 NOT NULL;

-- Backfill existing PAID payments to have amount_paid = total_amount
-- This ensures historical payment balances remain consistent
UPDATE payments
SET amount_paid = total_amount
WHERE status = 'PAID';

-- Add comment for documentation
COMMENT ON COLUMN payments.amount_paid IS 'Total amount paid so far (partial or full payment). Balance = total_amount - amount_paid';
