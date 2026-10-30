import { query } from '../database/connection';

/**
 * Migration: Add invoice settings table for clinic information
 *
 * This migration creates the invoice_settings table to store clinic information
 * that appears in invoice headers and footers. Settings are scoped to the doctor's clinic.
 */
async function migrate() {
  try {
    console.log('Starting invoice settings migration...');

    // Create the invoice_settings table
    await query(`
      CREATE TABLE IF NOT EXISTS invoice_settings (
        doctor_id UUID PRIMARY KEY REFERENCES doctors(id) ON DELETE CASCADE,
        clinic_name TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        contact_number TEXT NOT NULL DEFAULT '',
        footer_line TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created invoice_settings table');

    // Add comment to clarify the table purpose
    await query(`
      COMMENT ON TABLE invoice_settings IS 'Clinic invoice settings scoped by doctor. Stores clinic name, address, contact number, and footer line for invoice headers and footers.'
    `);
    console.log('✓ Added table comment');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
