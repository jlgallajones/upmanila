import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import {
  getAuthenticatedUser,
  type AuthenticatedUser,
} from "../middleware/auth.js";
import { recordAuditLog } from "../services/audit-log.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const backupRoles = new Set([
  "responder",
  "field_responder",
  "sa_responder",
  "minor_incident_documenter",
  "documenter",
  "medical_personnel",
]);

type IncidentRecord = {
  id: string;
  incident_name: string | null;
  created_by: string;
  status: string | null;
};

type DelegationRecord = {
  id: string;
  incident_id: string;
  primary_ic_user_id: string;
  acting_ic_user_id: string;
  delegated_by: string;
  reason: string | null;
  delegated_at: string;
  resumed_at: string | null;
  resumed_by: string | null;
  resume_reason: string | null;
};

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

async function loadIncident(incidentId: string): Promise<IncidentRecord | null> {
  const { data, error } = await supabase
    .from("incidents")
    .select("id, incident_name, created_by, status")
    .eq("id", incidentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to retrieve incident: ${error.message}`);
  }

  return data as IncidentRecord | null;
}

async function loadActiveDelegation(
  incidentId: string,
): Promise<DelegationRecord | null> {
  const { data, error } = await supabase
    .from("incident_ic_delegations")
    .select(
      "id, incident_id, primary_ic_user_id, acting_ic_user_id, delegated_by, reason, delegated_at, resumed_at, resumed_by, resume_reason",
    )
    .eq("incident_id", incidentId)
    .is("resumed_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to retrieve Acting IC delegation: ${error.message}`);
  }

  return data as DelegationRecord | null;
}

async function loadUserProfiles(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, is_active, created_by")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Unable to retrieve Acting IC user profiles: ${error.message}`);
  }

  return data ?? [];
}

async function loadBackups(incidentId: string) {
  const { data, error } = await supabase
    .from("incident_ic_backups")
    .select("id, incident_id, user_id, priority, designated_by, created_at, updated_at")
    .eq("incident_id", incidentId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to retrieve designated backup ICs: ${error.message}`);
  }

  const profiles = await loadUserProfiles((data ?? []).map((row) => row.user_id));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return (data ?? []).map((row) => ({
    ...row,
    user: profileById.get(row.user_id) ?? null,
  }));
}

async function loadCurrentUserCreatedBy(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("created_by")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to retrieve user unit scope: ${error.message}`);
  }

  return data?.created_by ?? null;
}

export async function getIncidentManagementAccess(
  incidentId: string,
  user: AuthenticatedUser,
) {
  const incident = await loadIncident(incidentId);
  if (!incident) return null;

  const activeDelegation = await loadActiveDelegation(incidentId);
  const isSuperAdmin = user.role === "super_admin";
  const isPrimaryOwner = incident.created_by === user.id;
  const isActingIc = activeDelegation?.acting_ic_user_id === user.id;
  const canManageIncident =
    isSuperAdmin ||
    isActingIc ||
    (isPrimaryOwner && !activeDelegation);

  return {
    incident,
    activeDelegation,
    isSuperAdmin,
    isPrimaryOwner,
    isActingIc,
    canManageIncident,
    canDelegate: isSuperAdmin || (isPrimaryOwner && !activeDelegation),
    canResume:
      Boolean(activeDelegation) &&
      (isSuperAdmin || isPrimaryOwner || isActingIc),
  };
}

async function requireOwnerAccess(
  incidentId: string,
  user: AuthenticatedUser,
): Promise<NonNullable<Awaited<ReturnType<typeof getIncidentManagementAccess>>>> {
  const access = await getIncidentManagementAccess(incidentId, user);
  if (!access) {
    throw Object.assign(new Error("Incident not found."), { statusCode: 404 });
  }

  if (!access.canDelegate && !access.canResume) {
    throw Object.assign(
      new Error("Only the permanent incident owner or super admin may change Acting IC control."),
      { statusCode: 403 },
    );
  }

  return access;
}

function sendControllerError(error: unknown, response: Response, next: NextFunction) {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 500;

  if (statusCode >= 400 && statusCode < 600) {
    response.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : "Request failed.",
    });
    return;
  }

  next(error);
}

