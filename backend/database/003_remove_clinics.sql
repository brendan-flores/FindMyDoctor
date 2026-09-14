-- Migration to remove clinics as a separate entity
-- This migration removes clinic tables and moves practice information into doctor profiles

-- Drop foreign key constraints first
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_clinic_id_fkey;
ALTER TABLE secretaries DROP CONSTRAINT IF EXISTS secretaries_clinic_id_fkey;
ALTER TABLE daily_capacities DROP CONSTRAINT IF EXISTS daily_capacities_clinic_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_clinic_id_fkey;
ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_clinic_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_clinic_id_fkey;
ALTER TABLE waitlists DROP CONSTRAINT IF EXISTS waitlists_clinic_id_fkey;

-- Drop clinic-related columns
ALTER TABLE doctors DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE secretaries DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE daily_capacities DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE queue_entries DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE waitlists DROP COLUMN IF EXISTS clinic_id;

-- Add practice information columns to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_address TEXT NOT NULL DEFAULT '';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_latitude DECIMAL(10, 8) NOT NULL DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_longitude DECIMAL(11, 8) NOT NULL DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_phone VARCHAR(20);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_email VARCHAR(255);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_description TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS operating_hours_start TIME;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS operating_hours_end TIME;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gcash_qr_code_url TEXT;

-- Add doctor_id column to secretaries table to associate secretaries with doctors
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE;

-- Add doctor_id column to conversations table to associate conversations with doctors
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE;

-- Update unique constraint on conversations
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'conversations_patient_id_secretary_id_clinic_id_key'
    ) THEN
        ALTER TABLE conversations DROP CONSTRAINT conversations_patient_id_secretary_id_clinic_id_key;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'conversations_patient_id_secretary_id_doctor_id_key'
    ) THEN
        ALTER TABLE conversations ADD CONSTRAINT conversations_patient_id_secretary_id_doctor_id_key UNIQUE(patient_id, secretary_id, doctor_id);
    END IF;
END $$;

-- Drop clinic-related indexes
DROP INDEX IF EXISTS idx_doctors_clinic_id;
DROP INDEX IF EXISTS idx_secretaries_clinic_id;
DROP INDEX IF EXISTS idx_appointments_clinic_id;
DROP INDEX IF EXISTS idx_conversations_clinic_id;

-- Add new indexes for doctor_id relationships
CREATE INDEX IF NOT EXISTS idx_secretaries_doctor_id ON secretaries(doctor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_doctor_id ON conversations(doctor_id);

-- Drop clinic table
DROP TABLE IF EXISTS clinics CASCADE;

-- Drop doctor-clinics junction table
DROP TABLE IF EXISTS doctor_clinics CASCADE;

-- Drop clinics trigger
DROP TRIGGER IF EXISTS update_clinics_updated_at ON clinics;

-- Migration complete
