-- Add remember_me column to login_otp_challenges table
-- This stores the user's Remember Me preference during OTP verification
-- This migration is idempotent and safe to run on existing databases

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'login_otp_challenges' 
        AND column_name = 'remember_me'
    ) THEN
        -- Column already exists, do nothing
    ELSE
        ALTER TABLE login_otp_challenges ADD COLUMN remember_me BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Migration complete