export async function getIncidentActingIc(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;
    const user = getAuthenticatedUser(request);
    if (!isValidUuid(incidentId)) {
      response.status(400).json({ success: false, message: "A valid incident UUID is required." });
      return;
    }

    const access = await getIncidentManagementAccess(incidentId, user);
    if (!access) {
      response.status(404).json({ success: false, message: "Incident not found." });
      return;
    }

    const currentUserCreatedBy = await loadCurrentUserCreatedBy(user.id);
    const canView =
      access.isSuperAdmin ||
      access.isPrimaryOwner ||
      access.isActingIc ||
      currentUserCreatedBy === access.incident.created_by;

    if (!canView) {
      response.status(403).json({ success: false, message: "This incident is outside your unit scope." });
      return;
    }

    const [backups, profiles] = await Promise.all([
      loadBackups(incidentId),
      loadUserProfiles([
        access.incident.created_by,
        access.activeDelegation?.acting_ic_user_id ?? "",
        access.activeDelegation?.delegated_by ?? "",
      ]),
    ]);
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    response.status(200).json({
      success: true,
      data: {
        incident: access.incident,
        primaryOwner: profileById.get(access.incident.created_by) ?? null,
        activeDelegation: access.activeDelegation
          ? {
              ...access.activeDelegation,
              actingUser:
                profileById.get(access.activeDelegation.acting_ic_user_id) ?? null,
              delegatedBy:
                profileById.get(access.activeDelegation.delegated_by) ?? null,
            }
          : null,
        backups,
        canManageIncident: access.canManageIncident,
        canDelegate: access.canDelegate,
        canResume: access.canResume,
        isPrimaryOwner: access.isPrimaryOwner,
        isActingIc: access.isActingIc,
      },
    });
  } catch (error) {
    sendControllerError(error, response, next);
  }
}

export async function designateIncidentBackupIc(
  request: Request<{ id: string }, unknown, { userId?: string; priority?: number }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;
    const user = getAuthenticatedUser(request);
    const backupUserId = request.body?.userId;
    const priority = request.body?.priority ?? 1;
    if (!isValidUuid(incidentId) || !isValidUuid(backupUserId)) {
      throw Object.assign(new Error("A valid incident ID and backup user ID are required."), { statusCode: 400 });
    }
    if (!Number.isInteger(priority) || priority < 1) {
      throw Object.assign(new Error("priority must be a positive whole number."), { statusCode: 400 });
    }

    const access = await requireOwnerAccess(incidentId, user);
    if (!access.isSuperAdmin && !access.isPrimaryOwner) {
      throw Object.assign(
        new Error("Only the permanent incident owner or super admin may designate backup ICs."),
        { statusCode: 403 },
      );
    }
    const { data: backupUser, error: backupError } = await supabase
      .from("users")
      .select("id, full_name, email, role, is_active, created_by")
      .eq("id", backupUserId)
      .maybeSingle();

    if (backupError) throw new Error(`Unable to retrieve backup user: ${backupError.message}`);
    if (!backupUser || !backupRoles.has(backupUser.role) || !backupUser.is_active) {
      throw Object.assign(new Error("The selected backup must be an active unit user."), { statusCode: 400 });
    }
    if (backupUser.created_by !== access.incident.created_by || backupUser.id === access.incident.created_by) {
      throw Object.assign(new Error("The backup IC must belong to the incident owner's unit."), { statusCode: 400 });
    }

    const { data: backup, error } = await supabase
      .from("incident_ic_backups")
      .upsert(
        {
          incident_id: incidentId,
          user_id: backupUserId,
          priority,
          designated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "incident_id,user_id" },
      )
      .select("id, incident_id, user_id, priority, designated_by, created_at, updated_at")
      .single();

    if (error || !backup) throw new Error(`Unable to designate backup IC: ${error?.message ?? "Unknown database error"}`);

    await recordAuditLog({
      actor: user,
      action: "incident.acting_ic_backup_designated",
      entityType: "incident",
      entityId: incidentId,
      entityLabel: access.incident.incident_name,
      metadata: { backupUserId, priority },
      scopeAdminId: access.incident.created_by,
    });

    response.status(200).json({ success: true, message: "Backup IC designated.", data: { ...backup, user: backupUser } });
  } catch (error) {
    sendControllerError(error, response, next);
  }
}

export async function removeIncidentBackupIc(
  request: Request<{ id: string; userId: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;
    const backupUserId = request.params.userId;
    const user = getAuthenticatedUser(request);
    if (!isValidUuid(incidentId) || !isValidUuid(backupUserId)) {
      throw Object.assign(new Error("A valid incident ID and backup user ID are required."), { statusCode: 400 });
    }
    const access = await requireOwnerAccess(incidentId, user);
    if (!access.isSuperAdmin && !access.isPrimaryOwner) {
      throw Object.assign(
        new Error("Only the permanent incident owner or super admin may remove backup ICs."),
        { statusCode: 403 },
      );
    }
    const active = await loadActiveDelegation(incidentId);
    if (active?.acting_ic_user_id === backupUserId) {
      throw Object.assign(new Error("Resume primary ownership before removing the active Acting IC."), { statusCode: 409 });
    }

    const { error } = await supabase
      .from("incident_ic_backups")
      .delete()
      .eq("incident_id", incidentId)
      .eq("user_id", backupUserId);
    if (error) throw new Error(`Unable to remove backup IC: ${error.message}`);

    await recordAuditLog({
      actor: user,
      action: "incident.acting_ic_backup_removed",
      entityType: "incident",
      entityId: incidentId,
      entityLabel: access.incident.incident_name,
      metadata: { backupUserId },
      scopeAdminId: access.incident.created_by,
    });

    response.status(200).json({ success: true, message: "Backup IC designation removed." });
  } catch (error) {
    sendControllerError(error, response, next);
  }
}

