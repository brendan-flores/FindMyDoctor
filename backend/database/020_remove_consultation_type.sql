-- FindMyDoctor Remove Consultation Type Migration
-- Removes the consultation_type column from the doctors table
-- Consultation type is now hardcoded to 'In-Person' by default

-- ============================================
-- 1. DROP CONSULTATION TYPE COLUMN
-- ============================================
-- This migration is idempotent and safe to re-run
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doctors' AND column_name = 'consultation_type'
  ) THEN
    ALTER TABLE doctors DROP COLUMN consultation_type;
  END IF;
END $$;

-- Migration complete
