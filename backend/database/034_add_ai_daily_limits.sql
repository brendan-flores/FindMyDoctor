-- Add AI daily limits table for per-patient message counting
-- This implements F1: Per-patient daily message limit counted on Asia/Manila calendar day

CREATE TABLE IF NOT EXISTS ai_daily_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    message_date DATE NOT NULL, -- Asia/Manila date
    message_count INTEGER NOT NULL DEFAULT 0,
    last_request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, message_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_limits_patient_date ON ai_daily_limits(patient_id, message_date);

CREATE TRIGGER update_ai_daily_limits_updated_at
    BEFORE UPDATE ON ai_daily_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
