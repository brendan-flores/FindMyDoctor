-- Add test schedules for doctor abdol Abar (ID: 28fd7121-7f97-433e-9d14-0ef6a669c3b7)
-- This creates schedules for Monday, Wednesday, Friday: 9 AM - 5 PM

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active) 
VALUES 
  ('28fd7121-7f97-433e-9d14-0ef6a669c3b7', 1, '09:00', '17:00', true), -- Monday
  ('28fd7121-7f97-433e-9d14-0ef6a669c3b7', 3, '09:00', '17:00', true), -- Wednesday
  ('28fd7121-7f97-433e-9d14-0ef6a669c3b7', 5, '09:00', '17:00', true)  -- Friday
ON CONFLICT (doctor_id, day_of_week) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  is_active = true;

-- Add a break period for today (2026-10-09 is Thursday, so let's add it for Monday 2026-10-13)
INSERT INTO doctor_break_periods (doctor_id, break_date, start_time, end_time, reason, is_active)
VALUES ('28fd7121-7f97-433e-9d14-0ef6a669c3b7', '2026-10-13', '12:00', '13:00', 'Lunch break', true)
ON CONFLICT (doctor_id, break_date, start_time, end_time) DO NOTHING;

-- Add a full-day unavailability for Wednesday 2026-10-15
INSERT INTO doctor_unavailability (doctor_id, start_date, end_date, reason, is_active)
VALUES ('28fd7121-7f97-433e-9d14-0ef6a669c3b7', '2026-10-15', '2026-10-15', 'Personal leave', true)
ON CONFLICT DO NOTHING;

-- Initialize daily capacities for the next 30 days (for working days only)
INSERT INTO daily_capacities (doctor_id, date, consultation_duration_minutes, calculated_capacity, final_capacity, registered_count)
SELECT 
  '28fd7121-7f97-433e-9d14-0ef6a669c3b7',
  CURRENT_DATE + (n || ' days')::interval,
  30, -- 30 minute consultation
  16, -- 8 hours / 30 min = 16 slots
  16, -- final capacity
  0   -- registered count
FROM generate_series(0, 29) AS n
WHERE EXTRACT(DOW FROM (CURRENT_DATE + (n || ' days')::interval)) IN (1, 3, 5) -- Mon, Wed, Fri
ON CONFLICT (doctor_id, date) DO UPDATE SET
  calculated_capacity = EXCLUDED.calculated_capacity,
  final_capacity = EXCLUDED.final_capacity,
  registered_count = EXCLUDED.registered_count;
