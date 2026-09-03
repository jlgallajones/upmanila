import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

const responderIncidentViewerRoles = new Set([
  "responder",
  "field_responder",
  "sa_responder",
  "documenter",
  "medical_personnel",
]);

const adminSummaryRoles = new Set([
  "admin",
  "administrator",
]);

const globalSummaryRoles = new Set([
  "super_admin",
]);

async function getCasualtySummaryEncoderIds(user: {
  id: string;
  role: string;
}): Promise<string[] | null> {
  if (globalSummaryRoles.has(user.role)) {
    return null;
  }

  if (!adminSummaryRoles.has(user.role)) {
    return [user.id];
  }

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("created_by", user.id);

  if (error) {
    throw new Error(
      `Unable to load admin-created accounts: ${error.message}`,
    );
  }

  return [
    user.id,
    ...((data ?? [])
      .map((account) => account.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0,
      )),
  ];
}

export async function getDashboardSummary(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const casualtySummaryEncoderIds =
      await getCasualtySummaryEncoderIds(user);
    let responderCreatorAdminId: string | null = null;

    if (responderIncidentViewerRoles.has(user.role)) {
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("created_by")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(
          `Unable to load responder incident scope: ${profileError.message}`,
        );
      }

      responderCreatorAdminId = profile?.created_by ?? null;
    }

    let activeIncidentsQuery = supabase
      .from("incidents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "active");

    if (adminSummaryRoles.has(user.role)) {
      activeIncidentsQuery = activeIncidentsQuery.eq(
        "created_by",
        user.id,
      );
    }

    if (responderIncidentViewerRoles.has(user.role)) {
      activeIncidentsQuery = responderCreatorAdminId
        ? activeIncidentsQuery.eq(
            "created_by",
            responderCreatorAdminId,
          )
        : activeIncidentsQuery.eq(
            "id",
            "00000000-0000-0000-0000-000000000000",
          );
    }

    let encodedTodayQuery = supabase
      .from("casualty_incidents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .gte("created_at", startOfToday.toISOString())
      .is("deleted_at", null);

    let verifiedRecordsQuery = supabase
      .from("casualty_incidents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("verification_status", "verified")
      .is("deleted_at", null);

    let pendingRecordsQuery = supabase
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
      .is("deleted_at", null);

    if (casualtySummaryEncoderIds) {
      encodedTodayQuery = encodedTodayQuery.in(
        "encoded_by",
        casualtySummaryEncoderIds,
      );
      verifiedRecordsQuery = verifiedRecordsQuery.in(
        "encoded_by",
        casualtySummaryEncoderIds,
      );
      pendingRecordsQuery = pendingRecordsQuery.in(
        "encoded_by",
        casualtySummaryEncoderIds,
      );
    }

    const [
      encodedTodayResult,
      verifiedResult,
      pendingResult,
      activeIncidentsResult,
    ] = await Promise.all([
      encodedTodayQuery,
      verifiedRecordsQuery,
      pendingRecordsQuery,
      activeIncidentsQuery,
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
    const user = getAuthenticatedUser(request);
    const casualtySummaryEncoderIds =
      await getCasualtySummaryEncoderIds(user);
    const requestedLimit = Number(request.query.limit);
    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit > 0 &&
      requestedLimit <= 20
        ? requestedLimit
        : 5;

    let query = supabase
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
        ),
        encoder:users!casualty_incidents_encoded_by_fkey (
          id,
          full_name,
          email,
          role,
          assigned_municipality,
          assigned_barangay
        )
      `)
      .is("deleted_at", null)
      .order("reported_at", {
        ascending: false,
      })
      .limit(limit);

    if (casualtySummaryEncoderIds) {
      query = query.in("encoded_by", casualtySummaryEncoderIds);
    }

    const { data, error } = await query;

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
