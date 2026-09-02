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

function parseNullableNonNegativeInteger(
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
    value < 0
  ) {
    throw new Error(
      `${fieldName} must be a non-negative whole number, or null.`,
    );
  }

  return value;
}

function parseSafetyActionStatus(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (
    value !== "yes" &&
    value !== "no" &&
    value !== "unknown"
  ) {
    throw new Error(
      `${fieldName} must be yes, no, unknown, or null.`,
    );
  }

  return value;
}

function parseDisruptionLevel(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (
    value !== "none" &&
    value !== "minimal" &&
    value !== "moderate" &&
    value !== "total" &&
    value !== "unknown"
  ) {
    throw new Error(
      `${fieldName} must be none, minimal, moderate, total, unknown, or null.`,
    );
  }

  return value;
}

function parseAlternativeIcuUse(
  value: unknown,
  fieldName: string,
): boolean | null | undefined {
  return parseNullableBoolean(value, fieldName);
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

function buildResponderSafetySummary(
  report: Record<string, unknown> | null,
  timeline: Record<string, unknown> | null,
  incident: Record<string, unknown> | null,
) {
  const deployedResponders =
    typeof report?.deployed_responders === "number"
      ? report.deployed_responders
      : 0;
  const injuredResponders =
    typeof report?.injured_responders === "number"
      ? report.injured_responders
      : 0;
  const illResponders =
    typeof report?.ill_responders === "number"
      ? report.ill_responders
      : 0;
  const deceasedResponders =
    typeof report?.deceased_responders === "number"
      ? report.deceased_responders
      : 0;
  const illOrInjuredResponders =
    illResponders + injuredResponders;
  const killedPercentage =
    deployedResponders > 0
      ? Number(
          (
            (deceasedResponders / deployedResponders) *
            100
          ).toFixed(2),
        )
      : 0;
  const illOrInjuredPercentage =
    deployedResponders > 0
      ? Number(
          (
            (illOrInjuredResponders / deployedResponders) *
            100
          ).toFixed(2),
        )
      : 0;
  const responseDeactivatedAt =
    (report?.response_deactivated_at as string | null | undefined) ??
    (timeline?.last_facility_deactivated_at as
      | string
      | null
      | undefined) ??
    (timeline?.scene_demobilized_at as string | null | undefined) ??
    (incident?.ended_at as string | null | undefined) ??
    null;

  return {
    safetyActionsEstablished:
      report?.safety_actions_established ?? null,
    ppeDecisionAt: report?.ppe_decision_at ?? null,
    dmmpActivatedAt: timeline?.dmmp_activated_at ?? null,
    responseDeactivatedAt,
    deployedResponders,
    injuredResponders,
    illResponders,
    deceasedResponders,
    illOrInjuredResponders,
    killedPercentage,
    illOrInjuredPercentage,
    killedFormula:
      "(killed responders during acute response phase / deployed responders during acute response phase) x 100",
    illOrInjuredFormula:
      "(ill or injured responders during acute response phase / deployed responders during acute response phase) x 100",
  };
}

/**
 * GET /api/incidents/:id/responder-safety-report
 */
export async function getResponderSafetyReport(
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

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, ended_at")
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

    const [reportResult, timelineResult] = await Promise.all([
      supabase
        .from("responder_safety_responses")
        .select("*")
        .eq("incident_id", incidentId)
        .maybeSingle(),
      supabase
        .from("incident_response_timelines")
        .select(
          "dmmp_activated_at, scene_demobilized_at, last_facility_deactivated_at",
        )
        .eq("incident_id", incidentId)
        .maybeSingle(),
    ]);

    if (reportResult.error) {
      throw new Error(
        `Unable to retrieve responder safety report: ${reportResult.error.message}`,
      );
    }

    if (timelineResult.error) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineResult.error.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data: reportResult.data ?? null,
      summary: buildResponderSafetySummary(
        reportResult.data ?? null,
        timelineResult.data ?? null,
        incident,
      ),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidents/:id/responder-safety-response
 */
export async function getResponderSafetyResponse(
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

    const authenticatedUser = getAuthenticatedUser(request);
    const { data, error } = await supabase
      .from("responder_safety_responses")
      .select("*")
      .eq("incident_id", incidentId)
      .eq("responder_id", authenticatedUser.id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to retrieve responder safety response: ${error.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data: data ?? null,
    });
  } catch (error) {
    next(error);
  }
}

function buildDeactivationContinuitySummary(
  timeline: Record<string, unknown> | null,
  assessment: Record<string, unknown> | null,
) {
  return {
    sceneDemobilizedAt: timeline?.scene_demobilized_at ?? null,
    lastFacilityDeactivatedAt:
      timeline?.last_facility_deactivated_at ?? null,
    emsCoverageDisruption:
      assessment?.ems_coverage_disruption ?? null,
    facilityCareDisruption:
      assessment?.facility_care_disruption ?? null,
    notes: assessment?.notes ?? null,
    assessedAt: assessment?.assessed_at ?? null,
  };
}

type FacilityOperationNoteEvent = {
  action: string;
  facilityId: string | null;
  facilityName: string | null;
  recordedAt: string | null;
  value: string | null;
};

function parseFacilityOperationNoteEvents(
  notes: string | null | undefined,
): FacilityOperationNoteEvent[] {
  if (!notes) {
    return [];
  }

  return notes
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const header = lines[0]?.match(/^\[(.+)\]$/)?.[1] ?? null;

      if (!header) {
        return null;
      }

      const readLine = (prefix: string) =>
        lines
          .find((line) =>
            line.toLowerCase().startsWith(prefix.toLowerCase()),
          )
          ?.slice(prefix.length)
          .trim() || null;

      return {
        action: header,
        facilityId: readLine("Healthcare facility ID:"),
        facilityName: readLine("Healthcare facility:"),
        recordedAt: readLine("Recorded at:"),
        value: readLine("Value:"),
      };
    })
    .filter(
      (event): event is FacilityOperationNoteEvent =>
        event !== null &&
        Boolean(event.facilityId || event.facilityName),
    );
}

