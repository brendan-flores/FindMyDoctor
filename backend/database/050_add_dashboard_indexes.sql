-- Add composite indexes supporting dashboard, queue, and payment queries that
-- filter on two columns together. The single-column indexes already present
-- serve individual filters, but queries such as the secretary and doctor
-- dashboards constrain (doctor_id, queue_date / appointment_date / date) and
-- message unread counts constrain (conversation_id, read_at), so composite
-- indexes avoid index-only scans falling back to table scans at real volumes.
--
-- Justified by actual queries:
--   backend/src/api/secretaries.ts  (GET /secretaries/me/dashboard)
--   backend/src/api/doctors.ts      (GET /doctors/me/dashboard)
--   backend/src/modules/capacity/capacityService.ts (calculateCapacity)
--
-- CREATE INDEX IF NOT EXISTS makes this migration idempotent and safe to
-- re-run. It is purely additive: no data or existing objects are modified.

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id_appointment_date
  ON appointments USING btree (doctor_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_queue_entries_doctor_id_queue_date
  ON queue_entries USING btree (doctor_id, queue_date);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_read_at
  ON messages USING btree (conversation_id, read_at);

CREATE INDEX IF NOT EXISTS idx_daily_capacities_doctor_id_date
  ON daily_capacities USING btree (doctor_id, date);
