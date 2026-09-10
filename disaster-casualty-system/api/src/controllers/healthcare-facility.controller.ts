import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

type FacilityLevel =
  | "primary"
  | "secondary"
  | "tertiary"
  | "specialized"
  | "unknown";

type CreateHealthcareFacilityRequest = {
  facilityName: string;
  facilityLevel?: FacilityLevel;
  address?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  contactPerson?: string;
  contactNumber?: string;
  latitude?: number;
  longitude?: number;
};

type BulkHealthcareFacilityRequest = {
  rows?: CreateHealthcareFacilityRequest[];
};

const facilityManagerRoles = new Set([
  "super_admin",
  "admin",
  "administrator",
  "encoder",
]);

const facilityViewerRolesScopedToCreatorAdmin = new Set([
  "responder",
  "field_responder",
  "sa_responder",
  "documenter",
  "medical_personnel",
]);

const facilityLevels = new Set([
  "primary",
  "secondary",
  "tertiary",
  "specialized",
  "unknown",
]);

const healthcareFacilitySelect = `
  id,
  facility_name,
  facility_level,
  address,
  barangay,
  municipality,
  province,
  contact_person,
  contact_number,
  latitude,
  longitude,
  is_active,
  created_by,
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

async function getFacilityOwnerScopeForUser(user: {
  id: string;
  role: string;
}): Promise<string | null | undefined> {
  if (user.role === "super_admin") {
    return undefined;
  }

  if (facilityManagerRoles.has(user.role)) {
    return user.id;
  }

  if (!facilityViewerRolesScopedToCreatorAdmin.has(user.role)) {
    return user.id;
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("created_by")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load healthcare facility scope: ${error.message}`,
    );
  }

  return profile?.created_by ?? null;
}

