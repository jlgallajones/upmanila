import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { supabase } from "../config/supabase.js";

export async function getDashboardSummary(
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      encodedTodayResult,
      verifiedResult,
      pendingResult,
      activeIncidentsResult,
    ] = await Promise.all([
      supabase
        .from("casualty_incidents")
        .select("id", {
          count: "exact",
          head: true,
        })
        .gte("created_at", startOfToday.toISOString())
        .is("deleted_at", null),

      supabase
        .from("casualty_incidents")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("verification_status", "verified")
        .is("deleted_at", null),

      supabase
        .from("casualty_incidents")
        .select("id", {
          count: "exact",
          head: true,
        })
        .in("verification_status", [
          "draft",
          "submitted",
          "under_review",
        ])
        .is("deleted_at", null),

      supabase
        .from("incidents")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("status", "active"),
    ]);

    const firstError =
      encodedTodayResult.error ??
      verifiedResult.error ??
      pendingResult.error ??
      activeIncidentsResult.error;

    if (firstError) {
      throw new Error(firstError.message);
    }

    response.status(200).json({
      success: true,
      data: {
        encodedToday: encodedTodayResult.count ?? 0,
        verifiedRecords: verifiedResult.count ?? 0,
        pendingRecords: pendingResult.count ?? 0,
        activeIncidents: activeIncidentsResult.count ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getRecentActivity(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const requestedLimit = Number(request.query.limit);
    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit > 0 &&
      requestedLimit <= 20
        ? requestedLimit
        : 5;

    const { data, error } = await supabase
      .from("casualty_incidents")
      .select(`
        id,
        current_status,
        verification_status,
        reported_at,
        casualty:casualties (
          id,
          first_name,
          middle_name,
          last_name,
          identification_status
        ),
        incident:incidents (
          id,
          incident_name
        )
      `)
      .is("deleted_at", null)
      .order("reported_at", {
        ascending: false,
      })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
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