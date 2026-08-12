import type { NextFunction, Request, Response } from "express";

import { supabase, supabaseAuth } from "../config/supabase.js";

type LoginRequest = {
  email: string;
  password: string;
};

type RegisterAdminRequest = {
  fullName: string;
  email: string;
  password: string;
  role: "administrator" | "encoder";
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
        message: "Only super admin accounts can register admins.",
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

    if (!["administrator", "encoder"].includes(role)) {
      response.status(400).json({
        success: false,
        message: "Only administrator and encoder roles can be created here.",
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
      message: "Admin account created successfully.",
      data: user,
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

      unitUsers = unitUsers.filter((user) => {
        if (user.created_by === currentUser.id) {
          return true;
        }

        if (user.created_by) {
          return false;
        }

        return (
          user.assigned_municipality === creator.assigned_municipality &&
          user.assigned_barangay === creator.assigned_barangay
        );
      });
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
