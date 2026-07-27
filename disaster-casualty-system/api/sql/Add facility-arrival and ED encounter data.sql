CREATE TABLE public.facility_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id) ON DELETE CASCADE,

  facility_id uuid NOT NULL
    REFERENCES public.healthcare_facilities(id) ON DELETE RESTRICT,

  arrived_at timestamptz,
  ed_admitted_at timestamptz,
  ed_departed_at timestamptz,

  disposition varchar(30),
  referred_or_transferred boolean,
  admitted_to_hospital boolean,
  discharged_home boolean,

  recorded_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facility_disposition_check CHECK (
    disposition IN (
      'active_care',
      'hospital_admission',
      'discharged_home',
      'transferred',
      'deceased',
      'left_without_treatment',
      'unknown'
    )
  )
);