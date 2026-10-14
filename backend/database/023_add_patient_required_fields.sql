-- Add required patient fields for unified patient record workflow
-- Migration: 023_add_patient_required_fields.sql
-- Purpose: Add middle_name, sex, and patient_doctor_associations table to support required patient details

-- Add middle_name column (optional)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);

-- Add sex column (required) with CHECK constraint
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex VARCHAR(10) NOT NULL DEFAULT 'NOT_SPECIFIED';

-- Add CHECK constraint for sex values with idempotency safeguard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'patients'::regclass
      AND conname = 'patients_sex_check'
  ) THEN
    ALTER TABLE patients ADD CONSTRAINT patients_sex_check
      CHECK (sex IN ('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'));
  END IF;
END $$;

-- Add index on sex for query performance
CREATE INDEX IF NOT EXISTS idx_patients_sex ON patients(sex);

-- Create patient_doctor_associations table to track persistent patient-doctor relationships
-- This allows tracking which doctors a patient has submitted details for, even before the first appointment
CREATE TABLE IF NOT EXISTS patient_doctor_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    first_details_submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, doctor_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_patient_id ON patient_doctor_associations(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_doctor_id ON patient_doctor_associations(doctor_id);

-- Add trigger for updated_at with idempotency safeguard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_patient_doctor_associations_updated_at'
      AND tgrelid = 'patient_doctor_associations'::regclass
  ) THEN
    CREATE TRIGGER update_patient_doctor_associations_updated_at
      BEFORE UPDATE ON patient_doctor_associations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
