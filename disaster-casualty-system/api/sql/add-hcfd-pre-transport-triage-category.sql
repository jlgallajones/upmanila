ALTER TABLE public.facility_encounters
  ADD COLUMN IF NOT EXISTS pre_transport_triage_category varchar(20);

ALTER TABLE public.facility_encounters
  DROP CONSTRAINT IF EXISTS facility_pre_transport_triage_category_check;

ALTER TABLE public.facility_encounters
  ADD CONSTRAINT facility_pre_transport_triage_category_check CHECK (
    pre_transport_triage_category IS NULL OR
    pre_transport_triage_category IN (
      'immediate',
      'delayed',
      'minimal',
      'expectant'
    )
  );

CREATE INDEX IF NOT EXISTS facility_encounters_pre_transport_triage_idx
  ON public.facility_encounters(pre_transport_triage_category);
