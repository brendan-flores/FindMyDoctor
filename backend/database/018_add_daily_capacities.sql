-- Add daily_capacities table for capacity management
CREATE TABLE IF NOT EXISTS daily_capacities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    consultation_duration_minutes INTEGER DEFAULT 30,
    calculated_capacity INTEGER NOT NULL,
    configured_capacity INTEGER,
    final_capacity INTEGER NOT NULL,
    registered_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_capacities_doctor_id ON daily_capacities(doctor_id);
CREATE INDEX IF NOT EXISTS idx_daily_capacities_date ON daily_capacities(date);
