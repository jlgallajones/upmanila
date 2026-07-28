CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.incident_response_timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL UNIQUE
    REFERENCES public.incidents(id) ON DELETE CASCADE,
  event_notification_at timestamptz,
  dmmp_activated boolean,
  dmmp_activation_trigger text,
  dmmp_activated_at timestamptz,
  medical_coordinator_notified_at timestamptz,
  last_dmmp_staff_arrived_at timestamptz,
  last_facility_deactivated_at timestamptz,
  acute_response_started_at timestamptz,
  acute_response_ended_at timestamptz,
  first_ems_on_scene_at timestamptz,
  triage_ordered_at timestamptz,
  first_site_triage_at timestamptz,
  last_site_triage_at timestamptz,
  first_transport_from_scene_at timestamptz,
  last_transport_from_scene_at timestamptz,
  scene_demobilized_at timestamptz,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_response_timelines
  ADD COLUMN IF NOT EXISTS event_notification_at timestamptz,
  ADD COLUMN IF NOT EXISTS dmmp_activated boolean,
  ADD COLUMN IF NOT EXISTS dmmp_activation_trigger text,
  ADD COLUMN IF NOT EXISTS dmmp_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS medical_coordinator_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_dmmp_staff_arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_facility_deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS acute_response_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS acute_response_ended_at timestamptz,
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

CREATE TABLE IF NOT EXISTS public.dmmp_staff_call_downs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,
  staff_name varchar(150),
  role_name varchar(150),
  was_contacted boolean NOT NULL DEFAULT false,
  contacted_at timestamptz,
  required_arrival_at timestamptz,
  arrived_at timestamptz,
  arrived_within_standard boolean,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dmmp_staff_call_downs
  ADD COLUMN IF NOT EXISTS staff_name varchar(150),
  ADD COLUMN IF NOT EXISTS role_name varchar(150),
  ADD COLUMN IF NOT EXISTS was_contacted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS required_arrival_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_within_standard boolean,
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.medical_coordination_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL UNIQUE
    REFERENCES public.incidents(id) ON DELETE CASCADE,
  initial_actions_rating smallint,
  scene_coordination_rating smallint,
  system_coordination_rating smallint,
  communications_rating smallint,
  resource_management_rating smallint,
  notes text,
  assessed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assessed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_coordination_assessments
  ADD COLUMN IF NOT EXISTS initial_actions_rating smallint,
  ADD COLUMN IF NOT EXISTS scene_coordination_rating smallint,
  ADD COLUMN IF NOT EXISTS system_coordination_rating smallint,
  ADD COLUMN IF NOT EXISTS communications_rating smallint,
  ADD COLUMN IF NOT EXISTS resource_management_rating smallint,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS assessed_by uuid,
  ADD COLUMN IF NOT EXISTS assessed_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'incident_response_timelines_triage_order_check'
  ) THEN
    ALTER TABLE public.incident_response_timelines
      ADD CONSTRAINT incident_response_timelines_triage_order_check
      CHECK (
        last_site_triage_at IS NULL
        OR first_site_triage_at IS NULL
        OR last_site_triage_at >= first_site_triage_at
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'incident_response_timelines_transport_order_check'
  ) THEN
    ALTER TABLE public.incident_response_timelines
      ADD CONSTRAINT incident_response_timelines_transport_order_check
      CHECK (
        last_transport_from_scene_at IS NULL
        OR first_transport_from_scene_at IS NULL
        OR last_transport_from_scene_at >= first_transport_from_scene_at
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'medical_coordination_assessments_rating_check'
  ) THEN
    ALTER TABLE public.medical_coordination_assessments
      ADD CONSTRAINT medical_coordination_assessments_rating_check
      CHECK (
        (initial_actions_rating IS NULL OR initial_actions_rating BETWEEN 1 AND 7)
        AND (scene_coordination_rating IS NULL OR scene_coordination_rating BETWEEN 1 AND 7)
        AND (system_coordination_rating IS NULL OR system_coordination_rating BETWEEN 1 AND 7)
        AND (communications_rating IS NULL OR communications_rating BETWEEN 1 AND 7)
        AND (resource_management_rating IS NULL OR resource_management_rating BETWEEN 1 AND 7)
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS incident_response_timelines_incident_idx
  ON public.incident_response_timelines(incident_id);

CREATE INDEX IF NOT EXISTS incident_response_timelines_notification_idx
  ON public.incident_response_timelines(event_notification_at);

CREATE INDEX IF NOT EXISTS dmmp_staff_call_downs_incident_idx
  ON public.dmmp_staff_call_downs(incident_id);

CREATE INDEX IF NOT EXISTS dmmp_staff_call_downs_arrived_idx
  ON public.dmmp_staff_call_downs(arrived_at);

CREATE INDEX IF NOT EXISTS medical_coordination_assessments_incident_idx
  ON public.medical_coordination_assessments(incident_id);

ALTER TABLE public.incident_response_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dmmp_staff_call_downs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_coordination_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dmmp_staff_call_downs'
      AND policyname = 'Authenticated users can view DMMP staff call downs'
  ) THEN
    CREATE POLICY "Authenticated users can view DMMP staff call downs"
      ON public.dmmp_staff_call_downs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medical_coordination_assessments'
      AND policyname = 'Authenticated users can view medical coordination assessments'
  ) THEN
    CREATE POLICY "Authenticated users can view medical coordination assessments"
      ON public.medical_coordination_assessments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;
