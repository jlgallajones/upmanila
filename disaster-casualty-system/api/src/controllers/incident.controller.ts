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
  disasterOccurredAt?: string | null;
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
  triage_system: string | null;
  triage_category: string | null;
  responder_category: string | null;
  calculated_category: string | null;
  triage_stage: string | null;
  triaged_at: string | null;
};

type TransportRecordRow = {
  casualty_incident_id: string;
  transport_required: string | null;
  transport_mode: string | null;
  ems_unit_type: string | null;
  arrived_scene_at: string | null;
  departed_scene_at: string | null;
  arrived_facility_at: string | null;
  receiving_facility_id: string | null;
};

type TreatmentRecordRow = {
  casualty_incident_id: string;
  treatment_strategy: string | null;
  treatment_area_name: string | null;
  stabilization_started_at: string | null;
  stabilized_at: string | null;
  created_at: string | null;
};

type FacilityRow = {
  id: string;
  facility_name: string | null;
  facility_level: string | null;
  municipality: string | null;
  province: string | null;
};

type FacilityEncounterRow = {
  casualty_incident_id: string;
  facility_id: string | null;
  arrived_at: string | null;
  ed_admitted_at?: string | null;
  ed_departed_at?: string | null;
  referred_or_transferred: boolean | null;
  sought_ed_care?: boolean | null;
  admitted_to_hospital?: boolean | null;
  discharged_home?: boolean | null;
  ed_resuscitation_started_at?: string | null;
  created_at?: string | null;
};

type ExportCasualtyRow = {
  id: string;
  current_status: string | null;
  severity: string | null;
  verification_status: string | null;
  current_location: string | null;
  reported_at: string | null;
  latitude: number | null;
  longitude: number | null;
  casualty: {
    id_number: string | null;
    identification_status: string | null;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    estimated_age: number | null;
    sex: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
  } | null;
  evacuation_center: {
    center_name: string | null;
  } | null;
  healthcare_facility: {
    facility_name: string | null;
  } | null;
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

function calculatePercentage(numerator: number, denominator: number): number {
  return denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(2))
    : 0;
}

function minutesBetween(start: string, end: string): number | null {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / 60000),
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((first, second) => first - second);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint] ?? null;
  }

  const lower = sorted[midpoint - 1];
  const upper = sorted[midpoint];

  if (lower === undefined || upper === undefined) {
    return null;
  }

  return Number(((lower + upper) / 2).toFixed(2));
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

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\r\n");
}

