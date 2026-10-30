-- Allow administrator-entered responder safety declarations beyond the
-- original yes/no/unknown values while preserving existing records.

ALTER TABLE public.responder_safety_responses
  DROP CONSTRAINT IF EXISTS responder_safety_responses_status_check;

ALTER TABLE public.responder_safety_responses
  ADD CONSTRAINT responder_safety_responses_status_check
  CHECK (
    safety_status IN (
      'yes',
      'no',
      'unknown',
      'seeking_medical_care',
      'deceased'
    )
  );
