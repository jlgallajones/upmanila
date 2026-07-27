CREATE TABLE public.casualty_treatments (
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