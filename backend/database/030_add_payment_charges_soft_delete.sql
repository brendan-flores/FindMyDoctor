-- FindMyDoctor Payment Charges Soft-Delete for Audit Trail
--
-- Migration: 030_add_payment_charges_soft_delete.sql
--
-- Adds deleted_at column to payment_charges table to support audit-preserving
-- soft-delete. When a charge is deleted, deleted_at is set instead of removing
-- the row. This preserves audit history while excluding deleted charges from
-- total calculations via WHERE deleted_at IS NULL filters.
--
-- This migration is idempotent and safe to re-run.

-- Add deleted_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'payment_charges'
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE payment_charges
        ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add index on deleted_at for efficient filtering of active charges
CREATE INDEX IF NOT EXISTS idx_payment_charges_deleted_at
ON payment_charges(deleted_at) WHERE deleted_at IS NULL;

-- Migration complete
