CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.casualty_transport_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id)
    ON DELETE CASCADE,
  transport_required varchar(20) NOT NULL DEFAULT 'unknown',
  transport_mode varchar(50) NOT NULL DEFAULT 'unknown',
  ems_unit_type varchar(50) NOT NULL DEFAULT 'unknown',
  departed_scene_at timestamptz,
  arrived_facility_at timestamptz,
  receiving_facility_id uuid
    REFERENCES public.healthcare_facilities(id)
    ON DELETE SET NULL,
  recorded_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT casualty_transport_records_required_check
    CHECK (transport_required IN ('yes', 'no', 'unknown')),
  CONSTRAINT casualty_transport_records_mode_check
    CHECK (
      transport_mode IN (
        'ems',
        'private_vehicle',
        'independent',
        'walk_in',
        'other',
        'unknown'
      )
    ),
  CONSTRAINT casualty_transport_records_ems_unit_check
    CHECK (ems_unit_type IN ('bls', 'als', 'other', 'unknown')),
  CONSTRAINT casualty_transport_records_valid_times_check
    CHECK (
      arrived_facility_at IS NULL
      OR departed_scene_at IS NULL
      OR arrived_facility_at >= departed_scene_at
    )
);

CREATE INDEX IF NOT EXISTS casualty_transport_records_incident_idx
  ON public.casualty_transport_records(
    casualty_incident_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS casualty_transport_records_facility_idx
  ON public.casualty_transport_records(receiving_facility_id);

CREATE INDEX IF NOT EXISTS casualty_transport_records_mode_idx
  ON public.casualty_transport_records(transport_mode);

ALTER TABLE public.casualty_transport_records
  ADD COLUMN IF NOT EXISTS transport_required varchar(20) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS transport_mode varchar(50) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ems_unit_type varchar(50) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS departed_scene_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_facility_at timestamptz,
  ADD COLUMN IF NOT EXISTS receiving_facility_id uuid,
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.casualty_transport_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_transport_records'
      AND policyname = 'Authenticated users can view casualty transport records'
  ) THEN
    CREATE POLICY "Authenticated users can view casualty transport records"
      ON public.casualty_transport_records
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
      AND tablename = 'casualty_transport_records'
      AND policyname = 'Responders can create casualty transport records'
  ) THEN
    CREATE POLICY "Responders can create casualty transport records"
      ON public.casualty_transport_records
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

