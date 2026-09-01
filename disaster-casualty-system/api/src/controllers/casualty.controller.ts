import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { calculateTriageCategory } from "../services/triage/calculate-triage.js";
import { compareTriageCategories } from "../services/triage/compare-triage.js";
import type {
  CasualtyTreatmentRecordRequest,
  CasualtyTransportRecordRequest,
  CasualtyTriageAssessmentRequest,
  CasualtyOutcomeRequest,
  CreateCasualtyRequest,
  FacilityEncounterRequest,
  UpdateCasualtyRequest,
} from "../types/casualty.types.js";
import type {
  TriageCategory,
  TriageSystem,
} from "../types/triage.types.js";

const casualtyStatuses = [
  "safe",
  "displaced",
  "evacuated",
  "rescued",
  "missing",
  "injured",
  "hospitalized",
  "deceased",
  "unknown",
];

const casualtySeverities = [
  "none",
  "minor",
  "moderate",
  "severe",
  "critical",
];

const identificationStatuses = [
  "identified",
  "partially_identified",
  "unidentified",
];

const triageSystems = [
  "stieve",
  "urgent_non_urgent",
  "nato",
  "start",
  "mstart",
  "jumpstart",
  "sieve",
  "sieve_sort",
  "save",
  "sort",
  "meta",
  "swift",
  "smart",
  "rts",
  "care_flight",
  "mass",
  "esi",
  "metts",
  "salt",
  "ptt",
  "mitt",
  "homebush",
  "mptt",
  "stm",
  "ed_triage",
  "other",
];

const triageCategories = [
  "immediate",
  "delayed",
  "minimal",
  "expectant",
  "unknown",
];

const triageStages = [
  "on_site",
  "facility_arrival",
  "reassessment",
];

const transportRequiredValues = ["yes", "no", "unknown"];

const transportModes = [
  "ems",
  "private_vehicle",
  "independent",
  "walk_in",
  "other",
  "unknown",
];

const emsUnitTypes = ["bls", "als", "other", "unknown"];

const treatmentStrategies = [
  "scoop_and_run",
  "scooter",
  "stay_and_play",
  "play_and_run",
  "unknown",
];

const facilityDispositions = [
  "active_care",
  "hospital_admission",
  "discharged_home",
  "transferred",
  "deceased",
  "left_without_treatment",
  "unknown",
];

const deathStages = ["impact", "prehospital", "in_hospital"];

const finalDispositions = [
  "alive",
  "deceased",
  "transferred",
  "discharged",
  "unknown",
];

const verificationStatuses = [
  "submitted",
  "under_review",
  "verified",
  "rejected",
] as const;

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

type VerificationStatus = (typeof verificationStatuses)[number];

const casualtyDataEntryRoles = new Set([
  "responder",
  "field_responder",
  "sa_responder",
  "documenter",
  "medical_personnel",
  "bystander",
]);

const casualtyAdminScopeRoles = new Set([
  "admin",
  "administrator",
]);

function shouldScopeToOwnCasualties(role: string): boolean {
  return casualtyDataEntryRoles.has(role);
}

async function getCasualtyScopeEncoderIds(user: {
  id: string;
  role: string;
}): Promise<string[] | null> {
  if (user.role === "super_admin") {
    return null;
  }

  if (!casualtyAdminScopeRoles.has(user.role)) {
    return [user.id];
  }

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("created_by", user.id);

  if (error) {
    throw new Error(
      `Unable to retrieve admin-created accounts: ${error.message}`,
    );
  }

  return [
    user.id,
    ...((data ?? [])
      .map((account) => account.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0,
      )),
  ];
}

function normalizeVerificationStatus(
  value: unknown,
): VerificationStatus {
  return verificationStatuses.includes(value as VerificationStatus)
    ? (value as VerificationStatus)
    : "submitted";
}

async function canAccessCasualtyRecord(
  casualtyIncidentId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  const scopedEncoderIds = await getCasualtyScopeEncoderIds({
    id: userId,
    role: userRole,
  });

  if (!scopedEncoderIds) {
    return true;
  }

  const { data, error } = await supabase
    .from("casualty_incidents")
    .select("id")
    .eq("id", casualtyIncidentId)
    .in("encoded_by", scopedEncoderIds)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to verify casualty access: ${error.message}`);
  }

  return Boolean(data);
}

type UpdateCasualtyVerificationRequest = {
  status: VerificationStatus;
  notes?: string;
};

type VerificationActionLogRow = {
  id: string;
  casualty_incident_id: string;
  old_status: VerificationStatus | null;
  new_status: VerificationStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
};

type VerificationReviewerProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  assigned_municipality: string | null;
  assigned_barangay: string | null;
};

type VerificationActionLogItem = VerificationActionLogRow & {
  action_type: "verification" | "casualty_submission";
  result: "Successful" | "Not Successful";
  reviewed_by_user: VerificationReviewerProfile | null;
  casualty_record: unknown;
};

type CreateCasualtyRpcResult = {
  casualty: unknown;
  casualtyIncident: {
    id: string;
  };
  incident: {
    id: string;
    incidentCode: string;
    incidentName: string;
  };
  encoder: {
    id: string;
    fullName: string;
  };
  triageAssessment: unknown;
  transportRecord: unknown;
};

type LatestTriageAssessmentSummary = {
  id: string;
  casualty_incident_id: string;
  triage_system: string;
  triage_category: string;
  responder_category: string | null;
  calculated_category: string | null;
  triage_stage: string;
  triaged_at: string;
  location: string | null;
  notes: string | null;
  assessment_answers: Record<string, unknown> | null;
};

type LatestTransportRecordSummary = {
  id: string;
  casualty_incident_id: string;
  transport_required: string;
  transport_mode: string;
  ems_unit_type: string;
  arrived_scene_at: string | null;
  departed_scene_at: string | null;
  arrived_facility_at: string | null;
  receiving_facility_id: string | null;
  notes: string | null;
  created_at: string;
};

const casualtyRecordSelect = `
  id,
  client_record_id,
  evacuation_center_id,
  healthcare_facility_id,
  current_status,
  severity,
  verification_status,
  verified_by,
  verified_at,
  current_location,
  hospital_name,
  visible_injury,
  medical_condition,
  assistance_needed,
  assistance_provided,
  remarks,
  reported_at,
  created_at,
  updated_at,
  latitude,
  longitude,
  casualty:casualties (
    id,
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
    contact_number,
    house_street,
    barangay,
    municipality,
    province,
    region
  ),
  incident:incidents (
    id,
    incident_code,
    incident_name,
    disaster_type,
    status
  ),
  evacuation_center:evacuation_centers (
    id,
    center_name,
    address,
    barangay,
    municipality,
    province
  ),
  healthcare_facility:healthcare_facilities (
    id,
    facility_name,
    facility_level,
    address,
    barangay,
    municipality,
    province
  ),
  encoder:users!casualty_incidents_encoded_by_fkey (
    id,
    full_name,
    email,
    role,
    assigned_municipality,
    assigned_barangay
  )
`;

async function attachLatestSummaries<
  T extends { id: string },
>(records: T[]): Promise<
  Array<
    T & {
      latest_triage_assessment: LatestTriageAssessmentSummary | null;
      latest_transport_record: LatestTransportRecordSummary | null;
    }
  >
> {
  if (records.length === 0) {
    return [];
  }

  const recordIds = records.map((record) => record.id);
  const [triageResult, transportResult] = await Promise.all([
    supabase
      .from("casualty_triage_assessments")
      .select(
        "id, casualty_incident_id, triage_system, triage_category, responder_category, calculated_category, triage_stage, triaged_at, location, notes, assessment_answers",
      )
      .in("casualty_incident_id", recordIds)
      .order("triaged_at", { ascending: false }),
    supabase
      .from("casualty_transport_records")
      .select(
        "id, casualty_incident_id, transport_required, transport_mode, ems_unit_type, arrived_scene_at, departed_scene_at, arrived_facility_at, receiving_facility_id, notes, created_at",
      )
      .in("casualty_incident_id", recordIds)
      .order("created_at", { ascending: false }),
  ]);

  if (triageResult.error) {
    throw new Error(
      `Unable to retrieve latest triage assessments: ${triageResult.error.message}`,
    );
  }

  if (transportResult.error) {
    throw new Error(
      `Unable to retrieve latest transport records: ${transportResult.error.message}`,
    );
  }

  const latestByRecordId = new Map<string, LatestTriageAssessmentSummary>();

  for (const assessment of (triageResult.data ?? []) as LatestTriageAssessmentSummary[]) {
    if (!latestByRecordId.has(assessment.casualty_incident_id)) {
      latestByRecordId.set(assessment.casualty_incident_id, assessment);
    }
  }

  const latestTransportByRecordId = new Map<
    string,
    LatestTransportRecordSummary
  >();

  for (const transport of (transportResult.data ?? []) as LatestTransportRecordSummary[]) {
    if (!latestTransportByRecordId.has(transport.casualty_incident_id)) {
      latestTransportByRecordId.set(
        transport.casualty_incident_id,
        transport,
      );
    }
  }

  return records.map((record) => ({
    ...record,
    latest_triage_assessment: latestByRecordId.get(record.id) ?? null,
    latest_transport_record:
      latestTransportByRecordId.get(record.id) ?? null,
  }));
}

function trimmedOrNull(
  value: string | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value.trim() || null;
}

async function ensureUniqueIdNumber(
  idNumber: string | undefined,
  excludeCasualtyId?: string,
): Promise<string | null> {
  const normalizedIdNumber = idNumber?.trim();

  if (!normalizedIdNumber) {
    return null;
  }

  let query = supabase
    .from("casualties")
    .select("id")
    .eq("id_number", normalizedIdNumber)
    .is("deleted_at", null)
    .limit(1);

  if (excludeCasualtyId) {
    query = query.neq("id", excludeCasualtyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to check duplicate ID number: ${error.message}`,
    );
  }

  return data?.[0]?.id ?? null;
}

function normalizeCasualtyIdUserCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getCasualtyIdSequenceFromNumber(
  idNumber: string | null | undefined,
  dateCode: string,
  userCode: string,
): number {
  const match = new RegExp(
    `^CAS:${dateCode}:${userCode}(\\d{3,})$`,
    "i",
  ).exec(idNumber ?? "");

  if (!match) {
    return 0;
  }

  const sequence = Number(match[1]);

  return Number.isFinite(sequence) ? sequence : 0;
}

function validateTriageAssessment(
  triageAssessment: CasualtyTriageAssessmentRequest | undefined,
  response: Response,
): boolean {
  if (!triageAssessment) {
    return true;
  }

  if (!triageSystems.includes(triageAssessment.triageSystem)) {
    response.status(400).json({
      success: false,
      message: "Invalid triage system.",
    });
    return false;
  }

  if (!triageCategories.includes(triageAssessment.triageCategory)) {
    response.status(400).json({
      success: false,
      message: "Invalid triage category.",
    });
    return false;
  }

  if (
    triageAssessment.triageStage !== undefined &&
    !triageStages.includes(triageAssessment.triageStage)
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid triage stage.",
    });
    return false;
  }

  if (triageAssessment.triagedAt) {
    const triagedAt = new Date(triageAssessment.triagedAt);

    if (Number.isNaN(triagedAt.getTime())) {
      response.status(400).json({
        success: false,
        message: "Invalid triage time.",
      });
      return false;
    }
  }

  if (
    triageAssessment.assessmentAnswers !== undefined &&
    !isObject(triageAssessment.assessmentAnswers)
  ) {
    response.status(400).json({
      success: false,
      message: "assessmentAnswers must be an object.",
    });
    return false;
  }

  return true;
}

function validateTransportRecord(
  transportRecord: CasualtyTransportRecordRequest | undefined,
  response: Response,
): boolean {
  if (!transportRecord) {
    return true;
  }

  if (
    !transportRequiredValues.includes(
      transportRecord.transportRequired,
    )
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid transport required value.",
    });
    return false;
  }

  const transportMode = transportRecord.transportMode ?? "unknown";

  if (!transportModes.includes(transportMode)) {
    response.status(400).json({
      success: false,
      message: "Invalid transport mode.",
    });
    return false;
  }

  const emsUnitType = transportRecord.emsUnitType ?? "unknown";

  if (!emsUnitTypes.includes(emsUnitType)) {
    response.status(400).json({
      success: false,
      message: "Invalid EMS unit type.",
    });
    return false;
  }

  const arrivedSceneAt = transportRecord.arrivedSceneAt
    ? new Date(transportRecord.arrivedSceneAt)
    : null;
  const departedSceneAt = transportRecord.departedSceneAt
    ? new Date(transportRecord.departedSceneAt)
    : null;
  const arrivedFacilityAt = transportRecord.arrivedFacilityAt
    ? new Date(transportRecord.arrivedFacilityAt)
    : null;

  if (
    arrivedSceneAt &&
    Number.isNaN(arrivedSceneAt.getTime())
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid EMS scene arrival time.",
    });
    return false;
  }

  if (
    departedSceneAt &&
    Number.isNaN(departedSceneAt.getTime())
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid departed scene time.",
    });
    return false;
  }

  if (
    arrivedFacilityAt &&
    Number.isNaN(arrivedFacilityAt.getTime())
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid arrived facility time.",
    });
    return false;
  }

  if (
    arrivedSceneAt &&
    departedSceneAt &&
    departedSceneAt < arrivedSceneAt
  ) {
    response.status(400).json({
      success: false,
      message:
        "Departed scene time cannot be before EMS scene arrival time.",
    });
    return false;
  }

  if (
    departedSceneAt &&
    arrivedFacilityAt &&
    arrivedFacilityAt < departedSceneAt
  ) {
    response.status(400).json({
      success: false,
      message:
        "Arrived facility time cannot be before departed scene time.",
    });
    return false;
  }

  return true;
}

function validateTreatmentRecord(
  treatmentRecord: CasualtyTreatmentRecordRequest | undefined,
  response: Response,
): boolean {
  if (!treatmentRecord) {
    return true;
  }

  if (
    !treatmentStrategies.includes(treatmentRecord.treatmentStrategy)
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid on-site treatment strategy.",
    });
    return false;
  }

  if (treatmentRecord.stabilizationStartedAt) {
    const stabilizationStartedAt = new Date(
      treatmentRecord.stabilizationStartedAt,
    );

    if (Number.isNaN(stabilizationStartedAt.getTime())) {
      response.status(400).json({
        success: false,
        message: "Invalid stabilization start time.",
      });
      return false;
    }
  }

  if (treatmentRecord.stabilizedAt) {
    const stabilizedAt = new Date(treatmentRecord.stabilizedAt);

    if (Number.isNaN(stabilizedAt.getTime())) {
      response.status(400).json({
        success: false,
        message: "Invalid stabilized time.",
      });
      return false;
    }
  }

  if (
    treatmentRecord.stabilizationStartedAt &&
    treatmentRecord.stabilizedAt &&
    new Date(treatmentRecord.stabilizedAt) <
      new Date(treatmentRecord.stabilizationStartedAt)
  ) {
    response.status(400).json({
      success: false,
      message:
        "Stabilized time cannot be before stabilization start time.",
    });
    return false;
  }

  if (
    treatmentRecord.treatmentDetails !== undefined &&
    !isObject(treatmentRecord.treatmentDetails)
  ) {
    response.status(400).json({
      success: false,
      message: "treatmentDetails must be an object.",
    });
    return false;
  }

  return true;
}

function validateCasualtyOutcome(
  casualtyOutcome: CasualtyOutcomeRequest | undefined,
  response: Response,
): boolean {
  if (!casualtyOutcome) {
    return true;
  }

  if (
    casualtyOutcome.deathStage !== undefined &&
    casualtyOutcome.deathStage !== null &&
    !deathStages.includes(casualtyOutcome.deathStage)
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid death stage.",
    });
    return false;
  }

  if (
    casualtyOutcome.finalDisposition !== undefined &&
    casualtyOutcome.finalDisposition !== null &&
    !finalDispositions.includes(casualtyOutcome.finalDisposition)
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid final disposition.",
    });
    return false;
  }

  if (casualtyOutcome.deathAt) {
    const deathAt = new Date(casualtyOutcome.deathAt);

    if (Number.isNaN(deathAt.getTime())) {
      response.status(400).json({
        success: false,
        message: "Invalid death time.",
      });
      return false;
    }
  }

  return true;
}

