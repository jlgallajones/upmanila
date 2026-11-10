-- Allow the same healthcare facility to be registered by different admin units.
-- Duplicate active facilities remain blocked within the same owner scope.

DROP INDEX IF EXISTS public.healthcare_facilities_active_name_location_unique_idx;

CREATE UNIQUE INDEX healthcare_facilities_active_name_location_unique_idx
  ON public.healthcare_facilities(
    lower(facility_name),
    coalesce(lower(municipality), ''),
    coalesce(lower(province), ''),
    coalesce(created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE is_active IS TRUE;
