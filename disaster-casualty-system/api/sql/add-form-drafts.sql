CREATE TABLE IF NOT EXISTS public.form_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  form_type text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_drafts_owner_id_idx
  ON public.form_drafts (owner_id);

CREATE INDEX IF NOT EXISTS form_drafts_form_type_idx
  ON public.form_drafts (form_type);

CREATE INDEX IF NOT EXISTS form_drafts_updated_at_idx
  ON public.form_drafts (updated_at DESC);

