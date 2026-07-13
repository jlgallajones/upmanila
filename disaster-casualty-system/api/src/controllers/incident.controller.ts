import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";

type CreateIncidentRequest = {
  incidentName: string;
  disasterType: string;
  createdBy: string;
  description?: string;
  province?: string;
  municipality?: string;
  barangay?: string;
  startedAt?: string;
};

function buildIncidentCode(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `INC-${timestamp}-${suffix}`;
}

export async function getIncidents(
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select(`
        id,
        incident_code,
        incident_name,
        disaster_type,
        description,
        province,
        municipality,
        barangay,
        started_at,
        ended_at,
        status,
        created_at,
        updated_at
      `)
      .is("ended_at", null)
      .order("started_at", { ascending: false });

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
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

export async function createIncident(
  request: Request<Record<string, never>, unknown, CreateIncidentRequest>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      incidentName,
      disasterType,
      createdBy,
      description,
      province,
      municipality,
      barangay,
      startedAt,
    } = request.body;

    const normalizedName = incidentName?.trim();
    const normalizedType = disasterType?.trim();

    if (!normalizedName || !normalizedType || !createdBy) {
      response.status(400).json({
        success: false,
        message:
          "incidentName, disasterType, and createdBy are required.",
      });
      return;
    }

    const { data: creator, error: creatorError } = await supabase
      .from("users")
      .select("id, is_active")
      .eq("id", createdBy)
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

    const { data: existingIncident, error: existingError } =
      await supabase
        .from("incidents")
        .select(`
          id,
          incident_code,
          incident_name,
          disaster_type,
          description,
          province,
          municipality,
          barangay,
          started_at,
          ended_at,
          status,
          created_at,
          updated_at
        `)
        .ilike("incident_name", normalizedName)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to check existing incident: ${existingError.message}`,
      );
    }

    if (existingIncident) {
      response.status(200).json({
        success: true,
        message: "Existing incident selected.",
        data: existingIncident,
      });
      return;
    }

    const { data: incident, error } = await supabase
      .from("incidents")
      .insert({
        incident_code: buildIncidentCode(),
        incident_name: normalizedName,
        disaster_type: normalizedType,
        description: description?.trim() || null,
        province: province?.trim() || null,
        municipality: municipality?.trim() || null,
        barangay: barangay?.trim() || null,
        started_at: startedAt ?? new Date().toISOString(),
        status: "active",
        created_by: createdBy,
      })
      .select(`
        id,
        incident_code,
        incident_name,
        disaster_type,
        description,
        province,
        municipality,
        barangay,
        started_at,
        ended_at,
        status,
        created_at,
        updated_at
      `)
      .single();

    if (error || !incident) {
      throw new Error(
        `Unable to create incident: ${
          error?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(201).json({
      success: true,
      message: "Incident created successfully.",
      data: incident,
    });
  } catch (error) {
    next(error);
  }
}
