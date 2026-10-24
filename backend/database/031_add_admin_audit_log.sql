-- FindMyDoctor Admin Audit Log Migration
-- Creates an append-only audit log for admin actions
-- This migration is idempotent and safe to run on existing databases

-- ============================================
-- 1. CREATE AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_type VARCHAR(20),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. ADD ACTION TYPE CONSTRAINT
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_admin_audit_log_action'
  ) THEN
    ALTER TABLE admin_audit_log ADD CONSTRAINT check_admin_audit_log_action
      CHECK (action IN (
        'APPROVE_DOCTOR',
        'REJECT_DOCTOR',
        'CREATE_ADMIN',
        'CREATE_SECRETARY',
        'DEACTIVATE_DOCTOR',
        'REACTIVATE_DOCTOR',
        'DEACTIVATE_SECRETARY',
        'REACTIVATE_SECRETARY',
        'DEACTIVATE_ADMIN',
        'REACTIVATE_ADMIN',
        'RESET_SECRETARY_PASSWORD'
      ));
  END IF;
END $$;

-- ============================================
-- 3. ADD TARGET TYPE CONSTRAINT
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_admin_audit_log_target_type'
  ) THEN
    ALTER TABLE admin_audit_log ADD CONSTRAINT check_admin_audit_log_target_type
      CHECK (target_type IN ('DOCTOR', 'SECRETARY', 'ADMIN', 'PATIENT', 'USER'));
  END IF;
END $$;

-- ============================================
-- 4. ADD INDEXES FOR PERFORMANCE
-- ============================================
-- Index for actor queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_user_id ON admin_audit_log(actor_user_id);

-- Index for target queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON admin_audit_log(target_user_id);

-- Index for action type queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);

-- Index for timestamp queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_timestamp ON admin_audit_log(timestamp DESC);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_timestamp ON admin_audit_log(action, timestamp DESC);

-- ============================================
-- 5. ADD COMMENT FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE admin_audit_log IS 'Append-only audit log for administrative actions. Records all approve/reject, create, deactivate/reactivate, and password reset actions performed by admins.';

COMMENT ON COLUMN admin_audit_log.actor_user_id IS 'The admin user who performed the action';
COMMENT ON COLUMN admin_audit_log.action IS 'The type of action performed (e.g., APPROVE_DOCTOR, REJECT_DOCTOR)';
COMMENT ON COLUMN admin_audit_log.target_user_id IS 'The user affected by the action (if applicable)';
COMMENT ON COLUMN admin_audit_log.target_type IS 'The role/type of the target user (DOCTOR, SECRETARY, ADMIN, etc.)';
COMMENT ON COLUMN admin_audit_log.timestamp IS 'When the action occurred (stored in UTC)';
COMMENT ON COLUMN admin_audit_log.reason IS 'Human-readable reason or note for the action (e.g., rejection reason)';
COMMENT ON COLUMN admin_audit_log.metadata IS 'Additional structured data about the action (JSONB)';

-- Migration complete
