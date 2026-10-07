-- FindMyDoctor Doctor Profile Flow - Add Contact Number to Pending Doctor Signups
--
-- This migration adds a contact_number field to the pending_doctor_signups table
-- to support the new doctor registration flow where only basic information is
-- collected initially, and professional information is collected later in the
-- profile completion step.
--
-- Changes:
--   1. Adds contact_number field (doctor's personal contact number)
--
-- The new basic flow stages: email, password_hash, first_name, last_name,
-- middle_name, contact_number. Professional information will be collected and
-- stored directly during the profile completion step.
--
-- Existing professional columns (specialty, credentials, prc_license_number,
-- practice_name, practice_phone, room_number) remain in the table for compatibility.
-- The new basic flow simply does not use or require these fields.
--
-- This migration is idempotent and safe to re-run on existing databases

-- ============================================
-- ADD CONTACT NUMBER FIELD
-- ============================================
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);

-- Migration complete
