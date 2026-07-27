CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.casualty_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id) ON DELETE CASCADE,

  treatment_strategy varchar(30) NOT NULL,
  treatment_area_name varchar(150),
  stabilization_started_at timestamptz,
  stabilized_at timestamptz,
  treatment_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,

  performed_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT treatment_strategy_check CHECK (
    treatment_strategy IN (
      'scoop_and_run',
      'scooter',
      'stay_and_play',
      'play_and_run',
      'unknown'
    )
  )
);

ALTER TABLE public.casualty_treatments
  ADD COLUMN IF NOT EXISTS casualty_incident_id uuid,
  ADD COLUMN IF NOT EXISTS treatment_strategy varchar(30),
  ADD COLUMN IF NOT EXISTS treatment_area_name varchar(150),
  ADD COLUMN IF NOT EXISTS stabilization_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS stabilized_at timestamptz,
  ADD COLUMN IF NOT EXISTS treatment_details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS performed_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.casualty_treatments
  DROP CONSTRAINT IF EXISTS treatment_strategy_check;

ALTER TABLE public.casualty_treatments
  ADD CONSTRAINT treatment_strategy_check CHECK (
    treatment_strategy IN (
      'scoop_and_run',
      'scooter',
      'stay_and_play',
      'play_and_run',
      'unknown'
    )
  );

CREATE INDEX IF NOT EXISTS casualty_treatments_incident_idx
  ON public.casualty_treatments(
    casualty_incident_id,
    stabilized_at DESC
  );

CREATE INDEX IF NOT EXISTS casualty_treatments_strategy_idx
  ON public.casualty_treatments(treatment_strategy);

ALTER TABLE public.casualty_treatments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_treatments'
      AND policyname = 'Authenticated users can view casualty treatments'
  ) THEN
    CREATE POLICY "Authenticated users can view casualty treatments"
      ON public.casualty_treatments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_treatments'
      AND policyname = 'Responders can create casualty treatments'
  ) THEN
    CREATE POLICY "Responders can create casualty treatments"
      ON public.casualty_treatments
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
