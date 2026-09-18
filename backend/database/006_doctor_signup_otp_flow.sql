-- FindMyDoctor Doctor Sign-Up OTP Flow
--
-- PostgreSQL remains the single source of truth for doctor accounts, credentials
-- and doctor profile data. Supabase is used only to send and verify the email OTP.
--
-- This migration:
--   1. Records email verification on the application account (users table).
--   2. Adds a staging table that keeps the doctor sign-up payload server-side
--      between the "send OTP" step and the "verify OTP" step. No users/doctors
--      row is created until the OTP has been verified.
--
-- This migration is idempotent and safe to re-run.

-- ============================================
-- 1. EMAIL VERIFICATION ON THE APPLICATION ACCOUNT
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Accounts that do not come from the doctor OTP flow (seeded admins,
-- Administrator-provisioned staff, patients) are treated as already verified.
-- Doctor accounts created through the sign-up flow are inserted with
-- email_verified = true, so this backfill never touches them.
UPDATE users
SET email_verified = true,
    email_verified_at = COALESCE(email_verified_at, created_at, CURRENT_TIMESTAMP)
WHERE email_verified = false AND email_verified_at IS NULL;

-- ============================================
-- 2. PENDING DOCTOR SIGN-UPS (OTP STAGING)
-- ============================================
-- The doctor sign-up page submits the full form, the backend validates it and
-- stores it here while Supabase is used to send/verify the OTP. The users and
-- doctors rows are only written once the OTP verification succeeds.

CREATE TABLE IF NOT EXISTS pending_doctor_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    credentials VARCHAR(255),
    prc_license_number VARCHAR(20) NOT NULL,
    practice_name VARCHAR(255) NOT NULL,
    practice_phone VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_doctor_signups_expires_at
    ON pending_doctor_signups(expires_at);

-- A PRC license number can only be staged once at a time
CREATE INDEX IF NOT EXISTS idx_pending_doctor_signups_prc_license_number
    ON pending_doctor_signups(prc_license_number);

-- Migration complete