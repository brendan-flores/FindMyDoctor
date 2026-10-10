-- Add trusted_browsers table for Remember Me functionality
-- This table stores trusted-browser credentials to allow OTP bypass on future logins
-- Migration is idempotent and safe to run on existing databases

CREATE TABLE IF NOT EXISTS trusted_browsers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of the trusted-browser token
  device_info TEXT, -- Optional: user-agent or device description for user identification
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE, -- NULL if active, set when trust is revoked
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookup by user_id and active status
CREATE INDEX IF NOT EXISTS idx_trusted_browsers_user_active ON trusted_browsers(user_id) WHERE revoked_at IS NULL;

-- Index for efficient lookup by token_hash
CREATE INDEX IF NOT EXISTS idx_trusted_browsers_token ON trusted_browsers(token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_trusted_browsers_expires_at ON trusted_browsers(expires_at);

-- Migration complete
