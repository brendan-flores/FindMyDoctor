-- Add CANCELLED status to payments table check constraint
ALTER TABLE payments DROP CONSTRAINT payments_status_check;

ALTER TABLE payments ADD CONSTRAINT payments_status_check
CHECK (status::text = ANY(ARRAY['UNPAID'::text, 'PENDING_VERIFICATION'::text, 'PAID'::text, 'REJECTED'::text, 'CANCELLED'::text]));
