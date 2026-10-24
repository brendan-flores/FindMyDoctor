-- Track when a doctor's GCash QR code was last uploaded.
-- doctors.updated_at is shared with profile and photo edits, so it cannot be
-- used as "QR last updated". This column is set only by the GCash QR upload
-- and cleared by QR deletion.
-- Idempotent and safe to re-run.

ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS gcash_qr_updated_at TIMESTAMP WITH TIME ZONE;
