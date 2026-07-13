-- =========================================================
-- DISASTER CASUALTY MANAGEMENT SYSTEM
-- Supabase PostgreSQL Database Schema
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUM TYPES
-- =========================================================

CREATE TYPE public.user_role AS ENUM (
  'super_admin',
  'administrator',
  'responder',
  'encoder',
  'medical_personnel',
  'viewer'
);

CREATE TYPE public.incident_status AS ENUM (
  'draft',
  'active',
  'closed',
  'archived'
);

CREATE TYPE public.casualty_status AS ENUM (
  'safe',
  'displaced',
  'evacuated',
  'rescued',
  'missing',
  'injured',
  'hospitalized',
  'deceased',
  'unknown'
);

CREATE TYPE public.casualty_severity AS ENUM (
  'none',
  'minor',
  'moderate',
  'severe',
  'critical'
);

CREATE TYPE public.verification_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'archived'
);

CREATE TYPE public.identification_status AS ENUM (
  'identified',
  'partially_identified',
  'unidentified'
);

-- =========================================================
-- USERS
-- Connected directly to Supabase Auth
-- =========================================================

CREATE TABLE public.users (
  id uuid PRIMARY KEY
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  full_name varchar(150) NOT NULL,
  email varchar(150) UNIQUE NOT NULL,
  phone_number varchar(30),

  role public.user_role NOT NULL DEFAULT 'responder',

  assigned_barangay varchar(150),
  assigned_municipality varchar(150),

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS
'Application user profiles connected to Supabase Auth accounts.';

COMMENT ON COLUMN public.users.id IS
'Uses the same UUID as auth.users.id.';

-- =========================================================
-- INCIDENTS
-- =========================================================

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  incident_code varchar(50) UNIQUE NOT NULL,
  incident_name varchar(200) NOT NULL,
  disaster_type varchar(100) NOT NULL,
  description text,

  province varchar(150),
  municipality varchar(150),
  barangay varchar(150),

  started_at timestamptz NOT NULL,
  ended_at timestamptz,

  status public.incident_status NOT NULL DEFAULT 'draft',

  created_by uuid NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT incidents_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.users(id)
    ON DELETE RESTRICT,

  CONSTRAINT incidents_valid_dates_check
    CHECK (
      ended_at IS NULL
      OR ended_at >= started_at
    )
);

-- =========================================================
-- CASUALTIES / PERSON REGISTRY
-- =========================================================

CREATE TABLE public.casualties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  id_number varchar(100),
  id_type varchar(50),

  identification_status public.identification_status
    NOT NULL
    DEFAULT 'identified',

  first_name varchar(100),
  middle_name varchar(100),
  last_name varchar(100),
  suffix varchar(20),

  date_of_birth date,
  estimated_age integer,

  sex varchar(30),
  civil_status varchar(50),
  nationality varchar(100),

  contact_number varchar(30),

  house_street text,
  barangay varchar(150),
  municipality varchar(150),
  province varchar(150),
  region varchar(150),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  deleted_at timestamptz,

  CONSTRAINT casualties_estimated_age_check
    CHECK (
      estimated_age IS NULL
      OR estimated_age BETWEEN 0 AND 130
    ),

  CONSTRAINT casualties_identified_name_check
    CHECK (
      identification_status <> 'identified'
      OR first_name IS NOT NULL
      OR last_name IS NOT NULL
    ),

  CONSTRAINT casualties_birth_date_check
    CHECK (
      date_of_birth IS NULL
      OR date_of_birth <= CURRENT_DATE
    )
);

COMMENT ON TABLE public.casualties IS
'Person registry containing permanent personal information.';

COMMENT ON COLUMN public.casualties.deleted_at IS
'Used for soft deletion instead of permanently removing records.';

-- =========================================================
-- EVACUATION CENTERS
-- =========================================================

CREATE TABLE public.evacuation_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  incident_id uuid NOT NULL,

  center_name varchar(200) NOT NULL,
  address text,

  barangay varchar(150),
  municipality varchar(150),
  province varchar(150),

  capacity integer,

  contact_person varchar(150),
  contact_number varchar(30),

  latitude decimal(10,7),
  longitude decimal(10,7),

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT evacuation_centers_incident_id_fkey
    FOREIGN KEY (incident_id)
    REFERENCES public.incidents(id)
    ON DELETE CASCADE,

  CONSTRAINT evacuation_centers_capacity_check
    CHECK (
      capacity IS NULL
      OR capacity >= 0
    ),

  CONSTRAINT evacuation_centers_latitude_check
    CHECK (
      latitude IS NULL
      OR latitude BETWEEN -90 AND 90
    ),

  CONSTRAINT evacuation_centers_longitude_check
    CHECK (
      longitude IS NULL
      OR longitude BETWEEN -180 AND 180
    )
);

