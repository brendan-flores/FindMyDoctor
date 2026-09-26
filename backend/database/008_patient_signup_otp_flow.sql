-- FindMyDoctor Patient Sign-Up OTP Flow
--
-- PostgreSQL remains the single source of truth for patient accounts, credentials
-- and patient profile data. Supabase is used only to send and verify the email OTP.
--
-- This migration:
--   1. Adds a staging table that keeps the patient sign-up payload server-side
--      between the "send OTP" step and the "verify OTP" step. No users/patients
--      row is created until the OTP has been verified.
--
-- This migration is idempotent and safe to re-run.

-- ============================================
-- PENDING PATIENT SIGN-UPS (OTP STAGING)
-- ============================================
-- The patient sign-up page submits the full form, the backend validates it and
-- stores it here while Supabase is used to send/verify the OTP. The users and
-- patients rows are only written once the OTP verification succeeds.

CREATE TABLE IF NOT EXISTS pending_patient_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_patient_signups_expires_at
    ON pending_patient_signups(expires_at);

CREATE INDEX IF NOT EXISTS idx_pending_patient_signups_email
    ON pending_patient_signups(email);

-- Migration complete