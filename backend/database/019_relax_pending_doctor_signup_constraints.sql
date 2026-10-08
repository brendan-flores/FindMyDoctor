-- FindMyDoctor - Relax Pending Doctor Signups Professional Constraints for Basic Flow
--
-- This migration ensures pending_doctor_signups supports the new basic-only
-- registration flow while preserving all existing professional columns for
-- compatibility with the existing working project.
--
-- The new basic registration flow does not collect professional information
-- during signup, so the professional columns must be nullable to allow
-- basic-only staging in pending_doctor_signups.
--
-- This migration handles three scenarios:
-- 1. Fresh database: Migration 006 created columns as NOT NULL → this migration relaxes them
-- 2. Restored database: Earlier destructive migration 017 dropped columns → this migration restores them as nullable
-- 3. Existing database: Columns already nullable → this migration is idempotent
--
-- This migration is idempotent and safe to re-run on existing databases.

-- ============================================
-- RESTORE PROFESSIONAL COLUMNS (IF MISSING)
-- ============================================
-- For databases where columns were dropped by earlier destructive migration 017
-- Restoring to original definitions from migration 006 and 009, but as nullable

ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS specialty VARCHAR(100);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS credentials VARCHAR(255);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS prc_license_number VARCHAR(20);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS practice_name VARCHAR(255);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS practice_phone VARCHAR(20);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS room_number VARCHAR(50);

-- ============================================
-- RELAX NOT NULL CONSTRAINTS
-- ============================================
-- For fresh databases where migration 006 created these as NOT NULL
-- Also ensures restored columns are properly nullable
-- The new basic flow needs these to be nullable to allow staging without professional info

ALTER TABLE pending_doctor_signups ALTER COLUMN specialty DROP NOT NULL;
ALTER TABLE pending_doctor_signups ALTER COLUMN prc_license_number DROP NOT NULL;
ALTER TABLE pending_doctor_signups ALTER COLUMN practice_name DROP NOT NULL;

-- ============================================
-- RESTORE PRC LICENSE NUMBER INDEX
-- ============================================
-- For databases where the index was dropped by earlier destructive migration 017
CREATE INDEX IF NOT EXISTS idx_pending_doctor_signups_prc_license_number
    ON pending_doctor_signups(prc_license_number);

-- ============================================
-- ADD COMMENTS
-- ============================================
-- For databases where the comment was dropped by earlier destructive migration 017
COMMENT ON COLUMN pending_doctor_signups.room_number IS 'Specific room or suite number where the doctor conducts consultations (staged during OTP verification)';

-- Migration complete
