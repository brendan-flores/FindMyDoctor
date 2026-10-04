-- FindMyDoctor Login OTP Challenge State
-- Creates server-side state for login OTP challenges to guarantee true one-time use
-- Stores only secure hash of challenge token, not the raw token
-- This migration is idempotent and safe to run on existing databases

-- Create login_otp_challenges table for server-side OTP challenge state
CREATE TABLE IF NOT EXISTS login_otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    attempt_count INTEGER DEFAULT 0,
    last_otp_sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add last_otp_sent_at column if table exists without it (for existing deployments)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'login_otp_challenges' 
        AND column_name = 'last_otp_sent_at'
    ) THEN
        -- Column already exists, do nothing
    ELSE
        ALTER TABLE login_otp_challenges ADD COLUMN last_otp_sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Index for fast challenge lookup by hash
CREATE INDEX IF NOT EXISTS idx_login_otp_challenges_hash ON login_otp_challenges(challenge_token_hash);

-- Index for cleanup of expired challenges
CREATE INDEX IF NOT EXISTS idx_login_otp_challenges_expires_at ON login_otp_challenges(expires_at);

-- Index for user lookup (for debugging/cleanup)
CREATE INDEX IF NOT EXISTS idx_login_otp_challenges_user_id ON login_otp_challenges(user_id);

-- Function to clean up expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_login_otp_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM login_otp_challenges WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Migration complete
