-- Add gcash_advance_amount and cash_tendered_amount to payments table
-- This allows tracking both GCash advance payments and cash payments separately
-- for mixed payment scenarios

-- Add gcash_advance_amount column
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
END $$;

-- Add cash_tendered_amount column
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
END $$;

-- Add comments
COMMENT ON COLUMN payments.gcash_advance_amount IS 'Amount paid via GCash advance payment (with receipt upload)';
COMMENT ON COLUMN payments.cash_tendered_amount IS 'Amount paid in cash at the clinic after checkup';
