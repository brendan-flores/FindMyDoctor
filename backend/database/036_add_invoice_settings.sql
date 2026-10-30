-- Migration: Add invoice settings table for clinic information
-- This table stores clinic information that appears in invoice headers and footers
-- Settings are scoped to the doctor's clinic, with doctor_id as the primary key

CREATE TABLE IF NOT EXISTS invoice_settings (
  doctor_id UUID PRIMARY KEY REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  contact_number TEXT NOT NULL DEFAULT '',
  footer_line TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comment to clarify the table purpose
COMMENT ON TABLE invoice_settings IS 'Clinic invoice settings scoped by doctor. Stores clinic name, address, contact number, and footer line for invoice headers and footers.';

-- Create an index on doctor_id for efficient lookups (already covered by primary key, but explicit for clarity)
-- No additional index needed since doctor_id is the primary key