export async function delegateIncidentActingIc(
  request: Request<{ id: string }, unknown, { userId?: string; reason?: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;
    const user = getAuthenticatedUser(request);
    const actingUserId = request.body?.userId;
    if (!isValidUuid(incidentId) || !isValidUuid(actingUserId)) {
      throw Object.assign(new Error("A valid incident ID and Acting IC user ID are required."), { statusCode: 400 });
    }
    const access = await requireOwnerAccess(incidentId, user);
    if (!access.canDelegate) {
      throw Object.assign(new Error("Primary ownership is already delegated. Resume it before starting another delegation."), { statusCode: 409 });
    }

    const { data: backup, error: backupError } = await supabase
      .from("incident_ic_backups")
      .select("user_id")
      .eq("incident_id", incidentId)
      .eq("user_id", actingUserId)
      .maybeSingle();
    if (backupError) throw new Error(`Unable to verify backup IC designation: ${backupError.message}`);
    if (!backup) throw Object.assign(new Error("Select a designated backup IC before delegating control."), { statusCode: 400 });

    const { data: actingUser, error: actingUserError } = await supabase
      .from("users")
      .select("id, full_name, email, role, is_active, created_by")
      .eq("id", actingUserId)
      .maybeSingle();
    if (actingUserError) throw new Error(`Unable to retrieve Acting IC: ${actingUserError.message}`);
    if (!actingUser || !actingUser.is_active || actingUser.created_by !== access.incident.created_by) {
      throw Object.assign(new Error("The selected Acting IC is not an active user in the incident owner's unit."), { statusCode: 400 });
    }

    const { data: delegation, error } = await supabase
      .from("incident_ic_delegations")
      .insert({
        incident_id: incidentId,
        primary_ic_user_id: access.incident.created_by,
        acting_ic_user_id: actingUserId,
        delegated_by: user.id,
        reason: normalizeText(request.body?.reason),
      })
      .select("id, incident_id, primary_ic_user_id, acting_ic_user_id, delegated_by, reason, delegated_at, resumed_at, resumed_by, resume_reason")
      .single();
    if (error || !delegation) throw new Error(`Unable to delegate Acting IC control: ${error?.message ?? "Unknown database error"}`);

    await recordAuditLog({
      actor: user,
      action: "incident.acting_ic_delegated",
      entityType: "incident",
      entityId: incidentId,
      entityLabel: access.incident.incident_name,
      metadata: { actingUserId, reason: delegation.reason, delegationId: delegation.id },
      scopeAdminId: access.incident.created_by,
    });

    response.status(201).json({ success: true, message: "Acting IC control delegated.", data: { ...delegation, actingUser } });
  } catch (error) {
    sendControllerError(error, response, next);
  }
}

export async function resumeIncidentPrimaryOwnership(
  request: Request<{ id: string }, unknown, { reason?: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId = request.params.id;
    const user = getAuthenticatedUser(request);
    if (!isValidUuid(incidentId)) {
      throw Object.assign(new Error("A valid incident UUID is required."), { statusCode: 400 });
    }
    const access = await requireOwnerAccess(incidentId, user);
    if (!access.activeDelegation) {
      throw Object.assign(new Error("This incident does not have an active Acting IC delegation."), { statusCode: 409 });
    }

    const { data: delegation, error } = await supabase
      .from("incident_ic_delegations")
      .update({
        resumed_at: new Date().toISOString(),
        resumed_by: user.id,
        resume_reason: normalizeText(request.body?.reason),
      })
      .eq("id", access.activeDelegation.id)
      .is("resumed_at", null)
      .select("id, incident_id, primary_ic_user_id, acting_ic_user_id, delegated_by, reason, delegated_at, resumed_at, resumed_by, resume_reason")
      .single();
    if (error || !delegation) throw new Error(`Unable to resume primary ownership: ${error?.message ?? "The delegation was already resumed."}`);

    await recordAuditLog({
      actor: user,
      action: "incident.acting_ic_resumed",
      entityType: "incident",
      entityId: incidentId,
      entityLabel: access.incident.incident_name,
      metadata: { delegationId: delegation.id, actingUserId: delegation.acting_ic_user_id, reason: delegation.resume_reason },
      scopeAdminId: access.incident.created_by,
    });

    response.status(200).json({ success: true, message: "Primary ownership resumed.", data: delegation });
  } catch (error) {
    sendControllerError(error, response, next);
  }
}
