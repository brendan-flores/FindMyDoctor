-- FindMyDoctor Patient Sign-Up OTP Flow - Detailed Patient Information
--
-- Migration: 026_add_pending_patient_signup_details.sql
--
-- The patient sign-up page now collects the full set of required patient
-- details (separate first/middle/last names, date of birth, sex, mobile
-- number and address). Because the account is only created after the OTP is
-- verified, this migration extends the staging table so every field captured
-- during sign-up is persisted server-side until verification succeeds.
--
-- This migration is idempotent and safe to re-run.

-- ============================================
-- EXTEND PENDING PATIENT SIGN-UPS (OTP STAGING)
-- ============================================

-- Optional middle name (maximum 100 characters)
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);

-- Required date of birth
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Required sex, constrained to the values accepted by the patients table
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS sex VARCHAR(20) NOT NULL DEFAULT 'NOT_SPECIFIED';

-- Required mobile number (maximum 20 characters)
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Required address
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS address TEXT;

-- CHECK constraint for sex values with idempotency safeguard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'pending_patient_signups'::regclass
      AND conname = 'pending_patient_signups_sex_check'
  ) THEN
    ALTER TABLE pending_patient_signups ADD CONSTRAINT pending_patient_signups_sex_check
      CHECK (sex IN ('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'));
  END IF;
END $$;

-- Migration complete
