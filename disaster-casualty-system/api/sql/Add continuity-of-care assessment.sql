CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.continuity_of_care_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL UNIQUE
    REFERENCES public.incidents(id) ON DELETE CASCADE,
  ems_coverage_disruption varchar(20),
  facility_care_disruption varchar(20),
  notes text,
  assessed_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.continuity_of_care_assessments
  ADD COLUMN IF NOT EXISTS ems_coverage_disruption varchar(20),
  ADD COLUMN IF NOT EXISTS facility_care_disruption varchar(20),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS assessed_by uuid,
  ADD COLUMN IF NOT EXISTS assessed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.continuity_of_care_assessments
  DROP CONSTRAINT IF EXISTS ems_disruption_check;

ALTER TABLE public.continuity_of_care_assessments
  ADD CONSTRAINT ems_disruption_check CHECK (
    ems_coverage_disruption IN (
      'none',
      'minimal',
      'moderate',
      'total',
      'unknown'
    )
    OR ems_coverage_disruption IS NULL
  );

ALTER TABLE public.continuity_of_care_assessments
  DROP CONSTRAINT IF EXISTS facility_disruption_check;

ALTER TABLE public.continuity_of_care_assessments
  ADD CONSTRAINT facility_disruption_check CHECK (
    facility_care_disruption IN (
      'none',
      'minimal',
      'moderate',
      'total',
      'unknown'
    )
    OR facility_care_disruption IS NULL
  );

ALTER TABLE public.continuity_of_care_assessments
  DROP CONSTRAINT IF EXISTS continuity_of_care_assessments_incident_unique;

ALTER TABLE public.continuity_of_care_assessments
  ADD CONSTRAINT continuity_of_care_assessments_incident_unique
  UNIQUE (incident_id);

CREATE INDEX IF NOT EXISTS continuity_of_care_assessments_incident_idx
  ON public.continuity_of_care_assessments(incident_id);

ALTER TABLE public.continuity_of_care_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'continuity_of_care_assessments'
      AND policyname = 'Authenticated users can view continuity of care assessments'
  ) THEN
    CREATE POLICY "Authenticated users can view continuity of care assessments"
      ON public.continuity_of_care_assessments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'continuity_of_care_assessments'
      AND policyname = 'Operations users can save continuity of care assessments'
  ) THEN
    CREATE POLICY "Operations users can save continuity of care assessments"
      ON public.continuity_of_care_assessments
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.is_active IS TRUE
            AND users.role IN (
              'super_admin',
              'administrator',
              'responder',
              'encoder',
              'medical_personnel'
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.is_active IS TRUE
            AND users.role IN (
              'super_admin',
              'administrator',
              'responder',
              'encoder',
              'medical_personnel'
            )
        )
      );
  END IF;
END;
$$;
