CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.responder_safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,
  safety_actions_established varchar(20),
  ppe_decision_at timestamptz,
  response_deactivated_at timestamptz,
  deployed_responders integer NOT NULL DEFAULT 0,
  injured_responders integer NOT NULL DEFAULT 0,
  ill_responders integer NOT NULL DEFAULT 0,
  deceased_responders integer NOT NULL DEFAULT 0,
  reported_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.responder_safety_reports
  ADD COLUMN IF NOT EXISTS safety_actions_established varchar(20),
  ADD COLUMN IF NOT EXISTS ppe_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS response_deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deployed_responders integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS injured_responders integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ill_responders integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deceased_responders integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reported_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.responder_safety_reports
SET
  deployed_responders = COALESCE(deployed_responders, 0),
  injured_responders = COALESCE(injured_responders, 0),
  ill_responders = COALESCE(ill_responders, 0),
  deceased_responders = COALESCE(deceased_responders, 0),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.responder_safety_reports
  ALTER COLUMN deployed_responders SET DEFAULT 0,
  ALTER COLUMN injured_responders SET DEFAULT 0,
  ALTER COLUMN ill_responders SET DEFAULT 0,
  ALTER COLUMN deceased_responders SET DEFAULT 0,
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.responder_safety_reports
  DROP CONSTRAINT IF EXISTS responder_safety_reports_action_check;

ALTER TABLE public.responder_safety_reports
  ADD CONSTRAINT responder_safety_reports_action_check
  CHECK (
    safety_actions_established IN ('yes', 'no', 'unknown')
    OR safety_actions_established IS NULL
  );

ALTER TABLE public.responder_safety_reports
  DROP CONSTRAINT IF EXISTS responder_safety_reports_counts_check;

ALTER TABLE public.responder_safety_reports
  ADD CONSTRAINT responder_safety_reports_counts_check
  CHECK (
    deployed_responders >= 0
    AND injured_responders >= 0
    AND ill_responders >= 0
    AND deceased_responders >= 0
  );

ALTER TABLE public.responder_safety_reports
  DROP CONSTRAINT IF EXISTS responder_safety_reports_incident_unique;

ALTER TABLE public.responder_safety_reports
  ADD CONSTRAINT responder_safety_reports_incident_unique
  UNIQUE (incident_id);

CREATE INDEX IF NOT EXISTS responder_safety_reports_incident_idx
  ON public.responder_safety_reports(incident_id);

ALTER TABLE public.responder_safety_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'responder_safety_reports'
      AND policyname = 'Authenticated users can view responder safety reports'
  ) THEN
    CREATE POLICY "Authenticated users can view responder safety reports"
      ON public.responder_safety_reports
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'responder_safety_reports'
      AND policyname = 'Operations users can save responder safety reports'
  ) THEN
    CREATE POLICY "Operations users can save responder safety reports"
      ON public.responder_safety_reports
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
