CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.responder_safety_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  responder_role text,
  responder_function text,
  safety_status varchar(20) NOT NULL,
  ppe_used_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.responder_safety_responses
  ADD COLUMN IF NOT EXISTS responder_role text,
  ADD COLUMN IF NOT EXISTS responder_function text,
  ADD COLUMN IF NOT EXISTS safety_status varchar(20),
  ADD COLUMN IF NOT EXISTS ppe_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.responder_safety_responses
  ALTER COLUMN safety_status SET NOT NULL,
  ALTER COLUMN ppe_used_at SET NOT NULL,
  ALTER COLUMN recorded_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.responder_safety_responses
  DROP CONSTRAINT IF EXISTS responder_safety_responses_status_check;

ALTER TABLE public.responder_safety_responses
  ADD CONSTRAINT responder_safety_responses_status_check
  CHECK (safety_status IN ('yes', 'no', 'unknown'));

ALTER TABLE public.responder_safety_responses
  DROP CONSTRAINT IF EXISTS responder_safety_responses_incident_user_unique;

ALTER TABLE public.responder_safety_responses
  ADD CONSTRAINT responder_safety_responses_incident_user_unique
  UNIQUE (incident_id, responder_id);

CREATE INDEX IF NOT EXISTS responder_safety_responses_incident_idx
  ON public.responder_safety_responses(incident_id);

CREATE INDEX IF NOT EXISTS responder_safety_responses_responder_idx
  ON public.responder_safety_responses(responder_id);

ALTER TABLE public.responder_safety_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'responder_safety_responses'
      AND policyname = 'Authenticated users can view responder safety responses'
  ) THEN
    CREATE POLICY "Authenticated users can view responder safety responses"
      ON public.responder_safety_responses
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'responder_safety_responses'
      AND policyname = 'Responders can save own responder safety response'
  ) THEN
    CREATE POLICY "Responders can save own responder safety response"
      ON public.responder_safety_responses
      FOR ALL
      TO authenticated
      USING (
        responder_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.is_active IS TRUE
            AND users.role IN ('super_admin', 'administrator', 'admin')
        )
      )
      WITH CHECK (
        responder_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.is_active IS TRUE
            AND users.role IN ('super_admin', 'administrator', 'admin')
        )
      );
  END IF;
END;
$$;
