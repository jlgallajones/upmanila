CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sitreps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id)
    ON DELETE CASCADE,
  report_number varchar(80) NOT NULL UNIQUE,
  period_start timestamptz,
  period_end timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL,
  generated_payload jsonb NOT NULL,
  generated_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  status varchar(30) NOT NULL DEFAULT 'generated',
  approved_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sitreps_status_check
    CHECK (status IN ('generated', 'approved', 'archived'))
);

ALTER TABLE public.sitreps
  ADD COLUMN IF NOT EXISTS incident_id uuid,
  ADD COLUMN IF NOT EXISTS report_number varchar(80),
  ADD COLUMN IF NOT EXISTS period_start timestamptz,
  ADD COLUMN IF NOT EXISTS period_end timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS generated_payload jsonb,
  ADD COLUMN IF NOT EXISTS generated_by uuid,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status varchar(30) DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS sitreps_incident_generated_idx
  ON public.sitreps(incident_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS sitreps_status_idx
  ON public.sitreps(status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'sitreps_set_updated_at'
  ) THEN
    CREATE TRIGGER sitreps_set_updated_at
    BEFORE UPDATE ON public.sitreps
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.sitreps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sitreps'
      AND policyname = 'Authenticated users can view sitreps'
  ) THEN
    CREATE POLICY "Authenticated users can view sitreps"
      ON public.sitreps
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
      AND tablename = 'sitreps'
      AND policyname = 'Report managers can manage sitreps'
  ) THEN
    CREATE POLICY "Report managers can manage sitreps"
      ON public.sitreps
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
              'encoder',
              'medical_personnel'
            )
        )
      );
  END IF;
END;
$$;
