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
}

export interface UpdateCasualtyRequest {
  incidentId?: string;

  person?: Partial<CreateCasualtyRequest["person"]>;

  incidentDetails?: Partial<
    CreateCasualtyRequest["incidentDetails"]
  >;
}
