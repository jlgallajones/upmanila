import { api } from "./client";

export type CasualtyRecord = {
  id: string;
  client_record_id: string;
  evacuation_center_id: string | null;
  current_status: string;
  severity: string;
  verification_status: string;
  current_location: string | null;
  hospital_name: string | null;
  visible_injury: string | null;
  medical_condition: string | null;
  assistance_needed: string | null;
  assistance_provided: string | null;
  remarks: string | null;
  reported_at: string;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;

  casualty: {
    id: string;
    id_number: string | null;
    id_type: string | null;
    identification_status: string;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    suffix: string | null;
    date_of_birth: string | null;
    estimated_age: number | null;
    sex: string | null;
    contact_number: string | null;
    house_street: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
    region: string | null;
  };

  incident: {
    id: string;
    incident_code: string;
    incident_name: string;
    disaster_type: string;
    status: string;
  };

  evacuation_center: {
    id: string;
    center_name: string;
    address: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
  } | null;

  encoder: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
};

type CasualtyListResponse = {
  success: boolean;
  count: number;
  data: CasualtyRecord[];
};

type CasualtyResponse = {
  success: boolean;
  message?: string;
  data: CasualtyRecord;
};

export async function getCasualties(): Promise<CasualtyRecord[]> {
  const response =
    await api.get<CasualtyListResponse>("/casualties");

  return response.data.data;
}

export async function getCasualty(
  id: string,
): Promise<CasualtyRecord> {
  const response = await api.get<CasualtyResponse>(
    `/casualties/${encodeURIComponent(id)}`,
  );

  return response.data.data;
}

export type CreateCasualtyPayload = {
  clientRecordId: string;
  incidentId: string;
  encodedBy: string;

  person: {
    idNumber?: string;
    idType?: string;
    identificationStatus:
      | "identified"
      | "partially_identified"
      | "unidentified";

    firstName?: string;
    middleName?: string;
    lastName?: string;
    suffix?: string;

    dateOfBirth?: string;
    estimatedAge?: number;

    sex?: string;
    civilStatus?: string;
    nationality?: string;
    contactNumber?: string;

    houseStreet?: string;
    barangay?: string;
    municipality?: string;
    province?: string;
    region?: string;
  };

  incidentDetails: {
    currentStatus:
      | "safe"
      | "displaced"
      | "evacuated"
      | "rescued"
      | "missing"
      | "injured"
      | "hospitalized"
      | "deceased"
      | "unknown";

    severity?:
      | "none"
      | "minor"
      | "moderate"
      | "severe"
      | "critical";

    evacuationCenterId?: string;
    currentLocation?: string;
    hospitalName?: string;
    visibleInjury?: string;
    medicalCondition?: string;
    assistanceNeeded?: string;
    assistanceProvided?: string;
    remarks?: string;

    latitude?: number;
    longitude?: number;
    reportedAt?: string;
  };
};

type CreateCasualtyResponse = {
  success: boolean;
  message: string;
  data: unknown;
};

export async function createCasualty(
  payload: CreateCasualtyPayload,
): Promise<CreateCasualtyResponse> {
  const response =
    await api.post<CreateCasualtyResponse>(
      "/casualties",
      payload,
    );

  return response.data;
}

export type UpdateCasualtyPayload = {
  incidentId?: string;
  person?: Partial<CreateCasualtyPayload["person"]>;
  incidentDetails?: Partial<
    CreateCasualtyPayload["incidentDetails"]
  >;
};

export async function updateCasualty(
  id: string,
  payload: UpdateCasualtyPayload,
): Promise<CasualtyRecord> {
  const response = await api.put<CasualtyResponse>(
    `/casualties/${encodeURIComponent(id)}`,
    payload,
  );

  return response.data.data;
}
