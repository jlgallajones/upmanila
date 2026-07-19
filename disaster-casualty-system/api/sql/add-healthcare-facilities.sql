CREATE TABLE IF NOT EXISTS public.healthcare_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_name varchar(200) NOT NULL,
  facility_level varchar(50) NOT NULL DEFAULT 'unknown',
  address text,
  barangay varchar(150),
  municipality varchar(150),
  province varchar(150),
  contact_person varchar(150),
  contact_number varchar(30),
  latitude decimal(10,7),
  longitude decimal(10,7),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT healthcare_facilities_level_check
    CHECK (
      facility_level IN (
        'primary',
        'secondary',
        'tertiary',
        'specialized',
        'unknown'
      )
    ),
  CONSTRAINT healthcare_facilities_latitude_check
    CHECK (
      latitude IS NULL
      OR latitude BETWEEN -90 AND 90
    ),
  CONSTRAINT healthcare_facilities_longitude_check
    CHECK (
      longitude IS NULL
      OR longitude BETWEEN -180 AND 180
    )
);

CREATE INDEX IF NOT EXISTS healthcare_facilities_name_idx
  ON public.healthcare_facilities(facility_name);

CREATE INDEX IF NOT EXISTS healthcare_facilities_location_idx
  ON public.healthcare_facilities(province, municipality, barangay);

CREATE INDEX IF NOT EXISTS healthcare_facilities_active_idx
  ON public.healthcare_facilities(is_active);

CREATE UNIQUE INDEX IF NOT EXISTS healthcare_facilities_active_name_location_unique_idx
  ON public.healthcare_facilities(
    lower(facility_name),
    coalesce(lower(municipality), ''),
    coalesce(lower(province), '')
  )
  WHERE is_active IS TRUE;

ALTER TABLE public.casualty_incidents
  ADD COLUMN IF NOT EXISTS healthcare_facility_id uuid
    REFERENCES public.healthcare_facilities(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS casualty_incidents_healthcare_facility_idx
  ON public.casualty_incidents(healthcare_facility_id);

ALTER TABLE public.healthcare_facilities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'healthcare_facilities'
      AND policyname = 'Authenticated users can view active healthcare facilities'
  ) THEN
    CREATE POLICY "Authenticated users can view active healthcare facilities"
      ON public.healthcare_facilities
      FOR SELECT
      TO authenticated
      USING (is_active IS TRUE);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'healthcare_facilities'
      AND policyname = 'Reference managers can create healthcare facilities'
  ) THEN
    CREATE POLICY "Reference managers can create healthcare facilities"
      ON public.healthcare_facilities
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users
          WHERE users.id = auth.uid()
            AND users.is_active IS TRUE
            AND users.role IN (
              'super_admin',
              'administrator',
              'encoder'
            )
        )
      );
  END IF;
END;
$$;
