-- Migration: Add status field to invoices table for voiding and reissue workflow
-- This allows invoices to be marked as VOID while preserving data for audit trail

-- Add status column with default ACTIVE
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Add check constraint to ensure only valid status values
ALTER TABLE invoices
ADD CONSTRAINT chk_invoice_status
CHECK (status IN ('ACTIVE', 'VOID'));

-- Add index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Update any existing invoices to ACTIVE (should already be default, but ensuring consistency)
UPDATE invoices SET status = 'ACTIVE' WHERE status IS NULL;

-- Add comments to clarify the status field
COMMENT ON COLUMN invoices.status IS 'Invoice status: ACTIVE (current/valid) or VOID (cancelled/for audit only). Voided invoices cannot be downloaded or edited.';
