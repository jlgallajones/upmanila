import { supabase } from "../config/supabase.js";

export type AuditActor = {
  id: string;
  fullName?: string;
  role: string;
};

export type AuditLogInput = {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
  scopeAdminId?: string | null;
};

type ActorProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  created_by: string | null;
};

const adminScopeRoles = new Set([
  "admin",
  "administrator",
  "encoder",
]);

async function getActorProfile(
  actorId: string,
): Promise<ActorProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role, created_by")
    .eq("id", actorId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load audit actor profile: ${error.message}`,
    );
  }

  return data;
}

async function resolveScopeAdminId(
  actor: AuditActor,
  override?: string | null,
): Promise<string | null> {
  if (override !== undefined) {
    return override;
  }

  if (actor.role === "super_admin") {
    return null;
  }

  if (adminScopeRoles.has(actor.role)) {
    return actor.id;
  }

  const profile = await getActorProfile(actor.id);

  return profile?.created_by ?? actor.id;
}

export async function recordAuditLog({
  actor,
  action,
  entityType,
  entityId = null,
  entityLabel = null,
  metadata = {},
  scopeAdminId,
}: AuditLogInput): Promise<void> {
  const profile = await getActorProfile(actor.id);
  const resolvedScopeAdminId = await resolveScopeAdminId(
    {
      ...actor,
      role: profile?.role ?? actor.role,
    },
    scopeAdminId,
  );

  const { error } = await supabase.from("audit_logs").insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_label: entityLabel,
    actor_id: actor.id,
    actor_full_name: profile?.full_name ?? actor.fullName ?? null,
    actor_role: profile?.role ?? actor.role,
    scope_admin_id: resolvedScopeAdminId,
    metadata,
  });

  if (error) {
    throw new Error(`Unable to record audit log: ${error.message}`);
  }
}
