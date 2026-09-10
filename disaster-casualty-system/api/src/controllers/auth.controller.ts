import type { NextFunction, Request, Response } from "express";

import { supabase, supabaseAuth } from "../config/supabase.js";

type LoginRequest = {
  email: string;
  password: string;
};

type RefreshSessionRequest = {
  refreshToken: string;
};

type RegisterAdminRequest = {
  fullName: string;
  email: string;
  password: string;
  role: "administrator" | "super_admin";
  phoneNumber?: string;
  assignedMunicipality?: string;
  assignedBarangay?: string;
};

type RegisterUnitUserRequest = {
  fullName: string;
  email: string;
  password: string;
  role: "responder" | "documenter";
  phoneNumber?: string;
  assignedMunicipality?: string;
  assignedBarangay?: string;
};

type UpdateUnitUserRequest = {
  fullName?: string;
  email?: string;
  password?: string;
  role?: "responder" | "documenter";
  phoneNumber?: string;
  assignedMunicipality?: string;
  assignedBarangay?: string;
  isActive?: boolean;
};

type UpdateCurrentUserRequest = {
  fullName?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  assignedMunicipality?: string;
  assignedBarangay?: string;
};

type ResetOperationalDataRequest = {
  confirmation?: string;
};

const userSelect = `
  id,
  full_name,
  email,
  phone_number,
  role,
  reporting_context,
  assigned_barangay,
  assigned_municipality,
  is_active,
  created_at,
  updated_at
`;

const unitUserSelect = `
  id,
  full_name,
  email,
  phone_number,
  role,
  reporting_context,
  assigned_barangay,
  assigned_municipality,
  is_active,
  created_by,
  created_at,
  updated_at,
  last_seen_at
`;

const operationalResetConfirmation = "RESET RECORDS";

const managedAccountSelect = `
  id,
  full_name,
  email,
  phone_number,
  role,
  reporting_context,
  assigned_barangay,
  assigned_municipality,
  is_active,
  created_by,
  created_at,
  updated_at,
  last_seen_at
`;

function getFallbackFullName(email: string): string {
  return email.split("@")[0]?.trim() || "Responder";
}

function getAuthenticationFailureMessage(message?: string): string {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (normalizedMessage.includes("email not confirmed")) {
    return "Email is not confirmed in Supabase Auth. Please confirm this account before logging in.";
  }

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Invalid login credentials. Please reset the password in Supabase Authentication and try again.";
  }

  if (message) {
    return `Supabase Auth rejected the login: ${message}`;
  }

  return "Invalid email or password. Make sure this account exists in Supabase Auth.";
}

