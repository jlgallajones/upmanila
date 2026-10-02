ALTER TABLE public.incident_response_timelines
  ADD COLUMN IF NOT EXISTS custom_events jsonb NOT NULL DEFAULT '[]'::jsonb;
