-- Add GCash QR URL column to doctors table
-- This allows each doctor to have their own GCash QR code for payments
-- The QR code is managed by secretaries through the web dashboard

ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS gcash_qr_url VARCHAR(500);

-- Add index for faster queries if needed
CREATE INDEX IF NOT EXISTS idx_doctors_gcash_qr_url ON doctors(gcash_qr_url) WHERE gcash_qr_url IS NOT NULL;
