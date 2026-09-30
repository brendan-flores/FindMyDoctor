-- Add middle_name field to doctors and pending_doctor_signups tables
-- This migration is idempotent and safe to re-run

-- Add middle_name to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);

-- Add middle_name to pending_doctor_signups table
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);

-- Migration complete
