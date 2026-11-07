-- Migration: Reconcile billing tables with migration 043 intended schema
-- The live database was created from an earlier schema variant where
-- payment_transactions/invoices void-review FKs referenced secretaries(id)
-- and billing_audit_log used before/after + actor_secretary_id columns.
-- This migration aligns the live schema with 043_add_billing_redesign.sql
-- and consolidated_schema.sql. Safe to re-run (IF EXISTS guards).

-- ============================================
-- payment_transactions: actor FKs must reference users(id)
-- (actors can be PATIENT or SECRETARY, not only secretaries)
-- ============================================
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_created_by_fkey;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_reviewed_by_fkey;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_voided_by_fkey;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_voided_by_fkey
  FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;

-- reference_no type parity with 043 (varchar(100))
ALTER TABLE payment_transactions ALTER COLUMN reference_no TYPE varchar(100);

-- ============================================
-- billing_audit_log: rename before/after to state_before/state_after,
-- drop unused actor_secretary_id (actors are users)
-- ============================================
ALTER TABLE billing_audit_log RENAME COLUMN "before" TO state_before;
ALTER TABLE billing_audit_log RENAME COLUMN "after" TO state_after;
ALTER TABLE billing_audit_log DROP COLUMN IF EXISTS actor_secretary_id;

-- ============================================
-- invoices.voided_by must reference users(id)
-- ============================================
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_voided_by_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_voided_by_fkey
  FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;
