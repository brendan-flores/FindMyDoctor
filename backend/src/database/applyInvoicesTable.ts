import { query } from '../database/connection';

/**
 * Migration: Add invoices table for automatic invoice generation
 *
 * This migration creates the invoices table to store generated invoices for paid payments.
 * Each invoice is linked to a payment and includes sequential numbering per clinic/doctor.
 */
async function migrate() {
  try {
    console.log('Starting invoices table migration...');

    // Create the invoices table
    await query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number TEXT NOT NULL,
        payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        advance_payment NUMERIC(10, 2) NOT NULL DEFAULT 0,
        remaining_balance_before_payment NUMERIC(10, 2) NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL,
        cash_tendered NUMERIC(10, 2) NOT NULL DEFAULT 0,
        amount_applied NUMERIC(10, 2) NOT NULL DEFAULT 0,
        change_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        final_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
        invoice_data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (doctor_id, invoice_number)
      )
    `);
    console.log('✓ Created invoices table');

    // Add indexes for efficient lookups
    await query(`CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON invoices(payment_id)`);
    console.log('✓ Created index on payment_id');

    await query(`CREATE INDEX IF NOT EXISTS idx_invoices_doctor_id ON invoices(doctor_id)`);
    console.log('✓ Created index on doctor_id');

    await query(`CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id)`);
    console.log('✓ Created index on patient_id');

    await query(`CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date)`);
    console.log('✓ Created index on invoice_date');

    // Add comments to clarify the table purpose
    await query(`
      COMMENT ON TABLE invoices IS 'Stores generated invoices for paid payments. Includes sequential invoice numbering per doctor/clinic, payment breakdown, and invoice data for PDF generation.'
    `);
    console.log('✓ Added table comment');

    await query(`COMMENT ON COLUMN invoices.invoice_number IS 'Sequential invoice number per doctor/clinic (e.g., INV-0001)'`);
    await query(`COMMENT ON COLUMN invoices.payment_id IS 'Reference to the payment record'`);
    await query(`COMMENT ON COLUMN invoices.subtotal IS 'Subtotal before payments (consultation + charges)'`);
    await query(`COMMENT ON COLUMN invoices.total_amount IS 'Total amount due (subtotal)'`);
    await query(`COMMENT ON COLUMN invoices.advance_payment IS 'Advance payment amount (e.g., GCash advance)'`);
    await query(`COMMENT ON COLUMN invoices.remaining_balance_before_payment IS 'Balance before current payment'`);
    await query(`COMMENT ON COLUMN invoices.cash_tendered IS 'Cash amount tendered by patient'`);
    await query(`COMMENT ON COLUMN invoices.amount_applied IS 'Amount applied to payment'`);
    await query(`COMMENT ON COLUMN invoices.change_amount IS 'Change returned to patient (if cash_tendered > amount_applied)'`);
    await query(`COMMENT ON COLUMN invoices.final_balance IS 'Final remaining balance after payment'`);
    await query(`COMMENT ON COLUMN invoices.invoice_data IS 'JSONB field storing complete invoice data for PDF generation (charges, patient info, clinic details, etc.)'`);
    console.log('✓ Added column comments');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
