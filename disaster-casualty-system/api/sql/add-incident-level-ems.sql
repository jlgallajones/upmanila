CREATE TABLE public.ems_vehicle_arrivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.incidents(id) ON DELETE CASCADE,

  vehicle_identifier varchar(100),
  unit_type varchar(20) NOT NULL,
  arrived_scene_at timestamptz NOT NULL,
  departed_scene_at timestamptz,

  recorded_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,

  CONSTRAINT ems_vehicle_type_check CHECK (
    unit_type IN ('bls', 'als', 'other')
  )
);