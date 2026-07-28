CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.facility_encounters
  ADD COLUMN IF NOT EXISTS surgical_intervention_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS surgical_intervention_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS operating_room_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS xray_required boolean,
  ADD COLUMN IF NOT EXISTS xray_performed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ultrasound_required boolean,
  ADD COLUMN IF NOT EXISTS ultrasound_performed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ct_required boolean,
  ADD COLUMN IF NOT EXISTS ct_performed_at timestamptz,
  ADD COLUMN IF NOT EXISTS icu_admitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS mechanical_ventilation_required boolean,
  ADD COLUMN IF NOT EXISTS alternative_icu_used boolean;

ALTER TABLE public.facility_encounters
  DROP CONSTRAINT IF EXISTS facility_surgery_time_check,
  DROP CONSTRAINT IF EXISTS facility_xray_time_check,
  DROP CONSTRAINT IF EXISTS facility_ultrasound_time_check,
  DROP CONSTRAINT IF EXISTS facility_ct_time_check,
  DROP CONSTRAINT IF EXISTS facility_icu_time_check;

ALTER TABLE public.facility_encounters
  ADD CONSTRAINT facility_surgery_time_check CHECK (
    surgical_intervention_ended_at IS NULL
    OR surgical_intervention_started_at IS NULL
    OR surgical_intervention_ended_at >= surgical_intervention_started_at
  ),
  ADD CONSTRAINT facility_xray_time_check CHECK (
    xray_performed_at IS NULL
    OR arrived_at IS NULL
    OR xray_performed_at >= arrived_at
  ),
  ADD CONSTRAINT facility_ultrasound_time_check CHECK (
    ultrasound_performed_at IS NULL
    OR arrived_at IS NULL
    OR ultrasound_performed_at >= arrived_at
  ),
  ADD CONSTRAINT facility_ct_time_check CHECK (
    ct_performed_at IS NULL
    OR arrived_at IS NULL
    OR ct_performed_at >= arrived_at
  ),
  ADD CONSTRAINT facility_icu_time_check CHECK (
    icu_admitted_at IS NULL
    OR arrived_at IS NULL
    OR icu_admitted_at >= arrived_at
  );

CREATE INDEX IF NOT EXISTS facility_encounters_surgery_idx
  ON public.facility_encounters(surgical_intervention_started_at);

CREATE INDEX IF NOT EXISTS facility_encounters_or_idx
  ON public.facility_encounters(operating_room_started_at);

CREATE INDEX IF NOT EXISTS facility_encounters_imaging_idx
  ON public.facility_encounters(
    xray_performed_at,
    ultrasound_performed_at,
    ct_performed_at
  );

CREATE INDEX IF NOT EXISTS facility_encounters_icu_idx
  ON public.facility_encounters(icu_admitted_at);

CREATE TABLE IF NOT EXISTS public.facility_resource_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,
  facility_id uuid
    REFERENCES public.healthcare_facilities(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  total_resuscitation_rooms integer,
  used_resuscitation_rooms integer,
  total_operating_rooms integer,
  used_operating_rooms integer,
  alternative_icu_in_use boolean,
  notes text,
  recorded_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facility_resource_snapshots
  ADD COLUMN IF NOT EXISTS incident_id uuid,
  ADD COLUMN IF NOT EXISTS facility_id uuid,
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS total_resuscitation_rooms integer,
  ADD COLUMN IF NOT EXISTS used_resuscitation_rooms integer,
  ADD COLUMN IF NOT EXISTS total_operating_rooms integer,
  ADD COLUMN IF NOT EXISTS used_operating_rooms integer,
  ADD COLUMN IF NOT EXISTS alternative_icu_in_use boolean,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.facility_resource_snapshots
  ALTER COLUMN facility_id DROP NOT NULL;

ALTER TABLE public.facility_resource_snapshots
  DROP CONSTRAINT IF EXISTS resuscitation_room_count_check,
  DROP CONSTRAINT IF EXISTS operating_room_count_check,
  DROP CONSTRAINT IF EXISTS facility_resource_snapshots_incident_unique;

ALTER TABLE public.facility_resource_snapshots
  ADD CONSTRAINT resuscitation_room_count_check CHECK (
    used_resuscitation_rooms IS NULL
    OR total_resuscitation_rooms IS NULL
    OR used_resuscitation_rooms <= total_resuscitation_rooms
  ),
  ADD CONSTRAINT operating_room_count_check CHECK (
    used_operating_rooms IS NULL
    OR total_operating_rooms IS NULL
    OR used_operating_rooms <= total_operating_rooms
  ),
  ADD CONSTRAINT facility_resource_snapshots_incident_unique
    UNIQUE (incident_id);

CREATE INDEX IF NOT EXISTS facility_resource_snapshots_incident_idx
  ON public.facility_resource_snapshots(incident_id, recorded_at DESC);

ALTER TABLE public.facility_resource_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'facility_resource_snapshots'
      AND policyname = 'Authenticated users can view facility resource snapshots'
  ) THEN
    CREATE POLICY "Authenticated users can view facility resource snapshots"
      ON public.facility_resource_snapshots
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'facility_resource_snapshots'
      AND policyname = 'Operations users can save facility resource snapshots'
  ) THEN
    CREATE POLICY "Operations users can save facility resource snapshots"
      ON public.facility_resource_snapshots
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
