-- Add completion status to patient_doctor_associations for walk-in workflow
-- Migration: 024_add_walk_in_completion_status.sql
-- Purpose: Add details_completion_status to distinguish between pending preliminary accounts and completed patient records

-- Add details_completion_status column (nullable initially for migration)
ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS details_completion_status VARCHAR(20);

-- Set completion status based on actual patient data
-- COMPLETE only when all required details are valid and populated:
-- - first_name (non-empty)
-- - last_name (non-empty)
-- - date_of_birth (not NULL)
-- - sex (valid value: MALE, FEMALE, OTHER, NOT_SPECIFIED)
-- - phone (not NULL and non-empty)
-- - address (not NULL and non-empty)
-- Otherwise, mark as PENDING
UPDATE patient_doctor_associations pda
SET details_completion_status = CASE
  WHEN p.first_name IS NOT NULL AND TRIM(p.first_name) <> ''
   AND p.last_name IS NOT NULL AND TRIM(p.last_name) <> ''
   AND p.date_of_birth IS NOT NULL
   AND p.sex IS NOT NULL AND p.sex IN ('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED')
   AND p.phone IS NOT NULL AND TRIM(p.phone) <> ''
   AND p.address IS NOT NULL AND TRIM(p.address) <> ''
  THEN 'COMPLETE'
  ELSE 'PENDING'
END
FROM patients p
WHERE pda.patient_id = p.id
  AND pda.details_completion_status IS NULL;

-- Now make the column NOT NULL
ALTER TABLE patient_doctor_associations ALTER COLUMN details_completion_status SET NOT NULL;

-- Set default to PENDING for new rows (safe default)
ALTER TABLE patient_doctor_associations ALTER COLUMN details_completion_status SET DEFAULT 'PENDING';

-- Add CHECK constraint for completion status values with idempotency safeguard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'patient_doctor_associations'::regclass
      AND conname = 'patient_doctor_associations_details_completion_status_check'
  ) THEN
    ALTER TABLE patient_doctor_associations ADD CONSTRAINT patient_doctor_associations_details_completion_status_check
      CHECK (details_completion_status IN ('PENDING', 'COMPLETE'));
  END IF;
END $$;

-- Add index for query performance
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_completion_status ON patient_doctor_associations(details_completion_status);
