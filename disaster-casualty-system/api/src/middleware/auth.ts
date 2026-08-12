import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  supabase,
  supabaseAuth,
} from "../config/supabase.js";

export type UserRole =
  | "super_admin"
  | "administrator"
  | "responder"
  | "encoder"
  | "medical_personnel"
  | "viewer";

export type ReportingContext =
  | "scene"
  | "transport"
  | "receiving_facility_ed"
  | "hospital_ward"
  | "evacuation_center"
  | "command_admin";

export type AuthenticatedUser = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: UserRole;
  reportingContext: ReportingContext;
  isActive: boolean;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

const userSelect = `
  id,
  full_name,
  email,
  role,
  reporting_context,
  is_active
`;

function getBearerToken(
  request: Request,
): string | null {
  const authorizationHeader =
    request.headers.authorization;

  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith("Bearer ")
  ) {
    return null;
  }

  const token = authorizationHeader
    .slice("Bearer ".length)
    .trim();

  return token || null;
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = getBearerToken(request);

    if (!token) {
      response.status(401).json({
        success: false,
        message:
          "Authentication token is required.",
      });
      return;
    }

    const {
      data: authenticationData,
      error: authenticationError,
    } = await supabaseAuth.auth.getUser(token);

    if (
      authenticationError ||
      !authenticationData.user
    ) {
      response.status(401).json({
        success: false,
        message:
          "Invalid or expired authentication token.",
      });
      return;
    }

    const authenticatedAuthUser =
      authenticationData.user;

    let {
      data: profile,
      error: profileError,
    } = await supabase
      .from("users")
      .select(userSelect)
      .eq("id", authenticatedAuthUser.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(
        `Unable to load authenticated profile: ${profileError.message}`,
      );
    }

    if (
      !profile &&
      authenticatedAuthUser.email
    ) {
      const {
        data: emailProfile,
        error: emailProfileError,
      } = await supabase
        .from("users")
        .select(userSelect)
        .ilike(
          "email",
          authenticatedAuthUser.email,
        )
        .maybeSingle();

      if (emailProfileError) {
        throw new Error(
          `Unable to load authenticated profile: ${emailProfileError.message}`,
        );
      }

      profile = emailProfile;
    }

    if (!profile) {
      response.status(403).json({
        success: false,
        message:
          "Authenticated user profile was not found.",
      });
      return;
    }

    if (!profile.is_active) {
      response.status(403).json({
        success: false,
        message: "This account is inactive.",
      });
      return;
    }

    const authenticatedUser: AuthenticatedUser = {
      id: profile.id,
      authUserId: authenticatedAuthUser.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role as UserRole,
      reportingContext: profile.reporting_context as ReportingContext,
      isActive: profile.is_active,
    };

    (
      request as AuthenticatedRequest
    ).user = authenticatedUser;

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(
  roles: UserRole[],
) {
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const authenticatedUser = (
      request as Partial<AuthenticatedRequest>
    ).user;

    if (!authenticatedUser) {
      response.status(401).json({
        success: false,
        message:
          "Authentication token is required.",
      });
      return;
    }

    if (
      !roles.includes(
        authenticatedUser.role,
      )
    ) {
      response.status(403).json({
        success: false,
        message:
          "Your account is not allowed to perform this action.",
      });
      return;
    }

    next();
  };
}

export function getAuthenticatedUser(
  request: Request,
): AuthenticatedUser {
  const authenticatedUser = (
    request as Partial<AuthenticatedRequest>
  ).user;

  if (!authenticatedUser) {
    throw new Error(
      "Authenticated user was not attached to the request.",
    );
  }

  return authenticatedUser;
}