-- =========================================================
-- CASUALTY INCIDENT RECORDS
-- Connects a person to a specific disaster
-- =========================================================

CREATE TABLE public.casualty_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  client_record_id uuid UNIQUE NOT NULL,

  casualty_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  evacuation_center_id uuid,

  current_status public.casualty_status NOT NULL,

  severity public.casualty_severity
    NOT NULL
    DEFAULT 'none',

  verification_status public.verification_status
    NOT NULL
    DEFAULT 'submitted',

  current_location text,
  hospital_name varchar(200),

  visible_injury text,
  medical_condition text,

  assistance_needed text,
  assistance_provided text,

  remarks text,

  encoded_by uuid NOT NULL,
  verified_by uuid,
  verified_at timestamptz,

  reported_at timestamptz NOT NULL DEFAULT now(),

  latitude decimal(10,7),
  longitude decimal(10,7),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  deleted_at timestamptz,

  CONSTRAINT casualty_incidents_casualty_id_fkey
    FOREIGN KEY (casualty_id)
    REFERENCES public.casualties(id)
    ON DELETE RESTRICT,

  CONSTRAINT casualty_incidents_incident_id_fkey
    FOREIGN KEY (incident_id)
    REFERENCES public.incidents(id)
    ON DELETE RESTRICT,

  CONSTRAINT casualty_incidents_evacuation_center_id_fkey
    FOREIGN KEY (evacuation_center_id)
    REFERENCES public.evacuation_centers(id)
    ON DELETE SET NULL,

  CONSTRAINT casualty_incidents_encoded_by_fkey
    FOREIGN KEY (encoded_by)
    REFERENCES public.users(id)
    ON DELETE RESTRICT,

  CONSTRAINT casualty_incidents_verified_by_fkey
    FOREIGN KEY (verified_by)
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  CONSTRAINT casualty_incidents_person_incident_unique
    UNIQUE (casualty_id, incident_id),

  CONSTRAINT casualty_incidents_latitude_check
    CHECK (
      latitude IS NULL
      OR latitude BETWEEN -90 AND 90
    ),

  CONSTRAINT casualty_incidents_longitude_check
    CHECK (
      longitude IS NULL
      OR longitude BETWEEN -180 AND 180
    ),

  CONSTRAINT casualty_incidents_verification_check
    CHECK (
      verification_status <> 'verified'
      OR verified_by IS NOT NULL
    )
);

COMMENT ON TABLE public.casualty_incidents IS
'Stores what happened to a specific person during a specific disaster incident.';

COMMENT ON COLUMN public.casualty_incidents.client_record_id IS
'UUID generated by the mobile app for offline synchronization and duplicate submission prevention.';

-- =========================================================
-- CASUALTY STATUS HISTORY
-- =========================================================

CREATE TABLE public.casualty_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  casualty_incident_id uuid NOT NULL,

  old_status public.casualty_status,
  new_status public.casualty_status NOT NULL,

  severity public.casualty_severity
    NOT NULL
    DEFAULT 'none',

  location text,
  notes text,

  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),

  latitude decimal(10,7),
  longitude decimal(10,7),

  CONSTRAINT casualty_status_history_incident_id_fkey
    FOREIGN KEY (casualty_incident_id)
    REFERENCES public.casualty_incidents(id)
    ON DELETE CASCADE,

  CONSTRAINT casualty_status_history_recorded_by_fkey
    FOREIGN KEY (recorded_by)
    REFERENCES public.users(id)
    ON DELETE RESTRICT,

  CONSTRAINT casualty_status_history_latitude_check
    CHECK (
      latitude IS NULL
      OR latitude BETWEEN -90 AND 90
    ),

  CONSTRAINT casualty_status_history_longitude_check
    CHECK (
      longitude IS NULL
      OR longitude BETWEEN -180 AND 180
    )
);

-- =========================================================
-- ATTACHMENTS
-- Files are stored in Supabase Storage
-- =========================================================

CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  casualty_incident_id uuid NOT NULL,

  file_name varchar(255) NOT NULL,
  storage_path text NOT NULL,

  file_type varchar(50) NOT NULL,
  mime_type varchar(100),
  file_size_bytes bigint,

  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT attachments_casualty_incident_id_fkey
    FOREIGN KEY (casualty_incident_id)
    REFERENCES public.casualty_incidents(id)
    ON DELETE CASCADE,

  CONSTRAINT attachments_uploaded_by_fkey
    FOREIGN KEY (uploaded_by)
    REFERENCES public.users(id)
    ON DELETE RESTRICT,

  CONSTRAINT attachments_file_size_check
    CHECK (
      file_size_bytes IS NULL
      OR file_size_bytes >= 0
    )
);

