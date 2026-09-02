import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import {
  addTimelineElapsedMetrics,
  buildCumulativeIntervalRows,
  dedupeEarliestEventRows,
} from "../services/analytics/incident-analytics.js";
import { buildTriageAccuracySummary } from "../services/triage/accuracy-summary.js";

const responderIncidentViewerRoles = new Set([
  "responder",
  "field_responder",
  "sa_responder",
]);

type CreateIncidentRequest = {
  incidentName: string;
  disasterType: string;
  description?: string;
  province?: string;
  municipality?: string;
  barangay?: string;
  startedAt?: string;
};

type UpdateIncidentRequest = Partial<CreateIncidentRequest> & {
  endedAt?: string | null;
  status?: "draft" | "active" | "closed" | "archived";
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
type ResponderFunctionFilter =
  | "field_responder"
  | "sa_responder"
  | "both";
type ResponderFunctionKind = Exclude<ResponderFunctionFilter, "both">;

type IncidentSitrepPayload = {
  incident: unknown;
  generatedAt: string;
  responderFunctionFilter: ResponderFunctionFilter;
  responderFunctionSummary: {
    fieldResponderRecords: number;
    stabilizationAreaResponderRecords: number;
    unspecifiedResponderRecords: number;
  };
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
  encoded_by?: string | null;
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
  encoder?: {
    id: string;
    role: string | null;
    reporting_context?: string | null;
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
  triaged_by?: string | null;
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
  recorded_by?: string | null;
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
  hospital_admitted_at?: string | null;
  hospital_discharged_at?: string | null;
  surgical_intervention_started_at?: string | null;
  surgical_intervention_ended_at?: string | null;
  operating_room_started_at?: string | null;
  xray_required?: boolean | null;
  xray_performed_at?: string | null;
  ultrasound_required?: boolean | null;
  ultrasound_performed_at?: string | null;
  ct_required?: boolean | null;
  ct_performed_at?: string | null;
  icu_admitted_at?: string | null;
  icu_discharged_at?: string | null;
  mechanical_ventilation_required?: boolean | null;
  ventilation_started_at?: string | null;
  ventilation_ended_at?: string | null;
  alternative_icu_used?: boolean | null;
  created_at?: string | null;
};

type CasualtyOutcomeRow = {
  casualty_incident_id: string;
  reached_hospital: boolean | null;
  medical_contact_before_death: boolean | null;
  died: boolean | null;
  death_stage: string | null;
  death_at: string | null;
  final_disposition: string | null;
};

type ResponderSafetyReportRow = {
  safety_actions_established: string | null;
  ppe_decision_at: string | null;
  deployed_responders: number | null;
  injured_responders: number | null;
  ill_responders: number | null;
  deceased_responders: number | null;
};

type ResponderSafetyResponseRow = {
  safety_status: string | null;
  ppe_used_at: string | null;
};

type HospitalResourceSnapshotRow = {
  id: string;
  incident_id: string;
  facility_id: string | null;
  recorded_at: string | null;
  total_operating_rooms: number | null;
  used_operating_rooms: number | null;
  total_resuscitation_rooms: number | null;
  used_resuscitation_rooms: number | null;
  alternative_icu_in_use: boolean | null;
  notes: string | null;
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
  "admin",
  "administrator",
  "encoder",
]);

const incidentStatuses = new Set([
  "draft",
  "active",
  "closed",
  "archived",
]);

const responderFunctionFilters = new Set<ResponderFunctionFilter>([
  "field_responder",
  "sa_responder",
  "both",
]);

const primaryTriageSystems = new Set([
  "stieve",
  "start",
  "mstart",
  "jumpstart",
  "sieve",
  "care_flight",
  "salt",
  "ptt",
  "mitt",
  "homebush",
  "mptt",
  "stm",
]);

const secondaryTriageSystems = new Set([
  "save",
  "sort",
  "meta",
  "swift",
  "smart",
  "urgent_non_urgent",
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

function parseResponderFunctionFilter(
  value: unknown,
): ResponderFunctionFilter {
  return typeof value === "string" &&
    responderFunctionFilters.has(value as ResponderFunctionFilter)
    ? (value as ResponderFunctionFilter)
    : "both";
}

function formatResponderFunctionFilter(
  value: ResponderFunctionFilter,
): string {
  switch (value) {
    case "field_responder":
      return "Field Responder only";
    case "sa_responder":
      return "Stabilization Area Responder only";
    case "both":
    default:
      return "Field Responder and Stabilization Area Responder";
  }
}

function normalizeResponderFunctionFromRole(
  role: string | null | undefined,
): ResponderFunctionKind | null {
  if (role === "field_responder") {
    return "field_responder";
  }

  if (role === "sa_responder") {
    return "sa_responder";
  }

  return null;
}

function inferResponderFunctionFromTriage(
  row: TriageAssessmentRow,
  userFunctionsById: Map<string, ResponderFunctionKind | null>,
): ResponderFunctionKind | null {
  const actorFunction = row.triaged_by
    ? userFunctionsById.get(row.triaged_by)
    : null;

  if (actorFunction) {
    return actorFunction;
  }

  const system = row.triage_system ?? "";

  if (
    secondaryTriageSystems.has(system) ||
    row.triage_stage === "reassessment"
  ) {
    return "sa_responder";
  }

  if (primaryTriageSystems.has(system) || row.triage_stage === "on_site") {
    return "field_responder";
  }

  return null;
}

function inferResponderFunctionFromTransport(
  row: TransportRecordRow,
  userFunctionsById: Map<string, ResponderFunctionKind | null>,
): ResponderFunctionKind | null {
  return row.recorded_by
    ? userFunctionsById.get(row.recorded_by) ?? null
    : null;
}

function groupRowsByCasualtyId<
  T extends { casualty_incident_id: string },
>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    grouped.set(row.casualty_incident_id, [
      ...(grouped.get(row.casualty_incident_id) ?? []),
      row,
    ]);
  }

  return grouped;
}

function filterRowsByResponderFunction<T>(
  rows: T[],
  filter: ResponderFunctionFilter,
  infer: (row: T) => ResponderFunctionKind | null,
): T[] {
  if (filter === "both") {
    return rows;
  }

  return rows.filter((row) => infer(row) === filter);
}

function buildResponderFunctionSummary(
  casualties: CasualtyIncidentRow[],
  triageRowsByCasualty: Map<string, TriageAssessmentRow[]>,
  transportRowsByCasualty: Map<string, TransportRecordRow[]>,
  userFunctionsById: Map<string, ResponderFunctionKind | null>,
): IncidentSitrepPayload["responderFunctionSummary"] {
  let fieldResponderRecords = 0;
  let stabilizationAreaResponderRecords = 0;
  let unspecifiedResponderRecords = 0;

  for (const casualty of casualties) {
    const functions = new Set<ResponderFunctionKind>();
    const encodedByFunction = casualty.encoded_by
      ? userFunctionsById.get(casualty.encoded_by)
      : null;

    if (encodedByFunction) {
      functions.add(encodedByFunction);
    }

    for (const triage of triageRowsByCasualty.get(casualty.id) ?? []) {
      const triageFunction = inferResponderFunctionFromTriage(
        triage,
        userFunctionsById,
      );

      if (triageFunction) {
        functions.add(triageFunction);
      }
    }

    for (const transport of transportRowsByCasualty.get(casualty.id) ?? []) {
      const transportFunction = inferResponderFunctionFromTransport(
        transport,
        userFunctionsById,
      );

      if (transportFunction) {
        functions.add(transportFunction);
      }
    }

    if (functions.has("field_responder")) {
      fieldResponderRecords += 1;
    }

    if (functions.has("sa_responder")) {
      stabilizationAreaResponderRecords += 1;
    }

    if (functions.size === 0) {
      unspecifiedResponderRecords += 1;
    }
  }

  return {
    fieldResponderRecords,
    stabilizationAreaResponderRecords,
    unspecifiedResponderRecords,
  };
}

function filterCasualtiesByResponderFunction(
  casualties: CasualtyIncidentRow[],
  filter: ResponderFunctionFilter,
  triageRowsByCasualty: Map<string, TriageAssessmentRow[]>,
  transportRowsByCasualty: Map<string, TransportRecordRow[]>,
  userFunctionsById: Map<string, ResponderFunctionKind | null>,
): CasualtyIncidentRow[] {
  if (filter === "both") {
    return casualties;
  }

  return casualties.filter((casualty) => {
    const encodedByFunction = casualty.encoded_by
      ? userFunctionsById.get(casualty.encoded_by)
      : null;

    if (encodedByFunction === filter) {
      return true;
    }

    return (
      (triageRowsByCasualty.get(casualty.id) ?? []).some(
        (row) =>
          inferResponderFunctionFromTriage(row, userFunctionsById) ===
          filter,
      ) ||
      (transportRowsByCasualty.get(casualty.id) ?? []).some(
        (row) =>
          inferResponderFunctionFromTransport(row, userFunctionsById) ===
          filter,
      )
    );
  });
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

function daysBetween(start: string, end: string): number | null {
  const minutes = minutesBetween(start, end);

  return minutes === null
    ? null
    : Number((minutes / (60 * 24)).toFixed(2));
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

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return Number((total / values.length).toFixed(2));
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

type PdfChart = {
  title: string;
  counts: CountMap;
};

function getChartEntries(counts: CountMap): Array<[string, number]> {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(
      ([firstLabel, firstCount], [secondLabel, secondCount]) =>
        secondCount - firstCount || firstLabel.localeCompare(secondLabel),
    )
    .slice(0, 8);
}

function buildSitrepCharts(payload: IncidentSitrepPayload): PdfChart[] {
  return [
    {
      title: "Responder Function Records",
      counts: {
        "Field Responder":
          payload.responderFunctionSummary?.fieldResponderRecords ?? 0,
        "Stabilization Area Responder":
          payload.responderFunctionSummary
            ?.stabilizationAreaResponderRecords ?? 0,
        "Unspecified Responder":
          payload.responderFunctionSummary?.unspecifiedResponderRecords ?? 0,
      },
    },
    {
      title: "Casualties by Status",
      counts: payload.casualtySummary.byStatus,
    },
    {
      title: "Casualties by Severity",
      counts: payload.casualtySummary.bySeverity,
    },
    {
      title: "Verification Status",
      counts: payload.casualtySummary.byVerification,
    },
    {
      title: "Latest Triage Category",
      counts: payload.triageSummary.latestByCategory,
    },
    {
      title: "Transport Mode",
      counts: payload.transportSummary.modes,
    },
    {
      title: "EMS Unit Type",
      counts: payload.transportSummary.emsUnits,
    },
  ];
}

function buildPdfWithCharts(
  title: string,
  lines: string[],
  charts: PdfChart[],
): Buffer {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 50;
  const bottomMargin = 48;
  const pages: string[][] = [[]];
  let currentPage = pages[0]!;
  let cursorY = 790;

  const addPage = () => {
    currentPage = [];
    pages.push(currentPage);
    cursorY = 790;
  };

  const ensureSpace = (height: number) => {
    if (cursorY - height < bottomMargin) {
      addPage();
    }
  };

  const addText = (
    text: string,
    x = marginX,
    size = 10,
    font = "F1",
    leading = 14,
  ) => {
    ensureSpace(leading);
    currentPage.push(
      `BT /${font} ${size} Tf ${x} ${cursorY} Td (${escapePdfText(
        text,
      )}) Tj ET`,
    );
    cursorY -= leading;
  };

  addText(title, marginX, 15, "F2", 22);
  addText("", marginX);

  for (const line of lines) {
    for (const wrappedLine of wrapText(line, 88)) {
      addText(wrappedLine);
    }
  }

  addText("", marginX);
  addText("Charts", marginX, 13, "F2", 20);

  for (const chart of charts) {
    const entries = getChartEntries(chart.counts);
    const chartHeight = entries.length > 0
      ? 34 + entries.length * 27
      : 50;

    ensureSpace(chartHeight);
    addText(chart.title, marginX, 12, "F2", 18);

    if (entries.length === 0) {
      addText("No data recorded.", marginX + 10);
      continue;
    }

    const maxCount = Math.max(...entries.map(([, count]) => count), 1);
    const barX = 210;
    const maxBarWidth = pageWidth - barX - marginX - 38;

    for (const [label, count] of entries) {
      const barWidth = Math.max(2, (count / maxCount) * maxBarWidth);
      ensureSpace(24);
      currentPage.push(
        `BT /F1 9 Tf ${marginX} ${cursorY} Td (${escapePdfText(
          label,
        )}) Tj ET`,
      );
      currentPage.push(
        "0.62 0.07 0.09 rg",
        `${barX} ${cursorY - 3} ${barWidth.toFixed(2)} 11 re f`,
        "0 g",
      );
      currentPage.push(
        `BT /F2 9 Tf ${(barX + barWidth + 8).toFixed(2)} ${
          cursorY
        } Td (${count}) Tj ET`,
      );
      cursorY -= 24;
    }

    cursorY -= 8;
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
  const boldFontId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  );
  const pageIds: number[] = [];

  for (const pageCommands of pages) {
    const content = pageCommands.join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
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

function buildSitrepPdf(sitrep: SitrepResponseRecord): Buffer {
  return buildPdfWithCharts(
    `Situation Report - ${sitrep.report_number}`,
    buildSitrepLines(sitrep),
    buildSitrepCharts(sitrep.generated_payload),
  );
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
    `Responder Function Scope: ${formatResponderFunctionFilter(
      payload.responderFunctionFilter ?? "both",
    )}`,
    `Period: ${payload.period.start ?? "Unavailable"} to ${payload.period.end}`,
    "",
    "Summary",
    sitrep.summary,
    "",
    "Responder Function Coverage",
    `Field Responder Records: ${
      payload.responderFunctionSummary?.fieldResponderRecords ?? 0
    }`,
    `Stabilization Area Responder Records: ${
      payload.responderFunctionSummary?.stabilizationAreaResponderRecords ?? 0
    }`,
    `Unspecified Responder Records: ${
      payload.responderFunctionSummary?.unspecifiedResponderRecords ?? 0
    }`,
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
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const includeAll =
      request.query.scope === "all" &&
      ["super_admin", "administrator", "admin"].includes(user.role);
    const isUnitScopedIncidentManager =
      user.role === "admin" || user.role === "administrator";
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

      if (!responderCreatorAdminId) {
        response.status(200).json({
          success: true,
          count: 0,
          data: [],
        });
        return;
      }
    }

    let query = supabase
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
        created_by,
        created_at,
        updated_at
      `)
      .order("started_at", { ascending: false });

    if (responderCreatorAdminId) {
      query = query.eq("created_by", responderCreatorAdminId);
    }

    if (isUnitScopedIncidentManager) {
      query = query.eq("created_by", user.id);
    }

    if (!includeAll) {
      query = query.is("ended_at", null);
    }

    const { data, error } = await query;

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

    let existingIncidentQuery = supabase
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
          created_by,
          created_at,
          updated_at
        `)
      .ilike("incident_name", normalizedName)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    if (creator.role !== "super_admin") {
      existingIncidentQuery = existingIncidentQuery.eq(
        "created_by",
        user.id,
      );
    }

    const { data: existingIncident, error: existingError } =
      await existingIncidentQuery.maybeSingle();

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
        created_by,
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

export async function updateIncident(
  request: Request<{ id: string }, unknown, UpdateIncidentRequest>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);
    const {
      incidentName,
      disasterType,
      description,
      province,
      municipality,
      barangay,
      startedAt,
      endedAt,
      status,
    } = request.body;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, created_by")
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

    if (user.role !== "super_admin" && incident.created_by !== user.id) {
      response.status(403).json({
        success: false,
        message: "You can only edit incidents created by your account.",
      });
      return;
    }

    if (!incidentManagerRoles.has(user.role)) {
      response.status(403).json({
        success: false,
        message:
          "Your account is not allowed to edit disaster incidents.",
      });
      return;
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (incidentName !== undefined) {
      const normalizedName = incidentName.trim();

      if (!normalizedName) {
        response.status(400).json({
          success: false,
          message: "incidentName is required.",
        });
        return;
      }

      updates.incident_name = normalizedName;
    }

    if (disasterType !== undefined) {
      const normalizedType = disasterType.trim();

      if (!normalizedType) {
        response.status(400).json({
          success: false,
          message: "disasterType is required.",
        });
        return;
      }

      updates.disaster_type = normalizedType;
    }

    if (description !== undefined) {
      updates.description = description.trim() || null;
    }

    if (province !== undefined) {
      updates.province = province.trim() || null;
    }

    if (municipality !== undefined) {
      updates.municipality = municipality.trim() || null;
    }

    if (barangay !== undefined) {
      updates.barangay = barangay.trim() || null;
    }

    if (startedAt !== undefined) {
      updates.started_at = startedAt || null;
    }

    if (endedAt !== undefined) {
      updates.ended_at = endedAt || null;
    }

    if (status !== undefined) {
      if (!incidentStatuses.has(status)) {
        response.status(400).json({
          success: false,
          message: "Invalid incident status.",
        });
        return;
      }

      updates.status = status;
    }

    const { data: updatedIncident, error: updateError } = await supabase
      .from("incidents")
      .update(updates)
      .eq("id", id)
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
        created_by,
        created_at,
        updated_at
      `)
      .single();

    if (updateError || !updatedIncident) {
      throw new Error(
        `Unable to update incident: ${
          updateError?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(200).json({
      success: true,
      message: "Incident updated successfully.",
      data: updatedIncident,
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

    let query = supabase
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
        created_by,
        created_at,
        updated_at
      `);

    if (user.role !== "super_admin") {
      query = query.eq("created_by", user.id);
    }

    const { data: incident, error } = await query.maybeSingle();

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
        accuracy: buildTriageAccuracySummary(firstOnsiteRows),
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
        accuracy: buildTriageAccuracySummary(facilityRows),
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

    const { data: snapshotData, error: snapshotError } = await supabase
      .from("facility_resource_snapshots")
      .select(
        "id, incident_id, facility_id, recorded_at, total_operating_rooms, used_operating_rooms, total_resuscitation_rooms, used_resuscitation_rooms, alternative_icu_in_use, notes",
      )
      .eq("incident_id", id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      throw new Error(
        `Unable to retrieve ED resource snapshot: ${snapshotError.message}`,
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
    const snapshot =
      (snapshotData as HospitalResourceSnapshotRow | null) ?? null;
    const totalResuscitationRooms =
      snapshot?.total_resuscitation_rooms ?? 0;
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
    const resuscitationRoomUseByInterval = resuscitationIntervals.map(
      (row) => ({
        minutes: row.minutes,
        cutoffAt: row.cutoffAt,
        count: row.count,
        totalResuscitationRooms,
        percentage: calculatePercentage(
          row.count,
          totalResuscitationRooms,
        ),
      }),
    );

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
        resuscitationRoomUseByInterval,
        resourceSnapshot: snapshot,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentHospitalResourceSummary(
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

    const [timelineResult, casualtiesResult, snapshotResult] =
      await Promise.all([
        supabase
          .from("incident_response_timelines")
          .select("dmmp_activated_at")
          .eq("incident_id", id)
          .maybeSingle(),
        supabase
          .from("casualty_incidents")
          .select("id, severity")
          .eq("incident_id", id)
          .is("deleted_at", null),
        supabase
          .from("facility_resource_snapshots")
          .select(
            "id, incident_id, facility_id, recorded_at, total_operating_rooms, used_operating_rooms, total_resuscitation_rooms, used_resuscitation_rooms, alternative_icu_in_use, notes",
          )
          .eq("incident_id", id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (timelineResult.error) {
      throw new Error(
        `Unable to retrieve incident timeline: ${timelineResult.error.message}`,
      );
    }

    if (casualtiesResult.error) {
      throw new Error(
        `Unable to retrieve incident casualties: ${casualtiesResult.error.message}`,
      );
    }

    if (snapshotResult.error) {
      throw new Error(
        `Unable to retrieve hospital resources: ${snapshotResult.error.message}`,
      );
    }

    const casualtyRows = (casualtiesResult.data ?? []) as Array<{
      id: string;
      severity: string | null;
    }>;
    const casualtyIncidentIds = casualtyRows.map((item) => item.id);
    const severityByCasualty = new Map(
      casualtyRows.map((item) => [item.id, item.severity]),
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
              "casualty_incident_id, facility_id, arrived_at, admitted_to_hospital, sought_ed_care, surgical_intervention_started_at, surgical_intervention_ended_at, operating_room_started_at, xray_required, xray_performed_at, ultrasound_required, ultrasound_performed_at, ct_required, ct_performed_at, icu_admitted_at, mechanical_ventilation_required, alternative_icu_used, created_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("arrived_at", { ascending: true })
            .order("created_at", { ascending: true })
        : { data: [], error: null };

    if (triageResult.error) {
      throw new Error(
        `Unable to retrieve hospital resource triage data: ${triageResult.error.message}`,
      );
    }

    if (encounterResult.error) {
      throw new Error(
        `Unable to retrieve hospital resource encounter data: ${encounterResult.error.message}`,
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

    const encounterRows = Array.from(firstEncounterByCasualty.values());
    const responseInitiatedAt =
      timelineResult.data?.dmmp_activated_at ?? incident.started_at ?? null;
    const responseInitiatedDate = responseInitiatedAt
      ? new Date(responseInitiatedAt)
      : null;
    const intervalMinutes = [0, 30, 60, 90, 120];
    const snapshot =
      (snapshotResult.data as HospitalResourceSnapshotRow | null) ?? null;
    const totalOperatingRooms = snapshot?.total_operating_rooms ?? 0;

    const getCategoryForCasualty = (casualtyIncidentId: string) =>
      latestTriageByCasualty.get(casualtyIncidentId)?.triage_category ??
      "unknown";
    const isCritical = (casualtyIncidentId: string) =>
      severityByCasualty.get(casualtyIncidentId) === "critical" ||
      getCategoryForCasualty(casualtyIncidentId) === "immediate";

    const criticalEncounterRows = encounterRows.filter((row) =>
      isCritical(row.casualty_incident_id),
    );
    const t1EncounterRows = encounterRows.filter(
      (row) => getCategoryForCasualty(row.casualty_incident_id) === "immediate",
    );
    const t2EncounterRows = encounterRows.filter(
      (row) => getCategoryForCasualty(row.casualty_incident_id) === "delayed",
    );
    const t1AndT2Rows = [...t1EncounterRows, ...t2EncounterRows].filter(
      (row) =>
        row.sought_ed_care === true ||
        row.admitted_to_hospital === true ||
        Boolean(row.arrived_at),
    );

    const surgeryStartDates = criticalEncounterRows
      .map((row) =>
        row.surgical_intervention_started_at
          ? new Date(row.surgical_intervention_started_at)
          : null,
      )
      .filter(
        (value): value is Date =>
          value !== null && !Number.isNaN(value.getTime()),
      )
      .sort((first, second) => first.getTime() - second.getTime());
    const surgeryDurations = criticalEncounterRows
      .map((row) =>
        row.surgical_intervention_started_at &&
        row.surgical_intervention_ended_at
          ? minutesBetween(
              row.surgical_intervention_started_at,
              row.surgical_intervention_ended_at,
            )
          : null,
      )
      .filter((value): value is number => value !== null);

    const buildIntervalMetric = (
      rows: FacilityEncounterRow[],
      getTime: (row: FacilityEncounterRow) => string | null | undefined,
    ) =>
      intervalMinutes.map((minutes) => {
        const cutoff =
          responseInitiatedDate &&
          !Number.isNaN(responseInitiatedDate.getTime())
            ? new Date(
                responseInitiatedDate.getTime() + minutes * 60 * 1000,
              )
            : null;
        const count =
          cutoff === null
            ? 0
            : rows.filter((row) => {
                const timeValue = getTime(row);

                if (!timeValue) {
                  return false;
                }

                const eventTime = new Date(timeValue);

                return (
                  !Number.isNaN(eventTime.getTime()) && eventTime <= cutoff
                );
              }).length;

        return {
          minutes,
          cutoffAt: cutoff?.toISOString() ?? null,
          count,
        };
      });

    const buildImagingSummary = (
      key: "xray" | "ultrasound" | "ct",
    ) => {
      const requiredKey = `${key}_required` as const;
      const performedKey = `${key}_performed_at` as const;
      const requiredT1Rows = t1EncounterRows.filter(
        (row) => row[requiredKey] === true,
      );
      const requiredT2Rows = t2EncounterRows.filter(
        (row) => row[requiredKey] === true,
      );
      const requiredRows = t1AndT2Rows.filter(
        (row) => row[requiredKey] === true,
      );

      return {
        requiredT1Total: requiredT1Rows.length,
        requiredT2Total: requiredT2Rows.length,
        performedT1ByInterval: buildIntervalMetric(
          requiredT1Rows,
          (row) => row[performedKey],
        ),
        performedT2ByInterval: buildIntervalMetric(
          requiredT2Rows,
          (row) => row[performedKey],
        ),
        performedByInterval: buildIntervalMetric(
          requiredRows,
          (row) => row[performedKey],
        ),
      };
    };

    const operatingRoomsInUseByInterval = intervalMinutes.map((minutes) => {
      const cutoff =
        responseInitiatedDate && !Number.isNaN(responseInitiatedDate.getTime())
          ? new Date(responseInitiatedDate.getTime() + minutes * 60 * 1000)
          : null;
      const count =
        cutoff === null
          ? 0
          : t1EncounterRows.filter((row) => {
              if (!row.operating_room_started_at) {
                return false;
              }

              const startedAt = new Date(row.operating_room_started_at);
              const endedAt = row.surgical_intervention_ended_at
                ? new Date(row.surgical_intervention_ended_at)
                : null;

              return (
                !Number.isNaN(startedAt.getTime()) &&
                startedAt <= cutoff &&
                (
                  endedAt === null ||
                  Number.isNaN(endedAt.getTime()) ||
                  endedAt >= cutoff
                )
              );
            }).length;

      return {
        minutes,
        cutoffAt: cutoff?.toISOString() ?? null,
        count,
        percentage: calculatePercentage(count, totalOperatingRooms),
        totalOperatingRooms,
      };
    });

    const icuRows = criticalEncounterRows.filter((row) =>
      Boolean(row.icu_admitted_at),
    );
    const ventilatedIcuRows = icuRows.filter(
      (row) => row.mechanical_ventilation_required === true,
    );
    const disasterToIcuMinutes = icuRows
      .map((row) =>
        incident.started_at && row.icu_admitted_at
          ? minutesBetween(incident.started_at, row.icu_admitted_at)
          : null,
      )
      .filter((value): value is number => value !== null);
    const edToIcuMinutes = icuRows
      .map((row) =>
        row.arrived_at && row.icu_admitted_at
          ? minutesBetween(row.arrived_at, row.icu_admitted_at)
          : null,
      )
      .filter((value): value is number => value !== null);

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        totalSurvivors: casualtyIncidentIds.length,
        responseInitiatedAt,
        responseInitiationSource: timelineResult.data?.dmmp_activated_at
          ? "dmmp_activated_at"
          : "incident_started_at",
        intervalMinutes,
        resourceSnapshot: snapshot,
        surgery: {
          firstSurgicalInterventionAt:
            surgeryStartDates[0]?.toISOString() ?? null,
          lastSurgicalInterventionAt:
            surgeryStartDates[surgeryStartDates.length - 1]?.toISOString() ??
            null,
          criticallyInjuredSurgeryTotal: criticalEncounterRows.filter((row) =>
            Boolean(row.surgical_intervention_started_at),
          ).length,
          meanDurationMinutes: average(surgeryDurations),
          durationCount: surgeryDurations.length,
        },
        operatingRooms: {
          t1ByInterval: buildIntervalMetric(
            t1EncounterRows,
            (row) => row.operating_room_started_at,
          ),
          percentUsedByInterval: operatingRoomsInUseByInterval,
        },
        imaging: {
          xray: buildImagingSummary("xray"),
          ultrasound: buildImagingSummary("ultrasound"),
          ct: buildImagingSummary("ct"),
        },
        icu: {
          admittedByInterval: buildIntervalMetric(
            criticalEncounterRows,
            (row) => row.icu_admitted_at,
          ),
          admittedTotal: icuRows.length,
          ventilatedTotal: ventilatedIcuRows.length,
          ventilatedPercentage: calculatePercentage(
            ventilatedIcuRows.length,
            icuRows.length,
          ),
          meanDisasterToIcuMinutes: average(disasterToIcuMinutes),
          meanEdToIcuMinutes: average(edToIcuMinutes),
          alternativeIcuUse:
            snapshot?.alternative_icu_in_use ??
            encounterRows.some((row) => row.alternative_icu_used === true),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentMorbidityMortalitySummary(
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

    const { data: casualties, error: casualtiesError } =
      await supabase
        .from("casualty_incidents")
        .select("id, current_status, severity")
        .eq("incident_id", id)
        .is("deleted_at", null);

    if (casualtiesError) {
      throw new Error(
        `Unable to retrieve incident casualties: ${casualtiesError.message}`,
      );
    }

    const casualtyRows = (casualties ?? []) as Array<{
      id: string;
      current_status: string | null;
      severity: string | null;
    }>;
    const casualtyIncidentIds = casualtyRows.map((item) => item.id);
    const currentStatusByCasualty = new Map(
      casualtyRows.map((item) => [item.id, item.current_status]),
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
              "casualty_incident_id, arrived_at, ed_admitted_at, ed_departed_at, hospital_admitted_at, hospital_discharged_at, icu_admitted_at, icu_discharged_at, ventilation_started_at, ventilation_ended_at, created_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("arrived_at", { ascending: true })
            .order("created_at", { ascending: true })
        : { data: [], error: null };

    const outcomeResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_outcomes")
            .select(
              "casualty_incident_id, reached_hospital, medical_contact_before_death, died, death_stage, death_at, final_disposition",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
        : { data: [], error: null };

    if (triageResult.error) {
      throw new Error(
        `Unable to retrieve morbidity triage data: ${triageResult.error.message}`,
      );
    }

    if (encounterResult.error) {
      throw new Error(
        `Unable to retrieve morbidity encounter data: ${encounterResult.error.message}`,
      );
    }

    if (outcomeResult.error) {
      throw new Error(
        `Unable to retrieve mortality data: ${outcomeResult.error.message}`,
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

    const outcomeByCasualty = new Map<string, CasualtyOutcomeRow>();

    for (const row of (outcomeResult.data ?? []) as CasualtyOutcomeRow[]) {
      outcomeByCasualty.set(row.casualty_incident_id, row);
    }

    const encounterRows = Array.from(firstEncounterByCasualty.values());
    const getCategoryForCasualty = (casualtyIncidentId: string) =>
      latestTriageByCasualty.get(casualtyIncidentId)?.triage_category ??
      "unknown";
    const rowsByCategory = (category: string) =>
      encounterRows.filter(
        (row) => getCategoryForCasualty(row.casualty_incident_id) === category,
      );

    const buildMinuteStayMetric = (
      rows: FacilityEncounterRow[],
      getStart: (row: FacilityEncounterRow) => string | null | undefined,
      getEnd: (row: FacilityEncounterRow) => string | null | undefined,
    ) => {
      const values = rows
        .map((row) => {
          const start = getStart(row);
          const end = getEnd(row);

          return start && end ? minutesBetween(start, end) : null;
        })
        .filter((value): value is number => value !== null);

      return {
        meanMinutes: average(values),
        medianMinutes: median(values),
        count: values.length,
      };
    };

    const buildDayStayMetric = (
      rows: FacilityEncounterRow[],
      getStart: (row: FacilityEncounterRow) => string | null | undefined,
      getEnd: (row: FacilityEncounterRow) => string | null | undefined,
    ) => {
      const values = rows
        .map((row) => {
          const start = getStart(row);
          const end = getEnd(row);

          return start && end ? daysBetween(start, end) : null;
        })
        .filter((value): value is number => value !== null);

      return {
        meanDays: average(values),
        medianDays: median(values),
        count: values.length,
      };
    };

    const t1EncounterRows = rowsByCategory("immediate");
    const t2EncounterRows = rowsByCategory("delayed");
    const ventilatorRows = encounterRows.filter(
      (row) =>
        Boolean(row.ventilation_started_at) &&
        Boolean(row.ventilation_ended_at),
    );
    const hospitalStayRows = encounterRows.filter(
      (row) =>
        Boolean(row.hospital_admitted_at) &&
        Boolean(row.hospital_discharged_at),
    );
    const totalVictims = casualtyIncidentIds.length;
    const t1Victims = casualtyIncidentIds.filter(
      (casualtyIncidentId) =>
        getCategoryForCasualty(casualtyIncidentId) === "immediate",
    );

    const hasDied = (casualtyIncidentId: string) => {
      const outcome = outcomeByCasualty.get(casualtyIncidentId);

      return (
        outcome?.died === true ||
        currentStatusByCasualty.get(casualtyIncidentId) === "deceased"
      );
    };
    const mortalityRows = casualtyIncidentIds
      .map((casualtyIncidentId) => ({
        casualtyIncidentId,
        outcome: outcomeByCasualty.get(casualtyIncidentId) ?? null,
      }))
      .filter((row) => hasDied(row.casualtyIncidentId));
    const buildMortalityMetric = (
      numerator: number,
      denominator: number,
    ) => ({
      numerator,
      denominator,
      percentage: calculatePercentage(numerator, denominator),
    });

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        totalVictims,
        morbidity: {
          ed: {
            immediate: buildMinuteStayMetric(
              t1EncounterRows,
              (row) => row.ed_admitted_at,
              (row) => row.ed_departed_at,
            ),
            delayed: buildMinuteStayMetric(
              t2EncounterRows,
              (row) => row.ed_admitted_at,
              (row) => row.ed_departed_at,
            ),
          },
          icu: {
            immediate: buildDayStayMetric(
              t1EncounterRows,
              (row) => row.icu_admitted_at,
              (row) => row.icu_discharged_at,
            ),
          },
          ventilator: buildDayStayMetric(
            ventilatorRows,
            (row) => row.ventilation_started_at,
            (row) => row.ventilation_ended_at,
          ),
          hospital: buildDayStayMetric(
            hospitalStayRows,
            (row) => row.hospital_admitted_at,
            (row) => row.hospital_discharged_at,
          ),
        },
        mortality: {
          impactDeaths: buildMortalityMetric(
            mortalityRows.filter(
              (row) =>
                row.outcome?.death_stage === "impact" ||
                row.outcome?.medical_contact_before_death === false,
            ).length,
            totalVictims,
          ),
          prehospitalDeaths: buildMortalityMetric(
            mortalityRows.filter(
              (row) =>
                row.outcome?.death_stage === "prehospital" ||
                (
                  row.outcome?.medical_contact_before_death === true &&
                  row.outcome?.reached_hospital === false
                ),
            ).length,
            totalVictims,
          ),
          inHospitalDeaths: buildMortalityMetric(
            mortalityRows.filter(
              (row) =>
                row.outcome?.death_stage === "in_hospital" ||
                row.outcome?.reached_hospital === true,
            ).length,
            totalVictims,
          ),
          immediateDeaths: buildMortalityMetric(
            t1Victims.filter((casualtyIncidentId) =>
              hasDied(casualtyIncidentId),
            ).length,
            t1Victims.length,
          ),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentAnalyticsSummary(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, incident_name, started_at")
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

    const [
      timelineResult,
      casualtiesResult,
      responderSafetyResult,
      responderSafetyResponsesResult,
    ] = await Promise.all([
      supabase
        .from("incident_response_timelines")
        .select(
          "event_notification_at, dmmp_activated_at, medical_coordinator_notified_at, first_ems_on_scene_at, triage_ordered_at, scene_demobilized_at, last_facility_deactivated_at",
        )
        .eq("incident_id", id)
        .maybeSingle(),
      supabase
        .from("casualty_incidents")
        .select("id, verification_status")
        .eq("incident_id", id)
        .is("deleted_at", null),
      supabase
        .from("responder_safety_reports")
        .select(
          "safety_actions_established, ppe_decision_at, deployed_responders, injured_responders, ill_responders, deceased_responders",
        )
        .eq("incident_id", id)
        .maybeSingle(),
      supabase
        .from("responder_safety_responses")
        .select("safety_status, ppe_used_at")
        .eq("incident_id", id),
    ]);

    const responderSafetyResponsesError =
      responderSafetyResponsesResult.error?.code === "42P01"
        ? null
        : responderSafetyResponsesResult.error;
    const firstError =
      timelineResult.error ??
      casualtiesResult.error ??
      responderSafetyResult.error ??
      responderSafetyResponsesError;

    if (firstError) {
      throw new Error(
        `Unable to retrieve incident analytics: ${firstError.message}`,
      );
    }

    const casualtyIncidentRows = (casualtiesResult.data ?? []) as Array<{
      id: string;
      verification_status: string | null;
    }>;
    const casualtyIncidentIds = casualtyIncidentRows.map(
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
            .order("triaged_at", { ascending: true })
        : { data: [], error: null };
    const transportResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("casualty_transport_records")
            .select(
              "casualty_incident_id, transport_required, transport_mode, ems_unit_type, arrived_scene_at, departed_scene_at, arrived_facility_at, receiving_facility_id",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("created_at", { ascending: true })
        : { data: [], error: null };
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
    const encounterResult =
      casualtyIncidentIds.length > 0
        ? await supabase
            .from("facility_encounters")
            .select(
              "casualty_incident_id, facility_id, arrived_at, sought_ed_care, admitted_to_hospital, ed_admitted_at, ed_departed_at, hospital_admitted_at, hospital_discharged_at, created_at",
            )
            .in("casualty_incident_id", casualtyIncidentIds)
            .order("created_at", { ascending: true })
        : { data: [], error: null };

    const detailsError =
      triageResult.error ??
      transportResult.error ??
      treatmentResult.error ??
      encounterResult.error;

    if (detailsError) {
      throw new Error(
        `Unable to retrieve incident analytics details: ${detailsError.message}`,
      );
    }

    const timeline = timelineResult.data as Record<string, string | null> | null;
    const triageRows =
      (triageResult.data ?? []) as TriageAssessmentRow[];
    const transportRows =
      (transportResult.data ?? []) as TransportRecordRow[];
    const treatmentRows =
      (treatmentResult.data ?? []) as TreatmentRecordRow[];
    const encounterRows =
      (encounterResult.data ?? []) as FacilityEncounterRow[];
    const responderSafety =
      (responderSafetyResult.data as ResponderSafetyReportRow | null) ??
      null;
    const responderSafetyResponses =
      responderSafetyResponsesResult.error
        ? []
        : ((responderSafetyResponsesResult.data ??
            []) as ResponderSafetyResponseRow[]);
    const intervalMinutes = [1, 5, 10, 15, 30, 60];
    const totalVictims = casualtyIncidentIds.length;
    const verifiedRecords = casualtyIncidentRows.filter(
      (item) => item.verification_status === "verified",
    ).length;
    const pendingReview = casualtyIncidentRows.filter((item) =>
      ["submitted", "under_review"].includes(
        item.verification_status ?? "",
      ),
    ).length;
    const dmmpActivatedAt = timeline?.dmmp_activated_at ?? null;
    const responseInitiatedAt =
      dmmpActivatedAt ?? incident.started_at ?? null;
    const sortedDates = (values: Array<string | null | undefined>) =>
      values
        .map((value) => (value ? new Date(value) : null))
        .filter(
          (value): value is Date =>
            value !== null && !Number.isNaN(value.getTime()),
        )
        .sort((first, second) => first.getTime() - second.getTime());
    const firstDate = (values: Array<string | null | undefined>) =>
      sortedDates(values)[0]?.toISOString() ?? null;
    const lastDate = (values: Array<string | null | undefined>) => {
      const dates = sortedDates(values);

      return dates[dates.length - 1]?.toISOString() ?? null;
    };
    const isPrimaryTriage = (row: TriageAssessmentRow) =>
      row.triage_stage === "on_site" ||
      primaryTriageSystems.has(row.triage_system ?? "");
    const isSecondaryTriage = (row: TriageAssessmentRow) =>
      row.triage_stage === "reassessment" ||
      secondaryTriageSystems.has(row.triage_system ?? "");
    const primaryTriageRows = triageRows.filter(isPrimaryTriage);
    const secondaryTriageRows = triageRows.filter(isSecondaryTriage);
    const facilityTriageRows = triageRows.filter(
      (row) => row.triage_stage === "facility_arrival",
    );
    const latestTriageByCasualty = new Map<string, TriageAssessmentRow>();

    for (const row of [...triageRows].reverse()) {
      if (!latestTriageByCasualty.has(row.casualty_incident_id)) {
        latestTriageByCasualty.set(row.casualty_incident_id, row);
      }
    }

    const categoryForCasualty = (casualtyIncidentId: string) =>
      latestTriageByCasualty.get(casualtyIncidentId)?.triage_category ??
      "unknown";
    const categoryRows = (
      rows: Array<{
        casualty_incident_id: string;
        occurred_at: string | null;
      }>,
      category: string,
    ) =>
      rows.filter(
        (row) =>
          categoryForCasualty(row.casualty_incident_id) === category &&
          Boolean(row.occurred_at),
      );
    const categoryTotal = (category: string) =>
      casualtyIncidentIds.filter(
        (casualtyIncidentId) =>
          categoryForCasualty(casualtyIncidentId) === category,
      ).length;
    const buildIntervalRows = (
      rows: Array<{
        casualty_incident_id: string;
        occurred_at: string | null;
      }>,
      denominator = totalVictims,
    ) =>
      buildCumulativeIntervalRows({
        rows,
        activationAt: dmmpActivatedAt,
        intervalMinutes,
        denominator,
      });
    const primaryEvents = dedupeEarliestEventRows(
      primaryTriageRows.map((row) => ({
        casualty_incident_id: row.casualty_incident_id,
        occurred_at: row.triaged_at,
      })),
    );
    const stabilizedEvents = dedupeEarliestEventRows(
      treatmentRows.map((row) => ({
        casualty_incident_id: row.casualty_incident_id,
        occurred_at: row.stabilized_at,
      })),
    );
    const departedAndArrivedEvents = dedupeEarliestEventRows(
      transportRows.map((row) => ({
        casualty_incident_id: row.casualty_incident_id,
        occurred_at:
          row.departed_scene_at && row.arrived_facility_at
            ? row.arrived_facility_at
            : null,
      })),
    );
    const arrivalEvents = dedupeEarliestEventRows([
      ...transportRows.map((row) => ({
        casualty_incident_id: row.casualty_incident_id,
        occurred_at: row.arrived_facility_at,
      })),
      ...encounterRows.map((row) => ({
        casualty_incident_id: row.casualty_incident_id,
        occurred_at: row.arrived_at,
      })),
    ]);
    const arrivalMinutesByCategory = (
      ["immediate", "delayed", "minimal", "expectant"] as const
    ).reduce<Record<string, number | null>>((values, category) => {
      const minutes = arrivalEvents
        .filter(
          (row) =>
            categoryForCasualty(row.casualty_incident_id) === category &&
            row.occurred_at,
        )
        .map((row) =>
          row.occurred_at
            ? minutesBetween(incident.started_at, row.occurred_at)
            : null,
        )
        .filter((value): value is number => value !== null);

      values[category] = median(minutes);
      return values;
    }, {});
    const healthcareStayByCategory = (
      ["immediate", "delayed"] as const
    ).reduce<
      Record<string, { averageMinutes: number | null; medianMinutes: number | null }>
    >((values, category) => {
      const minutes = encounterRows
        .filter(
          (row) => categoryForCasualty(row.casualty_incident_id) === category,
        )
        .map((row) => {
          const start = row.hospital_admitted_at ?? row.arrived_at;
          const end = row.hospital_discharged_at ?? row.ed_departed_at;

          return start && end ? minutesBetween(start, end) : null;
        })
        .filter((value): value is number => value !== null);

      values[category] = {
        averageMinutes: average(minutes),
        medianMinutes: median(minutes),
      };
      return values;
    }, {});
    const safeResponderResponses = responderSafetyResponses.filter(
      (row) => row.safety_status === "yes",
    ).length;
    const unsafeResponderResponses = responderSafetyResponses.filter(
      (row) => row.safety_status === "no",
    ).length;
    const deployedResponders =
      responderSafetyResponses.length > 0
        ? responderSafetyResponses.length
        : responderSafety?.deployed_responders ?? 0;
    const unsafeResponders =
      responderSafetyResponses.length > 0
        ? unsafeResponderResponses
        : (responderSafety?.injured_responders ?? 0) +
          (responderSafety?.ill_responders ?? 0) +
          (responderSafety?.deceased_responders ?? 0);
    const safeResponders =
      responderSafetyResponses.length > 0
        ? safeResponderResponses
        : Math.max(0, deployedResponders - unsafeResponders);
    const edCareByCategory = (
      ["immediate", "delayed", "minimal", "expectant"] as const
    ).reduce<Record<string, { count: number; total: number; percentage: number }>>(
      (values, category) => {
        const total = casualtyIncidentIds.filter(
          (casualtyIncidentId) =>
            categoryForCasualty(casualtyIncidentId) === category,
        ).length;
        const count = encounterRows.filter(
          (row) =>
            categoryForCasualty(row.casualty_incident_id) === category &&
            row.sought_ed_care === true,
        ).length;

        values[category] = {
          count,
          total,
          percentage: calculatePercentage(count, total),
        };
        return values;
      },
      {},
    );
    const immediatePrimaryTriageByActivation = buildIntervalRows(
      categoryRows(primaryEvents, "immediate"),
      categoryTotal("immediate"),
    );
    const delayedPrimaryTriageByActivation = buildIntervalRows(
      categoryRows(primaryEvents, "delayed"),
      categoryTotal("delayed"),
    );
    const immediateStabilizedByActivation = buildIntervalRows(
      categoryRows(stabilizedEvents, "immediate"),
      categoryTotal("immediate"),
    );
    const delayedStabilizedByActivation = buildIntervalRows(
      categoryRows(stabilizedEvents, "delayed"),
      categoryTotal("delayed"),
    );
    const immediateDepartedAndArrivedByActivation = buildIntervalRows(
      categoryRows(departedAndArrivedEvents, "immediate"),
      categoryTotal("immediate"),
    );
    const delayedDepartedAndArrivedByActivation = buildIntervalRows(
      categoryRows(departedAndArrivedEvents, "delayed"),
      categoryTotal("delayed"),
    );
    const facilityArrivalByActivation = buildIntervalRows(
      arrivalEvents,
      totalVictims,
    );
    const rawTimelineVisuals = [
      {
        key: "incidentOnset",
        label: "Incident onset",
        at: incident.started_at,
      },
      {
        key: "dmmpActivation",
        label: "Activation of DMMP",
        at: timeline?.dmmp_activated_at ?? null,
      },
      {
        key: "medicalCoordinatorNotification",
        label:
          "Notification of first appropriate staff person to assume medical management coordination role",
        at: timeline?.medical_coordinator_notified_at ?? null,
      },
      {
        key: "triageInitiated",
        label: "Triage initiated",
        at: timeline?.triage_ordered_at ?? null,
      },
      {
        key: "firstPrimaryTriage",
        label: "First victim triaged using primary triage",
        at: firstDate(primaryTriageRows.map((row) => row.triaged_at)),
      },
      {
        key: "firstSecondaryTriage",
        label: "First victim triaged using secondary triage",
        at: firstDate(secondaryTriageRows.map((row) => row.triaged_at)),
      },
      {
        key: "lastPrimaryTriage",
        label: "Last victim triaged using primary triage",
        at: lastDate(primaryTriageRows.map((row) => row.triaged_at)),
      },
      {
        key: "lastSecondaryTriage",
        label: "Last victim triaged using secondary triage",
        at: lastDate(secondaryTriageRows.map((row) => row.triaged_at)),
      },
      {
        key: "firstEmsVehicle",
        label: "First EMS vehicle arrived",
        at:
          timeline?.first_ems_on_scene_at ??
          firstDate(transportRows.map((row) => row.arrived_scene_at)),
      },
      {
        key: "firstDepartedScene",
        label: "First victim departed from the scene",
        at: firstDate(transportRows.map((row) => row.departed_scene_at)),
      },
      {
        key: "lastDepartedScene",
        label: "Last victim departed from the scene",
        at: lastDate(transportRows.map((row) => row.departed_scene_at)),
      },
      {
        key: "firstFacilityTriage",
        label: "First victim triaged at a healthcare facility",
        at: firstDate(facilityTriageRows.map((row) => row.triaged_at)),
      },
      {
        key: "lastFacilityTriage",
        label: "Last victim triaged at a healthcare facility",
        at: lastDate(facilityTriageRows.map((row) => row.triaged_at)),
      },
      {
        key: "ppeDecision",
        label: "PPE use decision",
        at:
          firstDate(responderSafetyResponses.map((row) => row.ppe_used_at)) ??
          responderSafety?.ppe_decision_at ??
          null,
      },
      {
        key: "respondersDemobilized",
        label: "Responders demobilized",
        at: timeline?.scene_demobilized_at ?? null,
      },
      {
        key: "lastFacilityDeactivation",
        label: "Last healthcare facility deactivated its disaster response",
        at: timeline?.last_facility_deactivated_at ?? null,
      },
    ];
    const timelineVisuals = addTimelineElapsedMetrics(
      rawTimelineVisuals,
      dmmpActivatedAt,
    );

    response.status(200).json({
      success: true,
      data: {
        incidentId: id,
        incidentName: incident.incident_name,
        totalVictims,
        casualtyRecords: totalVictims,
        verifiedRecords,
        pendingReview,
        responseInitiatedAt,
        timelineVisuals,
        durationMetrics: {
          medianOnsetToFacilityArrivalByCategory:
            arrivalMinutesByCategory,
          healthcareFacilityLengthOfStayMinutes:
            healthcareStayByCategory,
        },
        barGraphs: {
          primaryTriageByCategory: countBy(
            primaryTriageRows,
            (row) => row.triage_category,
          ),
          secondaryTriageByCategory: countBy(
            secondaryTriageRows,
            (row) => row.triage_category,
          ),
          stabilizationStrategies: countBy(
            treatmentRows,
            (row) => row.treatment_strategy,
          ),
          responderSafety: {
            safe: safeResponders,
            unsafe: unsafeResponders,
          },
          immediatePrimaryTriageByActivation,
          delayedPrimaryTriageByActivation,
          immediateStabilizedByActivation,
          delayedStabilizedByActivation,
          immediateDepartedAndArrivedByActivation,
          delayedDepartedAndArrivedByActivation,
          facilityArrivalByActivation,
          edCareByTriageCategory: edCareByCategory,
        },
        lineGraphs: {
          primaryTriageByActivation: [
            {
              key: "immediate",
              label: "Immediate",
              data: immediatePrimaryTriageByActivation,
            },
            {
              key: "delayed",
              label: "Delayed",
              data: delayedPrimaryTriageByActivation,
            },
          ],
          stabilizationByActivation: [
            {
              key: "immediate",
              label: "Immediate",
              data: immediateStabilizedByActivation,
            },
            {
              key: "delayed",
              label: "Delayed",
              data: delayedStabilizedByActivation,
            },
          ],
          departedAndArrivedByActivation: [
            {
              key: "immediate",
              label: "Immediate",
              data: immediateDepartedAndArrivedByActivation,
            },
            {
              key: "delayed",
              label: "Delayed",
              data: delayedDepartedAndArrivedByActivation,
            },
          ],
          facilityArrivalByActivation: [
            {
              key: "all",
              label: "All victims",
              data: facilityArrivalByActivation,
            },
          ],
        },
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
    const responderFunctionFilter = parseResponderFunctionFilter(
      request.body?.responderFunctionFilter,
    );

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
          encoded_by,
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
          ),
          encoder:users!casualty_incidents_encoded_by_fkey (
            id,
            role,
            reporting_context
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
              "casualty_incident_id, triage_system, triage_category, triage_stage, triaged_at, triaged_by",
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
              "casualty_incident_id, transport_required, transport_mode, ems_unit_type, departed_scene_at, arrived_facility_at, receiving_facility_id, recorded_by",
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
    const participantUserIds = [
      ...new Set(
        [
          ...casualties.map((item) => item.encoded_by),
          ...triageRows.map((item) => item.triaged_by),
          ...transportRows.map((item) => item.recorded_by),
        ].filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        ),
      ),
    ];
    const userFunctionsById = new Map<
      string,
      ResponderFunctionKind | null
    >();

    if (participantUserIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, role")
        .in("id", participantUserIds);

      if (usersError) {
        throw new Error(
          `Unable to collect responder function data: ${usersError.message}`,
        );
      }

      for (const participant of users ?? []) {
        userFunctionsById.set(
          participant.id,
          normalizeResponderFunctionFromRole(participant.role),
        );
      }
    }

    for (const casualty of casualties) {
      if (casualty.encoded_by && !userFunctionsById.has(casualty.encoded_by)) {
        userFunctionsById.set(
          casualty.encoded_by,
          normalizeResponderFunctionFromRole(casualty.encoder?.role),
        );
      }
    }

    const triageRowsByCasualty = groupRowsByCasualtyId(triageRows);
    const transportRowsByCasualty =
      groupRowsByCasualtyId(transportRows);
    const filteredCasualties = filterCasualtiesByResponderFunction(
      casualties,
      responderFunctionFilter,
      triageRowsByCasualty,
      transportRowsByCasualty,
      userFunctionsById,
    );
    const filteredCasualtyIds = new Set(
      filteredCasualties.map((item) => item.id),
    );
    const filteredTriageRows = filterRowsByResponderFunction(
      triageRows.filter((item) =>
        filteredCasualtyIds.has(item.casualty_incident_id),
      ),
      responderFunctionFilter,
      (row) => inferResponderFunctionFromTriage(row, userFunctionsById),
    );
    const filteredTransportRows = filterRowsByResponderFunction(
      transportRows.filter((item) =>
        filteredCasualtyIds.has(item.casualty_incident_id),
      ),
      responderFunctionFilter,
      (row) => inferResponderFunctionFromTransport(row, userFunctionsById),
    );
    const responderFunctionSummary = buildResponderFunctionSummary(
      filteredCasualties,
      triageRowsByCasualty,
      transportRowsByCasualty,
      userFunctionsById,
    );

    const receivingFacilityIds = Array.from(
      new Set(
        filteredTransportRows
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

    for (const triage of filteredTriageRows) {
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

    for (const transport of filteredTransportRows) {
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
      total: filteredCasualties.length,
      byStatus: countBy(filteredCasualties, (item) => item.current_status),
      bySeverity: countBy(filteredCasualties, (item) => item.severity),
      byVerification: countBy(
        filteredCasualties,
        (item) => item.verification_status,
      ),
      identified: filteredCasualties.filter(
        (item) =>
          item.casualty?.identification_status === "identified",
      ).length,
      partiallyIdentified: filteredCasualties.filter(
        (item) =>
          item.casualty?.identification_status ===
          "partially_identified",
      ).length,
      unidentified: filteredCasualties.filter(
        (item) =>
          item.casualty?.identification_status === "unidentified",
      ).length,
    };

    const triageSummary = {
      totalAssessments: filteredTriageRows.length,
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
      totalRecords: filteredTransportRows.length,
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

    const evacuationCenters = countBy(filteredCasualties, (item) =>
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
    ).concat(
      `; responder function scope: ${formatResponderFunctionFilter(
        responderFunctionFilter,
      )}`,
    );

    const periodStart = getPeriodStart(incident, filteredCasualties);
    const payload: IncidentSitrepPayload = {
      incident,
      generatedAt,
      responderFunctionFilter,
      responderFunctionSummary,
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
  responderFunctionFilter: ResponderFunctionFilter = "both",
): Promise<SitrepResponseRecord | null> {
  const { data, error } = await supabase
    .from("sitreps")
    .select(sitrepSelect)
    .eq("incident_id", incidentId)
    .order("generated_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Unable to retrieve latest SitRep: ${error.message}`);
  }

  const records = (data ?? []).map(
    (item) =>
      ({
        ...item,
        generated_payload:
          item.generated_payload as IncidentSitrepPayload,
      }) as SitrepResponseRecord,
  );

  return (
    records.find(
      (item) =>
        (item.generated_payload.responderFunctionFilter ?? "both") ===
        responderFunctionFilter,
    ) ?? null
  );
}

export async function exportLatestSitrepCsv(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const responderFunctionFilter = parseResponderFunctionFilter(
      request.query.responderFunctionFilter,
    );
    const sitrep = await getLatestSitrep(
      request.params.id,
      responderFunctionFilter,
    );

    if (!sitrep) {
      response.status(404).json({
        success: false,
        message:
          "Generate a SitRep for the selected responder function scope before exporting.",
      });
      return;
    }

    const payload = sitrep.generated_payload;
    const csv = buildCsv(
      ["section", "metric", "value"],
      [
        ["report", "report_number", sitrep.report_number],
        ["report", "generated_at", sitrep.generated_at],
        [
          "report",
          "responder_function_scope",
          formatResponderFunctionFilter(
            payload.responderFunctionFilter ?? "both",
          ),
        ],
        ["report", "summary", sitrep.summary],
        [
          "responder_function",
          "field_responder_records",
          payload.responderFunctionSummary?.fieldResponderRecords ?? 0,
        ],
        [
          "responder_function",
          "stabilization_area_responder_records",
          payload.responderFunctionSummary
            ?.stabilizationAreaResponderRecords ?? 0,
        ],
        [
          "responder_function",
          "unspecified_responder_records",
          payload.responderFunctionSummary?.unspecifiedResponderRecords ??
            0,
        ],
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
    const responderFunctionFilter = parseResponderFunctionFilter(
      request.query.responderFunctionFilter,
    );
    const sitrep = await getLatestSitrep(
      request.params.id,
      responderFunctionFilter,
    );

    if (!sitrep) {
      response.status(404).json({
        success: false,
        message:
          "Generate a SitRep for the selected responder function scope before exporting.",
      });
      return;
    }

    const pdf = buildSitrepPdf(sitrep);

    sendPdf(response, `${sitrep.report_number}.pdf`, pdf);
  } catch (error) {
    next(error);
  }
}
