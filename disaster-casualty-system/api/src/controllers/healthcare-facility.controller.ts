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

const facilityManagerRoles = new Set([
  "super_admin",
  "administrator",
  "encoder",
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
  created_at,
  updated_at
`;

export async function getHealthcareFacilities(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const search =
      typeof request.query.search === "string"
        ? request.query.search.trim()
        : "";

    let query = supabase
      .from("healthcare_facilities")
      .select(healthcareFacilitySelect)
      .eq("is_active", true)
      .order("facility_name", { ascending: true });

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
