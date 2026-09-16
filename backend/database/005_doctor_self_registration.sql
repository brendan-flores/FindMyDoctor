-- FindMyDoctor Doctor Self-Registration
-- Adds the PRC license number captured by the doctor sign-up page and relaxes
-- the practice location fields so a self-registered doctor can create an
-- account without a full practice address.
-- This migration is idempotent and safe to re-run.

-- PRC license number captured on the doctor sign-up page
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS prc_license_number VARCHAR(20);

-- A PRC license number may only be registered once (ignores NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_prc_license_number
    ON doctors(prc_license_number)
    WHERE prc_license_number IS NOT NULL;

-- Practice location details are optional at self-registration time
ALTER TABLE doctors ALTER COLUMN practice_address SET DEFAULT '';
ALTER TABLE doctors ALTER COLUMN practice_latitude SET DEFAULT 0;
ALTER TABLE doctors ALTER COLUMN practice_longitude SET DEFAULT 0;

-- Migration complete
