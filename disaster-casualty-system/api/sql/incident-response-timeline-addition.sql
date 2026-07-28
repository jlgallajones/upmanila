ALTER TABLE public.incident_response_timelines
  ADD COLUMN IF NOT EXISTS last_dmmp_staff_arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_facility_deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS acute_response_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS acute_response_ended_at timestamptz;
