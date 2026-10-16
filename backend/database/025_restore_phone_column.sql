-- Migration: 025_restore_phone_column.sql
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
COMMENT ON COLUMN patients.phone IS 'Patient phone number required by the patient-details and profile-completion workflows.';
