-- Migration: Add waitlists table for patient waitlist feature
-- This table allows patients to join waitlists when appointments are fully booked
-- and be automatically promoted when slots become available

-- Create waitlists table
CREATE TABLE IF NOT EXISTS waitlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    waitlist_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'OFFERED', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
    position INTEGER NOT NULL DEFAULT 1,
    offered_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Unique constraint to prevent duplicate waitlist entries for same patient, doctor, and date
    UNIQUE(patient_id, doctor_id, waitlist_date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_waitlists_doctor_date_status ON waitlists(doctor_id, waitlist_date, status);
CREATE INDEX IF NOT EXISTS idx_waitlists_patient_id ON waitlists(patient_id);

-- Create trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_waitlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_waitlists_updated_at ON waitlists;
CREATE TRIGGER trigger_update_waitlists_updated_at
    BEFORE UPDATE ON waitlists
    FOR EACH ROW
    EXECUTE FUNCTION update_waitlists_updated_at();
