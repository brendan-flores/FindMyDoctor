-- Sync appointment status with completed queue entries
-- This migration updates appointments to COMPLETED status when their associated queue entry is COMPLETED

UPDATE appointments
SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
WHERE id IN (
    SELECT appointment_id
    FROM queue_entries
    WHERE status = 'COMPLETED'
    AND appointment_id IS NOT NULL
)
AND status != 'COMPLETED';
