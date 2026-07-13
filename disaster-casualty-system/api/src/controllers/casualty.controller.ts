import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import type {
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
};

const casualtyRecordSelect = `
  id,
  client_record_id,
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

export async function updateCasualty(
  request: Request<{ id: string }, unknown, UpdateCasualtyRequest>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const { incidentId, person, incidentDetails } = request.body;
    const user = getAuthenticatedUser(request);

    if (!person && !incidentDetails && !incidentId) {
      response.status(400).json({
        success: false,
        message: "No casualty updates were provided.",
      });
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
