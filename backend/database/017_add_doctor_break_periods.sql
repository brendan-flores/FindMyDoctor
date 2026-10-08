-- Migration: Add doctor_break_periods table for break period management
-- This migration creates a table to store break periods within a doctor's working hours
-- Break periods are used to remove availability for specific time ranges on specific dates

-- Add is_active column to doctor_unavailability for soft delete support
ALTER TABLE doctor_unavailability
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add updated_at column to doctor_unavailability for tracking modifications
ALTER TABLE doctor_unavailability
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create doctor_break_periods table
CREATE TABLE IF NOT EXISTS doctor_break_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    break_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_break_time CHECK (start_time < end_time),
    CONSTRAINT unique_break_per_doctor_date_time UNIQUE (doctor_id, break_date, start_time, end_time)
);

-- Create index for efficient querying by doctor and date
CREATE INDEX IF NOT EXISTS idx_doctor_break_periods_doctor_date ON doctor_break_periods(doctor_id, break_date);

-- Create index for active breaks
CREATE INDEX IF NOT EXISTS idx_doctor_break_periods_active ON doctor_break_periods(doctor_id, is_active) WHERE is_active = true;

-- Add comment to table
COMMENT ON TABLE doctor_break_periods IS 'Stores break periods within a doctor''s working hours for specific dates';

COMMENT ON COLUMN doctor_break_periods.is_active IS 'Soft delete flag; inactive breaks do not affect availability';

COMMENT ON COLUMN doctor_unavailability.is_active IS 'Soft delete flag; inactive exceptions do not affect availability';
