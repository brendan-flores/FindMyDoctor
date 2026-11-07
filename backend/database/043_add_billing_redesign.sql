-- Migration: Add billing redesign tables for payment transactions and audit log
-- This migration creates the new payment_transactions and billing_audit_log tables
-- and adds void/reissue fields to invoices table

-- ============================================
-- NEW TABLE: payment_transactions
-- ============================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL DEFAULT 'PAYMENT' CHECK (kind IN ('PAYMENT', 'REFUND')),
    method VARCHAR(10) NOT NULL CHECK (method IN ('CASH', 'GCASH')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'VOIDED')),
    receipt_url TEXT,
    reference_no VARCHAR(100),
    patient_declared_amount NUMERIC(10,2),
    source VARCHAR(20) NOT NULL DEFAULT 'SECRETARY' CHECK (source IN ('PATIENT_UPLOAD', 'SECRETARY')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reject_reason TEXT,
    reject_note TEXT,
    voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    voided_at TIMESTAMP WITH TIME ZONE,
    void_reason TEXT,
    void_note TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_status ON payment_transactions(payment_id, status);

-- ============================================
-- NEW TABLE: billing_audit_log
-- ============================================
CREATE TABLE IF NOT EXISTS billing_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30),
    entity_id UUID,
    state_before JSONB DEFAULT '{}',
    state_after JSONB DEFAULT '{}',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_log_payment_id ON billing_audit_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_created_at ON billing_audit_log(created_at DESC);

-- ============================================
-- ALTER TABLE: invoices (add void/reissue fields)
-- ============================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS replaces_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS replaced_by_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Add unique constraint for one ACTIVE invoice per payment
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_one_active_per_payment ON invoices(payment_id) WHERE status = 'ACTIVE';

-- ============================================
-- MIGRATE EXISTING DATA
-- ============================================
-- Convert existing advance/cash/receipt payments to payment_transactions
-- This is a safe migration that handles existing data without breaking anything

-- Note: This will be executed in the application code, not in this migration file
-- The migration file only creates the new structure

-- Migration complete
