import { query } from '../database/connection';

/**
 * Migration: Add message type and invoice reference to messages table
 *
 * This migration enables secretaries to send invoices through chat.
 * Messages can be TEXT (default) or INVOICE type.
 * INVOICE messages reference an invoice via invoice_id foreign key.
 */
async function migrate() {
  try {
    console.log('Starting message type migration...');

    // Add message_type column with TEXT as default
    await query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'INVOICE'))
    `);
    console.log('✓ Added message_type column');

    // Add invoice_id column as nullable foreign key to invoices
    await query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL
    `);
    console.log('✓ Added invoice_id column');

    // Add index for efficient invoice lookups
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_invoice_id ON messages(invoice_id)`);
    console.log('✓ Created index on invoice_id');

    // Add comments to clarify the new columns
    await query(`COMMENT ON COLUMN messages.message_type IS 'Message type: TEXT for regular messages, INVOICE for invoice attachments'`);
    await query(`COMMENT ON COLUMN messages.invoice_id IS 'Reference to the invoice when message_type is INVOICE'`);
    console.log('✓ Added column comments');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
