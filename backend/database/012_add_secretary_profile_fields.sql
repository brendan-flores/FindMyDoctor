-- FindMyDoctor Secretary Profile Fields Migration
-- Adds middle_name and contact_number to secretaries table for Step 3 profile completion
-- This migration is idempotent and safe to run on existing databases

-- Add middle_name field (optional)
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);

-- Add contact_number field (required)
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);

-- Migration complete
