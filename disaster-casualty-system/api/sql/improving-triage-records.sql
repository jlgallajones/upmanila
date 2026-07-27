ALTER TABLE public.casualty_triage_assessments
ADD COLUMN responder_category varchar(30),
ADD COLUMN calculated_category varchar(30),
ADD COLUMN assessment_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN algorithm_version varchar(30),
ADD COLUMN is_over_triage boolean,
ADD COLUMN is_under_triage boolean;