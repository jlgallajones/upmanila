import type { NextFunction, Request, Response } from "express";

import { supabase, supabaseAuth } from "../config/supabase.js";

export type UserRole =
  | "super_admin"
  | "administrator"
  | "responder"
  | "encoder"
  | "medical_personnel"
  | "viewer";

export type AuthenticatedUser = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: UserRole;
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
  is_active
`;

function getBearerToken(request: Request): string | null {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
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
        message: "Authentication token is required.",
      });
      return;
    }

    const { data: authData, error: authError } =
      await supabaseAuth.auth.getUser(token);

    if (authError || !authData.user) {
      response.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
      return;
    }

    let { data: profile, error: profileError } = await supabase
      .from("users")
      .select(userSelect)
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(
        `Unable to load authenticated profile: ${profileError.message}`,
      );
    }

    if (!profile && authData.user.email) {
      const result = await supabase
        .from("users")
        .select(userSelect)
        .ilike("email", authData.user.email)
        .maybeSingle();

      if (result.error) {
        throw new Error(
          `Unable to load authenticated profile: ${result.error.message}`,
        );
      }

      profile = result.data;
    }

    if (!profile) {
      response.status(403).json({
        success: false,
        message: "Authenticated user profile was not found.",
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

    (request as AuthenticatedRequest).user = {
      id: profile.id,
      authUserId: authData.user.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role as UserRole,
      isActive: profile.is_active,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(roles: UserRole[]) {
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const user = (request as Partial<AuthenticatedRequest>).user;

    if (!user) {
      response.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    if (!roles.includes(user.role)) {
      response.status(403).json({
        success: false,
        message: "Your account is not allowed to perform this action.",
      });
      return;
    }

    next();
  };
}

export function getAuthenticatedUser(
  request: Request,
): AuthenticatedUser {
  return (request as AuthenticatedRequest).user;
}
