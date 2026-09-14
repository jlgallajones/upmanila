import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { recordAuditLog } from "../services/audit-log.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const staffManagerRoles = new Set([
  "super_admin",
  "admin",
  "administrator",
  "encoder",
]);

const callDownStaffSelect = `
  id,
  full_name,
  role_position,
  contact_number,
  assigned_team_unit,
  notes,
  linked_user_id,
  created_by,
  is_active,
  created_at,
  updated_at
`;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function nullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nullableUuid(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !isValidUuid(value)) return null;

  return value;
}

function activeBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  return value === true;
}

async function getStaffScope(user: {
  id: string;
  role: string;
}): Promise<string | undefined> {
  if (user.role === "super_admin") {
    return undefined;
  }

  return user.id;
}

export async function getCallDownStaff(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const scope = await getStaffScope(user);

    let query = supabase
      .from("call_down_staff")
      .select(callDownStaffSelect)
      .order("full_name", { ascending: true });

    if (scope !== undefined) {
      query = query.eq("created_by", scope);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to retrieve call down staff: ${error.message}`);
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

export async function createCallDownStaff(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    if (!staffManagerRoles.has(user.role)) {
      response.status(403).json({
        success: false,
        message: "Your account cannot manage call down staff.",
      });
      return;
    }

    const fullName = nullableText(request.body?.fullName);

    if (!fullName) {
      response.status(400).json({
        success: false,
        message: "Full name is required.",
      });
      return;
    }

    const payload = {
      full_name: fullName,
      role_position: nullableText(request.body?.rolePosition),
      contact_number: nullableText(request.body?.contactNumber),
      assigned_team_unit: nullableText(request.body?.assignedTeamUnit),
      notes: nullableText(request.body?.notes),
      linked_user_id: nullableUuid(request.body?.linkedUserId),
      created_by: user.id,
      is_active: true,
    };

    const { data, error } = await supabase
      .from("call_down_staff")
      .insert(payload)
      .select(callDownStaffSelect)
      .single();

    if (error) {
      throw new Error(`Unable to create call down staff: ${error.message}`);
    }

    await recordAuditLog({
      actor: user,
      action: "call_down_staff.created",
      entityType: "call_down_staff",
      entityId: data.id,
      entityLabel: data.full_name,
      metadata: {
        rolePosition: data.role_position,
        assignedTeamUnit: data.assigned_team_unit,
      },
    });

    response.status(201).json({
      success: true,
      message: "Call down staff added successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCallDownStaff(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const { id } = request.params;

    if (!isValidUuid(id)) {
      response.status(400).json({
        success: false,
        message: "A valid call down staff UUID is required.",
      });
      return;
    }

    let findQuery = supabase
      .from("call_down_staff")
      .select(callDownStaffSelect)
      .eq("id", id);

    if (user.role !== "super_admin") {
      findQuery = findQuery.eq("created_by", user.id);
    }

    const { data: existing, error: findError } = await findQuery.maybeSingle();

    if (findError) {
      throw new Error(`Unable to retrieve call down staff: ${findError.message}`);
    }

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Call down staff record not found.",
      });
      return;
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const fullName = nullableText(request.body?.fullName);
    if (request.body?.fullName !== undefined) {
      if (!fullName) {
        response.status(400).json({
          success: false,
          message: "Full name is required.",
        });
        return;
      }

      updates.full_name = fullName;
    }

    if (request.body?.rolePosition !== undefined) {
      updates.role_position = nullableText(request.body.rolePosition);
    }

    if (request.body?.contactNumber !== undefined) {
      updates.contact_number = nullableText(request.body.contactNumber);
    }

    if (request.body?.assignedTeamUnit !== undefined) {
      updates.assigned_team_unit = nullableText(request.body.assignedTeamUnit);
    }

    if (request.body?.notes !== undefined) {
      updates.notes = nullableText(request.body.notes);
    }

    if (request.body?.linkedUserId !== undefined) {
      updates.linked_user_id = nullableUuid(request.body.linkedUserId);
    }

    if (request.body?.isActive !== undefined) {
      updates.is_active = activeBoolean(request.body.isActive);
    }

    const { data, error } = await supabase
      .from("call_down_staff")
      .update(updates)
      .eq("id", id)
      .select(callDownStaffSelect)
      .single();

    if (error) {
      throw new Error(`Unable to update call down staff: ${error.message}`);
    }

    await recordAuditLog({
      actor: user,
      action: "call_down_staff.updated",
      entityType: "call_down_staff",
      entityId: data.id,
      entityLabel: data.full_name,
      metadata: {
        updatedFields: Object.keys(updates).filter((field) => field !== "updated_at"),
      },
    });

    response.status(200).json({
      success: true,
      message: "Call down staff updated successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

