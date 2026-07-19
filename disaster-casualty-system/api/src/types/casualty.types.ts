export type CasualtyStatus =
  | "safe"
  | "displaced"
  | "evacuated"
  | "rescued"
  | "missing"
  | "injured"
  | "hospitalized"
  | "deceased"
  | "unknown";

export type CasualtySeverity =
  | "none"
  | "minor"
  | "moderate"
  | "severe"
  | "critical";

export type IdentificationStatus =
  | "identified"
  | "partially_identified"
  | "unidentified";

export type TriageSystem =
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

export type TriageCategory =
  | "immediate"
  | "delayed"
  | "minimal"
  | "expectant"
  | "unknown";

export type TriageStage =
  | "on_site"
  | "facility_arrival"
  | "reassessment";

export interface CasualtyTriageAssessmentRequest {
  triageSystem: TriageSystem;
  triageCategory: TriageCategory;
  triageStage?: TriageStage;
  triagedAt?: string;
  location?: string;
  notes?: string;
}

export type TransportRequired = "yes" | "no" | "unknown";

export type TransportMode =
  | "ems"
  | "private_vehicle"
  | "independent"
  | "walk_in"
  | "other"
  | "unknown";

export type EmsUnitType = "bls" | "als" | "other" | "unknown";

export interface CasualtyTransportRecordRequest {
  transportRequired: TransportRequired;
  transportMode?: TransportMode;
  emsUnitType?: EmsUnitType;
  departedSceneAt?: string;
  arrivedFacilityAt?: string;
  receivingFacilityId?: string;
  notes?: string;
}

export interface CreateCasualtyRequest {
  clientRecordId: string;
  incidentId: string;

  person: {
    idNumber?: string;
    idType?: string;
    identificationStatus: IdentificationStatus;

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
    currentStatus: CasualtyStatus;
    severity?: CasualtySeverity;

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

  triageAssessment?: CasualtyTriageAssessmentRequest;
  transportRecord?: CasualtyTransportRecordRequest;
}

export interface UpdateCasualtyRequest {
  incidentId?: string;

  person?: Partial<CreateCasualtyRequest["person"]>;

  incidentDetails?: Partial<
    CreateCasualtyRequest["incidentDetails"]
  >;

  triageAssessment?: CasualtyTriageAssessmentRequest;
  transportRecord?: CasualtyTransportRecordRequest;
}
