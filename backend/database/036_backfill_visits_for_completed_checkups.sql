-- Migration: Backfill visit records for completed checkups
-- This migration creates visit records for all queue entries that were marked as COMPLETED
-- but didn't have corresponding visit records created (before the auto-creation logic was added)

-- Insert visit records for completed queue entries that don't already have visits
INSERT INTO visits (appointment_id, patient_id, doctor_id, visit_date, created_at, updated_at)
SELECT 
    q.appointment_id,
    q.patient_id,
    q.doctor_id,
    q.completed_at as visit_date,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM queue_entries q
JOIN appointments a ON q.appointment_id = a.id
WHERE q.status = 'COMPLETED'
  AND q.appointment_id IS NOT NULL
  AND q.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM visits v 
    WHERE v.appointment_id = q.appointment_id
  )
ON CONFLICT (appointment_id) DO NOTHING;

-- Log the number of visits created (optional, for verification)
-- Note: This comment is for reference; the actual row count can be checked after running
