ALTER TABLE public.casualty_triage_assessments
DROP CONSTRAINT casualty_triage_assessments_category_check;

ALTER TABLE public.casualty_triage_assessments
ADD CONSTRAINT casualty_triage_assessments_category_check
CHECK (
  triage_category IN (
    'immediate',
    'delayed',
    'minor',
    'expectant',
    'unknown'
  )
);