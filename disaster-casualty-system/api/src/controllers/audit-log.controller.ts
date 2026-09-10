import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

const auditLogSelect = `
  id,
  action,
  entity_type,
  entity_id,
  entity_label,
  actor_id,
  actor_full_name,
  actor_role,
  scope_admin_id,
  metadata,
  created_at
`;

const auditLogViewerRoles = new Set([
  "super_admin",
  "admin",
  "administrator",
  "encoder",
]);

const adminActorRoles = [
  "super_admin",
  "admin",
  "administrator",
  "encoder",
];

export async function getAuditLogs(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    if (!auditLogViewerRoles.has(user.role)) {
      response.status(403).json({
        success: false,
        message: "Your account is not allowed to view audit logs.",
      });
      return;
    }

    const limit = Math.min(
      Math.max(Number(request.query.limit) || 100, 1),
      250,
    );

    let query = supabase
      .from("audit_logs")
      .select(auditLogSelect)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (user.role === "super_admin") {
      query = query.in("actor_role", adminActorRoles);
    } else {
      query = query.or(
        `scope_admin_id.eq.${user.id},actor_id.eq.${user.id}`,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to retrieve audit logs: ${error.message}`);
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
