-- Ensure each Secretary is permanently assigned to one Doctor.
BEGIN;

ALTER TABLE secretaries
  ADD COLUMN IF NOT EXISTS doctor_id UUID;

-- Ensure the relationship is enforced even on databases created by older migrations.
DO $$
DECLARE
  existing_fk RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'secretaries'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) = 'FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE'
  ) THEN
    FOR existing_fk IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'secretaries'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (doctor_id) REFERENCES doctors(id)%'
    LOOP
      EXECUTE format('ALTER TABLE secretaries DROP CONSTRAINT %I', existing_fk.conname);
    END LOOP;

    ALTER TABLE secretaries
      ADD CONSTRAINT secretaries_doctor_id_fkey
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Use persisted conversation assignments only where they identify exactly one Doctor.
WITH unambiguous_assignments AS (
  SELECT
    secretary_id,
    (ARRAY_AGG(DISTINCT doctor_id))[1] AS doctor_id
  FROM conversations
  WHERE doctor_id IS NOT NULL
  GROUP BY secretary_id
  HAVING COUNT(DISTINCT doctor_id) = 1
)
UPDATE secretaries s
SET doctor_id = a.doctor_id
FROM unambiguous_assignments a
WHERE s.id = a.secretary_id
  AND s.doctor_id IS NULL;

DO $$
DECLARE
  unassigned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unassigned_count
  FROM secretaries
  WHERE doctor_id IS NULL;

  IF unassigned_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce Secretary-Doctor relationship: % Secretary account(s) have no unambiguous Doctor assignment.', unassigned_count
      USING HINT = 'Assign each remaining secretaries.doctor_id to the correct doctors.id, then rerun this migration.';
  END IF;
END $$;

ALTER TABLE secretaries
  ALTER COLUMN doctor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_secretaries_doctor_id
  ON secretaries(doctor_id);

COMMIT;
