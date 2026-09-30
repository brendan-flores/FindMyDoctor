-- FindMyDoctor Add Room Number to Doctor Profile
--
-- This migration adds a room_number field to track the specific room or suite
-- where a doctor conducts consultations within a medical arts building or clinic.
-- This is particularly useful for facilities like medical arts buildings where
-- doctors have individual consultation rooms.
--
-- This migration is idempotent and safe to re-run.

-- ============================================
-- 1. ADD ROOM_NUMBER TO DOCTORS TABLE
-- ============================================

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS room_number VARCHAR(50);

-- ============================================
-- 2. ADD ROOM_NUMBER TO PENDING_DOCTOR_SIGNUPS TABLE
-- ============================================

ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS room_number VARCHAR(50);

-- ============================================
-- 3. ADD COMMENT
-- ============================================

COMMENT ON COLUMN doctors.room_number IS 'Specific room or suite number where the doctor conducts consultations (e.g., Room 406, Suite 302)';
COMMENT ON COLUMN pending_doctor_signups.room_number IS 'Specific room or suite number where the doctor conducts consultations (staged during OTP verification)';

-- Migration complete
