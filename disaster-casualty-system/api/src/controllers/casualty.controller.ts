import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import type {
  CasualtyTransportRecordRequest,
  CasualtyTriageAssessmentRequest,
  CreateCasualtyRequest,
  UpdateCasualtyRequest,
} from "../types/casualty.types.js";

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
  "urgent_non_urgent",
  "nato",
  "start",
  "sieve_sort",
  "smart",
  "care_flight",
  "mass",
  "salt",
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

const verificationStatuses = [
  "submitted",
  "under_review",
  "verified",
  "rejected",
] as const;

type VerificationStatus = (typeof verificationStatuses)[number];

type UpdateCasualtyVerificationRequest = {
  status: VerificationStatus;
  notes?: string;
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
    role
  )
`;

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

  if (
    transportRecord.transportRequired === "yes" &&
    !transportRecord.receivingFacilityId
  ) {
    response.status(400).json({
      success: false,
      message:
        "Receiving facility is required when transport is required.",
    });
    return false;
  }

  const departedSceneAt = transportRecord.departedSceneAt
    ? new Date(transportRecord.departedSceneAt)
    : null;
  const arrivedFacilityAt = transportRecord.arrivedFacilityAt
    ? new Date(transportRecord.arrivedFacilityAt)
    : null;

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
  const { error } = await supabase
    .from("casualty_triage_assessments")
    .insert({
      casualty_incident_id: casualtyIncidentId,
      triage_system: triageAssessment.triageSystem,
      triage_category: triageAssessment.triageCategory,
      triage_stage: triageAssessment.triageStage ?? "on_site",
      triaged_at:
        triageAssessment.triagedAt ?? new Date().toISOString(),
      triaged_by: userId,
      location: triageAssessment.location?.trim() || null,
      notes: triageAssessment.notes?.trim() || null,
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
    const incidentId =
      typeof request.query.incidentId === "string"
        ? request.query.incidentId
        : undefined;

    const status =
      typeof request.query.status === "string"
        ? request.query.status
        : undefined;

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

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to retrieve casualties: ${error.message}`);
    }

    response.status(200).json({
      success: true,
      count: data?.length ?? 0,
      data: data ?? [],
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

    const { data, error } = await supabase
      .from("casualty_incidents")
      .select(casualtyRecordSelect)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

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

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
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

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
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

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
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

    const { data, error } = await supabase
      .from("casualty_triage_assessments")
      .select(
        "id, casualty_incident_id, triage_system, triage_category, triage_stage, triaged_at, triaged_by, location, notes, created_at",
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
        .select("id")
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

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
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

    const { data, error } = await supabase
      .from("casualty_transport_records")
      .select(
        "id, casualty_incident_id, transport_required, transport_mode, ems_unit_type, departed_scene_at, arrived_facility_at, receiving_facility_id, recorded_by, notes, created_at",
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
        .select("id")
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
    } = request.body;
    const user = getAuthenticatedUser(request);

    if (
      !person &&
      !incidentDetails &&
      !incidentId &&
      !triageAssessment &&
      !transportRecord
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

    const { data: existingRecord, error: existingError } =
      await supabase
        .from("casualty_incidents")
        .select("id, casualty_id, current_status, encoded_by")
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
