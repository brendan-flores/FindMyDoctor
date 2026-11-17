-- 048_consultation_workspace.sql
-- Consultation workspace: draft visits, issuance, prescription void/replace,
-- visit edit history, per-doctor prescription favorites and allergy/medication
-- "confirmed none" states.

-- ---------------------------------------------------------------------------
-- Visits: draft/issued lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE visits ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'DRAFT';

-- Every visit that predates this migration is treated as final/issued.
UPDATE visits SET status = 'ISSUED' WHERE status = 'DRAFT';

ALTER TABLE visits ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP WITH TIME ZONE;
UPDATE visits
   SET issued_at = COALESCE(updated_at, created_at, visit_date)
 WHERE issued_at IS NULL AND status = 'ISSUED';

ALTER TABLE visits ADD COLUMN IF NOT EXISTS doctor_finished_at TIMESTAMP WITH TIME ZONE;
UPDATE visits
   SET doctor_finished_at = issued_at
 WHERE doctor_finished_at IS NULL AND status = 'ISSUED';

ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS prescription_draft JSONB;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMP WITH TIME ZONE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'visits'::regclass AND conname = 'visits_status_check'
  ) THEN
    ALTER TABLE visits ADD CONSTRAINT visits_status_check
      CHECK (status IN ('DRAFT', 'ISSUED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visits_status ON visits USING btree (status);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_finished_at ON visits USING btree (doctor_finished_at);

-- ---------------------------------------------------------------------------
-- Prescriptions: issued/voided lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ISSUED';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS voided_by UUID;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS replaces_prescription_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'prescriptions'::regclass AND conname = 'prescriptions_status_check'
  ) THEN
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_status_check
      CHECK (status IN ('ISSUED', 'VOIDED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'prescriptions'::regclass AND conname = 'prescriptions_replaces_prescription_id_fkey'
  ) THEN
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_replaces_prescription_id_fkey
      FOREIGN KEY (replaces_prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit_status ON prescriptions USING btree (visit_id, status);

ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- ---------------------------------------------------------------------------
-- Patients: distinguish "not recorded yet" from "confirmed none"
-- ---------------------------------------------------------------------------
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies_confirmed_none BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medications_confirmed_none BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Visit edit history: who changed what after a visit was issued
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visit_edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL,
    edited_by UUID NOT NULL,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'visit_edit_history'::regclass AND conname = 'visit_edit_history_visit_id_fkey'
  ) THEN
    ALTER TABLE visit_edit_history ADD CONSTRAINT visit_edit_history_visit_id_fkey
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'visit_edit_history'::regclass AND conname = 'visit_edit_history_edited_by_fkey'
  ) THEN
    ALTER TABLE visit_edit_history ADD CONSTRAINT visit_edit_history_edited_by_fkey
      FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visit_edit_history_visit_id
  ON visit_edit_history USING btree (visit_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Prescription favorites (per doctor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prescription_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'prescription_favorites'::regclass AND conname = 'prescription_favorites_doctor_id_fkey'
  ) THEN
    ALTER TABLE prescription_favorites ADD CONSTRAINT prescription_favorites_doctor_id_fkey
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'prescription_favorites'::regclass AND conname = 'prescription_favorites_doctor_name_dosage_key'
  ) THEN
    ALTER TABLE prescription_favorites ADD CONSTRAINT prescription_favorites_doctor_name_dosage_key
      UNIQUE (doctor_id, medication_name, dosage);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prescription_favorites_doctor_id
  ON prescription_favorites USING btree (doctor_id);

-- ---------------------------------------------------------------------------
-- Existing blank visits created by "Complete Checkup" stay final/issued.
-- New rows inserted by the queue completion path explicitly set status.
-- ---------------------------------------------------------------------------
ALTER TABLE visits ALTER COLUMN status SET DEFAULT 'DRAFT';
