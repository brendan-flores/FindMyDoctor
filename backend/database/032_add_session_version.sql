-- Add a per-user session version used to revoke refresh tokens.
-- Every password change, password reset, account deactivation, or
-- "sign out of all devices" increments this value. Refresh tokens carry the
-- value they were issued with and are rejected once it no longer matches.
-- This migration is idempotent and only adds a column; it never deletes data.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

-- Migration complete
