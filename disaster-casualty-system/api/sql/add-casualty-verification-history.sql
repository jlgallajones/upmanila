CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.casualty_incidents
  ADD COLUMN IF NOT EXISTS verified_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.casualty_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id)
    ON DELETE CASCADE,
  old_status public.verification_status,
  new_status public.verification_status NOT NULL,
  reviewed_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casualty_verification_history_incident_idx
  ON public.casualty_verification_history(
    casualty_incident_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS casualty_verification_history_status_idx
  ON public.casualty_verification_history(new_status);

ALTER TABLE public.casualty_verification_history
  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_verification_history'
      AND policyname = 'Authenticated users can view casualty verification history'
  ) THEN
    CREATE POLICY "Authenticated users can view casualty verification history"
      ON public.casualty_verification_history
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'casualty_verification_history'
      AND policyname = 'Reviewers can manage casualty verification history'
  ) THEN
    CREATE POLICY "Reviewers can manage casualty verification history"
      ON public.casualty_verification_history
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.is_active IS TRUE
            AND users.role IN (
              'super_admin',
              'administrator',
              'medical_personnel'
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.is_active IS TRUE
            AND users.role IN (
              'super_admin',
              'administrator',
              'medical_personnel'
            )
        )
      );
  END IF;
END;
$$;
