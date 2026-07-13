import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";

type CreateEvacuationCenterRequest = {
  incidentId: string;
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

export async function getEvacuationCenters(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId =
      typeof request.query.incidentId === "string"
        ? request.query.incidentId
        : undefined;

    let query = supabase
      .from("evacuation_centers")
      .select(evacuationCenterSelect)
      .eq("is_active", true)
      .order("center_name", { ascending: true });

    if (incidentId) {
      query = query.eq("incident_id", incidentId);
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

    const normalizedName = centerName?.trim();

    if (!incidentId || !normalizedName) {
      response.status(400).json({
        success: false,
        message: "incidentId and centerName are required.",
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
      .select("id")
      .eq("id", incidentId)
      .single();

    if (incidentError || !incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
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

    response.status(201).json({
      success: true,
      message: "Evacuation center created successfully.",
      data: center,
    });
  } catch (error) {
    next(error);
  }
}
