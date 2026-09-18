-- FindMyDoctor Doctor Approval States Migration
-- Adds three-state approval workflow (PENDING, ACTIVE, REJECTED) while preserving existing is_approved field
-- This migration is additive and safe to run on existing databases

-- ============================================
-- 1. ADD APPROVAL STATUS FIELD
-- ============================================
-- Add approval_status column for three-state workflow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'doctors' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE doctors ADD COLUMN approval_status VARCHAR(20);
    ALTER TABLE doctors ADD CONSTRAINT check_approval_status 
      CHECK (approval_status IN ('PENDING', 'ACTIVE', 'REJECTED'));
  END IF;
END $$;

-- Add review tracking fields
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================
-- 2. MIGRATE EXISTING DATA SAFELY
-- ============================================
-- Existing is_approved = true → ACTIVE
-- Existing is_approved = false → PENDING  
UPDATE doctors 
SET approval_status = CASE 
  WHEN is_approved = true THEN 'ACTIVE'
  ELSE 'PENDING'
END
WHERE approval_status IS NULL;

-- ============================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- ============================================
-- Add index for approval status queries
CREATE INDEX IF NOT EXISTS idx_doctors_approval_status ON doctors(approval_status);

-- ============================================
-- 4. BACKWARD COMPATIBILITY
-- ============================================
-- Keep is_approved field for backward compatibility during transition
-- New code should use approval_status, old code can still use is_approved

-- Migration complete