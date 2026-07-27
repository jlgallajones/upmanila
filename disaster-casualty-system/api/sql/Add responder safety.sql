CREATE TABLE public.responder_safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,

  safety_actions_established varchar(20),
  ppe_decision_at timestamptz,
  deployed_responders integer,
  injured_responders integer,
  ill_responders integer,
  deceased_responders integer,

  reported_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);