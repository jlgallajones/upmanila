import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { recordAuditLog } from "../services/audit-log.service.js";

type CreateEvacuationCenterRequest = {
  incidentId: string;
  incidentCode?: string;
  incidentName?: string;
  centerName: string;
  address?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  capacity?: number;
  contactPerson?: string;
  contactNumber?: string;
  latitude?: number;
  longitude?: number;
};

type BulkEvacuationCenterRequest = {
  rows?: CreateEvacuationCenterRequest[];
};

const evacuationCenterManagerRoles = new Set([
  "super_admin",
  "admin",
  "administrator",
  "encoder",
]);

const evacuationCenterSelect = `
  id,
  incident_id,
  center_name,
  address,
  barangay,
  municipality,
  province,
  capacity,
  contact_person,
  contact_number,
  latitude,
  longitude,
  is_active,
  created_at,
  updated_at
`;

function rowError(rowNumber: number, message: string) {
  return {
    rowNumber,
    success: false,
    message,
  };
}

async function getVisibleIncidentIdsForReferenceData(user: {
  id: string;
  role: string;
}): Promise<string[] | null> {
  if (user.role === "super_admin") {
    return null;
  }

  let creatorId: string | null = user.id;

  if (["responder", "field_responder", "sa_responder", "documenter"].includes(user.role)) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("created_by")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(
        `Unable to load reference data scope: ${profileError.message}`,
      );
    }

    creatorId = profile?.created_by ?? null;
  }

  if (!creatorId) {
    return [];
  }

  const { data: incidents, error } = await supabase
    .from("incidents")
    .select("id")
    .eq("created_by", creatorId);

  if (error) {
    throw new Error(
      `Unable to load reference incident scope: ${error.message}`,
    );
  }

  return (incidents ?? [])
    .map((incident) => incident.id)
    .filter(
      (id): id is string =>
        typeof id === "string" && id.trim().length > 0,
    );
}

