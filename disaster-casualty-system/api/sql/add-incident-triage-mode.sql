-- Configure the triage assistance mode once per official incident.
-- Existing incidents remain compatible by defaulting to assisted mode.
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS triage_mode varchar(20) NOT NULL DEFAULT 'assisted';

ALTER TABLE public.incidents
  DROP CONSTRAINT IF EXISTS incidents_triage_mode_check;

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_triage_mode_check
  CHECK (triage_mode IN ('assisted', 'unassisted', 'both'));
