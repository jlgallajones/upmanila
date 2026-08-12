import type { NextFunction, Request, Response } from "express";

import { supabase, supabaseAuth } from "../config/supabase.js";

type LoginRequest = {
  email: string;
  password: string;
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