export async function getEvacuationCenters(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const incidentId =
      typeof request.query.incidentId === "string"
        ? request.query.incidentId
        : undefined;
    const visibleIncidentIds =
      await getVisibleIncidentIdsForReferenceData(user);

    if (visibleIncidentIds && visibleIncidentIds.length === 0) {
      response.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
      return;
    }

    if (
      incidentId &&
      visibleIncidentIds &&
      !visibleIncidentIds.includes(incidentId)
    ) {
      response.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
      return;
    }

    let query = supabase
      .from("evacuation_centers")
      .select(evacuationCenterSelect)
      .eq("is_active", true)
      .order("center_name", { ascending: true });

    if (incidentId) {
      query = query.eq("incident_id", incidentId);
    } else if (visibleIncidentIds) {
      query = query.in("incident_id", visibleIncidentIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Unable to retrieve evacuation centers: ${error.message}`,
      );
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

export async function createEvacuationCenter(
  request: Request<
    Record<string, never>,
    unknown,
    CreateEvacuationCenterRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      incidentId,
      centerName,
      address,
      barangay,
      municipality,
      province,
      capacity,
      contactPerson,
      contactNumber,
      latitude,
      longitude,
    } = request.body;
    const user = getAuthenticatedUser(request);

    const normalizedName = centerName?.trim();

    if (!incidentId || !normalizedName) {
      response.status(400).json({
        success: false,
        message:
          "incidentId and centerName are required.",
      });
      return;
    }

    if (
      capacity !== undefined &&
      (!Number.isInteger(capacity) || capacity < 0)
    ) {
      response.status(400).json({
        success: false,
        message: "Capacity must be a positive whole number.",
      });
      return;
    }

    if (
      latitude !== undefined &&
      (latitude < -90 || latitude > 90)
    ) {
      response.status(400).json({
        success: false,
        message: "Latitude must be from -90 to 90.",
      });
      return;
    }

    if (
      longitude !== undefined &&
      (longitude < -180 || longitude > 180)
    ) {
      response.status(400).json({
        success: false,
        message: "Longitude must be from -180 to 180.",
      });
      return;
    }

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, created_by")
      .eq("id", incidentId)
      .single();

    if (incidentError || !incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    if (user.role !== "super_admin" && incident.created_by !== user.id) {
      response.status(403).json({
        success: false,
        message:
          "You can only create evacuation centers for incidents created by your account.",
      });
      return;
    }

    const { data: creator, error: creatorError } = await supabase
      .from("users")
      .select("id, role, is_active")
      .eq("id", user.id)
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

    if (!evacuationCenterManagerRoles.has(creator.role)) {
      response.status(403).json({
        success: false,
        message:
          "Your account is not allowed to create evacuation centers.",
      });
      return;
    }

    const { data: existingCenter, error: existingError } =
      await supabase
        .from("evacuation_centers")
        .select(evacuationCenterSelect)
        .eq("incident_id", incidentId)
        .ilike("center_name", normalizedName)
        .eq("is_active", true)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to check existing evacuation center: ${existingError.message}`,
      );
    }

    if (existingCenter) {
      response.status(200).json({
        success: true,
        message: "Existing evacuation center selected.",
        data: existingCenter,
      });
      return;
    }

    const { data: center, error } = await supabase
      .from("evacuation_centers")
      .insert({
        incident_id: incidentId,
        center_name: normalizedName,
        address: address?.trim() || null,
        barangay: barangay?.trim() || null,
        municipality: municipality?.trim() || null,
        province: province?.trim() || null,
        capacity: capacity ?? null,
        contact_person: contactPerson?.trim() || null,
        contact_number: contactNumber?.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        is_active: true,
      })
      .select(evacuationCenterSelect)
      .single();

    if (error || !center) {
      throw new Error(
        `Unable to create evacuation center: ${
          error?.message ?? "Unknown database error"
        }`,
      );
    }

    await recordAuditLog({
      actor: user,
      action: "evacuation_center.created",
      entityType: "evacuation_center",
      entityId: center.id,
      entityLabel: center.center_name,
      metadata: {
        incidentId: center.incident_id,
        capacity: center.capacity,
        municipality: center.municipality,
        province: center.province,
        source: "manual",
      },
    });

    response.status(201).json({
      success: true,
      message: "Evacuation center created successfully.",
      data: center,
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkCreateEvacuationCenters(
  request: Request<
    Record<string, never>,
    unknown,
    BulkEvacuationCenterRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const { data: creator, error: creatorError } = await supabase
      .from("users")
      .select("id, role, is_active")
      .eq("id", user.id)
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

    if (!evacuationCenterManagerRoles.has(creator.role)) {
      response.status(403).json({
        success: false,
        message:
          "Your account is not allowed to create evacuation centers.",
      });
      return;
    }

    const rows = Array.isArray(request.body.rows)
      ? request.body.rows.slice(0, 300)
      : [];
    const results = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;

      try {
        const normalizedName = row.centerName?.trim();
        const incidentLookup =
          row.incidentId?.trim() ||
          row.incidentCode?.trim() ||
          row.incidentName?.trim();

        if (!incidentLookup || !normalizedName) {
          results.push(
            rowError(
              rowNumber,
              "incidentId, incidentCode, or incidentName and centerName are required.",
            ),
          );
          continue;
        }

        if (
          row.capacity !== undefined &&
          (!Number.isInteger(row.capacity) || row.capacity < 0)
        ) {
          results.push(
            rowError(rowNumber, "Capacity must be a positive whole number."),
          );
          continue;
        }

        if (
          row.latitude !== undefined &&
          (row.latitude < -90 || row.latitude > 90)
        ) {
          results.push(rowError(rowNumber, "Latitude must be from -90 to 90."));
          continue;
        }

        if (
          row.longitude !== undefined &&
          (row.longitude < -180 || row.longitude > 180)
        ) {
          results.push(
            rowError(rowNumber, "Longitude must be from -180 to 180."),
          );
          continue;
        }

        let incidentQuery = supabase
          .from("incidents")
          .select("id, incident_code, incident_name, created_by")
          .limit(1);

        if (row.incidentId?.trim()) {
          incidentQuery = incidentQuery.eq("id", row.incidentId.trim());
        } else if (row.incidentCode?.trim()) {
          incidentQuery = incidentQuery.ilike(
            "incident_code",
            row.incidentCode.trim(),
          );
        } else {
          incidentQuery = incidentQuery.ilike(
            "incident_name",
            row.incidentName?.trim() || "",
          );
        }

        const { data: incident, error: incidentError } =
          await incidentQuery.maybeSingle();

        if (incidentError || !incident) {
          results.push(rowError(rowNumber, "Incident not found."));
          continue;
        }

        if (user.role !== "super_admin" && incident.created_by !== user.id) {
          results.push(
            rowError(
              rowNumber,
              "You can only create evacuation centers for incidents created by your account.",
            ),
          );
          continue;
        }

        const { data: existingCenter, error: existingError } =
          await supabase
            .from("evacuation_centers")
            .select(evacuationCenterSelect)
            .eq("incident_id", incident.id)
            .ilike("center_name", normalizedName)
            .eq("is_active", true)
            .maybeSingle();

        if (existingError) {
          results.push(
            rowError(
              rowNumber,
              `Unable to check existing evacuation center: ${existingError.message}`,
            ),
          );
          continue;
        }

        if (existingCenter) {
          results.push({
            rowNumber,
            success: false,
            skipped: true,
            message: "Existing evacuation center skipped.",
            data: existingCenter,
          });
          continue;
        }

        const { data: center, error } = await supabase
          .from("evacuation_centers")
          .insert({
            incident_id: incident.id,
            center_name: normalizedName,
            address: row.address?.trim() || null,
            barangay: row.barangay?.trim() || null,
            municipality: row.municipality?.trim() || null,
            province: row.province?.trim() || null,
            capacity: row.capacity ?? null,
            contact_person: row.contactPerson?.trim() || null,
            contact_number: row.contactNumber?.trim() || null,
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
            is_active: true,
          })
          .select(evacuationCenterSelect)
          .single();

        if (error || !center) {
          results.push(
            rowError(
              rowNumber,
              `Unable to create evacuation center: ${
                error?.message ?? "Unknown database error"
              }`,
            ),
          );
          continue;
        }

        results.push({
          rowNumber,
          success: true,
          message: "Evacuation center created.",
          data: center,
        });
      } catch (error) {
        results.push(
          rowError(
            rowNumber,
            error instanceof Error ? error.message : "Unable to create row.",
          ),
        );
      }
    }

    const created = results.filter((result) => result.success).length;
    const skipped = results.filter((result) => "skipped" in result).length;
    const failed = results.length - created - skipped;

    await recordAuditLog({
      actor: user,
      action: "bulk_import.evacuation_centers",
      entityType: "evacuation_center",
      entityLabel: "Bulk evacuation center import",
      metadata: {
        created,
        skipped,
        failed,
        total: results.length,
      },
    });

    response.status(200).json({
      success: true,
      message: `Bulk evacuation center import finished. ${created} of ${results.length} rows created.`,
      data: {
        created,
        skipped,
        failed,
        results,
      },
    });
  } catch (error) {
    next(error);
  }
}
