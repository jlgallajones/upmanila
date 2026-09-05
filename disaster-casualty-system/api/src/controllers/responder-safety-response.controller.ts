import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

const responderSafetyStatuses = ["yes", "no"] as const;
type ResponderSafetyStatus = (typeof responderSafetyStatuses)[number];

const unitScopedAdminRoles = new Set(["admin", "administrator"]);

function isUnitScopedAdmin(role: string): boolean {
  return unitScopedAdminRoles.has(role);
}

function getStringParam(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

/**
 * Confirms the logged-in admin is allowed to see/manage this incident's
 * responder safety data, and returns the incident row.
 *
 * Scoping rule: super_admin can see every incident. A unit-scoped admin
 * (admin / administrator) can only see incidents they created themselves —
 * matching how their responder accounts are scoped by `created_by` too.
 */
async function loadScopedIncident(
  incidentId: string,
  user: { id: string; role: string },
): Promise<{ id: string; created_by: string | null } | null> {
  const { data: incident, error } = await supabase
    .from("incidents")
    .select("id, created_by")
    .eq("id", incidentId)
    .single();

  if (error || !incident) {
    return null;
  }

  if (
    isUnitScopedAdmin(user.role) &&
    incident.created_by !== user.id
  ) {
    return null;
  }

  return incident;
}

const responderSafetyResponseSelect = `
  id,
  incident_id,
  responder_id,
  responder_role,
  responder_function,
  safety_status,
  ppe_used_at,
  recorded_at,
  updated_at,
  responder:users!responder_safety_responses_responder_id_fkey (
    id,
    full_name,
    email,
    role,
    assigned_municipality,
    assigned_barangay
  )
`;
// NOTE: verify "responder_safety_responses_responder_id_fkey" matches the
// actual foreign key constraint name in Supabase (Table Editor >
// responder_safety_responses > the responder_id column's foreign key).
// Postgres auto-generates this as `<table>_<column>_fkey` by default, but
// rename it here if yours differs.

export async function getIncidentResponderSafetyResponses(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const incidentId = getStringParam(request.params.incidentId);

    if (!incidentId) {
      response.status(400).json({
        success: false,
        message: "incidentId is required.",
      });
      return;
    }

    const incident = await loadScopedIncident(incidentId, user);

    if (!incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("responder_safety_responses")
      .select(responderSafetyResponseSelect)
      .eq("incident_id", incidentId)
      .order("recorded_at", { ascending: false });

    if (error) {
      throw new Error(
        `Unable to retrieve responder safety responses: ${error.message}`,
      );
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

export async function updateResponderSafetyResponseStatus(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const incidentId = getStringParam(request.params.incidentId);
    const responseId = getStringParam(request.params.responseId);
    const safetyStatus = request.body?.safetyStatus;

    if (!incidentId || !responseId) {
      response.status(400).json({
        success: false,
        message: "incidentId and responseId are required.",
      });
      return;
    }

    if (
      typeof safetyStatus !== "string" ||
      !responderSafetyStatuses.includes(
        safetyStatus as ResponderSafetyStatus,
      )
    ) {
      response.status(400).json({
        success: false,
        message: "safetyStatus must be 'yes' or 'no'.",
      });
      return;
    }

    const incident = await loadScopedIncident(incidentId, user);

    if (!incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const { data: existingResponse, error: existingResponseError } =
      await supabase
        .from("responder_safety_responses")
        .select("id, incident_id")
        .eq("id", responseId)
        .single();

    if (existingResponseError || !existingResponse) {
      response.status(404).json({
        success: false,
        message: "Responder safety response not found.",
      });
      return;
    }

    if (existingResponse.incident_id !== incidentId) {
      response.status(400).json({
        success: false,
        message:
          "This response does not belong to the specified incident.",
      });
      return;
    }

    const { data: updatedRecord, error: updateError } = await supabase
      .from("responder_safety_responses")
      .update({
        safety_status: safetyStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", responseId)
      .select(responderSafetyResponseSelect)
      .single();

    if (updateError || !updatedRecord) {
      throw new Error(
        `Unable to update responder safety status: ${
          updateError?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Responder safety status updated.",
      data: updatedRecord,
    });
  } catch (error) {
    next(error);
  }
}