-- FindMyDoctor Two-Factor Authentication Settings
-- Adds two_factor_enabled column to doctors and secretaries tables for optional 2FA
-- This migration is idempotent and safe to run on existing databases

-- Add two_factor_enabled to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;

-- Add two_factor_enabled to secretaries table
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;

-- Admin does NOT need this column - regular Admin OTP is mandatory, while SuperAdmins bypass OTP
-- Existing accounts default to 2FA OFF (opt-in)

-- Migration complete
