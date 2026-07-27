import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseNullableDate(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a date string or null.`);
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`${fieldName} contains an invalid date.`);
  }

  return parsedDate.toISOString();
}

function parseNullableText(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be text or null.`);
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseNullableBoolean(
  value: unknown,
  fieldName: string,
): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be true, false, or null.`);
  }

  return value;
}

function parseCoordinationRating(
  value: unknown,
  fieldName: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 7
  ) {
    throw new Error(
      `${fieldName} must be a whole number from 1 to 7, or null.`,
    );
  }

  return value;
}

async function verifyIncidentExists(
  incidentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("incidents")
    .select("id")
    .eq("id", incidentId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to verify incident: ${error.message}`,
    );
  }

  return Boolean(data);
}

async function saveTimeline(
  incidentId: string,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data: existingTimeline, error: findError } =
    await supabase
      .from("incident_response_timelines")
      .select("id")
      .eq("incident_id", incidentId)
      .maybeSingle();

  if (findError) {
    throw new Error(
      `Unable to read incident response timeline: ${findError.message}`,
    );
  }

  if (existingTimeline) {
    const { data, error } = await supabase
      .from("incident_response_timelines")
      .update({
        ...values,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTimeline.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Unable to update incident response timeline: ${error.message}`,
      );
    }

    return data;
  }

  const { data, error } = await supabase
    .from("incident_response_timelines")
    .insert({
      incident_id: incidentId,
      ...values,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Unable to create incident response timeline: ${error.message}`,
    );
  }

  return data;
}

async function synchronizeLastStaffArrival(
  incidentId: string,
  userId: string,
): Promise<void> {
  const { data: latestStaffArrival, error } = await supabase
    .from("dmmp_staff_call_downs")
    .select("arrived_at")
    .eq("incident_id", incidentId)
    .not("arrived_at", "is", null)
    .order("arrived_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to determine the last staff arrival: ${error.message}`,
    );
  }

  await saveTimeline(incidentId, {
    last_dmmp_staff_arrived_at:
      latestStaffArrival?.arrived_at ?? null,
    updated_by: userId,
  });
}

/**
 * GET /api/incidents/:id/utstein-operations
 */
