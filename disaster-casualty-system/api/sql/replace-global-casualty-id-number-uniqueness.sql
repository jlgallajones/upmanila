DROP INDEX IF EXISTS public.casualties_id_number_unique_idx;

-- Victim codes such as JLG1 reset per incident. Uniqueness is enforced by
-- the API against casualty_incidents.incident_id + casualties.id_number.
CREATE INDEX IF NOT EXISTS casualties_id_number_lookup_idx
  ON public.casualties(id_number)
  WHERE id_number IS NOT NULL
    AND deleted_at IS NULL;
