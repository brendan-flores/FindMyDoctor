-- FindMyDoctor - Relax Doctor Professional Constraints for Basic Registration Flow
--
-- This migration relaxes NOT NULL constraints on professional fields to support
-- the new two-stage doctor registration flow where only basic information is
-- collected initially, and professional information is collected later in the
-- profile completion step.
--
-- Note: Migration 017 only adds contact_number to pending_doctor_signups for the new basic flow.
-- Existing professional columns (specialty, credentials, prc_license_number, practice_name,
-- practice_phone, room_number) remain in pending_doctor_signups for compatibility.
-- Migration 019 ensures these professional columns are nullable to support the basic-only
-- registration flow where professional information is not staged initially.
--
-- Changes:
--   1. Drops NOT NULL constraint from doctors.specialty (no default value)
--   2. Drops NOT NULL constraint from doctors.practice_name (no default value)
--
-- The following fields do NOT need constraint relaxation because they have
-- safe default values from migration 003:
--   - practice_address (default: '')
--   - practice_latitude (default: 0)
--   - practice_longitude (default: 0)
--
-- These changes allow:
--   - Newly verified doctors to be created without specialty and practice_name
--   - Professional information to be added during profile completion
--   - Existing approved doctors to retain their professional data
--
-- This migration is idempotent and safe to re-run on existing databases.
-- No data is deleted or fabricated. Existing doctor profiles remain intact.

-- ============================================
-- RELAX DOCTORS PROFESSIONAL CONSTRAINTS
-- ============================================
-- Allow doctors to be created without specialty and practice_name initially
-- Professional information will be added during profile completion

ALTER TABLE doctors ALTER COLUMN specialty DROP NOT NULL;
ALTER TABLE doctors ALTER COLUMN practice_name DROP NOT NULL;

-- Migration complete
