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

type CountMap = Record<string, number>;

type IncidentSitrepPayload = {
  incident: unknown;
  generatedAt: string;
  generatedBy: {
    id: string;
    fullName: string;
    role: string;
  };
  period: {
    start: string | null;
    end: string;
  };
  timeline: unknown;
  casualtySummary: {
    total: number;
    byStatus: CountMap;
    bySeverity: CountMap;
    byVerification: CountMap;
    identified: number;
    partiallyIdentified: number;
    unidentified: number;
  };
  triageSummary: {
    totalAssessments: number;
    latestByCategory: CountMap;
    latestByStage: CountMap;
  };
  transportSummary: {
    totalRecords: number;
    required: CountMap;
    modes: CountMap;
    emsUnits: CountMap;
    departedScene: number;
    arrivedFacility: number;
  };
  facilitySummary: {
    evacuationCenters: CountMap;
    receivingFacilities: CountMap;
  };
};

type SitrepResponseRecord = {
  id: string;
  incident_id: string;
  report_number: string;
  period_start: string | null;
  period_end: string;
  summary: string;
  generated_payload: IncidentSitrepPayload;
  generated_by: string | null;
  generated_at: string;
  status: string;
};

type IncidentRow = {
  id: string;
  incident_code: string;
  incident_name: string;
  disaster_type: string;
  description: string | null;
  province: string | null;
  municipality: string | null;
  barangay: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
};

type CasualtyIncidentRow = {
  id: string;
  current_status: string | null;
  severity: string | null;
  verification_status: string | null;
  reported_at: string | null;
  evacuation_center_id: string | null;
  healthcare_facility_id: string | null;
  casualty: {
    identification_status: string | null;
  } | null;
  evacuation_center: {
    center_name: string | null;
    barangay: string | null;
    municipality: string | null;
  } | null;
  healthcare_facility: {
    id: string;
    facility_name: string | null;
    municipality: string | null;
    province: string | null;
  } | null;
};

type TriageAssessmentRow = {
  casualty_incident_id: string;
  triage_category: string | null;
  triage_stage: string | null;
  triaged_at: string | null;
};

type TransportRecordRow = {
  casualty_incident_id: string;
  transport_required: string | null;
  transport_mode: string | null;
  ems_unit_type: string | null;
  departed_scene_at: string | null;
  arrived_facility_at: string | null;
  receiving_facility_id: string | null;
};

