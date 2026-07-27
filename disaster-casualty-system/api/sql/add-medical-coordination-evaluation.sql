CREATE TABLE public.medical_coordination_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL UNIQUE
    REFERENCES public.incidents(id) ON DELETE CASCADE,

  initial_actions_rating smallint,
  scene_coordination_rating smallint,
  system_coordination_rating smallint,
  communications_rating smallint,
  resource_management_rating smallint,

  notes text,
  assessed_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,

  assessed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT coordination_rating_check CHECK (
    initial_actions_rating BETWEEN 1 AND 7
    AND scene_coordination_rating BETWEEN 1 AND 7
    AND system_coordination_rating BETWEEN 1 AND 7
    AND communications_rating BETWEEN 1 AND 7
    AND resource_management_rating BETWEEN 1 AND 7
  )
);