function validateFacilityEncounter(
  facilityEncounter: FacilityEncounterRequest | undefined,
  response: Response,
): boolean {
  if (!facilityEncounter) {
    return true;
  }

  if (
    facilityEncounter.disposition !== undefined &&
    !facilityDispositions.includes(facilityEncounter.disposition)
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid facility disposition.",
    });
    return false;
  }

  const arrivedAt = facilityEncounter.arrivedAt
    ? new Date(facilityEncounter.arrivedAt)
    : null;
  const edAdmittedAt = facilityEncounter.edAdmittedAt
    ? new Date(facilityEncounter.edAdmittedAt)
    : null;
  const edDepartedAt = facilityEncounter.edDepartedAt
    ? new Date(facilityEncounter.edDepartedAt)
    : null;
  const hospitalAdmittedAt = facilityEncounter.hospitalAdmittedAt
    ? new Date(facilityEncounter.hospitalAdmittedAt)
    : null;
  const hospitalDischargedAt = facilityEncounter.hospitalDischargedAt
    ? new Date(facilityEncounter.hospitalDischargedAt)
    : null;
  const edResuscitationStartedAt =
    facilityEncounter.edResuscitationStartedAt
      ? new Date(facilityEncounter.edResuscitationStartedAt)
      : null;
  const surgicalInterventionStartedAt =
    facilityEncounter.surgicalInterventionStartedAt
      ? new Date(facilityEncounter.surgicalInterventionStartedAt)
      : null;
  const surgicalInterventionEndedAt =
    facilityEncounter.surgicalInterventionEndedAt
      ? new Date(facilityEncounter.surgicalInterventionEndedAt)
      : null;
  const operatingRoomStartedAt = facilityEncounter.operatingRoomStartedAt
    ? new Date(facilityEncounter.operatingRoomStartedAt)
    : null;
  const xrayPerformedAt = facilityEncounter.xrayPerformedAt
    ? new Date(facilityEncounter.xrayPerformedAt)
    : null;
  const ultrasoundPerformedAt = facilityEncounter.ultrasoundPerformedAt
    ? new Date(facilityEncounter.ultrasoundPerformedAt)
    : null;
  const ctPerformedAt = facilityEncounter.ctPerformedAt
    ? new Date(facilityEncounter.ctPerformedAt)
    : null;
  const icuAdmittedAt = facilityEncounter.icuAdmittedAt
    ? new Date(facilityEncounter.icuAdmittedAt)
    : null;
  const icuDischargedAt = facilityEncounter.icuDischargedAt
    ? new Date(facilityEncounter.icuDischargedAt)
    : null;
  const ventilationStartedAt = facilityEncounter.ventilationStartedAt
    ? new Date(facilityEncounter.ventilationStartedAt)
    : null;
  const ventilationEndedAt = facilityEncounter.ventilationEndedAt
    ? new Date(facilityEncounter.ventilationEndedAt)
    : null;

  if (arrivedAt && Number.isNaN(arrivedAt.getTime())) {
    response.status(400).json({
      success: false,
      message: "Invalid facility arrival time.",
    });
    return false;
  }

  if (edAdmittedAt && Number.isNaN(edAdmittedAt.getTime())) {
    response.status(400).json({
      success: false,
      message: "Invalid ED admission time.",
    });
    return false;
  }

  if (edDepartedAt && Number.isNaN(edDepartedAt.getTime())) {
    response.status(400).json({
      success: false,
      message: "Invalid ED discharge time.",
    });
    return false;
  }

  if (
    edResuscitationStartedAt &&
    Number.isNaN(edResuscitationStartedAt.getTime())
  ) {
    response.status(400).json({
      success: false,
      message: "Invalid ED resuscitation room time.",
    });
    return false;
  }

  const hospitalTimes: Array<[Date | null, string]> = [
    [hospitalAdmittedAt, "Invalid hospital admission time."],
    [hospitalDischargedAt, "Invalid hospital discharge time."],
    [surgicalInterventionStartedAt, "Invalid surgery start time."],
    [surgicalInterventionEndedAt, "Invalid surgery end time."],
    [operatingRoomStartedAt, "Invalid operating room time."],
    [xrayPerformedAt, "Invalid X-ray time."],
    [ultrasoundPerformedAt, "Invalid ultrasound time."],
    [ctPerformedAt, "Invalid CT scan time."],
    [icuAdmittedAt, "Invalid ICU admission time."],
    [icuDischargedAt, "Invalid ICU transfer out time."],
    [ventilationStartedAt, "Invalid ventilation start time."],
    [ventilationEndedAt, "Invalid ventilation end time."],
  ];

  for (const [dateValue, message] of hospitalTimes) {
    if (dateValue && Number.isNaN(dateValue.getTime())) {
      response.status(400).json({
        success: false,
        message,
      });
      return false;
    }
  }

  if (arrivedAt && edAdmittedAt && edAdmittedAt < arrivedAt) {
    response.status(400).json({
      success: false,
      message: "ED admission time cannot be before facility arrival time.",
    });
    return false;
  }

  if (arrivedAt && edDepartedAt && edDepartedAt < arrivedAt) {
    response.status(400).json({
      success: false,
      message: "ED discharge time cannot be before facility arrival time.",
    });
    return false;
  }

  if (edAdmittedAt && edDepartedAt && edDepartedAt < edAdmittedAt) {
    response.status(400).json({
      success: false,
      message: "ED discharge time cannot be before ED admission time.",
    });
    return false;
  }

  if (
    hospitalAdmittedAt &&
    hospitalDischargedAt &&
    hospitalDischargedAt < hospitalAdmittedAt
  ) {
    response.status(400).json({
      success: false,
      message:
        "Hospital discharge time cannot be before hospital admission time.",
    });
    return false;
  }

  if (
    icuAdmittedAt &&
    icuDischargedAt &&
    icuDischargedAt < icuAdmittedAt
  ) {
    response.status(400).json({
      success: false,
      message: "ICU transfer out time cannot be before ICU admission time.",
    });
    return false;
  }

  if (
    ventilationStartedAt &&
    ventilationEndedAt &&
    ventilationEndedAt < ventilationStartedAt
  ) {
    response.status(400).json({
      success: false,
      message:
        "Ventilation end time cannot be before ventilation start time.",
    });
    return false;
  }

  if (
    surgicalInterventionStartedAt &&
    surgicalInterventionEndedAt &&
    surgicalInterventionEndedAt < surgicalInterventionStartedAt
  ) {
    response.status(400).json({
      success: false,
      message: "Surgery end time cannot be before surgery start time.",
    });
    return false;
  }

  const facilityBasedTimes: Array<[Date | null, string]> = [
    [
      surgicalInterventionStartedAt,
      "Surgery start time cannot be before facility arrival time.",
    ],
    [
      hospitalAdmittedAt,
      "Hospital admission time cannot be before facility arrival time.",
    ],
    [
      operatingRoomStartedAt,
      "Operating room time cannot be before facility arrival time.",
    ],
    [xrayPerformedAt, "X-ray time cannot be before facility arrival time."],
    [
      ultrasoundPerformedAt,
      "Ultrasound time cannot be before facility arrival time.",
    ],
    [ctPerformedAt, "CT scan time cannot be before facility arrival time."],
    [
      icuAdmittedAt,
      "ICU admission time cannot be before facility arrival time.",
    ],
  ];

  for (const [dateValue, message] of facilityBasedTimes) {
    if (arrivedAt && dateValue && dateValue < arrivedAt) {
      response.status(400).json({
        success: false,
        message,
      });
      return false;
    }
  }

  return true;
}

async function ensureActiveHealthcareFacility(
  facilityId: string | undefined,
  response: Response,
): Promise<boolean> {
  if (!facilityId) {
    return true;
  }

  const { data: facility, error: facilityError } = await supabase
    .from("healthcare_facilities")
    .select("id, is_active")
    .eq("id", facilityId)
    .maybeSingle();

  if (facilityError || !facility) {
    response.status(404).json({
      success: false,
      message: "Healthcare facility not found.",
    });
    return false;
  }

  if (!facility.is_active) {
    response.status(400).json({
      success: false,
      message: "Healthcare facility is inactive.",
    });
    return false;
  }

  return true;
}

async function insertTriageAssessment(
  casualtyIncidentId: string,
  userId: string,
  triageAssessment: CasualtyTriageAssessmentRequest,
): Promise<void> {
  const assessmentAnswers = triageAssessment.assessmentAnswers;
  const hasAssessmentAnswers =
    assessmentAnswers !== undefined &&
    Object.keys(assessmentAnswers).length > 0;
  const responderCategory =
    triageAssessment.triageCategory as TriageCategory;
  let calculatedCategory: TriageCategory | null = null;
  let isOverTriage = false;
  let isUnderTriage = false;
  let algorithmVersion: string | null = null;

  if (hasAssessmentAnswers) {
    calculatedCategory = calculateTriageCategory(
      triageAssessment.triageSystem as TriageSystem,
      assessmentAnswers,
    );
    algorithmVersion = `${triageAssessment.triageSystem}-v1`;

    const comparison = compareTriageCategories(
      responderCategory,
      calculatedCategory,
    );

    isOverTriage = comparison.isOverTriage;
    isUnderTriage = comparison.isUnderTriage;
  }

  const { error } = await supabase
    .from("casualty_triage_assessments")
    .insert({
      casualty_incident_id: casualtyIncidentId,
      triage_system: triageAssessment.triageSystem,
      triage_category: triageAssessment.triageCategory,
      responder_category: responderCategory,
      calculated_category: calculatedCategory,
      triage_stage: triageAssessment.triageStage ?? "on_site",
      triaged_at:
        triageAssessment.triagedAt ?? new Date().toISOString(),
      triaged_by: userId,
      location: triageAssessment.location?.trim() || null,
      notes: triageAssessment.notes?.trim() || null,
      assessment_answers: assessmentAnswers ?? null,
      algorithm_version: algorithmVersion,
      is_over_triage: isOverTriage,
      is_under_triage: isUnderTriage,
    });

  if (error) {
    throw new Error(
      `Unable to record triage assessment: ${error.message}`,
    );
  }
}

