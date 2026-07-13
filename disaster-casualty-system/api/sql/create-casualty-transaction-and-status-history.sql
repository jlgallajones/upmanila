CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.casualty_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casualty_incident_id uuid NOT NULL
    REFERENCES public.casualty_incidents(id)
    ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.casualty_status_history
  ADD COLUMN IF NOT EXISTS old_status text,
  ADD COLUMN IF NOT EXISTS new_status text,
  ADD COLUMN IF NOT EXISTS changed_by uuid,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS casualty_status_history_incident_idx
  ON public.casualty_status_history(casualty_incident_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_casualty_record_transaction(
  p_client_record_id uuid,
  p_incident_id uuid,
  p_encoded_by uuid,
  p_person jsonb,
  p_incident_details jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident public.incidents%ROWTYPE;
  v_encoder public.users%ROWTYPE;
  v_casualty public.casualties%ROWTYPE;
  v_casualty_incident public.casualty_incidents%ROWTYPE;
  v_evacuation_center_id uuid;
  v_reported_at timestamptz;
BEGIN
  SELECT *
    INTO v_incident
    FROM public.incidents
   WHERE id = p_incident_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident not found.';
  END IF;

  IF v_incident.status <> 'active' THEN
    RAISE EXCEPTION 'Casualties can only be submitted to an active incident.';
  END IF;

  SELECT *
    INTO v_encoder
    FROM public.users
   WHERE id = p_encoded_by;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Encoder account not found.';
  END IF;

  IF v_encoder.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'The encoder account is inactive.';
  END IF;

  v_evacuation_center_id :=
    NULLIF(p_incident_details ->> 'evacuationCenterId', '')::uuid;

  v_reported_at :=
    COALESCE(
      NULLIF(p_incident_details ->> 'reportedAt', '')::timestamptz,
      now()
    );

  INSERT INTO public.casualties (
    id_number,
    id_type,
    identification_status,
    first_name,
    middle_name,
    last_name,
    suffix,
    date_of_birth,
    estimated_age,
    sex,
    civil_status,
    nationality,
    contact_number,
    house_street,
    barangay,
    municipality,
    province,
    region
  )
  VALUES (
    NULLIF(p_person ->> 'idNumber', ''),
    NULLIF(p_person ->> 'idType', ''),
    (p_person ->> 'identificationStatus')::public.identification_status,
    NULLIF(p_person ->> 'firstName', ''),
    NULLIF(p_person ->> 'middleName', ''),
    NULLIF(p_person ->> 'lastName', ''),
    NULLIF(p_person ->> 'suffix', ''),
    NULLIF(p_person ->> 'dateOfBirth', '')::date,
    NULLIF(p_person ->> 'estimatedAge', '')::integer,
    NULLIF(p_person ->> 'sex', ''),
    NULLIF(p_person ->> 'civilStatus', ''),
    NULLIF(p_person ->> 'nationality', ''),
    NULLIF(p_person ->> 'contactNumber', ''),
    NULLIF(p_person ->> 'houseStreet', ''),
    NULLIF(p_person ->> 'barangay', ''),
    NULLIF(p_person ->> 'municipality', ''),
    NULLIF(p_person ->> 'province', ''),
    NULLIF(p_person ->> 'region', '')
  )
  RETURNING * INTO v_casualty;

  INSERT INTO public.casualty_incidents (
    client_record_id,
    casualty_id,
    incident_id,
    evacuation_center_id,
    current_status,
    severity,
    verification_status,
    current_location,
    hospital_name,
    visible_injury,
    medical_condition,
    assistance_needed,
    assistance_provided,
    remarks,
    encoded_by,
    reported_at,
    latitude,
    longitude
  )
  VALUES (
    p_client_record_id,
    v_casualty.id,
    p_incident_id,
    v_evacuation_center_id,
    (p_incident_details ->> 'currentStatus')::public.casualty_status,
    COALESCE(
      NULLIF(p_incident_details ->> 'severity', ''),
      'none'
    )::public.casualty_severity,
    'submitted'::public.verification_status,
    NULLIF(p_incident_details ->> 'currentLocation', ''),
    NULLIF(p_incident_details ->> 'hospitalName', ''),
    NULLIF(p_incident_details ->> 'visibleInjury', ''),
    NULLIF(p_incident_details ->> 'medicalCondition', ''),
    NULLIF(p_incident_details ->> 'assistanceNeeded', ''),
    NULLIF(p_incident_details ->> 'assistanceProvided', ''),
    NULLIF(p_incident_details ->> 'remarks', ''),
    p_encoded_by,
    v_reported_at,
    NULLIF(p_incident_details ->> 'latitude', '')::numeric,
    NULLIF(p_incident_details ->> 'longitude', '')::numeric
  )
  RETURNING * INTO v_casualty_incident;

  RETURN jsonb_build_object(
    'casualty', to_jsonb(v_casualty),
    'casualtyIncident', to_jsonb(v_casualty_incident),
    'incident', jsonb_build_object(
      'id', v_incident.id,
      'incidentCode', v_incident.incident_code,
      'incidentName', v_incident.incident_name
    ),
    'encoder', jsonb_build_object(
      'id', v_encoder.id,
      'fullName', v_encoder.full_name
    )
  );
END;
$$;