async function findProfileByEmail(email: string) {
  const { data: user, error } = await supabase
    .from("users")
    .select(userSelect)
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load user profile: ${error.message}`);
  }

  return user;
}

export async function login(
  request: Request<Record<string, never>, unknown, LoginRequest>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const email = request.body.email?.trim();
    const password = request.body.password;

    if (!email || !password) {
      response.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
      return;
    }

    const { data: authData, error: authError } =
      await supabaseAuth.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      console.warn("Supabase Auth login rejected", {
        email,
        reason: authError?.message ?? "No authenticated user returned.",
      });

      response.status(401).json({
        success: false,
        message: getAuthenticationFailureMessage(authError?.message),
      });
      return;
    }

    let { data: user, error: userError } = await supabase
      .from("users")
      .select(userSelect)
      .eq("id", authData.user.id)
      .maybeSingle();

    if (userError) {
      throw new Error(
        `Unable to load user profile: ${userError.message}`,
      );
    }

    if (!user) {
      user = await findProfileByEmail(email);
    }

    if (!user) {
      const { data: createdUser, error: createUserError } =
        await supabase
          .from("users")
          .insert({
            id: authData.user.id,
            full_name:
              typeof authData.user.user_metadata.full_name ===
              "string"
                ? authData.user.user_metadata.full_name
                : getFallbackFullName(email),
            email,
            role: "responder",
            reporting_context: "scene",
            is_active: true,
          })
          .select(userSelect)
          .single();

      if (createUserError || !createdUser) {
        user = await findProfileByEmail(email);

        if (!user) {
          response.status(500).json({
            success: false,
            message:
              createUserError?.message ??
              "Login succeeded, but the user profile could not be created.",
          });
          return;
        }
      } else {
        user = createdUser;
      }
    }

    if (!user.is_active) {
      response.status(403).json({
        success: false,
        message: "This account is inactive.",
      });
      return;
    }

    const { error: seenError } = await supabase
      .from("users")
      .update({
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (seenError) {
      console.warn("Unable to update user last_seen_at", {
        userId: user.id,
        reason: seenError.message,
      });
    }

    response.status(200).json({
      success: true,
      data: {
        user,
        accessToken: authData.session?.access_token ?? null,
        refreshToken: authData.session?.refresh_token ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshSession(
  request: Request<Record<string, never>, unknown, RefreshSessionRequest>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const refreshToken = request.body.refreshToken?.trim();

    if (!refreshToken) {
      response.status(400).json({
        success: false,
        message: "refreshToken is required.",
      });
      return;
    }

    const { data: authData, error: authError } =
      await supabaseAuth.auth.refreshSession({
        refresh_token: refreshToken,
      });

    if (authError || !authData.session?.access_token || !authData.user) {
      response.status(401).json({
        success: false,
        message:
          authError?.message ??
          "Refresh session failed. Please log in again.",
      });
      return;
    }

    let { data: user, error: userError } = await supabase
      .from("users")
      .select(userSelect)
      .eq("id", authData.user.id)
      .maybeSingle();

    if (userError) {
      throw new Error(
        `Unable to load user profile: ${userError.message}`,
      );
    }

    if (!user) {
      user = await findProfileByEmail(authData.user.email ?? "");
    }

    if (!user) {
      response.status(404).json({
        success: false,
        message: "User profile not found.",
      });
      return;
    }

    if (!user.is_active) {
      response.status(403).json({
        success: false,
        message: "This account is inactive.",
      });
      return;
    }

    const { error: seenError } = await supabase
      .from("users")
      .update({
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (seenError) {
      console.warn("Unable to update user last_seen_at", {
        userId: user.id,
        reason: seenError.message,
      });
    }

    response.status(200).json({
      success: true,
      data: {
        user,
        accessToken: authData.session.access_token,
        refreshToken:
          authData.session.refresh_token ?? refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function registerAdmin(
  request: Request<
    Record<string, never>,
    unknown,
    RegisterAdminRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (request as Request & {
      user?: { role?: string; id?: string };
    }).user;

    if (currentUser?.role !== "super_admin") {
      response.status(403).json({
        success: false,
        message: "Only super admin accounts can register command accounts.",
      });
      return;
    }

    const fullName = request.body.fullName?.trim();
    const email = request.body.email?.trim().toLowerCase();
    const password = request.body.password;
    const role = request.body.role;

    if (!fullName || !email || !password || !role) {
      response.status(400).json({
        success: false,
        message: "fullName, email, password, and role are required.",
      });
      return;
    }

    if (!["administrator", "super_admin"].includes(role)) {
      response.status(400).json({
        success: false,
        message: "Only administrator and super_admin roles can be created here.",
      });
      return;
    }

    if (password.length < 6) {
      response.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    const { data: authData, error: authError } =
      await supabaseAuth.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (authError || !authData.user) {
      throw new Error(
        `Unable to create Supabase Auth user: ${
          authError?.message ?? "No user returned."
        }`,
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          id: authData.user.id,
          full_name: fullName,
          email,
          phone_number: request.body.phoneNumber?.trim() || null,
          role,
          reporting_context: "command_admin",
          assigned_municipality:
            request.body.assignedMunicipality?.trim() || null,
          assigned_barangay:
            request.body.assignedBarangay?.trim() || null,
          is_active: true,
        },
        {
          onConflict: "id",
        },
      )
      .select(userSelect)
      .single();

    if (userError || !user) {
      throw new Error(
        `Auth user was created, but profile creation failed: ${
          userError?.message ?? "No profile returned."
        }`,
      );
    }

    response.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function getManagedAccounts(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (request as Request & {
      user?: { role?: string; id?: string };
    }).user;

    if (currentUser?.role !== "super_admin") {
      response.status(403).json({
        success: false,
        message: "Only super admin accounts can view all accounts.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select(managedAccountSelect)
      .order("full_name", { ascending: true });

    if (error) {
      throw new Error(`Unable to retrieve accounts: ${error.message}`);
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

function getUnitUserContext(
  role: RegisterUnitUserRequest["role"],
): {
  role: string;
  reportingContext: string;
} {
  switch (role) {
    case "documenter":
      return {
        role: "documenter",
        reportingContext: "receiving_facility_ed",
      };
    case "responder":
    default:
      return {
        role: "responder",
        reportingContext: "scene",
      };
  }
}

export async function registerUnitUser(
  request: Request<
    Record<string, never>,
    unknown,
    RegisterUnitUserRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (request as Request & {
      user?: { role?: string; id?: string };
    }).user;

    if (!currentUser?.id) {
      response.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    if (
      !["super_admin", "admin", "administrator", "encoder"].includes(
        currentUser.role ?? "",
      )
    ) {
      response.status(403).json({
        success: false,
        message: "Your account is not allowed to register unit users.",
      });
      return;
    }

    const fullName = request.body.fullName?.trim();
    const email = request.body.email?.trim().toLowerCase();
    const password = request.body.password;
    const requestedRole = request.body.role;

    if (!fullName || !email || !password || !requestedRole) {
      response.status(400).json({
        success: false,
        message:
          "fullName, email, password, and role are required.",
      });
      return;
    }

    if (!["responder", "documenter"].includes(requestedRole)) {
      response.status(400).json({
        success: false,
        message: "Admins can only create responder or documenter accounts.",
      });
      return;
    }

    if (password.length < 6) {
      response.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    const { data: creator, error: creatorError } = await supabase
      .from("users")
      .select(
        "id, role, assigned_municipality, assigned_barangay, is_active",
      )
      .eq("id", currentUser.id)
      .single();

    if (creatorError || !creator) {
      response.status(404).json({
        success: false,
        message: "Creator account not found.",
      });
      return;
    }

    if (!creator.is_active) {
      response.status(403).json({
        success: false,
        message: "The creator account is inactive.",
      });
      return;
    }

    const { role, reportingContext } =
      getUnitUserContext(requestedRole);
    const assignedMunicipality =
      request.body.assignedMunicipality?.trim() ||
      creator.assigned_municipality ||
      null;
    const assignedBarangay =
      request.body.assignedBarangay?.trim() ||
      creator.assigned_barangay ||
      null;

    const { data: authData, error: authError } =
      await supabaseAuth.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (authError || !authData.user) {
      throw new Error(
        `Unable to create Supabase Auth user: ${
          authError?.message ?? "No user returned."
        }`,
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          id: authData.user.id,
          full_name: fullName,
          email,
          phone_number: request.body.phoneNumber?.trim() || null,
          role,
          reporting_context: reportingContext,
          assigned_municipality: assignedMunicipality,
          assigned_barangay: assignedBarangay,
          created_by: currentUser.id,
          is_active: true,
        },
        {
          onConflict: "id",
        },
      )
      .select(unitUserSelect)
      .single();

    if (userError || !user) {
      throw new Error(
        `Auth user was created, but profile creation failed: ${
          userError?.message ?? "No profile returned."
        }`,
      );
    }

    response.status(201).json({
      success: true,
      message: "Unit user account created successfully.",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnitUsers(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (request as Request & {
      user?: { role?: string; id?: string };
    }).user;

    if (!currentUser?.id) {
      response.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select(unitUserSelect)
      .in("role", ["responder", "documenter"])
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to retrieve unit users: ${error.message}`);
    }

    let unitUsers = data ?? [];

    if (currentUser.role !== "super_admin") {
      unitUsers = unitUsers.filter(
        (user) => user.created_by === currentUser.id,
      );
    }

    response.status(200).json({
      success: true,
      count: unitUsers.length,
      data: unitUsers,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCurrentUser(
  request: Request<
    Record<string, never>,
    unknown,
    UpdateCurrentUserRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (request as Request & {
      user?: { id?: string };
    }).user;

    if (!currentUser?.id) {
      response.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    const fullName = request.body.fullName?.trim();
    const email = request.body.email?.trim().toLowerCase();
    const password = request.body.password;

    if (password !== undefined && password.length > 0 && password.length < 6) {
      response.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    if (email || password || fullName) {
      const { error: authError } =
        await supabaseAuth.auth.admin.updateUserById(
          currentUser.id,
          {
            ...(email ? { email, email_confirm: true } : {}),
            ...(password ? { password } : {}),
            ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
          },
        );

      if (authError) {
        throw new Error(
          `Unable to update Supabase Auth user: ${authError.message}`,
        );
      }
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        ...(fullName ? { full_name: fullName } : {}),
        ...(email ? { email } : {}),
        phone_number: request.body.phoneNumber?.trim() || null,
        assigned_municipality:
          request.body.assignedMunicipality?.trim() || null,
        assigned_barangay: request.body.assignedBarangay?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentUser.id)
      .select(userSelect)
      .single();

    if (updateError || !updatedUser) {
      throw new Error(
        `Unable to update profile: ${
          updateError?.message ?? "No profile returned."
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminOperationalScope(userId: string): Promise<{
  incidentIds: string[];
  casualtyIncidentIds: string[];
  casualtyIds: string[];
}> {
  const { data: unitUsers, error: unitUsersError } = await supabase
    .from("users")
    .select("id")
    .eq("created_by", userId);

  if (unitUsersError) {
    throw new Error(
      `Unable to retrieve admin-created accounts: ${unitUsersError.message}`,
    );
  }

  const encoderIds = [
    userId,
    ...((unitUsers ?? [])
      .map((account) => account.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0,
      )),
  ];

  const { data: incidents, error: incidentsError } = await supabase
    .from("incidents")
    .select("id")
    .eq("created_by", userId);

  if (incidentsError) {
    throw new Error(
      `Unable to retrieve admin incidents: ${incidentsError.message}`,
    );
  }

  const incidentIds = (incidents ?? [])
    .map((incident) => incident.id)
    .filter(
      (id): id is string =>
        typeof id === "string" && id.trim().length > 0,
    );

  const casualtyRowsById = new Map<
    string,
    { id: string; casualty_id: string | null }
  >();

  if (encoderIds.length > 0) {
    const { data, error } = await supabase
      .from("casualty_incidents")
      .select("id, casualty_id")
      .in("encoded_by", encoderIds);

    if (error) {
      throw new Error(
        `Unable to retrieve admin casualty records: ${error.message}`,
      );
    }

    for (const row of data ?? []) {
      casualtyRowsById.set(row.id, row);
    }
  }

  if (incidentIds.length > 0) {
    const { data, error } = await supabase
      .from("casualty_incidents")
      .select("id, casualty_id")
      .in("incident_id", incidentIds);

    if (error) {
      throw new Error(
        `Unable to retrieve incident casualty records: ${error.message}`,
      );
    }

    for (const row of data ?? []) {
      casualtyRowsById.set(row.id, row);
    }
  }

  const casualtyIncidentIds = Array.from(casualtyRowsById.keys());
  const casualtyIds = [
    ...new Set(
      Array.from(casualtyRowsById.values())
        .map((row) => row.casualty_id)
        .filter(
          (id): id is string =>
            typeof id === "string" && id.trim().length > 0,
        ),
    ),
  ];

  return {
    incidentIds,
    casualtyIncidentIds,
    casualtyIds,
  };
}

async function getSystemOperationalScope(): Promise<{
  incidentIds: string[];
  casualtyIncidentIds: string[];
  casualtyIds: string[];
}> {
  const [incidentsResult, casualtiesResult] =
    await Promise.all([
      supabase.from("incidents").select("id"),
      supabase
        .from("casualty_incidents")
        .select("id, casualty_id"),
    ]);

  if (incidentsResult.error) {
    throw new Error(
      `Unable to retrieve incidents: ${incidentsResult.error.message}`,
    );
  }

  if (casualtiesResult.error) {
    throw new Error(
      `Unable to retrieve casualty records: ${casualtiesResult.error.message}`,
    );
  }

  return {
    incidentIds: (incidentsResult.data ?? [])
      .map((incident) => incident.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0,
      ),
    casualtyIncidentIds: (casualtiesResult.data ?? [])
      .map((record) => record.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0,
      ),
    casualtyIds: [
      ...new Set(
        (casualtiesResult.data ?? [])
          .map((record) => record.casualty_id)
          .filter(
            (id): id is string =>
              typeof id === "string" && id.trim().length > 0,
          ),
      ),
    ],
  };
}

async function deleteByColumn(
  tableName: string,
  columnName: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const { error, count } = await supabase
    .from(tableName)
    .delete({ count: "exact" })
    .in(columnName, ids);

  if (error) {
    throw new Error(
      `Unable to clear ${tableName}: ${error.message}`,
    );
  }

  return count ?? 0;
}

async function clearOperationalData(scope: {
  incidentIds: string[];
  casualtyIncidentIds: string[];
  casualtyIds: string[];
}): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const attachmentPaths =
    scope.casualtyIncidentIds.length > 0
      ? await supabase
          .from("attachments")
          .select("storage_path")
          .in("casualty_incident_id", scope.casualtyIncidentIds)
      : { data: [], error: null };

  if (attachmentPaths.error) {
    throw new Error(
      `Unable to retrieve attachment storage paths: ${attachmentPaths.error.message}`,
    );
  }

  const paths = (attachmentPaths.data ?? [])
    .map((attachment) => attachment.storage_path)
    .filter(
      (path): path is string =>
        typeof path === "string" && path.trim().length > 0,
    );

  if (paths.length > 0) {
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_ATTACHMENTS_BUCKET ?? "attachments")
      .remove(paths);

    if (error) {
      throw new Error(
        `Unable to remove attachment files: ${error.message}`,
      );
    }
  }

  const casualtyChildTables = [
    "attachments",
    "casualty_triage_assessments",
    "casualty_transport_records",
    "casualty_treatments",
    "facility_encounters",
    "casualty_outcomes",
    "casualty_status_history",
    "casualty_verification_history",
  ];

  for (const tableName of casualtyChildTables) {
    counts[tableName] = await deleteByColumn(
      tableName,
      "casualty_incident_id",
      scope.casualtyIncidentIds,
    );
  }

  counts.casualty_notifications = await deleteByColumn(
    "notifications",
    "related_entity_id",
    scope.casualtyIncidentIds,
  );

  counts.casualty_incidents = await deleteByColumn(
    "casualty_incidents",
    "id",
    scope.casualtyIncidentIds,
  );

  counts.casualties = await deleteByColumn(
    "casualties",
    "id",
    scope.casualtyIds,
  );

  const incidentChildTables = [
    "sitreps",
    "responder_safety_responses",
    "responder_safety_reports",
    "medical_coordination_assessments",
    "continuity_of_care_assessments",
    "facility_resource_snapshots",
    "dmmp_staff_call_downs",
    "incident_response_timelines",
    "evacuation_centers",
  ];

  for (const tableName of incidentChildTables) {
    counts[tableName] = await deleteByColumn(
      tableName,
      "incident_id",
      scope.incidentIds,
    );
  }

  counts.incident_notifications = await deleteByColumn(
    "notifications",
    "related_entity_id",
    scope.incidentIds,
  );

  counts.incidents = await deleteByColumn(
    "incidents",
    "id",
    scope.incidentIds,
  );

  return counts;
}

export async function resetOperationalData(
  request: Request<
    Record<string, never>,
    unknown,
    ResetOperationalDataRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (request as Request & {
      user?: { id?: string; role?: string };
    }).user;

    if (!currentUser?.id || !currentUser.role) {
      response.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    if (request.body.confirmation !== operationalResetConfirmation) {
      response.status(400).json({
        success: false,
        message: `Type ${operationalResetConfirmation} to confirm reset.`,
      });
      return;
    }

    const isSuperAdmin = currentUser.role === "super_admin";
    const scope = isSuperAdmin
      ? await getSystemOperationalScope()
      : await getAdminOperationalScope(currentUser.id);
    const counts = await clearOperationalData(scope);

    response.status(200).json({
      success: true,
      message: isSuperAdmin
        ? "All operational records and incidents were reset. Accounts were kept."
        : "Your admin unit operational records and incidents were reset. Accounts were kept.",
      data: {
        scope: isSuperAdmin ? "system" : "admin",
        counts,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUnitUser(
  request: Request<{ id: string }, unknown, UpdateUnitUserRequest>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (request as Request & {
      user?: { role?: string; id?: string };
    }).user;
    const { id } = request.params;

    if (!currentUser?.id) {
      response.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select(unitUserSelect)
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Unable to retrieve unit user: ${existingError.message}`);
    }

    if (!existingUser || !["responder", "documenter"].includes(existingUser.role)) {
      response.status(404).json({
        success: false,
        message: "Unit user account was not found.",
      });
      return;
    }

    let canEditUnitUser = currentUser.role === "super_admin";

    if (!canEditUnitUser && existingUser.created_by === currentUser.id) {
      canEditUnitUser = true;
    }

    if (!canEditUnitUser && !existingUser.created_by) {
      const { data: creator, error: creatorError } = await supabase
        .from("users")
        .select("id, assigned_municipality, assigned_barangay")
        .eq("id", currentUser.id)
        .single();

      if (creatorError || !creator) {
        response.status(404).json({
          success: false,
          message: "Creator account not found.",
        });
        return;
      }

      canEditUnitUser =
        existingUser.assigned_municipality === creator.assigned_municipality &&
        existingUser.assigned_barangay === creator.assigned_barangay;
    }

    if (!canEditUnitUser) {
      response.status(403).json({
        success: false,
        message: "You can only edit accounts created under your admin account.",
      });
      return;
    }

    const requestedRole = request.body.role ?? existingUser.role;

    if (!["responder", "documenter"].includes(requestedRole)) {
      response.status(400).json({
        success: false,
        message: "Admins can only assign responder or documenter roles.",
      });
      return;
    }

    if (request.body.password !== undefined && request.body.password.length < 6) {
      response.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    const fullName = request.body.fullName?.trim();
    const email = request.body.email?.trim().toLowerCase();
    const { role, reportingContext } = getUnitUserContext(requestedRole);

    if (email || request.body.password) {
      const { error: authError } = await supabaseAuth.auth.admin.updateUserById(
        id,
        {
          ...(email ? { email, email_confirm: true } : {}),
          ...(request.body.password ? { password: request.body.password } : {}),
          ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
        },
      );

      if (authError) {
        throw new Error(`Unable to update Supabase Auth user: ${authError.message}`);
      }
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        ...(fullName ? { full_name: fullName } : {}),
        ...(email ? { email } : {}),
        phone_number: request.body.phoneNumber?.trim() || null,
        role,
        reporting_context: reportingContext,
        assigned_municipality:
          request.body.assignedMunicipality?.trim() || null,
        assigned_barangay: request.body.assignedBarangay?.trim() || null,
        ...(existingUser.created_by ? {} : { created_by: currentUser.id }),
        ...(typeof request.body.isActive === "boolean"
          ? { is_active: request.body.isActive }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(unitUserSelect)
      .single();

    if (updateError || !updatedUser) {
      throw new Error(
        `Unable to update unit user: ${updateError?.message ?? "No profile returned."}`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Unit user account updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUnitUser(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (request as Request & {
      user?: { role?: string; id?: string };
    }).user;
    const { id } = request.params;

    if (!currentUser?.id) {
      response.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select(unitUserSelect)
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Unable to retrieve unit user: ${existingError.message}`);
    }

    if (!existingUser || !["responder", "documenter"].includes(existingUser.role)) {
      response.status(404).json({
        success: false,
        message: "Only responder and documenter accounts can be deleted here.",
      });
      return;
    }

    let canDeleteUnitUser = currentUser.role === "super_admin";

    if (!canDeleteUnitUser && existingUser.created_by === currentUser.id) {
      canDeleteUnitUser = true;
    }

    if (!canDeleteUnitUser && !existingUser.created_by) {
      const { data: creator, error: creatorError } = await supabase
        .from("users")
        .select("id, assigned_municipality, assigned_barangay")
        .eq("id", currentUser.id)
        .single();

      if (creatorError || !creator) {
        response.status(404).json({
          success: false,
          message: "Creator account not found.",
        });
        return;
      }

      canDeleteUnitUser =
        existingUser.assigned_municipality === creator.assigned_municipality &&
        existingUser.assigned_barangay === creator.assigned_barangay;
    }

    if (!canDeleteUnitUser) {
      response.status(403).json({
        success: false,
        message: "You can only delete accounts created under your admin account.",
      });
      return;
    }

    const { error: authDeleteError } =
      await supabaseAuth.auth.admin.deleteUser(id);

    if (authDeleteError) {
      throw new Error(
        `Unable to delete Supabase Auth user: ${authDeleteError.message}`,
      );
    }

    const { error: profileDeleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (!profileDeleteError) {
      response.status(200).json({
        success: true,
        message: "Unit user account deleted successfully.",
        data: {
          id,
          deleted: true,
          deactivated: false,
        },
      });
      return;
    }

    const { error: deactivateError } = await supabase
      .from("users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (deactivateError) {
      throw new Error(
        `Auth user was deleted, but profile deactivation failed: ${deactivateError.message}`,
      );
    }

    response.status(200).json({
      success: true,
      message:
        "Login access was deleted. The profile was kept inactive because existing records reference it.",
      data: {
        id,
        deleted: false,
        deactivated: true,
      },
    });
  } catch (error) {
    next(error);
  }
}
