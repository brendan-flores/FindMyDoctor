import { query } from '../database/connection';

/**
 * Migration: Add medicine charge fields to payment_charges table
 *
 * This migration adds support for medicine charges in payment_charges:
 * - charge_type: Distinguishes between ADDITIONAL and MEDICINE charges
 * - prescription_item_id: Optional link to prescription_items for medicine charges
 * - quantity: Number of units for medicine charges
 * - unit_price: Price per unit for medicine charges
 *
 * Existing ADDITIONAL charges remain backward compatible:
 * - charge_type defaults to 'ADDITIONAL'
 * - New fields are nullable
 * - No existing data is modified
 */
async function migrate() {
  try {
    console.log('Starting medicine charge fields migration...');

    // Add charge_type column with constraint and default
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'payment_charges'
              AND column_name = 'charge_type'
          ) THEN
              ALTER TABLE payment_charges
              ADD COLUMN charge_type VARCHAR(20) NOT NULL DEFAULT 'ADDITIONAL'
              CHECK (charge_type IN ('ADDITIONAL', 'MEDICINE'));
          END IF;
      END $$
    `);
    console.log('✓ Added charge_type column (if not exists)');

    // Add prescription_item_id column (nullable, optional FK to prescription_items)
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'payment_charges'
              AND column_name = 'prescription_item_id'
          ) THEN
              ALTER TABLE payment_charges
              ADD COLUMN prescription_item_id UUID REFERENCES prescription_items(id) ON DELETE SET NULL;
          END IF;
      END $$
    `);
    console.log('✓ Added prescription_item_id column (if not exists)');

    // Add quantity column (nullable, for medicine charges)
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'payment_charges'
              AND column_name = 'quantity'
          ) THEN
              ALTER TABLE payment_charges
              ADD COLUMN quantity INTEGER;
          END IF;
      END $$
    `);
    console.log('✓ Added quantity column (if not exists)');

    // Add unit_price column (nullable, for medicine charges)
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'payment_charges'
              AND column_name = 'unit_price'
          ) THEN
              ALTER TABLE payment_charges
              ADD COLUMN unit_price DECIMAL(10,2);
          END IF;
      END $$
    `);
    console.log('✓ Added unit_price column (if not exists)');

    // Add index on prescription_item_id for efficient lookup
    await query(`
      CREATE INDEX IF NOT EXISTS idx_payment_charges_prescription_item_id
      ON payment_charges(prescription_item_id) WHERE prescription_item_id IS NOT NULL
    `);
    console.log('✓ Created index on prescription_item_id column');

    // Add index on charge_type for efficient filtering
    await query(`
      CREATE INDEX IF NOT EXISTS idx_payment_charges_charge_type
      ON payment_charges(charge_type)
    `);
    console.log('✓ Created index on charge_type column');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
