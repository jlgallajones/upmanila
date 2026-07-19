CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.casualty_triage_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id)
    ON DELETE CASCADE,
  triage_system varchar(50) NOT NULL,
  triage_category varchar(50) NOT NULL,
  triage_stage varchar(50) NOT NULL DEFAULT 'on_site',
  triaged_at timestamptz NOT NULL DEFAULT now(),
  triaged_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT casualty_triage_assessments_system_check
    CHECK (
      triage_system IN (
        'urgent_non_urgent',
        'nato',
        'start',
        'sieve_sort',
        'smart',
        'care_flight',
        'mass',
        'salt',
        'ed_triage',
        'other'
      )
    ),
  CONSTRAINT casualty_triage_assessments_category_check
    CHECK (
      triage_category IN (
        'immediate',
        'delayed',
        'minimal',
        'expectant',
        'unknown'
      )
    ),
  CONSTRAINT casualty_triage_assessments_stage_check
    CHECK (
      triage_stage IN (
        'on_site',
        'facility_arrival',
        'reassessment'
      )
    )
);

CREATE INDEX IF NOT EXISTS casualty_triage_assessments_incident_idx
  ON public.casualty_triage_assessments(
    casualty_incident_id,
    triaged_at DESC
  );

CREATE INDEX IF NOT EXISTS casualty_triage_assessments_category_idx
  ON public.casualty_triage_assessments(triage_category);

CREATE INDEX IF NOT EXISTS casualty_triage_assessments_stage_idx
  ON public.casualty_triage_assessments(triage_stage);

ALTER TABLE public.casualty_triage_assessments
  ADD COLUMN IF NOT EXISTS triage_system varchar(50),
  ADD COLUMN IF NOT EXISTS triage_category varchar(50),
  ADD COLUMN IF NOT EXISTS triage_stage varchar(50) DEFAULT 'on_site',
  ADD COLUMN IF NOT EXISTS triaged_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS triaged_by uuid,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.casualty_triage_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_triage_assessments'
      AND policyname = 'Authenticated users can view casualty triage assessments'
  ) THEN
    CREATE POLICY "Authenticated users can view casualty triage assessments"
      ON public.casualty_triage_assessments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_triage_assessments'
      AND policyname = 'Responders can create casualty triage assessments'
  ) THEN
    CREATE POLICY "Responders can create casualty triage assessments"
      ON public.casualty_triage_assessments
      FOR INSERT
      TO authenticated
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
