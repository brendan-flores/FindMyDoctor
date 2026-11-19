-- ============================================================================
-- 049_add_doctor_signature_url.sql
-- Doctor signature image for professional prescription PDFs.
--
-- Adds a nullable signature_url column to the doctors table. The value is the
-- PRIVATE Supabase Storage object path inside the `doctor-signatures` bucket
-- (for example `doctor_signature_<doctor_id>_<timestamp>.png`). It must never
-- contain a public storage URL; the backend generates short-lived signed URLs
-- for previews and downloads the object with service-role credentials when
-- rendering a prescription PDF.
--
-- The `doctor-signatures` bucket is created manually in the Supabase Dashboard
-- and configured as PRIVATE. This migration does not create storage buckets.
-- ============================================================================

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS signature_url TEXT;

COMMENT ON COLUMN doctors.signature_url IS
  'Private Supabase Storage object path (doctor-signatures bucket) for the doctor''s uploaded signature image. Never a public URL.';
