-- FindMyDoctor Service/Other Charge Types
--
-- Migration: 046_add_service_other_charge_types.sql
--
-- Allows secretaries to categorise additional bill lines as SERVICE or OTHER
-- (in addition to the existing ADDITIONAL and MEDICINE types). The add-charge
-- form uses one row for all types: Type, Name, Qty, Unit price.
--
-- This migration is idempotent and safe to re-run.

DO $$
BEGIN
    ALTER TABLE payment_charges DROP CONSTRAINT IF EXISTS payment_charges_charge_type_check;
    ALTER TABLE payment_charges
        ADD CONSTRAINT payment_charges_charge_type_check
        CHECK (charge_type IN ('ADDITIONAL', 'MEDICINE', 'SERVICE', 'OTHER'));
END $$;

-- Migration complete
