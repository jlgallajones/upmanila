CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.incident_response_timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL UNIQUE
    REFERENCES public.incidents(id)
    ON DELETE CASCADE,
  event_notification_at timestamptz,
  dmmp_activated boolean,
  dmmp_activation_trigger text,
  dmmp_activated_at timestamptz,
  medical_coordinator_notified_at timestamptz,
  first_ems_on_scene_at timestamptz,
  triage_ordered_at timestamptz,
  first_site_triage_at timestamptz,
  last_site_triage_at timestamptz,
  first_transport_from_scene_at timestamptz,
  last_transport_from_scene_at timestamptz,
  scene_demobilized_at timestamptz,
  updated_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_response_timelines_triage_order_check
    CHECK (
      last_site_triage_at IS NULL
      OR first_site_triage_at IS NULL
      OR last_site_triage_at >= first_site_triage_at
    ),
  CONSTRAINT incident_response_timelines_transport_order_check
    CHECK (
      last_transport_from_scene_at IS NULL
      OR first_transport_from_scene_at IS NULL
      OR last_transport_from_scene_at >= first_transport_from_scene_at
    )
);

ALTER TABLE public.incident_response_timelines
  ADD COLUMN IF NOT EXISTS event_notification_at timestamptz,
  ADD COLUMN IF NOT EXISTS dmmp_activated boolean,
  ADD COLUMN IF NOT EXISTS dmmp_activation_trigger text,
  ADD COLUMN IF NOT EXISTS dmmp_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS medical_coordinator_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_ems_on_scene_at timestamptz,
  ADD COLUMN IF NOT EXISTS triage_ordered_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_site_triage_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_site_triage_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_transport_from_scene_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_transport_from_scene_at timestamptz,
  ADD COLUMN IF NOT EXISTS scene_demobilized_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS incident_response_timelines_incident_idx
  ON public.incident_response_timelines(incident_id);

CREATE INDEX IF NOT EXISTS incident_response_timelines_notification_idx
  ON public.incident_response_timelines(event_notification_at);

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
    WHERE tgname = 'incident_response_timelines_set_updated_at'
  ) THEN
    CREATE TRIGGER incident_response_timelines_set_updated_at
    BEFORE UPDATE ON public.incident_response_timelines
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.incident_response_timelines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'incident_response_timelines'
      AND policyname = 'Authenticated users can view incident response timelines'
  ) THEN
    CREATE POLICY "Authenticated users can view incident response timelines"
      ON public.incident_response_timelines
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
      AND tablename = 'incident_response_timelines'
      AND policyname = 'Reference managers can manage incident response timelines'
  ) THEN
    CREATE POLICY "Reference managers can manage incident response timelines"
      ON public.incident_response_timelines
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
              'encoder'
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
              'encoder'
            )
        )
      );
  END IF;
END;
$$;
