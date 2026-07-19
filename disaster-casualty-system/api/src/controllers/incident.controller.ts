import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

type CreateIncidentRequest = {
  incidentName: string;
  disasterType: string;
  description?: string;
  province?: string;
  municipality?: string;
  barangay?: string;
  startedAt?: string;
};

type UpdateIncidentTimelineRequest = {
  eventNotificationAt?: string | null;
  dmmpActivated?: boolean | null;
  dmmpActivationTrigger?: string | null;
  dmmpActivatedAt?: string | null;
  medicalCoordinatorNotifiedAt?: string | null;
  firstEmsOnSceneAt?: string | null;
  triageOrderedAt?: string | null;
  firstSiteTriageAt?: string | null;
  lastSiteTriageAt?: string | null;
  firstTransportFromSceneAt?: string | null;
  lastTransportFromSceneAt?: string | null;
  sceneDemobilizedAt?: string | null;
};

const incidentManagerRoles = new Set([
  "super_admin",
  "administrator",
  "encoder",
]);

const incidentTimelineSelect = `
  id,
  incident_id,
  event_notification_at,
  dmmp_activated,
  dmmp_activation_trigger,
  dmmp_activated_at,
  medical_coordinator_notified_at,
  first_ems_on_scene_at,
  triage_ordered_at,
  first_site_triage_at,
  last_site_triage_at,
  first_transport_from_scene_at,
  last_transport_from_scene_at,
  scene_demobilized_at,
  updated_by,
  created_at,
  updated_at
`;

function buildIncidentCode(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `INC-${timestamp}-${suffix}`;
}

function parseNullableTimestamp(
  value: string | null | undefined,
  label: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date and time.`);
  }

  return parsed.toISOString();
}

function assertChronologicalPair(
  firstValue: string | null | undefined,
  lastValue: string | null | undefined,
  message: string,
): void {
  if (!firstValue || !lastValue) {
    return;
  }

  if (new Date(lastValue) < new Date(firstValue)) {
    throw new Error(message);
  }
}

function pickTimelineValue<T>(
  value: T | undefined,
  fallback: T | null,
): T | null {
  return value === undefined ? fallback : value;
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
      description,
      province,
      municipality,
      barangay,
      startedAt,
    } = request.body;
    const user = getAuthenticatedUser(request);

    const normalizedName = incidentName?.trim();
    const normalizedType = disasterType?.trim();

    if (!normalizedName || !normalizedType) {
      response.status(400).json({
        success: false,
        message:
          "incidentName and disasterType are required.",
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

    if (!incidentManagerRoles.has(creator.role)) {
      response.status(403).json({
        success: false,
        message:
          "Your account is not allowed to create disaster incidents.",
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
        created_by: user.id,
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

export async function closeIncident(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);

    const { data: incident, error } = await supabase
      .from("incidents")
      .update({
        status: "closed",
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "active")
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
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to close incident: ${error.message}`);
    }

    if (!incident) {
      response.status(404).json({
        success: false,
        message: "Active incident not found.",
      });
      return;
    }

    response.status(200).json({
      success: true,
      message: `${user.fullName} closed the incident.`,
      data: incident,
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentTimeline(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (incidentError) {
      throw new Error(
        `Unable to retrieve incident: ${incidentError.message}`,
      );
    }

    if (!incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("incident_response_timelines")
      .select(incidentTimelineSelect)
      .eq("incident_id", id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to retrieve incident timeline: ${error.message}`,
      );
    }

    response.status(200).json({
      success: true,
      data: data ?? null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateIncidentTimeline(
  request: Request<
    { id: string },
    unknown,
    UpdateIncidentTimelineRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (incidentError) {
      throw new Error(
        `Unable to retrieve incident: ${incidentError.message}`,
      );
    }

    if (!incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const { data: existingTimeline, error: existingError } =
      await supabase
        .from("incident_response_timelines")
        .select(incidentTimelineSelect)
        .eq("incident_id", id)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to retrieve existing incident timeline: ${existingError.message}`,
      );
    }

    const eventNotificationAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.eventNotificationAt,
        "Event notification time",
      ),
      existingTimeline?.event_notification_at ?? null,
    );
    const dmmpActivatedAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.dmmpActivatedAt,
        "DMMP activation time",
      ),
      existingTimeline?.dmmp_activated_at ?? null,
    );
    const medicalCoordinatorNotifiedAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.medicalCoordinatorNotifiedAt,
        "Medical coordinator notification time",
      ),
      existingTimeline?.medical_coordinator_notified_at ?? null,
    );
    const firstEmsOnSceneAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.firstEmsOnSceneAt,
        "First EMS on scene time",
      ),
      existingTimeline?.first_ems_on_scene_at ?? null,
    );
    const triageOrderedAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.triageOrderedAt,
        "Triage ordered time",
      ),
      existingTimeline?.triage_ordered_at ?? null,
    );
    const firstSiteTriageAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.firstSiteTriageAt,
        "First site triage time",
      ),
      existingTimeline?.first_site_triage_at ?? null,
    );
    const lastSiteTriageAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.lastSiteTriageAt,
        "Last site triage time",
      ),
      existingTimeline?.last_site_triage_at ?? null,
    );
    const firstTransportFromSceneAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.firstTransportFromSceneAt,
        "First transport from scene time",
      ),
      existingTimeline?.first_transport_from_scene_at ?? null,
    );
    const lastTransportFromSceneAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.lastTransportFromSceneAt,
        "Last transport from scene time",
      ),
      existingTimeline?.last_transport_from_scene_at ?? null,
    );
    const sceneDemobilizedAt = pickTimelineValue(
      parseNullableTimestamp(
        request.body.sceneDemobilizedAt,
        "Scene demobilized time",
      ),
      existingTimeline?.scene_demobilized_at ?? null,
    );

    assertChronologicalPair(
      firstSiteTriageAt,
      lastSiteTriageAt,
      "Last site triage time cannot be before first site triage time.",
    );
    assertChronologicalPair(
      firstTransportFromSceneAt,
      lastTransportFromSceneAt,
      "Last transport from scene time cannot be before first transport from scene time.",
    );

    const timelineUpdates = {
      incident_id: id,
      event_notification_at: eventNotificationAt,
      dmmp_activated:
        request.body.dmmpActivated === undefined
          ? existingTimeline?.dmmp_activated ?? null
          : request.body.dmmpActivated,
      dmmp_activation_trigger:
        request.body.dmmpActivationTrigger === undefined
          ? existingTimeline?.dmmp_activation_trigger ?? null
          : request.body.dmmpActivationTrigger?.trim() || null,
      dmmp_activated_at: dmmpActivatedAt,
      medical_coordinator_notified_at:
        medicalCoordinatorNotifiedAt,
      first_ems_on_scene_at: firstEmsOnSceneAt,
      triage_ordered_at: triageOrderedAt,
      first_site_triage_at: firstSiteTriageAt,
      last_site_triage_at: lastSiteTriageAt,
      first_transport_from_scene_at: firstTransportFromSceneAt,
      last_transport_from_scene_at: lastTransportFromSceneAt,
      scene_demobilized_at: sceneDemobilizedAt,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("incident_response_timelines")
      .upsert(timelineUpdates, {
        onConflict: "incident_id",
      })
      .select(incidentTimelineSelect)
      .single();

    if (error || !data) {
      throw new Error(
        `Unable to save incident timeline: ${
          error?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Incident response timeline saved successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}
