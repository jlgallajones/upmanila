CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.facility_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id) ON DELETE CASCADE,

  facility_id uuid NOT NULL
    REFERENCES public.healthcare_facilities(id) ON DELETE RESTRICT,

  arrived_at timestamptz,
  ed_admitted_at timestamptz,
  ed_departed_at timestamptz,

  disposition varchar(30),
  referred_or_transferred boolean,
  admitted_to_hospital boolean,
  discharged_home boolean,

  recorded_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facility_disposition_check CHECK (
    disposition IN (
      'active_care',
      'hospital_admission',
      'discharged_home',
      'transferred',
      'deceased',
      'left_without_treatment',
      'unknown'
    )
  )
);

ALTER TABLE public.facility_encounters
  ADD COLUMN IF NOT EXISTS casualty_incident_id uuid,
  ADD COLUMN IF NOT EXISTS facility_id uuid,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS ed_admitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ed_departed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposition varchar(30),
  ADD COLUMN IF NOT EXISTS referred_or_transferred boolean,
  ADD COLUMN IF NOT EXISTS admitted_to_hospital boolean,
  ADD COLUMN IF NOT EXISTS discharged_home boolean,
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.facility_encounters
  DROP CONSTRAINT IF EXISTS facility_disposition_check;

ALTER TABLE public.facility_encounters
  ADD CONSTRAINT facility_disposition_check CHECK (
    disposition IN (
      'active_care',
      'hospital_admission',
      'discharged_home',
      'transferred',
      'deceased',
      'left_without_treatment',
      'unknown'
    )
  );

CREATE INDEX IF NOT EXISTS facility_encounters_casualty_idx
  ON public.facility_encounters(casualty_incident_id, arrived_at DESC);

CREATE INDEX IF NOT EXISTS facility_encounters_facility_idx
  ON public.facility_encounters(facility_id);

CREATE INDEX IF NOT EXISTS facility_encounters_transfer_idx
  ON public.facility_encounters(referred_or_transferred);

ALTER TABLE public.facility_encounters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'facility_encounters'
      AND policyname = 'Authenticated users can view facility encounters'
  ) THEN
    CREATE POLICY "Authenticated users can view facility encounters"
      ON public.facility_encounters
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'facility_encounters'
      AND policyname = 'Responders can create facility encounters'
  ) THEN
    CREATE POLICY "Responders can create facility encounters"
      ON public.facility_encounters
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