export async function getUtsteinOperations(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;

    if (!isValidUuid(incidentId)) {
      response.status(400).json({
        success: false,
        message: "A valid incident UUID is required.",
      });
      return;
    }

    const { data: incident, error: incidentError } =
      await supabase
        .from("incidents")
        .select(
          `
            id,
            incident_code,
            incident_name,
            disaster_type,
            started_at
          `,
        )
        .eq("id", incidentId)
        .maybeSingle();

    if (incidentError) {
      throw new Error(
        `Unable to retrieve incident: ${incidentError.message}`,
      );
    }

    if (!incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const { data: timeline, error: timelineError } =
      await supabase
        .from("incident_response_timelines")
        .select("*")
        .eq("incident_id", incidentId)
        .maybeSingle();

    if (timelineError) {
      throw new Error(
        `Unable to retrieve response timeline: ${timelineError.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data: {
        incident,
        timeline,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/incidents/:id/utstein-operations
 */
export async function saveUtsteinOperations(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;

    if (!isValidUuid(incidentId)) {
      response.status(400).json({
        success: false,
        message: "A valid incident UUID is required.",
      });
      return;
    }

    if (!isPlainObject(request.body)) {
      response.status(400).json({
        success: false,
        message: "A JSON request body is required.",
      });
      return;
    }

    const incidentExists =
      await verifyIncidentExists(incidentId);

    if (!incidentExists) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const authenticatedUser =
      getAuthenticatedUser(request);

    let disasterOccurredAt: string | null | undefined;
    let eventNotificationAt: string | null | undefined;
    let dmmpActivated: boolean | null | undefined;
    let dmmpActivationTrigger: string | null | undefined;
    let dmmpActivatedAt: string | null | undefined;
    let medicalCoordinatorNotifiedAt:
      | string
      | null
      | undefined;
    let lastDmmpStaffArrivedAt:
      | string
      | null
      | undefined;

    try {
      disasterOccurredAt = parseNullableDate(
        request.body.disasterOccurredAt,
        "disasterOccurredAt",
      );

      eventNotificationAt = parseNullableDate(
        request.body.eventNotificationAt,
        "eventNotificationAt",
      );

      dmmpActivated = parseNullableBoolean(
        request.body.dmmpActivated,
        "dmmpActivated",
      );

      dmmpActivationTrigger = parseNullableText(
        request.body.dmmpActivationTrigger,
        "dmmpActivationTrigger",
      );

      dmmpActivatedAt = parseNullableDate(
        request.body.dmmpActivatedAt,
        "dmmpActivatedAt",
      );

      medicalCoordinatorNotifiedAt = parseNullableDate(
        request.body.medicalCoordinatorNotifiedAt,
        "medicalCoordinatorNotifiedAt",
      );

      lastDmmpStaffArrivedAt = parseNullableDate(
        request.body.lastDmmpStaffArrivedAt,
        "lastDmmpStaffArrivedAt",
      );
    } catch (validationError) {
      response.status(400).json({
        success: false,
        message:
          validationError instanceof Error
            ? validationError.message
            : "Invalid request body.",
      });
      return;
    }

    if (
      dmmpActivated === true &&
      !dmmpActivatedAt
    ) {
      response.status(400).json({
        success: false,
        message:
          "dmmpActivatedAt is required when dmmpActivated is true.",
      });
      return;
    }

    if (disasterOccurredAt !== undefined) {
      if (disasterOccurredAt === null) {
        response.status(400).json({
          success: false,
          message:
            "The disaster occurrence time cannot be null.",
        });
        return;
      }

      const { error: incidentUpdateError } =
        await supabase
          .from("incidents")
          .update({
            started_at: disasterOccurredAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", incidentId);

      if (incidentUpdateError) {
        throw new Error(
          `Unable to update disaster occurrence time: ${incidentUpdateError.message}`,
        );
      }
    }

    const timelineValues: Record<string, unknown> = {
      updated_by: authenticatedUser.id,
    };

    if (eventNotificationAt !== undefined) {
      timelineValues.event_notification_at =
        eventNotificationAt;
    }

    if (dmmpActivated !== undefined) {
      timelineValues.dmmp_activated = dmmpActivated;
    }

    if (dmmpActivationTrigger !== undefined) {
      timelineValues.dmmp_activation_trigger =
        dmmpActivationTrigger;
    }

    if (dmmpActivatedAt !== undefined) {
      timelineValues.dmmp_activated_at =
        dmmpActivatedAt;
    }

    if (
      medicalCoordinatorNotifiedAt !== undefined
    ) {
      timelineValues.medical_coordinator_notified_at =
        medicalCoordinatorNotifiedAt;
    }

    if (lastDmmpStaffArrivedAt !== undefined) {
      timelineValues.last_dmmp_staff_arrived_at =
        lastDmmpStaffArrivedAt;
    }

    const timeline = await saveTimeline(
      incidentId,
      timelineValues,
    );

    const { data: incident, error: incidentError } =
      await supabase
        .from("incidents")
        .select(
          `
            id,
            incident_code,
            incident_name,
            disaster_type,
            started_at
          `,
        )
        .eq("id", incidentId)
        .single();

    if (incidentError) {
      throw new Error(
        `Unable to retrieve the updated incident: ${incidentError.message}`,
      );
    }

    response.status(200).json({
      success: true,
      message:
        "Utstein incident operations saved successfully.",
      data: {
        incident,
        timeline,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidents/:id/dmmp-staff
 */
export async function getDmmpStaff(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;

    if (!isValidUuid(incidentId)) {
      response.status(400).json({
        success: false,
        message: "A valid incident UUID is required.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("dmmp_staff_call_downs")
      .select("*")
      .eq("incident_id", incidentId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Unable to retrieve DMMP staff records: ${error.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data: data ?? [],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/incidents/:id/dmmp-staff
 */
export async function createDmmpStaff(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;

    if (!isValidUuid(incidentId)) {
      response.status(400).json({
        success: false,
        message: "A valid incident UUID is required.",
      });
      return;
    }

    if (!isPlainObject(request.body)) {
      response.status(400).json({
        success: false,
        message: "A JSON request body is required.",
      });
      return;
    }

    const incidentExists =
      await verifyIncidentExists(incidentId);

    if (!incidentExists) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const authenticatedUser =
      getAuthenticatedUser(request);

    let staffName: string | null | undefined;
    let roleName: string | null | undefined;
    let wasContacted: boolean | null | undefined;
    let contactedAt: string | null | undefined;
    let requiredArrivalAt: string | null | undefined;
    let arrivedAt: string | null | undefined;

    try {
      staffName = parseNullableText(
        request.body.staffName,
        "staffName",
      );

      roleName = parseNullableText(
        request.body.roleName,
        "roleName",
      );

      wasContacted = parseNullableBoolean(
        request.body.wasContacted,
        "wasContacted",
      );

      contactedAt = parseNullableDate(
        request.body.contactedAt,
        "contactedAt",
      );

      requiredArrivalAt = parseNullableDate(
        request.body.requiredArrivalAt,
        "requiredArrivalAt",
      );

      arrivedAt = parseNullableDate(
        request.body.arrivedAt,
        "arrivedAt",
      );
    } catch (validationError) {
      response.status(400).json({
        success: false,
        message:
          validationError instanceof Error
            ? validationError.message
            : "Invalid staff record.",
      });
      return;
    }

    const normalizedWasContacted =
      wasContacted ?? false;

    const arrivedWithinStandard =
      arrivedAt && requiredArrivalAt
        ? new Date(arrivedAt).getTime() <=
          new Date(requiredArrivalAt).getTime()
        : null;

    const { data, error } = await supabase
      .from("dmmp_staff_call_downs")
      .insert({
        incident_id: incidentId,
        staff_name: staffName ?? null,
        role_name: roleName ?? null,
        was_contacted: normalizedWasContacted,
        contacted_at: contactedAt ?? null,
        required_arrival_at:
          requiredArrivalAt ?? null,
        arrived_at: arrivedAt ?? null,
        arrived_within_standard:
          arrivedWithinStandard,
        recorded_by: authenticatedUser.id,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Unable to save DMMP staff record: ${error.message}`,
      );
    }

    await synchronizeLastStaffArrival(
      incidentId,
      authenticatedUser.id,
    );

    response.status(201).json({
      success: true,
      message:
        "DMMP staff record created successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/dmmp-staff/:staffId
 */
export async function updateDmmpStaff(
  request: Request<{ staffId: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const staffId = request.params.staffId;

    if (!isValidUuid(staffId)) {
      response.status(400).json({
        success: false,
        message: "A valid staff record UUID is required.",
      });
      return;
    }

    if (!isPlainObject(request.body)) {
      response.status(400).json({
        success: false,
        message: "A JSON request body is required.",
      });
      return;
    }

    const { data: existingRecord, error: findError } =
      await supabase
        .from("dmmp_staff_call_downs")
        .select("*")
        .eq("id", staffId)
        .maybeSingle();

    if (findError) {
      throw new Error(
        `Unable to retrieve staff record: ${findError.message}`,
      );
    }

    if (!existingRecord) {
      response.status(404).json({
        success: false,
        message: "DMMP staff record not found.",
      });
      return;
    }

    const authenticatedUser =
      getAuthenticatedUser(request);

    const updates: Record<string, unknown> = {
      recorded_by: authenticatedUser.id,
    };

    try {
      const staffName = parseNullableText(
        request.body.staffName,
        "staffName",
      );

      const roleName = parseNullableText(
        request.body.roleName,
        "roleName",
      );

      const wasContacted = parseNullableBoolean(
        request.body.wasContacted,
        "wasContacted",
      );

      const contactedAt = parseNullableDate(
        request.body.contactedAt,
        "contactedAt",
      );

      const requiredArrivalAt = parseNullableDate(
        request.body.requiredArrivalAt,
        "requiredArrivalAt",
      );

      const arrivedAt = parseNullableDate(
        request.body.arrivedAt,
        "arrivedAt",
      );

      if (staffName !== undefined) {
        updates.staff_name = staffName;
      }

      if (roleName !== undefined) {
        updates.role_name = roleName;
      }

      if (wasContacted !== undefined) {
        updates.was_contacted =
          wasContacted ?? false;
      }

      if (contactedAt !== undefined) {
        updates.contacted_at = contactedAt;
      }

      if (requiredArrivalAt !== undefined) {
        updates.required_arrival_at =
          requiredArrivalAt;
      }

      if (arrivedAt !== undefined) {
        updates.arrived_at = arrivedAt;
      }
    } catch (validationError) {
      response.status(400).json({
        success: false,
        message:
          validationError instanceof Error
            ? validationError.message
            : "Invalid staff record.",
      });
      return;
    }

    const finalRequiredArrivalAt =
      updates.required_arrival_at !== undefined
        ? (updates.required_arrival_at as string | null)
        : existingRecord.required_arrival_at;

    const finalArrivedAt =
      updates.arrived_at !== undefined
        ? (updates.arrived_at as string | null)
        : existingRecord.arrived_at;

    updates.arrived_within_standard =
      finalArrivedAt && finalRequiredArrivalAt
        ? new Date(finalArrivedAt).getTime() <=
          new Date(finalRequiredArrivalAt).getTime()
        : null;

    const { data, error } = await supabase
      .from("dmmp_staff_call_downs")
      .update(updates)
      .eq("id", staffId)
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Unable to update DMMP staff record: ${error.message}`,
      );
    }

    await synchronizeLastStaffArrival(
      existingRecord.incident_id,
      authenticatedUser.id,
    );

    response.status(200).json({
      success: true,
      message:
        "DMMP staff record updated successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/dmmp-staff/:staffId
 */
export async function deleteDmmpStaff(
  request: Request<{ staffId: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const staffId = request.params.staffId;

    if (!isValidUuid(staffId)) {
      response.status(400).json({
        success: false,
        message: "A valid staff record UUID is required.",
      });
      return;
    }

    const { data: existingRecord, error: findError } =
      await supabase
        .from("dmmp_staff_call_downs")
        .select("id, incident_id")
        .eq("id", staffId)
        .maybeSingle();

    if (findError) {
      throw new Error(
        `Unable to retrieve staff record: ${findError.message}`,
      );
    }

    if (!existingRecord) {
      response.status(404).json({
        success: false,
        message: "DMMP staff record not found.",
      });
      return;
    }

    const { error: deleteError } = await supabase
      .from("dmmp_staff_call_downs")
      .delete()
      .eq("id", staffId);

    if (deleteError) {
      throw new Error(
        `Unable to delete DMMP staff record: ${deleteError.message}`,
      );
    }

    const authenticatedUser =
      getAuthenticatedUser(request);

    await synchronizeLastStaffArrival(
      existingRecord.incident_id,
      authenticatedUser.id,
    );

    response.status(200).json({
      success: true,
      message:
        "DMMP staff record deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidents/:id/dmmp-staff-summary
 */
export async function getDmmpStaffSummary(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;

    if (!isValidUuid(incidentId)) {
      response.status(400).json({
        success: false,
        message: "A valid incident UUID is required.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("dmmp_staff_call_downs")
      .select(
        `
          id,
          was_contacted,
          arrived_at,
          arrived_within_standard
        `,
      )
      .eq("incident_id", incidentId);

    if (error) {
      throw new Error(
        `Unable to calculate DMMP staff summary: ${error.message}`,
      );
    }

    const records = data ?? [];

    const totalStaffRecords = records.length;

    const totalContacted = records.filter(
      (record) => record.was_contacted,
    ).length;

    const totalArrived = records.filter(
      (record) => Boolean(record.arrived_at),
    ).length;

    const totalArrivedWithinStandard =
      records.filter(
        (record) =>
          record.was_contacted &&
          record.arrived_within_standard === true,
      ).length;

    const reportingPercentage =
      totalContacted > 0
        ? Number(
            (
              (totalArrivedWithinStandard /
                totalContacted) *
              100
            ).toFixed(2),
          )
        : 0;

    response.status(200).json({
      success: true,
      data: {
        totalStaffRecords,
        totalContacted,
        totalArrived,
        totalArrivedWithinStandard,
        reportingPercentage,
        formula:
          "(staff who arrived within standard / staff contacted) × 100",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidents/:id/coordination-assessment
 */
export async function getCoordinationAssessment(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;

    if (!isValidUuid(incidentId)) {
      response.status(400).json({
        success: false,
        message: "A valid incident UUID is required.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("medical_coordination_assessments")
      .select("*")
      .eq("incident_id", incidentId)
      .order("assessed_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to retrieve coordination assessment: ${error.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data,
      ratingScale: {
        1: "Not Done",
        2: "Inadequate",
        3: "Somewhat Adequate",
        4: "Mostly Adequate",
        5: "Completely Adequate",
        6: "N/S",
        7: "N/D",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/incidents/:id/coordination-assessment
 */
export async function saveCoordinationAssessment(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;

    if (!isValidUuid(incidentId)) {
      response.status(400).json({
        success: false,
        message: "A valid incident UUID is required.",
      });
      return;
    }

    if (!isPlainObject(request.body)) {
      response.status(400).json({
        success: false,
        message: "A JSON request body is required.",
      });
      return;
    }

    const incidentExists =
      await verifyIncidentExists(incidentId);

    if (!incidentExists) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    let initialActionsRating:
      | number
      | null
      | undefined;
    let sceneCoordinationRating:
      | number
      | null
      | undefined;
    let systemCoordinationRating:
      | number
      | null
      | undefined;
    let communicationsRating:
      | number
      | null
      | undefined;
    let resourceManagementRating:
      | number
      | null
      | undefined;
    let notes: string | null | undefined;
    let assessedAt: string | null | undefined;

    try {
      initialActionsRating =
        parseCoordinationRating(
          request.body.initialActionsRating,
          "initialActionsRating",
        );

      sceneCoordinationRating =
        parseCoordinationRating(
          request.body.sceneCoordinationRating,
          "sceneCoordinationRating",
        );

      systemCoordinationRating =
        parseCoordinationRating(
          request.body.systemCoordinationRating,
          "systemCoordinationRating",
        );

      communicationsRating =
        parseCoordinationRating(
          request.body.communicationsRating,
          "communicationsRating",
        );

      resourceManagementRating =
        parseCoordinationRating(
          request.body.resourceManagementRating,
          "resourceManagementRating",
        );

      notes = parseNullableText(
        request.body.notes,
        "notes",
      );

      assessedAt = parseNullableDate(
        request.body.assessedAt,
        "assessedAt",
      );
    } catch (validationError) {
      response.status(400).json({
        success: false,
        message:
          validationError instanceof Error
            ? validationError.message
            : "Invalid coordination assessment.",
      });
      return;
    }

    const authenticatedUser =
      getAuthenticatedUser(request);

    const values = {
      incident_id: incidentId,
      initial_actions_rating:
        initialActionsRating ?? null,
      scene_coordination_rating:
        sceneCoordinationRating ?? null,
      system_coordination_rating:
        systemCoordinationRating ?? null,
      communications_rating:
        communicationsRating ?? null,
      resource_management_rating:
        resourceManagementRating ?? null,
      notes: notes ?? null,
      assessed_by: authenticatedUser.id,
      assessed_at:
        assessedAt ?? new Date().toISOString(),
    };

    const { data: existingAssessment, error: findError } =
      await supabase
        .from("medical_coordination_assessments")
        .select("id")
        .eq("incident_id", incidentId)
        .order("assessed_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (findError) {
      throw new Error(
        `Unable to read coordination assessment: ${findError.message}`,
      );
    }

    if (existingAssessment) {
      const { data, error } = await supabase
        .from("medical_coordination_assessments")
        .update(values)
        .eq("id", existingAssessment.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Unable to update coordination assessment: ${error.message}`,
        );
      }

      response.status(200).json({
        success: true,
        message:
          "Medical coordination assessment updated successfully.",
        data,
      });

      return;
    }

    const { data, error } = await supabase
      .from("medical_coordination_assessments")
      .insert(values)
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Unable to create coordination assessment: ${error.message}`,
      );
    }

    response.status(201).json({
      success: true,
      message:
        "Medical coordination assessment created successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}