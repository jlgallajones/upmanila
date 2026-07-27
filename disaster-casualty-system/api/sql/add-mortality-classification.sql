CREATE TABLE public.casualty_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL UNIQUE
    REFERENCES public.casualty_incidents(id) ON DELETE CASCADE,

  reached_hospital boolean,
  medical_contact_before_death boolean,
  died boolean NOT NULL DEFAULT false,
  death_stage varchar(30),
  death_at timestamptz,
  hospital_discharged_at timestamptz,
  final_disposition varchar(30),

  CONSTRAINT death_stage_check CHECK (
    death_stage IS NULL OR death_stage IN (
      'impact',
      'prehospital',
      'in_hospital'
    )
  )
);