CREATE TABLE public.continuity_of_care_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,

  ems_coverage_disruption varchar(20),
  facility_care_disruption varchar(20),
  notes text,

  assessed_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,

  assessed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ems_disruption_check CHECK (
    ems_coverage_disruption IN (
      'none',
      'minimal',
      'moderate',
      'total',
      'unknown'
    )
  ),

  CONSTRAINT facility_disruption_check CHECK (
    facility_care_disruption IN (
      'none',
      'minimal',
      'moderate',
      'total',
      'unknown'
    )
  )
);