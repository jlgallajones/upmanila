import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

type ProfileParams = {
  userId: string;
};

export async function getProfile(
  request: Request<ProfileParams>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId } = request.params;
    const authenticatedUser = getAuthenticatedUser(request);

    if (!userId) {
      response.status(400).json({
        success: false,
        message: "User ID is required.",
      });
      return;
    }

    const canViewAnyProfile = [
      "super_admin",
      "administrator",
    ].includes(authenticatedUser.role);

    if (userId !== authenticatedUser.id && !canViewAnyProfile) {
      response.status(403).json({
        success: false,
        message: "Your account is not allowed to view this profile.",
      });
      return;
    }

    const [
      userResult,
      encodedResult,
      verifiedResult,
      pendingResult,
    ] = await Promise.all([
      supabase
        .from("users")
        .select(`
          id,
          full_name,
          email,
          phone_number,
          role,
          assigned_barangay,
          assigned_municipality,
          is_active,
          created_at,
          updated_at
        `)
        .eq("id", userId)
        .single(),

      supabase
        .from("casualty_incidents")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("encoded_by", userId)
        .is("deleted_at", null),

      supabase
        .from("casualty_incidents")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("encoded_by", userId)
        .eq("verification_status", "verified")
        .is("deleted_at", null),

      supabase
        .from("casualty_incidents")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("encoded_by", userId)
        .in("verification_status", [
          "draft",
          "submitted",
          "under_review",
        ])
        .is("deleted_at", null),
    ]);

    if (userResult.error || !userResult.data) {
      response.status(404).json({
        success: false,
        message: "User profile not found.",
      });
      return;
    }

    const statisticsError =
      encodedResult.error ??
      verifiedResult.error ??
      pendingResult.error;

    if (statisticsError) {
      throw new Error(
        `Unable to load profile statistics: ${statisticsError.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data: {
        user: userResult.data,
        statistics: {
          encoded: encodedResult.count ?? 0,
          verified: verifiedResult.count ?? 0,
          pending: pendingResult.count ?? 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