function normalizeFacilityName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function latestDateValue(
  values: Array<string | null | undefined>,
): string | null {
  const dates = values
    .map((value) => (value ? new Date(value) : null))
    .filter(
      (value): value is Date =>
        value !== null && !Number.isNaN(value.getTime()),
    )
    .sort((first, second) => second.getTime() - first.getTime());

  return dates[0]?.toISOString() ?? null;
}

/**
 * GET /api/incidents/:id/facility-operational-summary
 */
export async function getFacilityOperationalSummary(
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

    const incidentExists = await verifyIncidentExists(incidentId);

    if (!incidentExists) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const [
      facilitiesResult,
      casualtyResult,
      continuityResult,
      resourceResult,
    ] = await Promise.all([
      supabase
        .from("healthcare_facilities")
        .select(
          "id, facility_name, facility_level, municipality, province, is_active",
        )
        .eq("is_active", true)
        .order("facility_name", { ascending: true }),
      supabase
        .from("casualty_incidents")
        .select("id")
        .eq("incident_id", incidentId)
        .is("deleted_at", null),
      supabase
        .from("continuity_of_care_assessments")
        .select("facility_care_disruption, notes, assessed_at")
        .eq("incident_id", incidentId)
        .maybeSingle(),
      supabase
        .from("facility_resource_snapshots")
        .select(
          "id, facility_id, recorded_at, total_operating_rooms, total_resuscitation_rooms, alternative_icu_in_use, notes",
        )
        .eq("incident_id", incidentId)
        .order("recorded_at", { ascending: false }),
    ]);

    const firstError =
      facilitiesResult.error ??
      casualtyResult.error ??
      continuityResult.error ??
      resourceResult.error;

    if (firstError) {
      throw new Error(
        `Unable to retrieve facility operational summary: ${firstError.message}`,
      );
    }

    const casualtyIncidentIds = (casualtyResult.data ?? []).map(
      (item) => item.id,
    );
    const encounterResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("facility_encounters")
            .select(
              "casualty_incident_id, facility_id, arrived_at, admitted_to_hospital, discharged_home, surgical_intervention_started_at, operating_room_started_at, xray_performed_at, ultrasound_performed_at, ct_performed_at, icu_admitted_at, mechanical_ventilation_required, alternative_icu_used, created_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };

    if (encounterResult.error) {
      throw new Error(
        `Unable to retrieve facility encounters: ${encounterResult.error.message}`,
      );
    }

    const facilities = new Map<
      string,
      {
        id: string;
        facility_name: string;
        facility_level: string | null;
        municipality: string | null;
        province: string | null;
      }
    >();

    for (const facility of facilitiesResult.data ?? []) {
      facilities.set(facility.id, facility);
    }

    const noteEvents = parseFacilityOperationNoteEvents(
      continuityResult.data?.notes,
    );
    const resources = resourceResult.data ?? [];
    const encounters = encounterResult.data ?? [];
    const facilityIds = new Set<string>();

    for (const encounter of encounters) {
      if (encounter.facility_id) {
        facilityIds.add(encounter.facility_id);
      }
    }

    for (const resource of resources) {
      if (resource.facility_id) {
        facilityIds.add(resource.facility_id);
      }
    }

    for (const event of noteEvents) {
      if (event.facilityId) {
        facilityIds.add(event.facilityId);
      }
    }

    for (const facilityId of facilities.keys()) {
      facilityIds.add(facilityId);
    }

    const summaries = Array.from(facilityIds)
      .map((facilityId) => {
        const facility = facilities.get(facilityId) ?? null;
        const facilityName = facility?.facility_name ?? null;
        const nameKey = normalizeFacilityName(facilityName);
        const matchingEvents = noteEvents.filter(
          (event) =>
            event.facilityId === facilityId ||
            (
              !event.facilityId &&
              nameKey &&
              normalizeFacilityName(event.facilityName) === nameKey
            ),
        );
        const disruptionEvents = matchingEvents.filter((event) =>
          event.action
            .toLowerCase()
            .includes("routine care disruption"),
        );
        const closeEvents = matchingEvents.filter((event) =>
          event.action
            .toLowerCase()
            .includes("close healthcare facility response"),
        );
        const facilityEncounters = encounters.filter(
          (encounter) => encounter.facility_id === facilityId,
        );
        const latestResource =
          resources.find((resource) => resource.facility_id === facilityId) ??
          null;
        const latestDisruption = disruptionEvents[0] ?? null;

        return {
          facilityId,
          facilityName:
            facilityName ??
            matchingEvents[0]?.facilityName ??
            "Unspecified healthcare facility",
          facilityLevel: facility?.facility_level ?? null,
          municipality: facility?.municipality ?? null,
          province: facility?.province ?? null,
          continuity: {
            facilityCareDisruption:
              latestDisruption?.value?.toLowerCase() ??
              (disruptionEvents.length > 0
                ? continuityResult.data?.facility_care_disruption ?? null
                : null),
            lastFacilityDeactivatedAt: latestDateValue(
              closeEvents.map((event) => event.recordedAt),
            ),
            assessedAt: continuityResult.data?.assessed_at ?? null,
          },
          resources: latestResource
            ? {
                recordedAt: latestResource.recorded_at,
                totalOperatingRooms:
                  latestResource.total_operating_rooms,
                totalResuscitationRooms:
                  latestResource.total_resuscitation_rooms,
                alternativeIcuInUse:
                  latestResource.alternative_icu_in_use,
                notes: latestResource.notes,
              }
            : null,
          hofdEntries: {
            encountersTotal: facilityEncounters.length,
            arrivedTotal: facilityEncounters.filter((row) =>
              Boolean(row.arrived_at),
            ).length,
            admittedTotal: facilityEncounters.filter(
              (row) => row.admitted_to_hospital === true,
            ).length,
            dischargedTotal: facilityEncounters.filter(
              (row) => row.discharged_home === true,
            ).length,
            surgeryTotal: facilityEncounters.filter((row) =>
              Boolean(row.surgical_intervention_started_at),
            ).length,
            operatingRoomUseTotal: facilityEncounters.filter((row) =>
              Boolean(row.operating_room_started_at),
            ).length,
            xrayUseTotal: facilityEncounters.filter((row) =>
              Boolean(row.xray_performed_at),
            ).length,
            ultrasoundUseTotal: facilityEncounters.filter((row) =>
              Boolean(row.ultrasound_performed_at),
            ).length,
            ctUseTotal: facilityEncounters.filter((row) =>
              Boolean(row.ct_performed_at),
            ).length,
            icuAdmissions: facilityEncounters.filter((row) =>
              Boolean(row.icu_admitted_at),
            ).length,
            ventilatedTotal: facilityEncounters.filter(
              (row) => row.mechanical_ventilation_required === true,
            ).length,
            alternativeIcuUseTotal: facilityEncounters.filter(
              (row) => row.alternative_icu_used === true,
            ).length,
          },
        };
      })
      .sort((first, second) =>
        first.facilityName.localeCompare(second.facilityName),
      );

    response.status(200).json({
      success: true,
      data: {
        incidentId,
        facilities: summaries,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidents/:id/deactivation-continuity
 */
export async function getDeactivationContinuity(
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

    const incidentExists = await verifyIncidentExists(incidentId);

    if (!incidentExists) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const [timelineResult, assessmentResult] = await Promise.all([
      supabase
        .from("incident_response_timelines")
        .select("scene_demobilized_at, last_facility_deactivated_at")
        .eq("incident_id", incidentId)
        .maybeSingle(),
      supabase
        .from("continuity_of_care_assessments")
        .select("*")
        .eq("incident_id", incidentId)
        .maybeSingle(),
    ]);

    if (timelineResult.error) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineResult.error.message}`,
      );
    }

    if (assessmentResult.error) {
      throw new Error(
        `Unable to retrieve continuity assessment: ${assessmentResult.error.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data: {
        timeline: timelineResult.data ?? null,
        assessment: assessmentResult.data ?? null,
      },
      summary: buildDeactivationContinuitySummary(
        timelineResult.data ?? null,
        assessmentResult.data ?? null,
      ),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/incidents/:id/deactivation-continuity
 */
export async function saveDeactivationContinuity(
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

    const incidentExists = await verifyIncidentExists(incidentId);

    if (!incidentExists) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    let sceneDemobilizedAt: string | null | undefined;
    let lastFacilityDeactivatedAt: string | null | undefined;
    let emsCoverageDisruption: string | null | undefined;
    let facilityCareDisruption: string | null | undefined;
    let notes: string | null | undefined;
    let assessedAt: string | null | undefined;

    try {
      sceneDemobilizedAt = parseNullableDate(
        request.body.sceneDemobilizedAt,
        "sceneDemobilizedAt",
      );
      lastFacilityDeactivatedAt = parseNullableDate(
        request.body.lastFacilityDeactivatedAt,
        "lastFacilityDeactivatedAt",
      );
      emsCoverageDisruption = parseDisruptionLevel(
        request.body.emsCoverageDisruption,
        "emsCoverageDisruption",
      );
      facilityCareDisruption = parseDisruptionLevel(
        request.body.facilityCareDisruption,
        "facilityCareDisruption",
      );
      notes = parseNullableText(request.body.notes, "notes");
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
            : "Invalid deactivation and continuity assessment.",
      });
      return;
    }

    if (
      sceneDemobilizedAt &&
      lastFacilityDeactivatedAt &&
      new Date(lastFacilityDeactivatedAt) < new Date(sceneDemobilizedAt)
    ) {
      response.status(400).json({
        success: false,
        message:
          "Last facility deactivation cannot be before scene demobilization.",
      });
      return;
    }

    const authenticatedUser = getAuthenticatedUser(request);
    const timelineValues: Record<string, unknown> = {
      updated_by: authenticatedUser.id,
    };

    if (sceneDemobilizedAt !== undefined) {
      timelineValues.scene_demobilized_at = sceneDemobilizedAt;
    }

    if (lastFacilityDeactivatedAt !== undefined) {
      timelineValues.last_facility_deactivated_at =
        lastFacilityDeactivatedAt;
    }

    const timeline = await saveTimeline(incidentId, timelineValues);

    const assessmentValues = {
      incident_id: incidentId,
      ems_coverage_disruption: emsCoverageDisruption ?? null,
      facility_care_disruption: facilityCareDisruption ?? null,
      notes: notes ?? null,
      assessed_by: authenticatedUser.id,
      assessed_at: assessedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: assessment, error: assessmentError } = await supabase
      .from("continuity_of_care_assessments")
      .upsert(assessmentValues, {
        onConflict: "incident_id",
      })
      .select("*")
      .single();

    if (assessmentError || !assessment) {
      throw new Error(
        `Unable to save continuity assessment: ${
          assessmentError?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message:
        "Deactivation and continuity assessment saved successfully.",
      data: {
        timeline,
        assessment,
      },
      summary: buildDeactivationContinuitySummary(
        timeline,
        assessment,
      ),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidents/:id/hospital-resources
 */
export async function getHospitalResources(
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

    const incidentExists = await verifyIncidentExists(incidentId);

    if (!incidentExists) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("facility_resource_snapshots")
      .select("*")
      .eq("incident_id", incidentId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to retrieve hospital resources: ${error.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data: data ?? null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/incidents/:id/hospital-resources
 */
export async function saveHospitalResources(
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

    const incidentExists = await verifyIncidentExists(incidentId);

    if (!incidentExists) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    let facilityId: string | null | undefined;
    let recordedAt: string | null | undefined;
    let totalOperatingRooms: number | null | undefined;
    let totalResuscitationRooms: number | null | undefined;
    let alternativeIcuInUse: boolean | null | undefined;
    let notes: string | null | undefined;

    try {
      facilityId = parseNullableText(request.body.facilityId, "facilityId");

      if (facilityId && !isValidUuid(facilityId)) {
        throw new Error("facilityId must be a valid UUID or null.");
      }

      recordedAt = parseNullableDate(
        request.body.recordedAt,
        "recordedAt",
      );
      totalOperatingRooms = parseNullableNonNegativeInteger(
        request.body.totalOperatingRooms,
        "totalOperatingRooms",
      );
      totalResuscitationRooms = parseNullableNonNegativeInteger(
        request.body.totalResuscitationRooms,
        "totalResuscitationRooms",
      );
      alternativeIcuInUse = parseAlternativeIcuUse(
        request.body.alternativeIcuInUse,
        "alternativeIcuInUse",
      );
      notes = parseNullableText(request.body.notes, "notes");
    } catch (validationError) {
      response.status(400).json({
        success: false,
        message:
          validationError instanceof Error
            ? validationError.message
            : "Invalid hospital resources.",
      });
      return;
    }

    const authenticatedUser = getAuthenticatedUser(request);
    const values = {
      incident_id: incidentId,
      facility_id: facilityId ?? null,
      recorded_at: recordedAt ?? new Date().toISOString(),
      total_operating_rooms: totalOperatingRooms ?? null,
      total_resuscitation_rooms: totalResuscitationRooms ?? null,
      alternative_icu_in_use: alternativeIcuInUse ?? null,
      notes: notes ?? null,
      recorded_by: authenticatedUser.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("facility_resource_snapshots")
      .upsert(values, {
        onConflict: "incident_id",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        `Unable to save hospital resources: ${
          error?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Hospital resources saved successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/incidents/:id/responder-safety-report
 */
export async function saveResponderSafetyReport(
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

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, ended_at")
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

    let safetyActionsEstablished: string | null | undefined;
    let ppeDecisionAt: string | null | undefined;
    let responseDeactivatedAt: string | null | undefined;
    let deployedResponders: number | null | undefined;
    let injuredResponders: number | null | undefined;
    let illResponders: number | null | undefined;
    let deceasedResponders: number | null | undefined;

    try {
      safetyActionsEstablished = parseSafetyActionStatus(
        request.body.safetyActionsEstablished,
        "safetyActionsEstablished",
      );
      ppeDecisionAt = parseNullableDate(
        request.body.ppeDecisionAt,
        "ppeDecisionAt",
      );
      responseDeactivatedAt = parseNullableDate(
        request.body.responseDeactivatedAt,
        "responseDeactivatedAt",
      );
      deployedResponders = parseNullableNonNegativeInteger(
        request.body.deployedResponders,
        "deployedResponders",
      );
      injuredResponders = parseNullableNonNegativeInteger(
        request.body.injuredResponders,
        "injuredResponders",
      );
      illResponders = parseNullableNonNegativeInteger(
        request.body.illResponders,
        "illResponders",
      );
      deceasedResponders = parseNullableNonNegativeInteger(
        request.body.deceasedResponders,
        "deceasedResponders",
      );
    } catch (validationError) {
      response.status(400).json({
        success: false,
        message:
          validationError instanceof Error
            ? validationError.message
            : "Invalid responder safety report.",
      });
      return;
    }

    const authenticatedUser = getAuthenticatedUser(request);
    const values = {
      incident_id: incidentId,
      safety_actions_established:
        safetyActionsEstablished ?? null,
      ppe_decision_at: ppeDecisionAt ?? null,
      response_deactivated_at: responseDeactivatedAt ?? null,
      deployed_responders: deployedResponders ?? 0,
      injured_responders: injuredResponders ?? 0,
      ill_responders: illResponders ?? 0,
      deceased_responders: deceasedResponders ?? 0,
      reported_by: authenticatedUser.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("responder_safety_responses")
      .upsert(values, {
        onConflict: "incident_id",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        `Unable to save responder safety report: ${
          error?.message ?? "Unknown database error"
        }`,
      );
    }

    const { data: timeline, error: timelineError } = await supabase
      .from("incident_response_timelines")
        .select(
          "dmmp_activated_at, scene_demobilized_at, last_facility_deactivated_at",
        )
      .eq("incident_id", incidentId)
      .maybeSingle();

    if (timelineError) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineError.message}`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Responder safety report saved successfully.",
      data,
      summary: buildResponderSafetySummary(data, timeline, incident),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/incidents/:id/responder-safety-response
 */
export async function saveResponderSafetyResponse(
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

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id")
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

    let safetyStatus: string | null | undefined;
    let ppeUsedAt: string | null | undefined;

    try {
      safetyStatus = parseSafetyActionStatus(
        request.body.safetyStatus,
        "safetyStatus",
      );
      ppeUsedAt = parseNullableDate(
        request.body.ppeUsedAt,
        "ppeUsedAt",
      );
    } catch (validationError) {
      response.status(400).json({
        success: false,
        message:
          validationError instanceof Error
            ? validationError.message
            : "Invalid responder safety response.",
      });
      return;
    }

    if (!safetyStatus) {
      response.status(400).json({
        success: false,
        message: "safetyStatus is required.",
      });
      return;
    }

    if (!ppeUsedAt) {
      response.status(400).json({
        success: false,
        message: "ppeUsedAt is required.",
      });
      return;
    }

    const authenticatedUser = getAuthenticatedUser(request);
    const now = new Date().toISOString();
    const values = {
      incident_id: incidentId,
      responder_id: authenticatedUser.id,
      responder_role: authenticatedUser.role,
      responder_function:
        typeof request.body.responderFunction === "string"
          ? request.body.responderFunction.trim() || null
          : null,
      safety_status: safetyStatus,
      ppe_used_at: ppeUsedAt,
      recorded_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("responder_safety_responses")
      .upsert(values, {
        onConflict: "incident_id,responder_id",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        `Unable to save responder safety response: ${
          error?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Responder safety response saved successfully.",
      data,
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
