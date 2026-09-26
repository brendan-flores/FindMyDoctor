-- FindMyDoctor Patient Username Migration
--
-- This migration:
--   1. Adds username field to users table
--   2. Removes phone field from patients table
--   3. Updates pending_patient_signups table to use username instead of phone
--
-- This migration is idempotent and safe to re-run.

-- ============================================
-- ADD USERNAME TO USERS TABLE
-- ============================================

-- Add username column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Add index for username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- UPDATE PENDING PATIENT SIGNUPS TABLE
-- ============================================

-- Rename phone column to username in pending_patient_signups
ALTER TABLE pending_patient_signups RENAME COLUMN phone TO username;

-- Update the column type and constraints
ALTER TABLE pending_patient_signups 
  ALTER COLUMN username TYPE VARCHAR(50),
  ALTER COLUMN username SET NOT NULL;

-- ============================================
-- REMOVE PHONE FROM PATIENTS TABLE
-- ============================================

-- Drop phone column from patients table
ALTER TABLE patients DROP COLUMN IF EXISTS phone;

-- Migration complete