function sendCsv(
  response: Response,
  filename: string,
  csv: string,
): void {
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  response.status(200).send(`\uFEFF${csv}`);
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value: string, maxLength = 92): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function buildSimplePdf(title: string, lines: string[]): Buffer {
  const wrappedLines = [
    title,
    "",
    ...lines.flatMap((line) => wrapText(line)),
  ];
  const pages: string[][] = [];

  for (let index = 0; index < wrappedLines.length; index += 48) {
    pages.push(wrappedLines.slice(index, index + 48));
  }

  const objects: string[] = [];
  const addObject = (content: string): number => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      "14 TL",
      ...pageLines.map((line) => `(${escapePdfText(line)}) Tj T*`),
      "ET",
    ].join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );

    pageIds.push(pageId);
  }

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageIds.length} >>`;

  const parts = ["%PDF-1.4\n"];
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(parts.join(""), "utf8"));
    parts.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(parts.join(""), "utf8");
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push("0000000000 65535 f \n");

  for (const offset of offsets) {
    parts.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }

  parts.push(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return Buffer.from(parts.join(""), "utf8");
}

function sendPdf(
  response: Response,
  filename: string,
  pdf: Buffer,
): void {
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  response.status(200).send(pdf);
}

function countMapLines(
  title: string,
  counts: Record<string, number>,
): string[] {
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return [`${title}: none recorded`];
  }

  return [
    `${title}:`,
    ...entries
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, count]) => `  ${key}: ${count}`),
  ];
}

function buildSitrepLines(sitrep: SitrepResponseRecord): string[] {
  const payload = sitrep.generated_payload;

  return [
    `Report Number: ${sitrep.report_number}`,
    `Status: ${sitrep.status}`,
    `Generated At: ${sitrep.generated_at}`,
    `Generated By: ${payload.generatedBy.fullName} (${payload.generatedBy.role})`,
    `Period: ${payload.period.start ?? "Unavailable"} to ${payload.period.end}`,
    "",
    "Summary",
    sitrep.summary,
    "",
    "Casualties",
    `Total: ${payload.casualtySummary.total}`,
    `Identified: ${payload.casualtySummary.identified}`,
    `Partially Identified: ${payload.casualtySummary.partiallyIdentified}`,
    `Unidentified: ${payload.casualtySummary.unidentified}`,
    ...countMapLines(
      "By Status",
      payload.casualtySummary.byStatus,
    ),
    ...countMapLines(
      "By Severity",
      payload.casualtySummary.bySeverity,
    ),
    ...countMapLines(
      "By Verification",
      payload.casualtySummary.byVerification,
    ),
    "",
    "Triage",
    `Total Assessments: ${payload.triageSummary.totalAssessments}`,
    ...countMapLines(
      "Latest Categories",
      payload.triageSummary.latestByCategory,
    ),
    "",
    "Transport",
    `Total Records: ${payload.transportSummary.totalRecords}`,
    `Departed Scene: ${payload.transportSummary.departedScene}`,
    `Arrived Facility: ${payload.transportSummary.arrivedFacility}`,
    ...countMapLines("Modes", payload.transportSummary.modes),
    ...countMapLines("EMS Units", payload.transportSummary.emsUnits),
    "",
    "Facilities",
    ...countMapLines(
      "Evacuation Centers",
      payload.facilitySummary.evacuationCenters,
    ),
    ...countMapLines(
      "Receiving Facilities",
      payload.facilitySummary.receivingFacilities,
    ),
  ];
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

    const disasterOccurredAt = parseNullableTimestamp(
      request.body.disasterOccurredAt,
      "Disaster occurrence time",
    );
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

    if (disasterOccurredAt !== undefined) {
      if (disasterOccurredAt === null) {
        response.status(400).json({
          success: false,
          message: "Disaster occurrence time cannot be blank.",
        });
        return;
      }

      const { error: incidentUpdateError } = await supabase
        .from("incidents")
        .update({
          started_at: disasterOccurredAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (incidentUpdateError) {
        throw new Error(
          `Unable to update disaster occurrence time: ${incidentUpdateError.message}`,
        );
      }
    }

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

export async function getIncidentOnsiteTriageSummary(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, started_at")
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

    const { data: timeline, error: timelineError } = await supabase
      .from("incident_response_timelines")
      .select(
        "dmmp_activated_at, triage_ordered_at, first_site_triage_at, last_site_triage_at",
      )
      .eq("incident_id", id)
      .maybeSingle();

    if (timelineError) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineError.message}`,
      );
    }

    const { data: casualties, error: casualtiesError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
        .eq("incident_id", id)
        .is("deleted_at", null);

    if (casualtiesError) {
      throw new Error(
        `Unable to retrieve incident casualties: ${casualtiesError.message}`,
      );
    }

    const casualtyIncidentIds = (casualties ?? []).map(
      (item) => item.id,
    );

    const triageResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_triage_assessments")
            .select(
              "casualty_incident_id, triage_system, triage_category, responder_category, calculated_category, triage_stage, triaged_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .eq("triage_stage", "on_site")
            .order("triaged_at", { ascending: true })
        : { data: [], error: null };

    if (triageResult.error) {
      throw new Error(
        `Unable to retrieve on-site triage data: ${triageResult.error.message}`,
      );
    }

    const firstOnsiteTriageByCasualty = new Map<
      string,
      TriageAssessmentRow
    >();

    for (const row of (triageResult.data ?? []) as TriageAssessmentRow[]) {
      if (!firstOnsiteTriageByCasualty.has(row.casualty_incident_id)) {
        firstOnsiteTriageByCasualty.set(row.casualty_incident_id, row);
      }
    }

    const firstOnsiteRows = Array.from(
      firstOnsiteTriageByCasualty.values(),
    );
    const triagedAtValues = firstOnsiteRows
      .map((row) => (row.triaged_at ? new Date(row.triaged_at) : null))
      .filter((value): value is Date => Boolean(value));

    const firstSiteTriageAt =
      timeline?.first_site_triage_at ??
      triagedAtValues[0]?.toISOString() ??
      null;
    const lastSiteTriageAt =
      timeline?.last_site_triage_at ??
      triagedAtValues[triagedAtValues.length - 1]?.toISOString() ??
      null;

    const responseInitiatedAt =
      timeline?.dmmp_activated_at ??
      timeline?.triage_ordered_at ??
      incident.started_at ??
      null;
    const responseInitiationSource = timeline?.dmmp_activated_at
      ? "dmmp_activated_at"
      : timeline?.triage_ordered_at
        ? "triage_ordered_at"
        : "incident_started_at";

    const totalSurvivors = casualtyIncidentIds.length;
    const intervalMinutes = [1, 5, 10, 15, 30, 60];
    const responseInitiatedDate = responseInitiatedAt
      ? new Date(responseInitiatedAt)
      : null;

    const buildIntervalRows = (category: string) =>
      intervalMinutes.map((minutes) => {
        const cutoff =
          responseInitiatedDate && !Number.isNaN(responseInitiatedDate.getTime())
            ? new Date(
                responseInitiatedDate.getTime() + minutes * 60 * 1000,
              )
            : null;
        const count =
          cutoff === null
            ? 0
            : firstOnsiteRows.filter((row) => {
                if (row.triage_category !== category || !row.triaged_at) {
                  return false;
                }

                const triagedAt = new Date(row.triaged_at);
                return (
                  !Number.isNaN(triagedAt.getTime()) &&
                  triagedAt <= cutoff
                );
              }).length;

        return {
          minutes,
          cutoffAt: cutoff?.toISOString() ?? null,
          count,
          totalSurvivors,
          percentage:
            totalSurvivors > 0
              ? Number(((count / totalSurvivors) * 100).toFixed(2))
              : 0,
        };
      });

    const buildAccuracyMetric = (
      label: string,
      trueCategory: string,
      assignedCategories: string[],
    ) => {
      const denominator = firstOnsiteRows.filter(
        (row) => row.calculated_category === trueCategory,
      ).length;
      const numerator = firstOnsiteRows.filter((row) => {
        const assignedCategory =
          row.responder_category ?? row.triage_category;

        return (
          row.calculated_category === trueCategory &&
          assignedCategory !== null &&
          assignedCategories.includes(assignedCategory)
        );
      }).length;

      return {
        label,
        numerator,
        denominator,
        percentage:
          denominator > 0
            ? Number(((numerator / denominator) * 100).toFixed(2))
            : 0,
      };
    };

    const firstTriageSystemCounts = countBy(
      firstOnsiteRows,
      (row) => row.triage_system,
    );
    const dominantSystemEntry = Object.entries(
      firstTriageSystemCounts,
    ).sort(([, firstCount], [, secondCount]) => secondCount - firstCount)[0];

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        totalSurvivors,
        onSiteTriagedTotal: firstOnsiteRows.length,
        triageSystemUsed: dominantSystemEntry?.[0] ?? null,
        firstTriageSystemCounts,
        responseInitiatedAt,
        responseInitiationSource,
        triageOrderedAt: timeline?.triage_ordered_at ?? null,
        firstSiteTriageAt,
        lastSiteTriageAt,
        intervalMinutes,
        categories: {
          immediate: buildIntervalRows("immediate"),
          delayed: buildIntervalRows("delayed"),
        },
        accuracy: {
          undertriagedT1: buildAccuracyMetric(
            "T1 survivors assigned T2, T3, or T4",
            "immediate",
            ["delayed", "minimal", "expectant"],
          ),
          undertriagedT2: buildAccuracyMetric(
            "T2 survivors assigned T3 or T4",
            "delayed",
            ["minimal", "expectant"],
          ),
          overtriagedT2: buildAccuracyMetric(
            "T2 survivors assigned T1",
            "delayed",
            ["immediate"],
          ),
          overtriagedT3: buildAccuracyMetric(
            "T3 survivors assigned T1 or T2",
            "minimal",
            ["immediate", "delayed"],
          ),
        },
        formula:
          "(number of first on-site triaged category survivors by interval / total survivors) x 100",
        accuracyFormula:
          "(number of true category survivors assigned to listed categories / number of true category survivors) x 100",
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentFacilityTriageSummary(
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

    const { data: casualties, error: casualtiesError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
        .eq("incident_id", id)
        .is("deleted_at", null);

    if (casualtiesError) {
      throw new Error(
        `Unable to retrieve incident casualties: ${casualtiesError.message}`,
      );
    }

    const casualtyIncidentIds = (casualties ?? []).map(
      (item) => item.id,
    );

    const triageResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_triage_assessments")
            .select(
              "casualty_incident_id, triage_system, triage_category, responder_category, calculated_category, triage_stage, triaged_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .eq("triage_stage", "facility_arrival")
            .order("triaged_at", { ascending: true })
        : { data: [], error: null };

    if (triageResult.error) {
      throw new Error(
        `Unable to retrieve healthcare facility triage data: ${triageResult.error.message}`,
      );
    }

    const firstFacilityTriageByCasualty = new Map<
      string,
      TriageAssessmentRow
    >();

    for (const row of (triageResult.data ?? []) as TriageAssessmentRow[]) {
      if (
        !firstFacilityTriageByCasualty.has(row.casualty_incident_id)
      ) {
        firstFacilityTriageByCasualty.set(
          row.casualty_incident_id,
          row,
        );
      }
    }

    const facilityRows = Array.from(
      firstFacilityTriageByCasualty.values(),
    );
    const triagedAtValues = facilityRows
      .map((row) => (row.triaged_at ? new Date(row.triaged_at) : null))
      .filter((value): value is Date => Boolean(value));

    const buildAccuracyMetric = (
      label: string,
      trueCategory: string,
      assignedCategories: string[],
    ) => {
      const denominator = facilityRows.filter(
        (row) => row.calculated_category === trueCategory,
      ).length;
      const numerator = facilityRows.filter((row) => {
        const assignedCategory =
          row.responder_category ?? row.triage_category;

        return (
          row.calculated_category === trueCategory &&
          assignedCategory !== null &&
          assignedCategories.includes(assignedCategory)
        );
      }).length;

      return {
        label,
        numerator,
        denominator,
        percentage:
          denominator > 0
            ? Number(((numerator / denominator) * 100).toFixed(2))
            : 0,
      };
    };

    const firstTriageSystemCounts = countBy(
      facilityRows,
      (row) => row.triage_system,
    );
    const dominantSystemEntry = Object.entries(
      firstTriageSystemCounts,
    ).sort(([, firstCount], [, secondCount]) => secondCount - firstCount)[0];

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        totalSurvivors: casualtyIncidentIds.length,
        facilityTriagedTotal: facilityRows.length,
        triageSystemUsed: dominantSystemEntry?.[0] ?? null,
        firstTriageSystemCounts,
        firstFacilityTriageAt:
          triagedAtValues[0]?.toISOString() ?? null,
        lastFacilityTriageAt:
          triagedAtValues[triagedAtValues.length - 1]?.toISOString() ??
          null,
        accuracy: {
          undertriagedT1: buildAccuracyMetric(
            "T1 survivors assigned T2, T3, or T4",
            "immediate",
            ["delayed", "minimal", "expectant"],
          ),
          undertriagedT2: buildAccuracyMetric(
            "T2 survivors assigned T3 or T4",
            "delayed",
            ["minimal", "expectant"],
          ),
          overtriagedT2: buildAccuracyMetric(
            "T2 survivors assigned T1",
            "delayed",
            ["immediate"],
          ),
          overtriagedT3: buildAccuracyMetric(
            "T3 survivors assigned T1 or T2",
            "minimal",
            ["immediate", "delayed"],
          ),
        },
        accuracyFormula:
          "(number of true category survivors assigned to listed categories / number of true category survivors) x 100",
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentOnsiteCareSummary(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, started_at")
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

    const { data: timeline, error: timelineError } = await supabase
      .from("incident_response_timelines")
      .select("dmmp_activated_at")
      .eq("incident_id", id)
      .maybeSingle();

    if (timelineError) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineError.message}`,
      );
    }

    const { data: casualties, error: casualtiesError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
        .eq("incident_id", id)
        .is("deleted_at", null);

    if (casualtiesError) {
      throw new Error(
        `Unable to retrieve incident casualties: ${casualtiesError.message}`,
      );
    }

    const casualtyIncidentIds = (casualties ?? []).map(
      (item) => item.id,
    );

    const triageResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_triage_assessments")
            .select(
              "casualty_incident_id, triage_category, triage_stage, triaged_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .eq("triage_stage", "on_site")
            .order("triaged_at", { ascending: true })
        : { data: [], error: null };

    if (triageResult.error) {
      throw new Error(
        `Unable to retrieve on-site triage data: ${triageResult.error.message}`,
      );
    }

    const treatmentResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_treatments")
            .select(
              "casualty_incident_id, treatment_strategy, treatment_area_name, stabilization_started_at, stabilized_at, created_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("created_at", { ascending: true })
        : { data: [], error: null };

    if (treatmentResult.error) {
      throw new Error(
        `Unable to retrieve on-site care data: ${treatmentResult.error.message}`,
      );
    }

    const firstTriageByCasualty = new Map<
      string,
      TriageAssessmentRow
    >();

    for (const row of (triageResult.data ?? []) as TriageAssessmentRow[]) {
      if (!firstTriageByCasualty.has(row.casualty_incident_id)) {
        firstTriageByCasualty.set(row.casualty_incident_id, row);
      }
    }

    const firstTreatmentByCasualty = new Map<
      string,
      TreatmentRecordRow
    >();

    for (const row of (treatmentResult.data ?? []) as TreatmentRecordRow[]) {
      if (!firstTreatmentByCasualty.has(row.casualty_incident_id)) {
        firstTreatmentByCasualty.set(row.casualty_incident_id, row);
      }
    }

    const treatmentRows = Array.from(firstTreatmentByCasualty.values());
    const responseInitiatedAt =
      timeline?.dmmp_activated_at ?? incident.started_at ?? null;
    const responseInitiatedDate = responseInitiatedAt
      ? new Date(responseInitiatedAt)
      : null;
    const intervalMinutes = [1, 5, 10, 15, 30, 60];
    const totalSurvivors = casualtyIncidentIds.length;

    const buildIntervalRows = (category: string) =>
      intervalMinutes.map((minutes) => {
        const cutoff =
          responseInitiatedDate && !Number.isNaN(responseInitiatedDate.getTime())
            ? new Date(
                responseInitiatedDate.getTime() + minutes * 60 * 1000,
              )
            : null;
        const count =
          cutoff === null
            ? 0
            : treatmentRows.filter((treatment) => {
                const triage = firstTriageByCasualty.get(
                  treatment.casualty_incident_id,
                );

                if (
                  triage?.triage_category !== category ||
                  !treatment.stabilized_at
                ) {
                  return false;
                }

                const stabilizedAt = new Date(treatment.stabilized_at);

                return (
                  !Number.isNaN(stabilizedAt.getTime()) &&
                  stabilizedAt <= cutoff
                );
              }).length;

        return {
          minutes,
          cutoffAt: cutoff?.toISOString() ?? null,
          count,
          totalSurvivors,
          percentage:
            totalSurvivors > 0
              ? Number(((count / totalSurvivors) * 100).toFixed(2))
              : 0,
        };
      });

    const stabilizedT1Total = treatmentRows.filter((treatment) => {
      const triage = firstTriageByCasualty.get(
        treatment.casualty_incident_id,
      );

      return (
        triage?.triage_category === "immediate" &&
        Boolean(treatment.stabilized_at)
      );
    }).length;
    const stabilizedT2Total = treatmentRows.filter((treatment) => {
      const triage = firstTriageByCasualty.get(
        treatment.casualty_incident_id,
      );

      return (
        triage?.triage_category === "delayed" &&
        Boolean(treatment.stabilized_at)
      );
    }).length;

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        totalSurvivors,
        treatmentRecordedTotal: treatmentRows.length,
        stabilizedT1Total,
        stabilizedT2Total,
        treatmentStrategyCounts: countBy(
          treatmentRows,
          (row) => row.treatment_strategy,
        ),
        responseInitiatedAt,
        responseInitiationSource: timeline?.dmmp_activated_at
          ? "dmmp_activated_at"
          : "incident_started_at",
        intervalMinutes,
        categories: {
          immediate: buildIntervalRows("immediate"),
          delayed: buildIntervalRows("delayed"),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentSceneClearanceSummary(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, started_at")
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

    const { data: timeline, error: timelineError } = await supabase
      .from("incident_response_timelines")
      .select(
        "dmmp_activated_at, first_ems_on_scene_at, first_transport_from_scene_at, last_transport_from_scene_at",
      )
      .eq("incident_id", id)
      .maybeSingle();

    if (timelineError) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineError.message}`,
      );
    }

    const { data: casualties, error: casualtiesError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
        .eq("incident_id", id)
        .is("deleted_at", null);

    if (casualtiesError) {
      throw new Error(
        `Unable to retrieve incident casualties: ${casualtiesError.message}`,
      );
    }

    const casualtyIncidentIds = (casualties ?? []).map(
      (item) => item.id,
    );

    const triageResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_triage_assessments")
            .select(
              "casualty_incident_id, triage_category, triage_stage, triaged_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .eq("triage_stage", "on_site")
            .order("triaged_at", { ascending: true })
        : { data: [], error: null };

    if (triageResult.error) {
      throw new Error(
        `Unable to retrieve on-site triage data: ${triageResult.error.message}`,
      );
    }

    const transportResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_transport_records")
            .select(
              "casualty_incident_id, transport_required, transport_mode, ems_unit_type, arrived_scene_at, departed_scene_at, arrived_facility_at, receiving_facility_id",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("departed_scene_at", { ascending: true })
        : { data: [], error: null };

    if (transportResult.error) {
      throw new Error(
        `Unable to retrieve scene clearance data: ${transportResult.error.message}`,
      );
    }

    const firstTriageByCasualty = new Map<
      string,
      TriageAssessmentRow
    >();

    for (const row of (triageResult.data ?? []) as TriageAssessmentRow[]) {
      if (!firstTriageByCasualty.has(row.casualty_incident_id)) {
        firstTriageByCasualty.set(row.casualty_incident_id, row);
      }
    }

    const transportRows = (transportResult.data ??
      []) as TransportRecordRow[];
    const emsTransportRows = transportRows.filter(
      (row) => row.transport_mode === "ems",
    );
    const departedAtValues = emsTransportRows
      .map((row) =>
        row.departed_scene_at ? new Date(row.departed_scene_at) : null,
      )
      .filter((value): value is Date => Boolean(value));
    const arrivedSceneAtValues = emsTransportRows
      .map((row) =>
        row.arrived_scene_at ? new Date(row.arrived_scene_at) : null,
      )
      .filter((value): value is Date => Boolean(value));

    const firstEmsVehicleOnSceneAt =
      timeline?.first_ems_on_scene_at ??
      arrivedSceneAtValues[0]?.toISOString() ??
      null;
    const firstTransportFromSceneAt =
      timeline?.first_transport_from_scene_at ??
      departedAtValues[0]?.toISOString() ??
      null;
    const lastTransportFromSceneAt =
      timeline?.last_transport_from_scene_at ??
      departedAtValues[departedAtValues.length - 1]?.toISOString() ??
      null;

    const responseInitiatedAt =
      timeline?.dmmp_activated_at ?? incident.started_at ?? null;
    const responseInitiatedDate = responseInitiatedAt
      ? new Date(responseInitiatedAt)
      : null;
    const intervalMinutes = [1, 5, 10, 15, 30, 60];
    const totalSurvivors = casualtyIncidentIds.length;

    const buildTransportIntervalRows = (category: string) =>
      intervalMinutes.map((minutes) => {
        const cutoff =
          responseInitiatedDate && !Number.isNaN(responseInitiatedDate.getTime())
            ? new Date(
                responseInitiatedDate.getTime() + minutes * 60 * 1000,
              )
            : null;
        const count =
          cutoff === null
            ? 0
            : emsTransportRows.filter((transport) => {
                const triage = firstTriageByCasualty.get(
                  transport.casualty_incident_id,
                );

                if (
                  triage?.triage_category !== category ||
                  !transport.departed_scene_at ||
                  !transport.receiving_facility_id
                ) {
                  return false;
                }

                const departedSceneAt = new Date(
                  transport.departed_scene_at,
                );

                return (
                  !Number.isNaN(departedSceneAt.getTime()) &&
                  departedSceneAt <= cutoff
                );
              }).length;

        return {
          minutes,
          cutoffAt: cutoff?.toISOString() ?? null,
          count,
          totalSurvivors,
          percentage:
            totalSurvivors > 0
              ? Number(((count / totalSurvivors) * 100).toFixed(2))
              : 0,
        };
      });

    const buildAmbulanceIntervalRows = (emsUnitType: string) =>
      intervalMinutes.map((minutes) => {
        const cutoff =
          responseInitiatedDate && !Number.isNaN(responseInitiatedDate.getTime())
            ? new Date(
                responseInitiatedDate.getTime() + minutes * 60 * 1000,
              )
            : null;
        const count =
          cutoff === null
            ? 0
            : emsTransportRows.filter((transport) => {
                if (
                  transport.ems_unit_type !== emsUnitType ||
                  !transport.arrived_scene_at
                ) {
                  return false;
                }

                const arrivedSceneAt = new Date(
                  transport.arrived_scene_at,
                );

                return (
                  !Number.isNaN(arrivedSceneAt.getTime()) &&
                  arrivedSceneAt <= cutoff
                );
              }).length;

        return {
          minutes,
          cutoffAt: cutoff?.toISOString() ?? null,
          count,
        };
      });

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        totalSurvivors,
        emsTransportedTotal: emsTransportRows.length,
        firstEmsVehicleOnSceneAt,
        firstTransportFromSceneAt,
        lastTransportFromSceneAt,
        responseInitiatedAt,
        responseInitiationSource: timeline?.dmmp_activated_at
          ? "dmmp_activated_at"
          : "incident_started_at",
        intervalMinutes,
        transported: {
          immediate: buildTransportIntervalRows("immediate"),
          delayed: buildTransportIntervalRows("delayed"),
        },
        ambulances: {
          bls: buildAmbulanceIntervalRows("bls"),
          als: buildAmbulanceIntervalRows("als"),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentSurvivorDistributionSummary(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, started_at")
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

    const { data: timeline, error: timelineError } = await supabase
      .from("incident_response_timelines")
      .select("dmmp_activated_at")
      .eq("incident_id", id)
      .maybeSingle();

    if (timelineError) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineError.message}`,
      );
    }

    const { data: casualties, error: casualtiesError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
        .eq("incident_id", id)
        .is("deleted_at", null);

    if (casualtiesError) {
      throw new Error(
        `Unable to retrieve incident casualties: ${casualtiesError.message}`,
      );
    }

    const casualtyIncidentIds = (casualties ?? []).map(
      (item) => item.id,
    );

    const transportResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_transport_records")
            .select(
              "casualty_incident_id, transport_mode, arrived_facility_at, receiving_facility_id",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .not("receiving_facility_id", "is", null)
            .not("arrived_facility_at", "is", null)
            .order("arrived_facility_at", { ascending: true })
        : { data: [], error: null };

    const encounterResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("facility_encounters")
            .select(
              "casualty_incident_id, facility_id, arrived_at, referred_or_transferred",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("arrived_at", { ascending: true })
        : { data: [], error: null };

    if (transportResult.error) {
      throw new Error(
        `Unable to retrieve survivor distribution data: ${transportResult.error.message}`,
      );
    }

    if (encounterResult.error) {
      throw new Error(
        `Unable to retrieve facility encounter data: ${encounterResult.error.message}`,
      );
    }

    const transportRows = (transportResult.data ??
      []) as TransportRecordRow[];
    const encounterRows = (encounterResult.data ??
      []) as FacilityEncounterRow[];
    const facilityIds = Array.from(
      new Set(
        [
          ...transportRows.map((row) => row.receiving_facility_id),
          ...encounterRows.map((row) => row.facility_id),
        ]
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const facilityResult =
      facilityIds.length > 0
        ? await supabase
            .from("healthcare_facilities")
            .select("id, facility_name, facility_level, municipality, province")
            .in("id", facilityIds)
        : { data: [], error: null };

    if (facilityResult.error) {
      throw new Error(
        `Unable to retrieve healthcare facilities: ${facilityResult.error.message}`,
      );
    }

    const facilityMap = new Map<string, FacilityRow>();

    for (const facility of (facilityResult.data ?? []) as FacilityRow[]) {
      facilityMap.set(facility.id, facility);
    }

    const facilityLevels = [
      "primary",
      "secondary",
      "tertiary",
      "specialized",
    ] as const;
    const arrivedRows = transportRows.filter((row) => {
      const facility = row.receiving_facility_id
        ? facilityMap.get(row.receiving_facility_id)
        : null;

      return (
        Boolean(row.arrived_facility_at) &&
        Boolean(facility?.facility_level) &&
        facilityLevels.includes(
          facility?.facility_level as (typeof facilityLevels)[number],
        )
      );
    });

    const buildFacilityMetric = (
      level: (typeof facilityLevels)[number],
      usesEms: boolean,
    ) => {
      const levelRows = arrivedRows.filter((row) => {
        const facility = row.receiving_facility_id
          ? facilityMap.get(row.receiving_facility_id)
          : null;

        return facility?.facility_level === level;
      });
      const numerator = levelRows.filter((row) =>
        usesEms
          ? row.transport_mode === "ems"
          : ["private_vehicle", "independent", "walk_in", "other"].includes(
              row.transport_mode ?? "",
            ),
      ).length;
      const denominator = levelRows.length;

      return {
        level,
        transportUse: usesEms ? "ems" : "non_ems",
        numerator,
        denominator,
        percentage:
          denominator > 0
            ? Number(((numerator / denominator) * 100).toFixed(2))
            : 0,
      };
    };

    const responseInitiatedAt =
      timeline?.dmmp_activated_at ?? incident.started_at ?? null;
    const responseInitiatedDate = responseInitiatedAt
      ? new Date(responseInitiatedAt)
      : null;
    const intervalMinutes = [1, 5, 10, 15, 30, 60];
    const totalEdArrivals = arrivedRows.length;
    const transferDenominator = encounterRows.filter((row) =>
      Boolean(row.facility_id),
    ).length;
    const transferNumerator = encounterRows.filter(
      (row) => row.referred_or_transferred === true,
    ).length;

    const edArrivalsByInterval = intervalMinutes.map((minutes) => {
      const cutoff =
        responseInitiatedDate && !Number.isNaN(responseInitiatedDate.getTime())
          ? new Date(
              responseInitiatedDate.getTime() + minutes * 60 * 1000,
            )
          : null;
      const count =
        cutoff === null
          ? 0
          : arrivedRows.filter((row) => {
              if (!row.arrived_facility_at) {
                return false;
              }

              const arrivedAt = new Date(row.arrived_facility_at);

              return (
                !Number.isNaN(arrivedAt.getTime()) &&
                arrivedAt <= cutoff
              );
            }).length;

      return {
        minutes,
        cutoffAt: cutoff?.toISOString() ?? null,
        count,
        totalArrivals: totalEdArrivals,
        percentage:
          totalEdArrivals > 0
            ? Number(((count / totalEdArrivals) * 100).toFixed(2))
            : 0,
      };
    });

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        totalSurvivors: casualtyIncidentIds.length,
        totalFacilityArrivals: arrivedRows.length,
        responseInitiatedAt,
        responseInitiationSource: timeline?.dmmp_activated_at
          ? "dmmp_activated_at"
          : "incident_started_at",
        facilityLevels: {
          primary: {
            nonEms: buildFacilityMetric("primary", false),
            ems: buildFacilityMetric("primary", true),
          },
          secondary: {
            nonEms: buildFacilityMetric("secondary", false),
            ems: buildFacilityMetric("secondary", true),
          },
          tertiary: {
            nonEms: buildFacilityMetric("tertiary", false),
            ems: buildFacilityMetric("tertiary", true),
          },
          specialized: {
            nonEms: buildFacilityMetric("specialized", false),
            ems: buildFacilityMetric("specialized", true),
          },
        },
        edArrivalsByInterval,
        interhospitalTransfer: {
          numerator: transferNumerator,
          denominator: transferDenominator,
          percentage:
            transferDenominator > 0
              ? Number(
                  (
                    (transferNumerator / transferDenominator) *
                    100
                  ).toFixed(2),
                )
              : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentEdResourceSummary(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, started_at")
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

    const { data: timeline, error: timelineError } = await supabase
      .from("incident_response_timelines")
      .select("dmmp_activated_at")
      .eq("incident_id", id)
      .maybeSingle();

    if (timelineError) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineError.message}`,
      );
    }

    const { data: casualties, error: casualtiesError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
        .eq("incident_id", id)
        .is("deleted_at", null);

    if (casualtiesError) {
      throw new Error(
        `Unable to retrieve incident casualties: ${casualtiesError.message}`,
      );
    }

    const casualtyIncidentIds = (casualties ?? []).map(
      (item) => item.id,
    );

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

    const encounterResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("facility_encounters")
            .select(
              "casualty_incident_id, facility_id, arrived_at, ed_admitted_at, ed_departed_at, referred_or_transferred, sought_ed_care, admitted_to_hospital, discharged_home, ed_resuscitation_started_at, created_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("arrived_at", { ascending: true })
            .order("created_at", { ascending: true })
        : { data: [], error: null };

    if (triageResult.error) {
      throw new Error(
        `Unable to retrieve ED triage data: ${triageResult.error.message}`,
      );
    }

    if (encounterResult.error) {
      throw new Error(
        `Unable to retrieve ED resource data: ${encounterResult.error.message}`,
      );
    }

    const latestTriageByCasualty = new Map<
      string,
      TriageAssessmentRow
    >();

    for (const row of (triageResult.data ?? []) as TriageAssessmentRow[]) {
      if (!latestTriageByCasualty.has(row.casualty_incident_id)) {
        latestTriageByCasualty.set(row.casualty_incident_id, row);
      }
    }

    const firstEncounterByCasualty = new Map<
      string,
      FacilityEncounterRow
    >();

    for (const row of (encounterResult.data ?? []) as FacilityEncounterRow[]) {
      if (!firstEncounterByCasualty.has(row.casualty_incident_id)) {
        firstEncounterByCasualty.set(row.casualty_incident_id, row);
      }
    }

    const categories = [
      "immediate",
      "delayed",
      "minimal",
      "expectant",
    ] as const;

    const encounterRows = Array.from(firstEncounterByCasualty.values());
    const soughtEdRows = encounterRows.filter(
      (row) =>
        row.sought_ed_care === true ||
        (
          row.sought_ed_care !== false &&
          (Boolean(row.facility_id) || Boolean(row.arrived_at))
        ),
    );
    const totalEdCareSeekers = soughtEdRows.length;
    const disasterOnsetAt = incident.started_at ?? null;
    const responseInitiatedAt =
      timeline?.dmmp_activated_at ?? incident.started_at ?? null;
    const responseInitiatedDate = responseInitiatedAt
      ? new Date(responseInitiatedAt)
      : null;
    const intervalMinutes = [0, 15, 30, 45, 60];

    const getCategoryForCasualty = (casualtyIncidentId: string) =>
      latestTriageByCasualty.get(casualtyIncidentId)?.triage_category ??
      "unknown";

    const buildRatioMetric = (
      label: string,
      numerator: number,
      denominator: number,
    ) => ({
      label,
      numerator,
      denominator,
      percentage: calculatePercentage(numerator, denominator),
    });

    const buildCategorySummary = (
      category: (typeof categories)[number],
    ) => {
      const categoryRows = soughtEdRows.filter(
        (row) => getCategoryForCasualty(row.casualty_incident_id) === category,
      );
      const arrivalIntervals = categoryRows
        .map((row) =>
          disasterOnsetAt && row.arrived_at
            ? minutesBetween(disasterOnsetAt, row.arrived_at)
            : null,
        )
        .filter((value): value is number => value !== null);

      return {
        soughtCare: buildRatioMetric(
          "Sought ED/similar facility care",
          categoryRows.length,
          totalEdCareSeekers,
        ),
        admitted: buildRatioMetric(
          "Admitted after ED/similar facility care",
          categoryRows.filter(
            (row) =>
              row.admitted_to_hospital === true ||
              Boolean(row.ed_admitted_at),
          ).length,
          categoryRows.length,
        ),
        discharged: buildRatioMetric(
          "Discharged after ED/similar facility care",
          categoryRows.filter(
            (row) =>
              row.discharged_home === true ||
              Boolean(row.ed_departed_at),
          ).length,
          categoryRows.length,
        ),
        medianArrivalMinutes: median(arrivalIntervals),
        arrivalIntervalCount: arrivalIntervals.length,
      };
    };

    const t1Rows = soughtEdRows.filter(
      (row) => getCategoryForCasualty(row.casualty_incident_id) === "immediate",
    );
    const resuscitationIntervals = intervalMinutes.map((minutes) => {
      const cutoff =
        responseInitiatedDate && !Number.isNaN(responseInitiatedDate.getTime())
          ? new Date(
              responseInitiatedDate.getTime() + minutes * 60 * 1000,
            )
          : null;
      const count =
        cutoff === null
          ? 0
          : t1Rows.filter((row) => {
              if (!row.ed_resuscitation_started_at) {
                return false;
              }

              const resuscitationStartedAt = new Date(
                row.ed_resuscitation_started_at,
              );

              return (
                !Number.isNaN(resuscitationStartedAt.getTime()) &&
                resuscitationStartedAt <= cutoff
              );
            }).length;

      return {
        minutes,
        cutoffAt: cutoff?.toISOString() ?? null,
        count,
        totalT1EdCareSeekers: t1Rows.length,
      };
    });

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        totalSurvivors: casualtyIncidentIds.length,
        totalEdCareSeekers,
        disasterOnsetAt,
        responseInitiatedAt,
        responseInitiationSource: timeline?.dmmp_activated_at
          ? "dmmp_activated_at"
          : "incident_started_at",
        categories: {
          immediate: buildCategorySummary("immediate"),
          delayed: buildCategorySummary("delayed"),
          minimal: buildCategorySummary("minimal"),
          expectant: buildCategorySummary("expectant"),
        },
        resuscitationIntervals,
      },
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
              "casualty_incident_id, triage_system, triage_category, triage_stage, triaged_at",
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

export async function exportIncidentCasualtiesCsv(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, incident_code")
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
      .from("casualty_incidents")
      .select(`
        id,
        current_status,
        severity,
        verification_status,
        current_location,
        reported_at,
        latitude,
        longitude,
        casualty:casualties (
          id_number,
          identification_status,
          first_name,
          middle_name,
          last_name,
          estimated_age,
          sex,
          barangay,
          municipality,
          province
        ),
        evacuation_center:evacuation_centers (
          center_name
        ),
        healthcare_facility:healthcare_facilities (
          facility_name
        )
      `)
      .eq("incident_id", id)
      .is("deleted_at", null)
      .order("reported_at", { ascending: true });

    if (error) {
      throw new Error(
        `Unable to export casualties: ${error.message}`,
      );
    }

    const records = (data ?? []) as unknown as ExportCasualtyRow[];
    const csv = buildCsv(
      [
        "record_id",
        "id_number",
        "identification_status",
        "first_name",
        "middle_name",
        "last_name",
        "estimated_age",
        "sex",
        "barangay",
        "municipality",
        "province",
        "current_status",
        "severity",
        "verification_status",
        "evacuation_center",
        "receiving_facility",
        "current_location",
        "latitude",
        "longitude",
        "reported_at",
      ],
      records.map((record) => [
        record.id,
        record.casualty?.id_number,
        record.casualty?.identification_status,
        record.casualty?.first_name,
        record.casualty?.middle_name,
        record.casualty?.last_name,
        record.casualty?.estimated_age,
        record.casualty?.sex,
        record.casualty?.barangay,
        record.casualty?.municipality,
        record.casualty?.province,
        record.current_status,
        record.severity,
        record.verification_status,
        record.evacuation_center?.center_name,
        record.healthcare_facility?.facility_name,
        record.current_location,
        record.latitude,
        record.longitude,
        record.reported_at,
      ]),
    );

    sendCsv(
      response,
      `${incident.incident_code}-casualties.csv`,
      csv,
    );
  } catch (error) {
    next(error);
  }
}

async function getLatestSitrep(
  incidentId: string,
): Promise<SitrepResponseRecord | null> {
  const { data, error } = await supabase
    .from("sitreps")
    .select(sitrepSelect)
    .eq("incident_id", incidentId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to retrieve latest SitRep: ${error.message}`);
  }

  return data
    ? ({
        ...data,
        generated_payload:
          data.generated_payload as IncidentSitrepPayload,
      } as SitrepResponseRecord)
    : null;
}

export async function exportLatestSitrepCsv(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sitrep = await getLatestSitrep(request.params.id);

    if (!sitrep) {
      response.status(404).json({
        success: false,
        message: "Generate a SitRep before exporting.",
      });
      return;
    }

    const payload = sitrep.generated_payload;
    const csv = buildCsv(
      ["section", "metric", "value"],
      [
        ["report", "report_number", sitrep.report_number],
        ["report", "generated_at", sitrep.generated_at],
        ["report", "summary", sitrep.summary],
        ["casualties", "total", payload.casualtySummary.total],
        ["casualties", "identified", payload.casualtySummary.identified],
        [
          "casualties",
          "partially_identified",
          payload.casualtySummary.partiallyIdentified,
        ],
        [
          "casualties",
          "unidentified",
          payload.casualtySummary.unidentified,
        ],
        ...Object.entries(payload.casualtySummary.byStatus).map(
          ([key, value]) => ["casualty_status", key, value],
        ),
        ...Object.entries(payload.casualtySummary.bySeverity).map(
          ([key, value]) => ["casualty_severity", key, value],
        ),
        ...Object.entries(payload.triageSummary.latestByCategory).map(
          ([key, value]) => ["triage_category", key, value],
        ),
        ...Object.entries(payload.transportSummary.modes).map(
          ([key, value]) => ["transport_mode", key, value],
        ),
        ...Object.entries(payload.transportSummary.emsUnits).map(
          ([key, value]) => ["ems_unit", key, value],
        ),
        ...Object.entries(payload.facilitySummary.evacuationCenters).map(
          ([key, value]) => ["evacuation_center", key, value],
        ),
        ...Object.entries(payload.facilitySummary.receivingFacilities).map(
          ([key, value]) => ["receiving_facility", key, value],
        ),
      ],
    );

    sendCsv(response, `${sitrep.report_number}.csv`, csv);
  } catch (error) {
    next(error);
  }
}

export async function exportLatestSitrepPdf(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sitrep = await getLatestSitrep(request.params.id);

    if (!sitrep) {
      response.status(404).json({
        success: false,
        message: "Generate a SitRep before exporting.",
      });
      return;
    }

    const pdf = buildSimplePdf(
      `Situation Report - ${sitrep.report_number}`,
      buildSitrepLines(sitrep),
    );

    sendPdf(response, `${sitrep.report_number}.pdf`, pdf);
  } catch (error) {
    next(error);
  }
}
