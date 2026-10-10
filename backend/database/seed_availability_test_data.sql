-- Seed availability test data
-- This script creates test data for the availability endpoint

-- First, get a doctor ID (you'll need to replace this with an actual doctor ID)
-- Uncomment and modify the line below with your actual doctor ID
-- DO DO SET @doctor_id = 'your-doctor-uuid-here';

-- Clear existing test data for the doctor (replace UUID)
-- DELETE FROM doctor_schedules WHERE doctor_id = 'your-doctor-uuid-here';
-- DELETE FROM doctor_break_periods WHERE doctor_id = 'your-doctor-uuid-here';
-- DELETE FROM doctor_unavailability WHERE doctor_id = 'your-doctor-uuid-here';
-- DELETE FROM daily_capacities WHERE doctor_id = 'your-doctor-uuid-here';

-- Add weekly schedules (Monday, Wednesday, Friday: 9 AM - 5 PM)
-- Replace 'your-doctor-uuid-here' with actual doctor ID
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active) 
VALUES 
  ('your-doctor-uuid-here', 1, '09:00', '17:00', true), -- Monday
  ('your-doctor-uuid-here', 3, '09:00', '17:00', true), -- Wednesday
  ('your-doctor-uuid-here', 5, '09:00', '17:00', true)  -- Friday
ON CONFLICT (doctor_id, day_of_week) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  is_active = true;

-- Add a break period for today
INSERT INTO doctor_break_periods (doctor_id, break_date, start_time, end_time, reason, is_active)
VALUES ('your-doctor-uuid-here', CURRENT_DATE, '12:00', '13:00', 'Lunch break', true)
ON CONFLICT (doctor_id, break_date, start_time, end_time) DO NOTHING;

-- Add a full-day unavailability for tomorrow
INSERT INTO doctor_unavailability (doctor_id, start_date, end_date, reason, is_active)
VALUES ('your-doctor-uuid-here', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 'Personal leave', true)
ON CONFLICT DO NOTHING;

-- Initialize daily capacities for the next 30 days (for working days only)
-- This is a sample - you may need to run this with a script that generates dates
INSERT INTO daily_capacities (doctor_id, date, consultation_duration_minutes, calculated_capacity, final_capacity, registered_count)
SELECT 
  'your-doctor-uuid-here',
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
