CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_full_name text,
  actor_role text,
  scope_admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS entity_label text,
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_full_name text,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS scope_admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx
  ON public.audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS audit_logs_scope_admin_id_idx
  ON public.audit_logs (scope_admin_id);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON public.audit_logs (entity_type, entity_id);
