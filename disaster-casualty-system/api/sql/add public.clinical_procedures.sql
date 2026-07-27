CREATE TABLE public.clinical_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id) ON DELETE CASCADE,

  facility_id uuid
    REFERENCES public.healthcare_facilities(id) ON DELETE SET NULL,

  procedure_type varchar(30) NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  room_identifier varchar(100),
  notes text,

  CONSTRAINT clinical_procedure_type_check CHECK (
    procedure_type IN (
      'surgery',
      'xray',
      'ultrasound',
      'ct_scan',
      'other'
    )
  ),

  CONSTRAINT clinical_procedure_time_check CHECK (
    ended_at IS NULL
    OR started_at IS NULL
    OR ended_at >= started_at
  )
);