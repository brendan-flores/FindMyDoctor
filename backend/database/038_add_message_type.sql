-- Migration: Add message type and invoice reference to messages table
-- This enables secretaries to send invoices through chat
-- Messages can be TEXT (default) or INVOICE type
-- INVOICE messages reference an invoice via invoice_id foreign key

-- Add message_type column with TEXT as default
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'INVOICE'));

-- Add invoice_id column as nullable foreign key to invoices
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Add index for efficient invoice lookups
CREATE INDEX IF NOT EXISTS idx_messages_invoice_id ON messages(invoice_id);

-- Add comments to clarify the new columns
COMMENT ON COLUMN messages.message_type IS 'Message type: TEXT for regular messages, INVOICE for invoice attachments';
COMMENT ON COLUMN messages.invoice_id IS 'Reference to the invoice when message_type is INVOICE';
