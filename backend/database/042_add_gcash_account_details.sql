-- Migration: Add GCash account details to doctors table
-- Adds nullable columns for storing GCash account name and number
-- These will be displayed to patients alongside the GCash QR code

-- Add gcash_account_name column
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS gcash_account_name VARCHAR(100);

-- Add gcash_account_number column
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS gcash_account_number VARCHAR(20);

-- Add comment to document the purpose
COMMENT ON COLUMN doctors.gcash_account_name IS 'GCash account name (e.g., "Maria Santos") displayed to patients for payment';
COMMENT ON COLUMN doctors.gcash_account_number IS 'GCash account number (Philippian mobile format: 09XXXXXXXXX) displayed to patients for payment';