async function insertTransportRecord(
  casualtyIncidentId: string,
  userId: string,
  transportRecord: CasualtyTransportRecordRequest,
): Promise<void> {
  const { error } = await supabase
    .from("casualty_transport_records")
    .insert({
      casualty_incident_id: casualtyIncidentId,
      transport_required: transportRecord.transportRequired,
      transport_mode: transportRecord.transportMode ?? "unknown",
      ems_unit_type: transportRecord.emsUnitType ?? "unknown",
      arrived_scene_at: transportRecord.arrivedSceneAt ?? null,
      departed_scene_at: transportRecord.departedSceneAt ?? null,
      arrived_facility_at: transportRecord.arrivedFacilityAt ?? null,
      receiving_facility_id:
        transportRecord.receivingFacilityId ?? null,
      recorded_by: userId,
      notes: transportRecord.notes?.trim() || null,
    });

  if (error) {
    throw new Error(
      `Unable to record transport details: ${error.message}`,
    );
  }
}

async function insertTreatmentRecord(
  casualtyIncidentId: string,
  userId: string,
  treatmentRecord: CasualtyTreatmentRecordRequest,
): Promise<void> {
  const { error } = await supabase
    .from("casualty_treatments")
    .insert({
      casualty_incident_id: casualtyIncidentId,
      treatment_strategy: treatmentRecord.treatmentStrategy,
      treatment_area_name:
        treatmentRecord.treatmentAreaName?.trim() || null,
      stabilization_started_at:
        treatmentRecord.stabilizationStartedAt ?? null,
      stabilized_at: treatmentRecord.stabilizedAt ?? null,
      treatment_details: treatmentRecord.treatmentDetails ?? {},
      notes: treatmentRecord.notes?.trim() || null,
      performed_by: userId,
    });

  if (error) {
    throw new Error(
      `Unable to record on-site treatment: ${error.message}`,
    );
  }
}

async function insertFacilityEncounter(
  casualtyIncidentId: string,
  userId: string,
  facilityEncounter: FacilityEncounterRequest,
): Promise<void> {
  if (!facilityEncounter.facilityId) {
    return;
  }

  const { error } = await supabase
    .from("facility_encounters")
    .insert({
      casualty_incident_id: casualtyIncidentId,
      facility_id: facilityEncounter.facilityId,
      arrived_at: facilityEncounter.arrivedAt ?? null,
      ed_admitted_at: facilityEncounter.edAdmittedAt ?? null,
      ed_departed_at: facilityEncounter.edDepartedAt ?? null,
      referred_or_transferred:
        facilityEncounter.referredOrTransferred ?? null,
      sought_ed_care: facilityEncounter.soughtEdCare ?? null,
      admitted_to_hospital:
        facilityEncounter.admittedToHospital ?? null,
      discharged_home: facilityEncounter.dischargedHome ?? null,
      ed_resuscitation_started_at:
        facilityEncounter.edResuscitationStartedAt ?? null,
      surgical_intervention_started_at:
        facilityEncounter.surgicalInterventionStartedAt ?? null,
      surgical_intervention_ended_at:
        facilityEncounter.surgicalInterventionEndedAt ?? null,
      operating_room_started_at:
        facilityEncounter.operatingRoomStartedAt ?? null,
      xray_required: facilityEncounter.xrayRequired ?? null,
      xray_performed_at: facilityEncounter.xrayPerformedAt ?? null,
      ultrasound_required: facilityEncounter.ultrasoundRequired ?? null,
      ultrasound_performed_at:
        facilityEncounter.ultrasoundPerformedAt ?? null,
      ct_required: facilityEncounter.ctRequired ?? null,
      ct_performed_at: facilityEncounter.ctPerformedAt ?? null,
      icu_admitted_at: facilityEncounter.icuAdmittedAt ?? null,
      hospital_admitted_at: facilityEncounter.hospitalAdmittedAt ?? null,
      hospital_discharged_at:
        facilityEncounter.hospitalDischargedAt ?? null,
      icu_discharged_at: facilityEncounter.icuDischargedAt ?? null,
      mechanical_ventilation_required:
        facilityEncounter.mechanicalVentilationRequired ?? null,
      ventilation_started_at:
        facilityEncounter.ventilationStartedAt ?? null,
      ventilation_ended_at: facilityEncounter.ventilationEndedAt ?? null,
      alternative_icu_used:
        facilityEncounter.alternativeIcuUsed ?? null,
      disposition: facilityEncounter.disposition ?? "unknown",
      recorded_by: userId,
    });

  if (error) {
    throw new Error(
      `Unable to record facility encounter: ${error.message}`,
    );
  }
}

async function upsertCasualtyOutcome(
  casualtyIncidentId: string,
  userId: string,
  casualtyOutcome: CasualtyOutcomeRequest,
  currentStatus?: string | null,
): Promise<void> {
  const died =
    casualtyOutcome.died ??
    (currentStatus === "deceased" ? true : null);
  const finalDisposition =
    casualtyOutcome.finalDisposition ??
    (died === true ? "deceased" : null);

  const { error } = await supabase
    .from("casualty_outcomes")
    .upsert(
      {
        casualty_incident_id: casualtyIncidentId,
        reached_hospital: casualtyOutcome.reachedHospital ?? null,
        medical_contact_before_death:
          casualtyOutcome.medicalContactBeforeDeath ?? null,
        died: died ?? false,
        death_stage: casualtyOutcome.deathStage ?? null,
        death_at: casualtyOutcome.deathAt ?? null,
        final_disposition: finalDisposition,
        recorded_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "casualty_incident_id" },
    );

  if (error) {
    throw new Error(
      `Unable to record casualty outcome: ${error.message}`,
    );
  }
}

