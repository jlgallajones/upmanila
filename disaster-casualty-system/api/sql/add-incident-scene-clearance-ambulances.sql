CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.incident_scene_clearance_ambulances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id)
    ON DELETE CASCADE,
  ambulance_provider varchar(150) NOT NULL,
  plate_number varchar(80) NOT NULL,
  ambulance_type varchar(40) NOT NULL,
  arrived_on_scene_at timestamptz NOT NULL,
  recorded_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_scene_clearance_ambulances_type_check
    CHECK (
      ambulance_type IN (
        'bls',
        'acls',
        'patient_transport_vehicle',
        'other'
      )
    )
);

CREATE INDEX IF NOT EXISTS incident_scene_clearance_ambulances_incident_idx
  ON public.incident_scene_clearance_ambulances(
    incident_id,
    arrived_on_scene_at
  );

CREATE OR REPLACE FUNCTION public.set_incident_scene_clearance_ambulance_updated_at()
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

DROP TRIGGER IF EXISTS incident_scene_clearance_ambulances_set_updated_at
  ON public.incident_scene_clearance_ambulances;

CREATE TRIGGER incident_scene_clearance_ambulances_set_updated_at
  BEFORE UPDATE ON public.incident_scene_clearance_ambulances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_incident_scene_clearance_ambulance_updated_at();

ALTER TABLE public.incident_scene_clearance_ambulances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'incident_scene_clearance_ambulances'
      AND policyname = 'Authenticated users can view scene clearance ambulances'
  ) THEN
    CREATE POLICY "Authenticated users can view scene clearance ambulances"
      ON public.incident_scene_clearance_ambulances
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'incident_scene_clearance_ambulances'
      AND policyname = 'Incident managers can manage scene clearance ambulances'
  ) THEN
    CREATE POLICY "Incident managers can manage scene clearance ambulances"
      ON public.incident_scene_clearance_ambulances
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
              'admin',
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
              'admin',
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
