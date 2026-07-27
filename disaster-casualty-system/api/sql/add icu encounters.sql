CREATE TABLE public.icu_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id) ON DELETE CASCADE,

  facility_id uuid
    REFERENCES public.healthcare_facilities(id) ON DELETE SET NULL,

  admitted_at timestamptz NOT NULL,
  discharged_at timestamptz,
  alternative_icu_used boolean,
  mechanical_ventilation_used boolean,
  ventilation_started_at timestamptz,
  ventilation_ended_at timestamptz,

  CONSTRAINT icu_time_check CHECK (
    discharged_at IS NULL OR discharged_at >= admitted_at
  ),

  CONSTRAINT ventilation_time_check CHECK (
    ventilation_ended_at IS NULL
    OR ventilation_started_at IS NULL
    OR ventilation_ended_at >= ventilation_started_at
  )
);