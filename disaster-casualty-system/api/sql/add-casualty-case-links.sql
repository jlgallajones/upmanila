CREATE TABLE IF NOT EXISTS public.casualty_case_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,
  role text NOT NULL,
  linked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casualty_incident_id),
  UNIQUE (case_id, role)
);

CREATE INDEX IF NOT EXISTS casualty_case_links_case_id_idx
  ON public.casualty_case_links (case_id);

CREATE INDEX IF NOT EXISTS casualty_case_links_incident_id_idx
  ON public.casualty_case_links (incident_id);

CREATE INDEX IF NOT EXISTS casualty_case_links_linked_by_idx
  ON public.casualty_case_links (linked_by);
