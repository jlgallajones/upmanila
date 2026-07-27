ALTER TABLE public.casualty_transport_records
ADD COLUMN origin_facility_id uuid
  REFERENCES public.healthcare_facilities(id) ON DELETE SET NULL,
ADD COLUMN destination_type varchar(30),
ADD COLUMN vehicle_identifier varchar(100),
ADD COLUMN is_interhospital_transfer boolean NOT NULL DEFAULT false;