-- ============================================================================
-- 047_add_schedule_change_requests.sql
-- Schedule-change confirmation workflow
--
-- Adds:
--   1. Appointment "needs attention" flag columns on appointments (there was
--      no equivalent mechanism before this migration).
--   2. schedule_change_requests table storing proposed EXCEPTION/BREAK
--      changes (CREATE/UPDATE/DELETE) that affect active future appointments
--      and therefore wait for secretary confirmation.
-- ============================================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS needs_attention boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_attention_reason text,
  ADD COLUMN IF NOT EXISTS needs_attention_flagged_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS schedule_change_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    change_type character varying(20) NOT NULL,
    operation character varying(10) NOT NULL,
    proposed_payload jsonb NOT NULL,
    target_id uuid,
    affected_count integer NOT NULL DEFAULT 0,
    affected_appointment_ids uuid[] NOT NULL DEFAULT '{}',
    status character varying(10) NOT NULL DEFAULT 'PENDING',
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    CONSTRAINT schedule_change_requests_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_change_requests_change_type_check CHECK (((change_type)::text = ANY ((ARRAY['EXCEPTION'::character varying, 'BREAK'::character varying])::text[]))),
    CONSTRAINT schedule_change_requests_operation_check CHECK (((operation)::text = ANY ((ARRAY['CREATE'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::text[]))),
    CONSTRAINT schedule_change_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'CONFIRMED'::character varying, 'DISMISSED'::character varying])::text[])))
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='schedule_change_requests'::regclass AND conname='schedule_change_requests_doctor_id_fkey') THEN
    ALTER TABLE schedule_change_requests ADD CONSTRAINT schedule_change_requests_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='schedule_change_requests'::regclass AND conname='schedule_change_requests_requested_by_fkey') THEN
    ALTER TABLE schedule_change_requests ADD CONSTRAINT schedule_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='schedule_change_requests'::regclass AND conname='schedule_change_requests_resolved_by_fkey') THEN
    ALTER TABLE schedule_change_requests ADD CONSTRAINT schedule_change_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_doctor_status ON schedule_change_requests USING btree (doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_status ON schedule_change_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_target_id ON schedule_change_requests USING btree (target_id) WHERE (target_id IS NOT NULL);
-- Backstop for the application-level duplicate-pending check: at most one
-- PENDING request may exist per target record.
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_change_requests_pending_target_id ON schedule_change_requests USING btree (target_id) WHERE (status = 'PENDING'::text AND target_id IS NOT NULL);

DROP TRIGGER IF EXISTS update_schedule_change_requests_updated_at ON schedule_change_requests;
CREATE TRIGGER update_schedule_change_requests_updated_at BEFORE UPDATE ON schedule_change_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
