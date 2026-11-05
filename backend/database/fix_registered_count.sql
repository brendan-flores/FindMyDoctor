-- Fix registered_count in daily_capacities to match actual active queue entries
-- This script updates the registered_count for all dates to match the count of
-- queue entries that are NOT cancelled or no_show

UPDATE daily_capacities dc
SET registered_count = (
  SELECT COUNT(*)
  FROM queue_entries q
  WHERE q.doctor_id = dc.doctor_id
    AND q.queue_date = dc.date
    AND q.status NOT IN ('CANCELLED', 'NO_SHOW')
)
WHERE registered_count != (
  SELECT COUNT(*)
  FROM queue_entries q
  WHERE q.doctor_id = dc.doctor_id
    AND q.queue_date = dc.date
    AND q.status NOT IN ('CANCELLED', 'NO_SHOW')
);

-- To verify the fix, run:
-- SELECT * FROM daily_capacities WHERE date = '2026-11-05';
-- SELECT * FROM queue_entries WHERE queue_date = '2026-11-05' AND status NOT IN ('CANCELLED', 'NO_SHOW');
