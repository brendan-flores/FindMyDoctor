-- FindMyDoctor Secretary Nullable Names Migration
-- Allows Secretary creation without first_name and last_name
-- These fields will be completed by the Secretary in Step 3 (profile completion)
-- This migration is idempotent and safe to run on existing databases

-- Remove NOT NULL constraint from first_name
ALTER TABLE secretaries ALTER COLUMN first_name DROP NOT NULL;

-- Remove NOT NULL constraint from last_name
ALTER TABLE secretaries ALTER COLUMN last_name DROP NOT NULL;

-- Migration complete
