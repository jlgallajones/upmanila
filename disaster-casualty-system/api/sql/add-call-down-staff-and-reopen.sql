CREATE TABLE IF NOT EXISTS public.call_down_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role_position text,
  contact_number text,
  assigned_team_unit text,
  notes text,
  linked_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_down_staff_created_by_idx
  ON public.call_down_staff (created_by);

CREATE INDEX IF NOT EXISTS call_down_staff_full_name_idx
  ON public.call_down_staff (full_name);

ALTER TABLE public.dmmp_staff_call_downs
  ADD COLUMN IF NOT EXISTS call_down_staff_id uuid REFERENCES public.call_down_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS has_arrived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS reopen_request_status text,
  ADD COLUMN IF NOT EXISTS reopen_request_reason text,
  ADD COLUMN IF NOT EXISTS reopen_requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopen_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopen_approved_at timestamptz;
