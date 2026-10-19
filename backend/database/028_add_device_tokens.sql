-- FindMyDoctor Device Tokens for Push Notifications
--
-- Migration: 028_add_device_tokens.sql
--
-- Stores authenticated users' push-notification device tokens so the
-- notification module can deliver FCM/APNs pushes after messaging events
-- (for example NEW_SECRETARY_MESSAGE / NEW_PATIENT_MESSAGE). Tokens belong to
-- their owning user; a token re-registered by the same or another user is
-- reassigned to the latest owner (one device token = one active owner).
--
-- Provider credentials (FCM/APNs) remain backend-only and are read from the
-- backend environment; this table stores only the opaque device tokens.
--
-- This migration is idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'FCM' CHECK (provider IN ('FCM', 'APNS')),
    platform VARCHAR(20) NOT NULL DEFAULT 'ANDROID' CHECK (platform IN ('IOS', 'ANDROID', 'WEB')),
    device_info VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, token)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

-- Migration complete