export async function getHealthcareFacilities(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const search =
      typeof request.query.search === "string"
        ? request.query.search.trim()
        : "";
    const facilityOwnerScope = await getFacilityOwnerScopeForUser(user);

    if (facilityOwnerScope === null) {
      response.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
      return;
    }

    let query = supabase
      .from("healthcare_facilities")
      .select(healthcareFacilitySelect)
      .eq("is_active", true)
      .order("facility_name", { ascending: true });

    if (facilityOwnerScope !== undefined) {
      query = query.eq("created_by", facilityOwnerScope);
    }

    if (search) {
      query = query.or(
        [
          `facility_name.ilike.%${search}%`,
          `municipality.ilike.%${search}%`,
          `province.ilike.%${search}%`,
        ].join(","),
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Unable to retrieve healthcare facilities: ${error.message}`,
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

export async function createHealthcareFacility(
  request: Request<
    Record<string, never>,
    unknown,
    CreateHealthcareFacilityRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      facilityName,
      facilityLevel = "unknown",
      address,
      barangay,
      municipality,
      province,
      contactPerson,
      contactNumber,
      latitude,
      longitude,
    } = request.body;
    const user = getAuthenticatedUser(request);

    const normalizedName = facilityName?.trim();

    if (!normalizedName) {
      response.status(400).json({
        success: false,
        message: "facilityName is required.",
      });
      return;
    }

    if (!facilityLevels.has(facilityLevel)) {
      response.status(400).json({
        success: false,
        message: "Invalid healthcare facility level.",
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

    if (!facilityManagerRoles.has(creator.role)) {
      response.status(403).json({
        success: false,
        message:
          "Your account is not allowed to create healthcare facilities.",
      });
      return;
    }

    let existingQuery = supabase
      .from("healthcare_facilities")
      .select(healthcareFacilitySelect)
      .ilike("facility_name", normalizedName)
      .eq("is_active", true)
      .limit(1);

    if (creator.role !== "super_admin") {
      existingQuery = existingQuery.eq("created_by", user.id);
    }

    const normalizedMunicipality = municipality?.trim();
    const normalizedProvince = province?.trim();

    if (normalizedMunicipality) {
      existingQuery = existingQuery.ilike(
        "municipality",
        normalizedMunicipality,
      );
    }

    if (normalizedProvince) {
      existingQuery = existingQuery.ilike(
        "province",
        normalizedProvince,
      );
    }

    const { data: existingFacility, error: existingError } =
      await existingQuery.maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to check existing healthcare facility: ${existingError.message}`,
      );
    }

    if (existingFacility) {
      response.status(200).json({
        success: true,
        message: "Existing healthcare facility selected.",
        data: existingFacility,
      });
      return;
    }

    const { data: facility, error } = await supabase
      .from("healthcare_facilities")
      .insert({
        facility_name: normalizedName,
        facility_level: facilityLevel,
        address: address?.trim() || null,
        barangay: barangay?.trim() || null,
        municipality: municipality?.trim() || null,
        province: province?.trim() || null,
        contact_person: contactPerson?.trim() || null,
        contact_number: contactNumber?.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        is_active: true,
        created_by: user.id,
      })
      .select(healthcareFacilitySelect)
      .single();

    if (error || !facility) {
      throw new Error(
        `Unable to create healthcare facility: ${
          error?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(201).json({
      success: true,
      message: "Healthcare facility created successfully.",
      data: facility,
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkCreateHealthcareFacilities(
  request: Request<
    Record<string, never>,
    unknown,
    BulkHealthcareFacilityRequest
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

    if (!facilityManagerRoles.has(creator.role)) {
      response.status(403).json({
        success: false,
        message:
          "Your account is not allowed to create healthcare facilities.",
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
        const normalizedName = row.facilityName?.trim();
        const facilityLevel = row.facilityLevel || "unknown";

        if (!normalizedName) {
          results.push(rowError(rowNumber, "facilityName is required."));
          continue;
        }

        if (!facilityLevels.has(facilityLevel)) {
          results.push(rowError(rowNumber, "Invalid healthcare facility level."));
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

        let existingQuery = supabase
          .from("healthcare_facilities")
          .select(healthcareFacilitySelect)
          .ilike("facility_name", normalizedName)
          .eq("is_active", true)
          .limit(1);

        if (creator.role !== "super_admin") {
          existingQuery = existingQuery.eq("created_by", user.id);
        }

        if (row.municipality?.trim()) {
          existingQuery = existingQuery.ilike(
            "municipality",
            row.municipality.trim(),
          );
        }

        if (row.province?.trim()) {
          existingQuery = existingQuery.ilike(
            "province",
            row.province.trim(),
          );
        }

        const { data: existingFacility, error: existingError } =
          await existingQuery.maybeSingle();

        if (existingError) {
          results.push(
            rowError(
              rowNumber,
              `Unable to check existing facility: ${existingError.message}`,
            ),
          );
          continue;
        }

        if (existingFacility) {
          results.push({
            rowNumber,
            success: false,
            skipped: true,
            message: "Existing healthcare facility skipped.",
            data: existingFacility,
          });
          continue;
        }

        const { data: facility, error } = await supabase
          .from("healthcare_facilities")
          .insert({
            facility_name: normalizedName,
            facility_level: facilityLevel,
            address: row.address?.trim() || null,
            barangay: row.barangay?.trim() || null,
            municipality: row.municipality?.trim() || null,
            province: row.province?.trim() || null,
            contact_person: row.contactPerson?.trim() || null,
            contact_number: row.contactNumber?.trim() || null,
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
            is_active: true,
            created_by: user.id,
          })
          .select(healthcareFacilitySelect)
          .single();

        if (error || !facility) {
          results.push(
            rowError(
              rowNumber,
              `Unable to create facility: ${
                error?.message ?? "Unknown database error"
              }`,
            ),
          );
          continue;
        }

        results.push({
          rowNumber,
          success: true,
          message: "Healthcare facility created.",
          data: facility,
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

    response.status(200).json({
      success: true,
      message: `Bulk healthcare facility import finished. ${created} of ${results.length} rows created.`,
      data: {
        created,
        skipped,
        failed: results.length - created - skipped,
        results,
      },
    });
  } catch (error) {
    next(error);
  }
}
