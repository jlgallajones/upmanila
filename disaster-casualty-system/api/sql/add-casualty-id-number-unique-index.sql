CREATE UNIQUE INDEX IF NOT EXISTS casualties_id_number_unique_idx
  ON public.casualties(id_number)
  WHERE id_number IS NOT NULL
    AND deleted_at IS NULL;
