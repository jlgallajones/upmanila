CREATE TABLE public.dmmp_staff_call_downs (
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

  recorded_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);