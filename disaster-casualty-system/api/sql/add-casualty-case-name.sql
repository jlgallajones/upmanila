ALTER TABLE public.casualty_case_links
  ADD COLUMN IF NOT EXISTS case_name text;

COMMENT ON COLUMN public.casualty_case_links.case_name IS
  'Optional display name for the matched case; does not change linked victim records.';