export async function createCasualty(
  request: Request<
    Record<string, never>,
    unknown,
    CreateCasualtyRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      clientRecordId,
      incidentId,
      person,
      incidentDetails,
      triageAssessment,
      transportRecord,
      treatmentRecord,
      facilityEncounter,
      casualtyOutcome,
    } = request.body;
    const user = getAuthenticatedUser(request);

    if (!clientRecordId || !incidentId) {
      response.status(400).json({
        success: false,
        message:
          "clientRecordId and incidentId are required.",
      });
      return;
    }

    if (!person || !incidentDetails) {
      response.status(400).json({
        success: false,
        message: "person and incidentDetails are required.",
      });
      return;
    }

    if (
      !identificationStatuses.includes(
        person.identificationStatus,
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid identification status.",
      });
      return;
    }

    if (
      person.identificationStatus === "identified" &&
      !person.firstName?.trim() &&
      !person.lastName?.trim()
    ) {
      response.status(400).json({
        success: false,
        message:
          "An identified person must have a first name or last name.",
      });
      return;
    }

    if (
      person.estimatedAge !== undefined &&
      (
        !Number.isInteger(person.estimatedAge) ||
        person.estimatedAge < 0 ||
        person.estimatedAge > 130
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Estimated age must be from 0 to 130.",
      });
      return;
    }

    if (
      !casualtyStatuses.includes(
        incidentDetails.currentStatus,
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid casualty status.",
      });
      return;
    }

    const severity = incidentDetails.severity ?? "none";

    if (!casualtySeverities.includes(severity)) {
      response.status(400).json({
        success: false,
        message: "Invalid casualty severity.",
      });
      return;
    }

    if (
      incidentDetails.latitude !== undefined &&
      (
        incidentDetails.latitude < -90 ||
        incidentDetails.latitude > 90
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Latitude must be from -90 to 90.",
      });
      return;
    }

    if (
      incidentDetails.longitude !== undefined &&
      (
        incidentDetails.longitude < -180 ||
        incidentDetails.longitude > 180
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Longitude must be from -180 to 180.",
      });
      return;
    }

    /*
     * Prevent the same offline record from being uploaded twice.
     */
    const { data: existingSubmission, error: duplicateError } =
      await supabase
        .from("casualty_incidents")
        .select("id, casualty_id, incident_id")
        .eq("client_record_id", clientRecordId)
        .maybeSingle();

    if (duplicateError) {
      throw new Error(
        `Unable to check duplicate submission: ${duplicateError.message}`,
      );
    }

    if (existingSubmission) {
      response.status(409).json({
        success: false,
        message: "This mobile record has already been synchronized.",
        data: existingSubmission,
      });
      return;
    }

    if (!validateTriageAssessment(triageAssessment, response)) {
      return;
    }

    if (!validateTransportRecord(transportRecord, response)) {
      return;
    }

    if (!validateTreatmentRecord(treatmentRecord, response)) {
      return;
    }

    if (!validateFacilityEncounter(facilityEncounter, response)) {
      return;
    }

    if (!validateCasualtyOutcome(casualtyOutcome, response)) {
      return;
    }

    const existingIdNumber = await ensureUniqueIdNumber(
      person.idNumber,
    );

    if (existingIdNumber) {
      response.status(409).json({
        success: false,
        message:
          "A casualty with this ID number already exists. Please generate a new record.",
      });
      return;
    }

    /*
     * Confirm that the selected disaster exists and is active.
     */
    const { data: incident, error: incidentError } =
      await supabase
        .from("incidents")
        .select("id, incident_code, incident_name, status")
        .eq("id", incidentId)
        .single();

    if (incidentError || !incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    if (incident.status !== "active") {
      response.status(400).json({
        success: false,
        message:
          "Casualties can only be submitted to an active incident.",
      });
      return;
    }

    if (
      !(await ensureActiveHealthcareFacility(
        incidentDetails.healthcareFacilityId,
        response,
      ))
    ) {
      return;
    }

    if (
      !(await ensureActiveHealthcareFacility(
        transportRecord?.receivingFacilityId,
        response,
      ))
    ) {
      return;
    }

    if (
      !(await ensureActiveHealthcareFacility(
        facilityEncounter?.facilityId,
        response,
      ))
    ) {
      return;
    }

    /*
     * Confirm that the authenticated encoder exists and is active.
     */
    const { data: encoder, error: encoderError } =
      await supabase
        .from("users")
        .select("id, full_name, role, is_active")
        .eq("id", user.id)
        .single();

    if (encoderError || !encoder) {
      response.status(404).json({
        success: false,
        message: "Encoder account not found.",
      });
      return;
    }

    if (!encoder.is_active) {
      response.status(403).json({
        success: false,
        message: "The encoder account is inactive.",
      });
      return;
    }

    const { data, error: transactionError } = await supabase.rpc(
      "create_casualty_record_transaction",
      {
        p_client_record_id: clientRecordId,
        p_incident_id: incidentId,
        p_encoded_by: user.id,
        p_person: person,
        p_incident_details: {
          ...incidentDetails,
          severity,
        },
        p_triage_assessment: triageAssessment ?? null,
        p_transport_record: transportRecord ?? null,
      },
    );

    const transactionResult =
      data as CreateCasualtyRpcResult | null;

    if (transactionError || !transactionResult) {
      throw new Error(
        `Unable to create casualty record: ${
          transactionError?.message ?? "Unknown database error"
        }`,
      );
    }

    if (treatmentRecord) {
      await insertTreatmentRecord(
        transactionResult.casualtyIncident.id,
        user.id,
        treatmentRecord,
      );
    }

    const encounterPayload = facilityEncounter ?? {
      facilityId:
        transportRecord?.receivingFacilityId ??
        incidentDetails.healthcareFacilityId,
      arrivedAt: transportRecord?.arrivedFacilityAt,
      referredOrTransferred: null,
      soughtEdCare:
        Boolean(
          transportRecord?.receivingFacilityId ??
            incidentDetails.healthcareFacilityId,
        ) || null,
      disposition: "unknown",
    };

    if (encounterPayload.facilityId) {
      await insertFacilityEncounter(
        transactionResult.casualtyIncident.id,
        user.id,
        encounterPayload,
      );
    }

    if (casualtyOutcome) {
      await upsertCasualtyOutcome(
        transactionResult.casualtyIncident.id,
        user.id,
        casualtyOutcome,
        incidentDetails.currentStatus,
      );
    }

    response.status(201).json({
      success: true,
      message: "Casualty record submitted successfully.",
      data: transactionResult,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCasualties(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const incidentId =
      typeof request.query.incidentId === "string"
        ? request.query.incidentId
        : undefined;

    const status =
      typeof request.query.status === "string"
        ? request.query.status
        : undefined;
    const fieldResponderLinks =
      request.query.fieldResponderLinks === "true";
    const canLoadFieldResponderLinks =
      fieldResponderLinks &&
      ["responder", "field_responder", "sa_responder"].includes(
        user.role,
      );
    const scopedEncoderIds = await getCasualtyScopeEncoderIds(user);

    if (fieldResponderLinks && !incidentId) {
      response.status(400).json({
        success: false,
        message:
          "incidentId is required when loading Field Responder victim codes.",
      });
      return;
    }

    let query = supabase
      .from("casualty_incidents")
      .select(casualtyRecordSelect)
      .is("deleted_at", null)
      .order("reported_at", { ascending: false });

    if (incidentId) {
      query = query.eq("incident_id", incidentId);
    }

    if (status) {
      query = query.eq("current_status", status);
    }

    if (scopedEncoderIds && !canLoadFieldResponderLinks) {
      query = query.in("encoded_by", scopedEncoderIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to retrieve casualties: ${error.message}`);
    }

    const recordsWithSummaries = await attachLatestSummaries(
      data ?? [],
    );

    response.status(200).json({
      success: true,
      count: recordsWithSummaries.length,
      data: recordsWithSummaries,
    });
  } catch (error) {
    next(error);
  }
}

export async function getNextCasualtyIdSequence(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawUserCode =
      typeof request.query.userCode === "string"
        ? request.query.userCode
        : "";
    const rawDateCode =
      typeof request.query.dateCode === "string"
        ? request.query.dateCode
        : "";
    const userCode = normalizeCasualtyIdUserCode(rawUserCode);
    const dateCode = rawDateCode.trim();

    if (!userCode) {
      response.status(400).json({
        success: false,
        message: "User code is required.",
      });
      return;
    }

    if (!/^\d{6}$/.test(dateCode)) {
      response.status(400).json({
        success: false,
        message: "Date code must use MMDDYY format.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("casualties")
      .select("id_number")
      .ilike("id_number", `CAS:${dateCode}:${userCode}%`)
      .is("deleted_at", null);

    if (error) {
      throw new Error(
        `Unable to retrieve casualty ID sequence: ${error.message}`,
      );
    }

    const highestSequence = (data ?? []).reduce((highest, record) => {
      return Math.max(
        highest,
        getCasualtyIdSequenceFromNumber(
          record.id_number,
          dateCode,
          userCode,
        ),
      );
    }, 0);
    const nextSequence = highestSequence + 1;

    response.status(200).json({
      success: true,
      data: {
        dateCode,
        userCode,
        nextSequence,
        formattedSequence: String(nextSequence).padStart(3, "0"),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCasualtyById(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);

    let query = supabase
      .from("casualty_incidents")
      .select(casualtyRecordSelect)
      .eq("id", id)
      .is("deleted_at", null);

    if (shouldScopeToOwnCasualties(user.role)) {
      query = query.eq("encoded_by", user.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Unable to retrieve casualty: ${error.message}`);
    }

    if (!data) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    response.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCasualtyStatusHistory(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);

    const hasAccess = await canAccessCasualtyRecord(
      id,
      user.id,
      user.role,
    );

    if (!hasAccess) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("casualty_status_history")
      .select(
        "id, casualty_incident_id, old_status, new_status, changed_by, change_reason, created_at",
      )
      .eq("casualty_incident_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(
        `Unable to retrieve status history: ${error.message}`,
      );
    }

    const changedByIds = [
      ...new Set(
        (data ?? [])
          .map((item) => item.changed_by)
          .filter(
            (changedBy): changedBy is string =>
              typeof changedBy === "string" &&
              changedBy.trim().length > 0,
          ),
      ),
    ];

    const usersById = new Map<
      string,
      {
        id: string;
        full_name: string;
        email: string;
        role: string;
      }
    >();

    if (changedByIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .in("id", changedByIds);

      if (usersError) {
        throw new Error(
          `Unable to retrieve status history users: ${usersError.message}`,
        );
      }

      for (const user of users ?? []) {
        usersById.set(user.id, user);
      }
    }

    const history = (data ?? []).map((item) => ({
      ...item,
      changed_by_user: item.changed_by
        ? usersById.get(item.changed_by) ?? null
        : null,
    }));

    response.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCasualtyVerificationHistory(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);

    const hasAccess = await canAccessCasualtyRecord(
      id,
      user.id,
      user.role,
    );

    if (!hasAccess) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("casualty_verification_history")
      .select(
        "id, casualty_incident_id, old_status, new_status, reviewed_by, review_notes, created_at",
      )
      .eq("casualty_incident_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(
        `Unable to retrieve verification history: ${error.message}`,
      );
    }

    const reviewerIds = [
      ...new Set(
        (data ?? [])
          .map((item) => item.reviewed_by)
          .filter(
            (reviewedBy): reviewedBy is string =>
              typeof reviewedBy === "string" &&
              reviewedBy.trim().length > 0,
          ),
      ),
    ];

    const usersById = new Map<
      string,
      {
        id: string;
        full_name: string;
        email: string;
        role: string;
      }
    >();

    if (reviewerIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .in("id", reviewerIds);

      if (usersError) {
        throw new Error(
          `Unable to retrieve verification reviewers: ${usersError.message}`,
        );
      }

      for (const user of users ?? []) {
        usersById.set(user.id, user);
      }
    }

    const history = (data ?? []).map((item) => ({
      ...item,
      reviewed_by_user: item.reviewed_by
        ? usersById.get(item.reviewed_by) ?? null
        : null,
    }));

    response.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCasualtyVerificationActionLogs(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const isUnitScopedAdmin =
      user.role === "admin" || user.role === "administrator";

    const {
      data: reviewerProfile,
      error: reviewerError,
    } = await supabase
      .from("users")
      .select(
        "id, full_name, email, role, assigned_municipality, assigned_barangay",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (reviewerError) {
      throw new Error(
        `Unable to retrieve action log reviewer: ${reviewerError.message}`,
      );
    }

    const reviewer =
      (reviewerProfile as VerificationReviewerProfile | null) ?? {
        id: user.id,
        full_name: user.fullName,
        email: user.email,
        role: user.role,
        assigned_municipality: null,
        assigned_barangay: null,
      };

    const casualtyRecordsById = new Map<string, unknown>();
    const submissionLogs: VerificationActionLogItem[] = [];
    let scopedCasualtyIncidentIds: string[] | null = null;

    if (isUnitScopedAdmin) {
      const { data: unitUsers, error: unitUsersError } = await supabase
        .from("users")
        .select(
          "id, full_name, email, role, assigned_municipality, assigned_barangay",
        )
        .eq("created_by", user.id)
        .in("role", ["responder", "documenter"]);

      if (unitUsersError) {
        throw new Error(
          `Unable to retrieve admin-created accounts: ${unitUsersError.message}`,
        );
      }

      const unitUsersById = new Map(
        ((unitUsers ?? []) as VerificationReviewerProfile[]).map(
          (unitUser) => [unitUser.id, unitUser],
        ),
      );
      const unitUserIds = [user.id, ...unitUsersById.keys()];

      if (unitUserIds.length > 0) {
        const {
          data: scopedCasualtyRecords,
          error: scopedCasualtyRecordsError,
        } = await supabase
          .from("casualty_incidents")
          .select(casualtyRecordSelect)
          .in("encoded_by", unitUserIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(250);

        if (scopedCasualtyRecordsError) {
          throw new Error(
            `Unable to retrieve admin-created account casualty records: ${scopedCasualtyRecordsError.message}`,
          );
        }

        for (const casualtyRecord of scopedCasualtyRecords ?? []) {
          if (
            !isObject(casualtyRecord) ||
            typeof casualtyRecord.id !== "string"
          ) {
            continue;
          }

          casualtyRecordsById.set(casualtyRecord.id, casualtyRecord);

          const encoder = isObject(casualtyRecord.encoder)
            ? (casualtyRecord.encoder as unknown as VerificationReviewerProfile)
            : null;
          const actor =
            encoder?.id && unitUsersById.has(encoder.id)
              ? unitUsersById.get(encoder.id) ?? encoder
              : encoder;
          const createdAt =
            typeof casualtyRecord.created_at === "string"
              ? casualtyRecord.created_at
              : new Date().toISOString();

          submissionLogs.push({
            id: `casualty-submission-${casualtyRecord.id}`,
            action_type: "casualty_submission",
            casualty_incident_id: casualtyRecord.id,
            old_status: null,
            new_status: normalizeVerificationStatus(
              casualtyRecord.verification_status,
            ),
            reviewed_by: actor?.id ?? null,
            review_notes: null,
            created_at: createdAt,
            result: "Successful",
            reviewed_by_user: actor,
            casualty_record: casualtyRecord,
          });
        }
      }

      scopedCasualtyIncidentIds = [
        ...new Set(
          submissionLogs.map((item) => item.casualty_incident_id),
        ),
      ];
    }

    let logs: VerificationActionLogRow[] = [];

    if (
      !isUnitScopedAdmin ||
      (scopedCasualtyIncidentIds && scopedCasualtyIncidentIds.length > 0)
    ) {
      let historyQuery = supabase
        .from("casualty_verification_history")
        .select(
          "id, casualty_incident_id, old_status, new_status, reviewed_by, review_notes, created_at",
        )
        .eq("reviewed_by", user.id)
        .order("created_at", { ascending: false })
        .limit(250);

      if (scopedCasualtyIncidentIds) {
        historyQuery = historyQuery.in(
          "casualty_incident_id",
          scopedCasualtyIncidentIds,
        );
      }

      const { data, error } = await historyQuery;

      if (error) {
        throw new Error(
          `Unable to retrieve verification action logs: ${error.message}`,
        );
      }

      logs = (data ?? []) as VerificationActionLogRow[];
    }

    const missingCasualtyIncidentIds = [
      ...new Set(
        logs
          .map((item) => item.casualty_incident_id)
          .filter((id) => !casualtyRecordsById.has(id)),
      ),
    ];

    if (missingCasualtyIncidentIds.length > 0) {
      const {
        data: casualtyRecords,
        error: casualtyRecordsError,
      } = await supabase
        .from("casualty_incidents")
        .select(casualtyRecordSelect)
        .in("id", missingCasualtyIncidentIds)
        .is("deleted_at", null);

      if (casualtyRecordsError) {
        throw new Error(
          `Unable to retrieve action log casualty records: ${casualtyRecordsError.message}`,
        );
      }

      for (const casualtyRecord of casualtyRecords ?? []) {
        if (isObject(casualtyRecord) && typeof casualtyRecord.id === "string") {
          casualtyRecordsById.set(casualtyRecord.id, casualtyRecord);
        }
      }
    }

    const verificationLogs = logs.map<VerificationActionLogItem>((item) => {
      const casualtyRecord =
        casualtyRecordsById.get(item.casualty_incident_id) ?? null;

      return {
        ...item,
        action_type: "verification",
        result: casualtyRecord ? "Successful" : "Not Successful",
        reviewed_by_user: item.reviewed_by ? reviewer : null,
        casualty_record: casualtyRecord,
      };
    });

    const actionLogs = [...submissionLogs, ...verificationLogs].sort(
      (first, second) =>
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime(),
    );

    response.status(200).json({
      success: true,
      count: actionLogs.length,
      data: actionLogs,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCasualtyVerification(
  request: Request<
    { id: string },
    unknown,
    UpdateCasualtyVerificationRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const { status, notes } = request.body;
    const user = getAuthenticatedUser(request);

    if (!verificationStatuses.includes(status)) {
      response.status(400).json({
        success: false,
        message: "Invalid verification status.",
      });
      return;
    }

    if (status === "rejected" && !notes?.trim()) {
      response.status(400).json({
        success: false,
        message: "Review notes are required when rejecting a record.",
      });
      return;
    }

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id, verification_status")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to retrieve casualty record: ${existingError.message}`,
      );
    }

    if (!existingRecord) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    const hasAccess = await canAccessCasualtyRecord(
      id,
      user.id,
      user.role,
    );

    if (!hasAccess) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    const verificationUpdates = {
      verification_status: status,
      verified_by: status === "verified" ? user.id : null,
      verified_at:
        status === "verified" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("casualty_incidents")
      .update(verificationUpdates)
      .eq("id", id);

    if (updateError) {
      throw new Error(
        `Unable to update verification status: ${updateError.message}`,
      );
    }

    const { error: historyError } = await supabase
      .from("casualty_verification_history")
      .insert({
        casualty_incident_id: id,
        old_status: existingRecord.verification_status,
        new_status: status,
        reviewed_by: user.id,
        review_notes: notes?.trim() || null,
      });

    if (historyError) {
      throw new Error(
        `Unable to record verification history: ${historyError.message}`,
      );
    }

    const { data: updatedRecord, error: updatedError } =
      await supabase
        .from("casualty_incidents")
        .select(casualtyRecordSelect)
        .eq("id", id)
        .single();

    if (updatedError || !updatedRecord) {
      throw new Error(
        `Unable to retrieve updated casualty: ${
          updatedError?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Verification status updated successfully.",
      data: updatedRecord,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCasualtyTriageHistory(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);

    const hasAccess = await canAccessCasualtyRecord(
      id,
      user.id,
      user.role,
    );

    if (!hasAccess) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("casualty_triage_assessments")
      .select(
        "id, casualty_incident_id, triage_system, triage_category, responder_category, calculated_category, assessment_answers, algorithm_version, is_over_triage, is_under_triage, triage_stage, triaged_at, triaged_by, location, notes, created_at",
      )
      .eq("casualty_incident_id", id)
      .order("triaged_at", { ascending: false });

    if (error) {
      throw new Error(
        `Unable to retrieve triage history: ${error.message}`,
      );
    }

    const triagedByIds = [
      ...new Set(
        (data ?? [])
          .map((item) => item.triaged_by)
          .filter(
            (triagedBy): triagedBy is string =>
              typeof triagedBy === "string" &&
              triagedBy.trim().length > 0,
          ),
      ),
    ];

    const usersById = new Map<
      string,
      {
        id: string;
        full_name: string;
        email: string;
        role: string;
      }
    >();

    if (triagedByIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .in("id", triagedByIds);

      if (usersError) {
        throw new Error(
          `Unable to retrieve triage history users: ${usersError.message}`,
        );
      }

      for (const user of users ?? []) {
        usersById.set(user.id, user);
      }
    }

    const history = (data ?? []).map((item) => ({
      ...item,
      triaged_by_user: item.triaged_by
        ? usersById.get(item.triaged_by) ?? null
        : null,
    }));

    response.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCasualtyTriageAssessment(
  request: Request<
    { id: string },
    unknown,
    CasualtyTriageAssessmentRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);
    const responderFunction =
      request.header("x-dcms-responder-function") ??
      request.header("X-DCMS-Responder-Function");
    const isStabilizationResponderUpdate =
      responderFunction === "sa_responder" &&
      ["responder", "field_responder", "sa_responder"].includes(
        user.role,
      );

    if (!request.body) {
      response.status(400).json({
        success: false,
        message: "Triage assessment is required.",
      });
      return;
    }

    if (!validateTriageAssessment(request.body, response)) {
      return;
    }

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id, encoded_by, verification_status")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to retrieve casualty record: ${existingError.message}`,
      );
    }

    if (!existingRecord) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    if (shouldScopeToOwnCasualties(user.role)) {
      if (
        existingRecord.encoded_by !== user.id &&
        !isStabilizationResponderUpdate
      ) {
        response.status(404).json({
          success: false,
          message: "Casualty record not found.",
        });
        return;
      }

      if (
        !isStabilizationResponderUpdate &&
        existingRecord.verification_status !== "rejected"
      ) {
        response.status(403).json({
          success: false,
          message:
            "This record cannot be edited unless an administrator rejects it for correction.",
        });
        return;
      }
    }

    await insertTriageAssessment(id, user.id, request.body);

    response.status(201).json({
      success: true,
      message: "Triage assessment recorded successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export async function getCasualtyTransportHistory(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);

    const hasAccess = await canAccessCasualtyRecord(
      id,
      user.id,
      user.role,
    );

    if (!hasAccess) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("casualty_transport_records")
      .select(
        "id, casualty_incident_id, transport_required, transport_mode, ems_unit_type, arrived_scene_at, departed_scene_at, arrived_facility_at, receiving_facility_id, recorded_by, notes, created_at",
      )
      .eq("casualty_incident_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(
        `Unable to retrieve transport history: ${error.message}`,
      );
    }

    const recordedByIds = [
      ...new Set(
        (data ?? [])
          .map((item) => item.recorded_by)
          .filter(
            (recordedBy): recordedBy is string =>
              typeof recordedBy === "string" &&
              recordedBy.trim().length > 0,
          ),
      ),
    ];
    const facilityIds = [
      ...new Set(
        (data ?? [])
          .map((item) => item.receiving_facility_id)
          .filter(
            (facilityId): facilityId is string =>
              typeof facilityId === "string" &&
              facilityId.trim().length > 0,
          ),
      ),
    ];

    const usersById = new Map<
      string,
      {
        id: string;
        full_name: string;
        email: string;
        role: string;
      }
    >();
    const facilitiesById = new Map<
      string,
      {
        id: string;
        facility_name: string;
        facility_level: string;
        address: string | null;
        barangay: string | null;
        municipality: string | null;
        province: string | null;
      }
    >();

    if (recordedByIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .in("id", recordedByIds);

      if (usersError) {
        throw new Error(
          `Unable to retrieve transport history users: ${usersError.message}`,
        );
      }

      for (const user of users ?? []) {
        usersById.set(user.id, user);
      }
    }

    if (facilityIds.length > 0) {
      const { data: facilities, error: facilitiesError } =
        await supabase
          .from("healthcare_facilities")
          .select(
            "id, facility_name, facility_level, address, barangay, municipality, province",
          )
          .in("id", facilityIds);

      if (facilitiesError) {
        throw new Error(
          `Unable to retrieve transport facilities: ${facilitiesError.message}`,
        );
      }

      for (const facility of facilities ?? []) {
        facilitiesById.set(facility.id, facility);
      }
    }

    const history = (data ?? []).map((item) => ({
      ...item,
      recorded_by_user: item.recorded_by
        ? usersById.get(item.recorded_by) ?? null
        : null,
      receiving_facility: item.receiving_facility_id
        ? facilitiesById.get(item.receiving_facility_id) ?? null
        : null,
    }));

    response.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCasualtyTransportRecord(
  request: Request<
    { id: string },
    unknown,
    CasualtyTransportRecordRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);
    const responderFunction =
      request.header("x-dcms-responder-function") ??
      request.header("X-DCMS-Responder-Function");
    const isStabilizationResponderUpdate =
      responderFunction === "sa_responder" &&
      ["responder", "field_responder", "sa_responder"].includes(
        user.role,
      );

    if (!request.body) {
      response.status(400).json({
        success: false,
        message: "Transport record is required.",
      });
      return;
    }

    if (!validateTransportRecord(request.body, response)) {
      return;
    }

    if (
      !(await ensureActiveHealthcareFacility(
        request.body.receivingFacilityId,
        response,
      ))
    ) {
      return;
    }

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id, encoded_by, verification_status")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to retrieve casualty record: ${existingError.message}`,
      );
    }

    if (!existingRecord) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    if (shouldScopeToOwnCasualties(user.role)) {
      if (
        existingRecord.encoded_by !== user.id &&
        !isStabilizationResponderUpdate
      ) {
        response.status(404).json({
          success: false,
          message: "Casualty record not found.",
        });
        return;
      }

      if (
        !isStabilizationResponderUpdate &&
        existingRecord.verification_status !== "rejected"
      ) {
        response.status(403).json({
          success: false,
          message:
            "This record cannot be edited unless an administrator rejects it for correction.",
        });
        return;
      }
    }

    await insertTransportRecord(id, user.id, request.body);

    response.status(201).json({
      success: true,
      message: "Transport record saved successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCasualty(
  request: Request<{ id: string }, unknown, UpdateCasualtyRequest>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const {
      incidentId,
      person,
      incidentDetails,
      triageAssessment,
      transportRecord,
      treatmentRecord,
      facilityEncounter,
      casualtyOutcome,
    } = request.body;
    const user = getAuthenticatedUser(request);
    const responderFunction =
      request.header("x-dcms-responder-function") ??
      request.header("X-DCMS-Responder-Function");
    const isStabilizationResponderUpdate =
      responderFunction === "sa_responder" &&
      ["responder", "field_responder", "sa_responder"].includes(
        user.role,
      );

    if (
      !person &&
      !incidentDetails &&
      !incidentId &&
      !triageAssessment &&
      !transportRecord &&
      !treatmentRecord &&
      !facilityEncounter &&
      !casualtyOutcome
    ) {
      response.status(400).json({
        success: false,
        message: "No casualty updates were provided.",
      });
      return;
    }

    if (!validateTriageAssessment(triageAssessment, response)) {
      return;
    }

    if (!validateTransportRecord(transportRecord, response)) {
      return;
    }

    if (!validateTreatmentRecord(treatmentRecord, response)) {
      return;
    }

    if (!validateFacilityEncounter(facilityEncounter, response)) {
      return;
    }

    if (!validateCasualtyOutcome(casualtyOutcome, response)) {
      return;
    }

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id, casualty_id, current_status, encoded_by, verification_status")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to retrieve casualty record: ${existingError.message}`,
      );
    }

    if (!existingRecord) {
      response.status(404).json({
        success: false,
        message: "Casualty record not found.",
      });
      return;
    }

    if (shouldScopeToOwnCasualties(user.role)) {
      if (
        existingRecord.encoded_by !== user.id &&
        !isStabilizationResponderUpdate
      ) {
        response.status(404).json({
          success: false,
          message: "Casualty record not found.",
        });
        return;
      }

      if (
        !isStabilizationResponderUpdate &&
        existingRecord.verification_status !== "rejected"
      ) {
        response.status(403).json({
          success: false,
          message:
            "This record cannot be edited unless an administrator rejects it for correction.",
        });
        return;
      }
    }

    if (
      person?.identificationStatus !== undefined &&
      !identificationStatuses.includes(
        person.identificationStatus,
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid identification status.",
      });
      return;
    }

    if (
      person?.estimatedAge !== undefined &&
      (
        !Number.isInteger(person.estimatedAge) ||
        person.estimatedAge < 0 ||
        person.estimatedAge > 130
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Estimated age must be from 0 to 130.",
      });
      return;
    }

    if (
      incidentDetails?.currentStatus !== undefined &&
      !casualtyStatuses.includes(
        incidentDetails.currentStatus,
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid casualty status.",
      });
      return;
    }

    if (
      incidentDetails?.severity !== undefined &&
      !casualtySeverities.includes(incidentDetails.severity)
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid casualty severity.",
      });
      return;
    }

    if (
      incidentDetails?.latitude !== undefined &&
      (
        incidentDetails.latitude < -90 ||
        incidentDetails.latitude > 90
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Latitude must be from -90 to 90.",
      });
      return;
    }

    if (
      incidentDetails?.longitude !== undefined &&
      (
        incidentDetails.longitude < -180 ||
        incidentDetails.longitude > 180
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Longitude must be from -180 to 180.",
      });
      return;
    }

    if (incidentId) {
      const { data: incident, error: incidentError } =
        await supabase
          .from("incidents")
          .select("id, status")
          .eq("id", incidentId)
          .single();

      if (incidentError || !incident) {
        response.status(404).json({
          success: false,
          message: "Incident not found.",
        });
        return;
      }

      if (incident.status !== "active") {
        response.status(400).json({
          success: false,
          message:
            "Casualties can only be assigned to an active incident.",
        });
        return;
      }
    }

    if (
      !(await ensureActiveHealthcareFacility(
        incidentDetails?.healthcareFacilityId,
        response,
      ))
    ) {
      return;
    }

    if (
      !(await ensureActiveHealthcareFacility(
        transportRecord?.receivingFacilityId,
        response,
      ))
    ) {
      return;
    }

    if (
      !(await ensureActiveHealthcareFacility(
        facilityEncounter?.facilityId,
        response,
      ))
    ) {
      return;
    }

    if (person) {
      const existingIdNumber = await ensureUniqueIdNumber(
        person.idNumber,
        existingRecord.casualty_id,
      );

      if (existingIdNumber) {
        response.status(409).json({
          success: false,
          message:
            "A casualty with this ID number already exists. Please generate a new record.",
        });
        return;
      }

      const casualtyUpdates = {
        id_number: trimmedOrNull(person.idNumber),
        id_type: trimmedOrNull(person.idType),
        identification_status: person.identificationStatus,
        first_name: trimmedOrNull(person.firstName),
        middle_name: trimmedOrNull(person.middleName),
        last_name: trimmedOrNull(person.lastName),
        suffix: trimmedOrNull(person.suffix),
        date_of_birth:
          person.dateOfBirth === undefined
            ? undefined
            : person.dateOfBirth || null,
        estimated_age:
          person.estimatedAge === undefined
            ? undefined
            : person.estimatedAge,
        sex: trimmedOrNull(person.sex),
        civil_status: trimmedOrNull(person.civilStatus),
        nationality: trimmedOrNull(person.nationality),
        contact_number: trimmedOrNull(person.contactNumber),
        house_street: trimmedOrNull(person.houseStreet),
        barangay: trimmedOrNull(person.barangay),
        municipality: trimmedOrNull(person.municipality),
        province: trimmedOrNull(person.province),
        region: trimmedOrNull(person.region),
      };

      const { error: casualtyError } = await supabase
        .from("casualties")
        .update(casualtyUpdates)
        .eq("id", existingRecord.casualty_id);

      if (casualtyError) {
        throw new Error(
          `Unable to update casualty: ${casualtyError.message}`,
        );
      }
    }

    if (incidentDetails || incidentId) {
      const incidentUpdates = {
        incident_id: incidentId,
        evacuation_center_id:
          incidentDetails?.evacuationCenterId === undefined
            ? undefined
            : incidentDetails.evacuationCenterId || null,
        healthcare_facility_id:
          incidentDetails?.healthcareFacilityId === undefined
            ? undefined
            : incidentDetails.healthcareFacilityId || null,
        current_status: incidentDetails?.currentStatus,
        severity: incidentDetails?.severity,
        current_location: trimmedOrNull(
          incidentDetails?.currentLocation,
        ),
        hospital_name: trimmedOrNull(
          incidentDetails?.hospitalName,
        ),
        visible_injury: trimmedOrNull(
          incidentDetails?.visibleInjury,
        ),
        medical_condition: trimmedOrNull(
          incidentDetails?.medicalCondition,
        ),
        assistance_needed: trimmedOrNull(
          incidentDetails?.assistanceNeeded,
        ),
        assistance_provided: trimmedOrNull(
          incidentDetails?.assistanceProvided,
        ),
        remarks: trimmedOrNull(incidentDetails?.remarks),
        latitude:
          incidentDetails?.latitude === undefined
            ? undefined
            : incidentDetails.latitude,
        longitude:
          incidentDetails?.longitude === undefined
            ? undefined
            : incidentDetails.longitude,
      };

      const { error: incidentError } = await supabase
        .from("casualty_incidents")
        .update(incidentUpdates)
        .eq("id", id);

      if (incidentError) {
        throw new Error(
          `Unable to update casualty incident: ${incidentError.message}`,
        );
      }

      if (
        incidentDetails?.currentStatus &&
        incidentDetails.currentStatus !== existingRecord.current_status
      ) {
        const { error: historyError } = await supabase
          .from("casualty_status_history")
          .insert({
            casualty_incident_id: id,
            old_status: existingRecord.current_status,
            new_status: incidentDetails.currentStatus,
            changed_by: user.id,
          });

        if (historyError) {
          throw new Error(
            `Unable to record status history: ${historyError.message}`,
          );
        }
      }
    }

    if (triageAssessment) {
      await insertTriageAssessment(id, user.id, triageAssessment);
    }

    if (transportRecord) {
      await insertTransportRecord(id, user.id, transportRecord);
    }

    if (treatmentRecord) {
      await insertTreatmentRecord(id, user.id, treatmentRecord);
    }

    const encounterPayload = facilityEncounter ?? (
      transportRecord?.receivingFacilityId || incidentDetails?.healthcareFacilityId
        ? {
            facilityId:
              transportRecord?.receivingFacilityId ??
              incidentDetails?.healthcareFacilityId,
            arrivedAt: transportRecord?.arrivedFacilityAt,
            referredOrTransferred: null,
            soughtEdCare: true,
            disposition: "unknown",
          }
        : undefined
    );

    if (encounterPayload?.facilityId) {
      await insertFacilityEncounter(id, user.id, encounterPayload);
    }

    if (casualtyOutcome) {
      await upsertCasualtyOutcome(
        id,
        user.id,
        casualtyOutcome,
        incidentDetails?.currentStatus ?? existingRecord.current_status,
      );
    }

    const { data: updatedRecord, error: updatedError } =
      await supabase
        .from("casualty_incidents")
        .select(casualtyRecordSelect)
        .eq("id", id)
        .single();

    if (updatedError || !updatedRecord) {
      throw new Error(
        `Unable to retrieve updated casualty: ${
          updatedError?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Casualty record updated successfully.",
      data: updatedRecord,
    });
  } catch (error) {
    next(error);
  }
}
