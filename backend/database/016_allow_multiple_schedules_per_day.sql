-- Migration: Allow multiple schedules per day for the same doctor
-- This removes the UNIQUE constraint on (doctor_id, day_of_week) to support
-- multiple shift blocks on the same day (e.g., morning and afternoon shifts)

-- Remove the unique constraint
ALTER TABLE doctor_schedules DROP CONSTRAINT IF EXISTS doctor_schedules_doctor_id_day_of_week_key;

-- Add a comment to clarify the change
COMMENT ON TABLE doctor_schedules IS 'Doctor schedules for recurring weekly availability. Multiple schedules can exist for the same day (e.g., morning and afternoon shifts).';
