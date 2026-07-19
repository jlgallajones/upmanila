import { api } from "./client";

export type CasualtyRecord = {
  id: string;
  client_record_id: string;
  evacuation_center_id: string | null;
  healthcare_facility_id: string | null;
  current_status: string;
  severity: string;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
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

  healthcare_facility: {
    id: string;
    facility_name: string;
    facility_level: string;
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

export type CasualtyStatusHistoryItem = {
  id: string;
  casualty_incident_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
  changed_by_user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
};

export type CasualtyTriageHistoryItem = {
  id: string;
  casualty_incident_id: string;
  triage_system: string;
  triage_category: string;
  triage_stage: string;
  triaged_at: string;
  triaged_by: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  triaged_by_user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
};

export type CasualtyTransportHistoryItem = {
  id: string;
  casualty_incident_id: string;
  transport_required: string;
  transport_mode: string;
  ems_unit_type: string;
  departed_scene_at: string | null;
  arrived_facility_at: string | null;
  receiving_facility_id: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
  recorded_by_user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
  receiving_facility: {
    id: string;
    facility_name: string;
    facility_level: string;
    address: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
  } | null;
};

export type CasualtyVerificationHistoryItem = {
  id: string;
  casualty_incident_id: string;
  old_status: string | null;
  new_status: string;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  reviewed_by_user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
};

type CasualtyResponse = {
  success: boolean;
  message?: string;
  data: CasualtyRecord;
};

type CasualtyStatusHistoryResponse = {
  success: boolean;
  count: number;
  data: CasualtyStatusHistoryItem[];
};

type CasualtyTriageHistoryResponse = {
  success: boolean;
  count: number;
  data: CasualtyTriageHistoryItem[];
};

type CasualtyTransportHistoryResponse = {
  success: boolean;
  count: number;
  data: CasualtyTransportHistoryItem[];
};

type CasualtyVerificationHistoryResponse = {
  success: boolean;
  count: number;
  data: CasualtyVerificationHistoryItem[];
};

export type UpdateCasualtyVerificationPayload = {
  status: "submitted" | "under_review" | "verified" | "rejected";
  notes?: string;
};

export type CasualtyTriageAssessmentPayload = {
  triageSystem:
    | "urgent_non_urgent"
    | "nato"
    | "start"
    | "sieve_sort"
    | "smart"
    | "care_flight"
    | "mass"
    | "salt"
    | "ed_triage"
    | "other";
  triageCategory:
    | "immediate"
    | "delayed"
    | "minimal"
    | "expectant"
    | "unknown";
  triageStage?:
    | "on_site"
    | "facility_arrival"
    | "reassessment";
  triagedAt?: string;
  location?: string;
  notes?: string;
};

export type CasualtyTransportRecordPayload = {
  transportRequired: "yes" | "no" | "unknown";
  transportMode?:
    | "ems"
    | "private_vehicle"
    | "independent"
    | "walk_in"
    | "other"
    | "unknown";
  emsUnitType?: "bls" | "als" | "other" | "unknown";
  departedSceneAt?: string;
  arrivedFacilityAt?: string;
  receivingFacilityId?: string;
  notes?: string;
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

export async function getCasualtyStatusHistory(
  id: string,
): Promise<CasualtyStatusHistoryItem[]> {
  const response = await api.get<CasualtyStatusHistoryResponse>(
    `/casualties/${encodeURIComponent(id)}/status-history`,
  );

  return response.data.data;
}

export async function getCasualtyTriageHistory(
  id: string,
): Promise<CasualtyTriageHistoryItem[]> {
  const response = await api.get<CasualtyTriageHistoryResponse>(
    `/casualties/${encodeURIComponent(id)}/triage-history`,
  );

  return response.data.data;
}

export async function getCasualtyTransportHistory(
  id: string,
): Promise<CasualtyTransportHistoryItem[]> {
  const response = await api.get<CasualtyTransportHistoryResponse>(
    `/casualties/${encodeURIComponent(id)}/transport-history`,
  );

  return response.data.data;
}

export async function getCasualtyVerificationHistory(
  id: string,
): Promise<CasualtyVerificationHistoryItem[]> {
  const response =
    await api.get<CasualtyVerificationHistoryResponse>(
      `/casualties/${encodeURIComponent(id)}/verification-history`,
    );

  return response.data.data;
}

export async function updateCasualtyVerification(
  id: string,
  payload: UpdateCasualtyVerificationPayload,
): Promise<CasualtyRecord> {
  const response = await api.patch<CasualtyResponse>(
    `/casualties/${encodeURIComponent(id)}/verification`,
    payload,
  );

  return response.data.data;
}

export type CreateCasualtyPayload = {
  clientRecordId: string;
  incidentId: string;

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
    healthcareFacilityId?: string;
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

  triageAssessment?: CasualtyTriageAssessmentPayload;
  transportRecord?: CasualtyTransportRecordPayload;
};

type CreateCasualtyResponse = {
  success: boolean;
  message: string;
  data: {
    casualty: unknown;
    casualtyIncident: {
      id: string;
    };
    incident: unknown;
    encoder: unknown;
  };
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
  triageAssessment?: CasualtyTriageAssessmentPayload;
  transportRecord?: CasualtyTransportRecordPayload;
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
