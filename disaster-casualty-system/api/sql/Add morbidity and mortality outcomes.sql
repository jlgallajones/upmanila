CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.facility_encounters
  ADD COLUMN IF NOT EXISTS hospital_admitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS hospital_discharged_at timestamptz,
  ADD COLUMN IF NOT EXISTS icu_discharged_at timestamptz,
  ADD COLUMN IF NOT EXISTS ventilation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ventilation_ended_at timestamptz;

ALTER TABLE public.facility_encounters
  DROP CONSTRAINT IF EXISTS facility_hospital_stay_time_check,
  DROP CONSTRAINT IF EXISTS facility_icu_stay_time_check,
  DROP CONSTRAINT IF EXISTS facility_ventilation_time_check,
  DROP CONSTRAINT IF EXISTS facility_ed_stay_time_check;

ALTER TABLE public.facility_encounters
  ADD CONSTRAINT facility_ed_stay_time_check CHECK (
    ed_departed_at IS NULL
    OR ed_admitted_at IS NULL
    OR ed_departed_at >= ed_admitted_at
  ),
  ADD CONSTRAINT facility_hospital_stay_time_check CHECK (
    hospital_discharged_at IS NULL
    OR hospital_admitted_at IS NULL
    OR hospital_discharged_at >= hospital_admitted_at
  ),
  ADD CONSTRAINT facility_icu_stay_time_check CHECK (
    icu_discharged_at IS NULL
    OR icu_admitted_at IS NULL
    OR icu_discharged_at >= icu_admitted_at
  ),
  ADD CONSTRAINT facility_ventilation_time_check CHECK (
    ventilation_ended_at IS NULL
    OR ventilation_started_at IS NULL
    OR ventilation_ended_at >= ventilation_started_at
  );

CREATE INDEX IF NOT EXISTS facility_encounters_ed_stay_idx
  ON public.facility_encounters(ed_admitted_at, ed_departed_at);

CREATE INDEX IF NOT EXISTS facility_encounters_icu_stay_idx
  ON public.facility_encounters(icu_admitted_at, icu_discharged_at);

CREATE INDEX IF NOT EXISTS facility_encounters_ventilation_idx
  ON public.facility_encounters(ventilation_started_at, ventilation_ended_at);

CREATE INDEX IF NOT EXISTS facility_encounters_hospital_stay_idx
  ON public.facility_encounters(hospital_admitted_at, hospital_discharged_at);

CREATE TABLE IF NOT EXISTS public.casualty_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL UNIQUE
    REFERENCES public.casualty_incidents(id) ON DELETE CASCADE,
  reached_hospital boolean,
  medical_contact_before_death boolean,
  died boolean NOT NULL DEFAULT false,
  death_stage varchar(30),
  death_at timestamptz,
  final_disposition varchar(30),
  recorded_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.casualty_outcomes
  ADD COLUMN IF NOT EXISTS casualty_incident_id uuid,
  ADD COLUMN IF NOT EXISTS reached_hospital boolean,
  ADD COLUMN IF NOT EXISTS medical_contact_before_death boolean,
  ADD COLUMN IF NOT EXISTS died boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS death_stage varchar(30),
  ADD COLUMN IF NOT EXISTS death_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_disposition varchar(30),
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.casualty_outcomes
  DROP CONSTRAINT IF EXISTS death_stage_check,
  DROP CONSTRAINT IF EXISTS casualty_outcomes_final_disposition_check,
  DROP CONSTRAINT IF EXISTS casualty_outcomes_incident_unique;

ALTER TABLE public.casualty_outcomes
  ADD CONSTRAINT death_stage_check CHECK (
    death_stage IS NULL OR death_stage IN (
      'impact',
      'prehospital',
      'in_hospital'
    )
  ),
  ADD CONSTRAINT casualty_outcomes_final_disposition_check CHECK (
    final_disposition IS NULL OR final_disposition IN (
      'alive',
      'deceased',
      'transferred',
      'discharged',
      'unknown'
    )
  ),
  ADD CONSTRAINT casualty_outcomes_incident_unique
    UNIQUE (casualty_incident_id);

CREATE INDEX IF NOT EXISTS casualty_outcomes_death_stage_idx
  ON public.casualty_outcomes(death_stage, died);

ALTER TABLE public.casualty_outcomes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_outcomes'
      AND policyname = 'Authenticated users can view casualty outcomes'
  ) THEN
    CREATE POLICY "Authenticated users can view casualty outcomes"
      ON public.casualty_outcomes
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_outcomes'
      AND policyname = 'Responders can save casualty outcomes'
  ) THEN
    CREATE POLICY "Responders can save casualty outcomes"
      ON public.casualty_outcomes
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