type FacilityRow = {
  id: string;
  facility_name: string | null;
  municipality: string | null;
  province: string | null;
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

const sitrepSelect = `
  id,
  incident_id,
  report_number,
  period_start,
  period_end,
  summary,
  generated_payload,
  generated_by,
  generated_at,
  status
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

function buildSitrepNumber(incidentCode: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();

  return `SITREP-${incidentCode}-${timestamp}-${suffix}`;
}

function normalizeCountKey(value: string | null | undefined): string {
  return value?.trim() || "unknown";
}

function incrementCount(counts: CountMap, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function countBy<T>(
  items: T[],
  getKey: (item: T) => string | null | undefined,
): CountMap {
  const counts: CountMap = {};

  for (const item of items) {
    incrementCount(counts, normalizeCountKey(getKey(item)));
  }

  return counts;
}

function formatFacilityLabel(
  facility: FacilityRow | CasualtyIncidentRow["healthcare_facility"],
): string {
  if (!facility) {
    return "Unknown facility";
  }

  const location = [facility.municipality, facility.province]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(", ");

  return location
    ? `${facility.facility_name ?? "Unnamed facility"} - ${location}`
    : facility.facility_name ?? "Unnamed facility";
}

function formatEvacuationCenterLabel(
  center: CasualtyIncidentRow["evacuation_center"],
): string {
  if (!center) {
    return "No evacuation center";
  }

  const location = [center.barangay, center.municipality]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(", ");

  return location
    ? `${center.center_name ?? "Unnamed center"} - ${location}`
    : center.center_name ?? "Unnamed center";
}

function getPeriodStart(
  incident: IncidentRow,
  casualties: CasualtyIncidentRow[],
): string | null {
  const reportedTimes = casualties
    .map((item) => item.reported_at)
    .filter((value): value is string => Boolean(value));

  const firstReportedAt = reportedTimes.sort()[0];

  return firstReportedAt ?? incident.started_at ?? null;
}

function buildSitrepSummary(
  incident: IncidentRow,
  casualtyCount: number,
  criticalCount: number,
  deceasedCount: number,
  transportedCount: number,
): string {
  const location = [
    incident.barangay,
    incident.municipality,
    incident.province,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(", ");

  return [
    `${incident.incident_name} (${incident.incident_code})`,
    location ? `in ${location}` : null,
    `has ${casualtyCount} casualty record${casualtyCount === 1 ? "" : "s"}`,
    `${criticalCount} critical`,
    `${deceasedCount} deceased`,
    `${transportedCount} transported or awaiting transport`,
  ]
    .filter((part): part is string => Boolean(part))
    .join("; ");
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

export async function generateIncidentSitrep(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);
    const generatedAt = new Date().toISOString();

    const { data: incidentData, error: incidentError } =
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
          status
        `)
        .eq("id", id)
        .maybeSingle();

    if (incidentError) {
      throw new Error(
        `Unable to retrieve incident: ${incidentError.message}`,
      );
    }

    if (!incidentData) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    const incident = incidentData as IncidentRow;

    const [
      timelineResult,
      casualtiesResult,
      evacuationCentersResult,
    ] = await Promise.all([
      supabase
        .from("incident_response_timelines")
        .select(incidentTimelineSelect)
        .eq("incident_id", id)
        .maybeSingle(),
      supabase
        .from("casualty_incidents")
        .select(`
          id,
          current_status,
          severity,
          verification_status,
          reported_at,
          evacuation_center_id,
          healthcare_facility_id,
          casualty:casualties (
            identification_status
          ),
          evacuation_center:evacuation_centers (
            center_name,
            barangay,
            municipality
          ),
          healthcare_facility:healthcare_facilities (
            id,
            facility_name,
            municipality,
            province
          )
        `)
        .eq("incident_id", id)
        .is("deleted_at", null)
        .order("reported_at", { ascending: true }),
      supabase
        .from("evacuation_centers")
        .select("id, center_name, barangay, municipality")
        .eq("incident_id", id)
        .eq("is_active", true),
    ]);

    const firstError =
      timelineResult.error ??
      casualtiesResult.error ??
      evacuationCentersResult.error;

    if (firstError) {
      throw new Error(
        `Unable to collect SitRep data: ${firstError.message}`,
      );
    }

    const casualties =
      (casualtiesResult.data ?? []) as unknown as CasualtyIncidentRow[];
    const casualtyIncidentIds = casualties.map((item) => item.id);

    const triageResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_triage_assessments")
            .select(
              "casualty_incident_id, triage_category, triage_stage, triaged_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("triaged_at", { ascending: false })
        : { data: [], error: null };

    if (triageResult.error) {
      throw new Error(
        `Unable to collect triage data: ${triageResult.error.message}`,
      );
    }

    const transportResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_transport_records")
            .select(
              "casualty_incident_id, transport_required, transport_mode, ems_unit_type, departed_scene_at, arrived_facility_at, receiving_facility_id",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };

    if (transportResult.error) {
      throw new Error(
        `Unable to collect transport data: ${transportResult.error.message}`,
      );
    }

    const triageRows =
      (triageResult.data ?? []) as TriageAssessmentRow[];
    const transportRows =
      (transportResult.data ?? []) as TransportRecordRow[];

    const receivingFacilityIds = Array.from(
      new Set(
        transportRows
          .map((item) => item.receiving_facility_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const facilityResult =
      receivingFacilityIds.length > 0
        ? await supabase
            .from("healthcare_facilities")
            .select("id, facility_name, municipality, province")
            .in("id", receivingFacilityIds)
        : { data: [], error: null };

    if (facilityResult.error) {
      throw new Error(
        `Unable to collect facility data: ${facilityResult.error.message}`,
      );
    }

    const facilityMap = new Map<string, FacilityRow>();

    for (const facility of (facilityResult.data ?? []) as FacilityRow[]) {
      facilityMap.set(facility.id, facility);
    }

    const latestTriageByCasualty = new Map<
      string,
      TriageAssessmentRow
    >();

    for (const triage of triageRows) {
      if (!latestTriageByCasualty.has(triage.casualty_incident_id)) {
        latestTriageByCasualty.set(
          triage.casualty_incident_id,
          triage,
        );
      }
    }

    const latestTransportByCasualty = new Map<
      string,
      TransportRecordRow
    >();

    for (const transport of transportRows) {
      if (
        !latestTransportByCasualty.has(
          transport.casualty_incident_id,
        )
      ) {
        latestTransportByCasualty.set(
          transport.casualty_incident_id,
          transport,
        );
      }
    }

    const latestTriageRows = Array.from(
      latestTriageByCasualty.values(),
    );
    const latestTransportRows = Array.from(
      latestTransportByCasualty.values(),
    );

    const casualtySummary = {
      total: casualties.length,
      byStatus: countBy(casualties, (item) => item.current_status),
      bySeverity: countBy(casualties, (item) => item.severity),
      byVerification: countBy(
        casualties,
        (item) => item.verification_status,
      ),
      identified: casualties.filter(
        (item) =>
          item.casualty?.identification_status === "identified",
      ).length,
      partiallyIdentified: casualties.filter(
        (item) =>
          item.casualty?.identification_status ===
          "partially_identified",
      ).length,
      unidentified: casualties.filter(
        (item) =>
          item.casualty?.identification_status === "unidentified",
      ).length,
    };

    const triageSummary = {
      totalAssessments: triageRows.length,
      latestByCategory: countBy(
        latestTriageRows,
        (item) => item.triage_category,
      ),
      latestByStage: countBy(
        latestTriageRows,
        (item) => item.triage_stage,
      ),
    };

    const transportSummary = {
      totalRecords: transportRows.length,
      required: countBy(
        latestTransportRows,
        (item) => item.transport_required,
      ),
      modes: countBy(
        latestTransportRows,
        (item) => item.transport_mode,
      ),
      emsUnits: countBy(
        latestTransportRows,
        (item) => item.ems_unit_type,
      ),
      departedScene: latestTransportRows.filter(
        (item) => item.departed_scene_at,
      ).length,
      arrivedFacility: latestTransportRows.filter(
        (item) => item.arrived_facility_at,
      ).length,
    };

    const receivingFacilities: CountMap = {};

    for (const transport of latestTransportRows) {
      const facility = transport.receiving_facility_id
        ? facilityMap.get(transport.receiving_facility_id)
        : null;

      incrementCount(
        receivingFacilities,
        formatFacilityLabel(facility ?? null),
      );
    }

    const evacuationCenters = countBy(casualties, (item) =>
      formatEvacuationCenterLabel(item.evacuation_center),
    );

    const facilitySummary = {
      evacuationCenters,
      receivingFacilities,
      activeEvacuationCenterCount:
        evacuationCentersResult.data?.length ?? 0,
    };

    const summary = buildSitrepSummary(
      incident,
      casualtySummary.total,
      casualtySummary.bySeverity.critical ?? 0,
      casualtySummary.byStatus.deceased ?? 0,
      transportSummary.required.yes ?? 0,
    );

    const periodStart = getPeriodStart(incident, casualties);
    const payload: IncidentSitrepPayload = {
      incident,
      generatedAt,
      generatedBy: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
      },
      period: {
        start: periodStart,
        end: generatedAt,
      },
      timeline: timelineResult.data ?? null,
      casualtySummary,
      triageSummary,
      transportSummary,
      facilitySummary,
    };

    const { data: sitrepData, error: sitrepError } = await supabase
      .from("sitreps")
      .insert({
        incident_id: id,
        report_number: buildSitrepNumber(incident.incident_code),
        period_start: periodStart,
        period_end: generatedAt,
        summary,
        generated_payload: payload,
        generated_by: user.id,
        generated_at: generatedAt,
        status: "generated",
      })
      .select(sitrepSelect)
      .single();

    if (sitrepError || !sitrepData) {
      throw new Error(
        `Unable to save SitRep: ${
          sitrepError?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(201).json({
      success: true,
      message: "SitRep generated successfully.",
      data: sitrepData as SitrepResponseRecord,
    });
  } catch (error) {
    next(error);
  }
}