COMMENT ON COLUMN public.attachments.storage_path IS
'Path of the uploaded file inside a Supabase Storage bucket.';

-- =========================================================
-- AUDIT LOGS
-- =========================================================

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid,

  action varchar(100) NOT NULL,
  entity_type varchar(100) NOT NULL,
  entity_id uuid NOT NULL,

  previous_data jsonb,
  new_data jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX incidents_status_idx
  ON public.incidents(status);

CREATE INDEX incidents_started_at_idx
  ON public.incidents(started_at);

CREATE INDEX incidents_location_idx
  ON public.incidents(province, municipality, barangay);

CREATE INDEX casualties_id_number_idx
  ON public.casualties(id_number);

CREATE UNIQUE INDEX casualties_id_number_unique_idx
  ON public.casualties(id_number)
  WHERE id_number IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX casualties_name_idx
  ON public.casualties(last_name, first_name);

CREATE INDEX casualties_contact_number_idx
  ON public.casualties(contact_number);

CREATE INDEX casualties_location_idx
  ON public.casualties(province, municipality, barangay);

CREATE UNIQUE INDEX casualties_id_type_number_unique_idx
  ON public.casualties(id_type, id_number)
  WHERE id_type IS NOT NULL
    AND id_number IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX evacuation_centers_incident_id_idx
  ON public.evacuation_centers(incident_id);

CREATE INDEX evacuation_centers_municipality_idx
  ON public.evacuation_centers(municipality);

CREATE INDEX casualty_incidents_casualty_id_idx
  ON public.casualty_incidents(casualty_id);

CREATE INDEX casualty_incidents_incident_id_idx
  ON public.casualty_incidents(incident_id);

CREATE INDEX casualty_incidents_current_status_idx
  ON public.casualty_incidents(current_status);

CREATE INDEX casualty_incidents_verification_status_idx
  ON public.casualty_incidents(verification_status);

CREATE INDEX casualty_incidents_reported_at_idx
  ON public.casualty_incidents(reported_at);

CREATE INDEX casualty_incidents_incident_status_idx
  ON public.casualty_incidents(incident_id, current_status);

CREATE INDEX casualty_incidents_incident_verification_idx
  ON public.casualty_incidents(
    incident_id,
    verification_status
  );

CREATE INDEX casualty_status_history_incident_id_idx
  ON public.casualty_status_history(casualty_incident_id);

CREATE INDEX casualty_status_history_recorded_at_idx
  ON public.casualty_status_history(recorded_at);

CREATE INDEX attachments_casualty_incident_id_idx
  ON public.attachments(casualty_incident_id);

CREATE INDEX attachments_file_type_idx
  ON public.attachments(file_type);

CREATE INDEX audit_logs_user_id_idx
  ON public.audit_logs(user_id);

CREATE INDEX audit_logs_entity_type_idx
  ON public.audit_logs(entity_type);

CREATE INDEX audit_logs_entity_id_idx
  ON public.audit_logs(entity_id);

CREATE INDEX audit_logs_created_at_idx
  ON public.audit_logs(created_at);

-- =========================================================
-- AUTOMATIC UPDATED_AT FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER incidents_set_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER casualties_set_updated_at
BEFORE UPDATE ON public.casualties
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER evacuation_centers_set_updated_at
BEFORE UPDATE ON public.evacuation_centers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER casualty_incidents_set_updated_at
BEFORE UPDATE ON public.casualty_incidents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- AUTOMATIC USER PROFILE CREATION
-- Creates public.users after Supabase Auth registration
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    full_name,
    email,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NEW.email,
    'responder'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_profile_after_auth_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- =========================================================
-- AUTOMATIC FIRST STATUS HISTORY
-- Creates history after a casualty incident is added
-- =========================================================

CREATE OR REPLACE FUNCTION public.create_initial_casualty_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.casualty_status_history (
    casualty_incident_id,
    old_status,
    new_status,
    severity,
    location,
    notes,
    recorded_by,
    recorded_at,
    latitude,
    longitude
  )
  VALUES (
    NEW.id,
    NULL,
    NEW.current_status,
    NEW.severity,
    NEW.current_location,
    'Initial casualty status',
    NEW.encoded_by,
    NEW.reported_at,
    NEW.latitude,
    NEW.longitude
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_initial_status_after_casualty_incident
AFTER INSERT ON public.casualty_incidents
FOR EACH ROW
EXECUTE FUNCTION public.create_initial_casualty_status_history();

-- =========================================================
-- ROW LEVEL SECURITY
-- Policies will be added after authentication roles are tested
-- =========================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casualties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evacuation_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casualty_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casualty_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
