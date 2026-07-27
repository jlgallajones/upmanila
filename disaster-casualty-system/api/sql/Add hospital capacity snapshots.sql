CREATE TABLE public.facility_resource_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,

  facility_id uuid NOT NULL
    REFERENCES public.healthcare_facilities(id) ON DELETE CASCADE,

  recorded_at timestamptz NOT NULL,

  total_resuscitation_rooms integer,
  used_resuscitation_rooms integer,
  total_operating_rooms integer,
  used_operating_rooms integer,

  alternative_icu_in_use boolean,
  notes text,

  CONSTRAINT resuscitation_room_count_check CHECK (
    used_resuscitation_rooms IS NULL
    OR total_resuscitation_rooms IS NULL
    OR used_resuscitation_rooms <= total_resuscitation_rooms
  ),

  CONSTRAINT operating_room_count_check CHECK (
    used_operating_rooms IS NULL
    OR total_operating_rooms IS NULL
    OR used_operating_rooms <= total_operating_rooms
  )
);