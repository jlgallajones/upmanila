import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

type AuthUser = {
  id: string;
  role: string;
};

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

function sanitizeFileName(value: string): string {
  return value
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "dcms-export";
}

function sendCsv(response: Response, filename: string, csv: string): void {
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${sanitizeFileName(filename)}"`,
  );
  response.status(200).send(`\uFEFF${csv}`);
}

function sendJsonDownload(
  response: Response,
  filename: string,
  payload: unknown,
): void {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${sanitizeFileName(filename)}"`,
  );
  response.status(200).send(JSON.stringify(payload, null, 2));
}

async function getScopedIncidentIds(user: AuthUser): Promise<string[] | null> {
  if (user.role === "super_admin") {
    return null;
  }

  const { data, error } = await supabase
    .from("incidents")
    .select("id")
    .eq("created_by", user.id);

  if (error) {
    throw new Error(`Unable to load incident export scope: ${error.message}`);
  }

  return (data ?? [])
    .map((incident) => incident.id)
    .filter((id): id is string => typeof id === "string");
}

async function assertCanExportIncident(
  incidentId: string,
  user: AuthUser,
): Promise<{ id: string; incident_code: string; incident_name: string }> {
  const { data, error } = await supabase
    .from("incidents")
    .select("id, incident_code, incident_name, created_by")
    .eq("id", incidentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load incident: ${error.message}`);
  }

  if (!data) {
    throw new Error("Incident not found.");
  }

  if (user.role !== "super_admin" && data.created_by !== user.id) {
    throw new Error("You can only export incidents created by your account.");
  }

  return {
    id: data.id,
    incident_code: data.incident_code,
    incident_name: data.incident_name,
  };
}

async function selectByIds(
  tableName: string,
  columnName: string,
  ids: string[],
): Promise<unknown[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .in(columnName, ids);

  if (error) {
    throw new Error(`Unable to export ${tableName}: ${error.message}`);
  }

  return data ?? [];
}

async function selectByIncidentIds(
  tableName: string,
  incidentIds: string[],
): Promise<unknown[]> {
  return selectByIds(tableName, "incident_id", incidentIds);
}

export async function exportRespondersDocumentersCsv(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const unitRoles = ["responder", "documenter"];
    let query = supabase
      .from("users")
      .select(
        "id, full_name, email, phone_number, role, reporting_context, assigned_municipality, assigned_barangay, is_active, created_by, created_at, updated_at, last_seen_at",
      )
      .in("role", unitRoles)
      .order("full_name", { ascending: true });

    if (user.role !== "super_admin") {
      query = query.eq("created_by", user.id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to export accounts: ${error.message}`);
    }

    const csv = buildCsv(
      [
        "id",
        "full_name",
        "email",
        "phone_number",
        "role",
        "reporting_context",
        "assigned_municipality",
        "assigned_barangay",
        "is_active",
        "created_by",
        "created_at",
        "updated_at",
        "last_seen_at",
      ],
      (data ?? []).map((account) => [
        account.id,
        account.full_name,
        account.email,
        account.phone_number,
        account.role,
        account.reporting_context,
        account.assigned_municipality,
        account.assigned_barangay,
        account.is_active,
        account.created_by,
        account.created_at,
        account.updated_at,
        account.last_seen_at,
      ]),
    );

    sendCsv(response, "dcms-responders-documenters.csv", csv);
  } catch (error) {
    next(error);
  }
}

export async function exportHealthcareFacilitiesCsv(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    let query = supabase
      .from("healthcare_facilities")
      .select("*")
      .order("facility_name", { ascending: true });

    if (user.role !== "super_admin") {
      query = query.eq("created_by", user.id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to export healthcare facilities: ${error.message}`);
    }

    const csv = buildCsv(
      [
        "id",
        "facility_name",
        "facility_level",
        "address",
        "barangay",
        "municipality",
        "province",
        "contact_person",
        "contact_number",
        "latitude",
        "longitude",
        "is_active",
        "created_by",
        "created_at",
        "updated_at",
      ],
      (data ?? []).map((facility) => [
        facility.id,
        facility.facility_name,
        facility.facility_level,
        facility.address,
        facility.barangay,
        facility.municipality,
        facility.province,
        facility.contact_person,
        facility.contact_number,
        facility.latitude,
        facility.longitude,
        facility.is_active,
        facility.created_by,
        facility.created_at,
        facility.updated_at,
      ]),
    );

    sendCsv(response, "dcms-healthcare-facilities.csv", csv);
  } catch (error) {
    next(error);
  }
}

export async function exportEvacuationCentersCsv(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const scopedIncidentIds = await getScopedIncidentIds(user);

    if (scopedIncidentIds && scopedIncidentIds.length === 0) {
      sendCsv(
        response,
        "dcms-evacuation-centers.csv",
        buildCsv(
          [
            "id",
            "incident_id",
            "incident_code",
            "incident_name",
            "center_name",
            "capacity",
            "address",
            "barangay",
            "municipality",
            "province",
            "contact_person",
            "contact_number",
            "latitude",
            "longitude",
            "is_active",
            "created_at",
            "updated_at",
          ],
          [],
        ),
      );
      return;
    }

    let query = supabase
      .from("evacuation_centers")
      .select(
        "*, incident:incidents(id, incident_code, incident_name, created_by)",
      )
      .order("center_name", { ascending: true });

    if (scopedIncidentIds) {
      query = query.in("incident_id", scopedIncidentIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to export evacuation centers: ${error.message}`);
    }

    const csv = buildCsv(
      [
        "id",
        "incident_id",
        "incident_code",
        "incident_name",
        "center_name",
        "capacity",
        "address",
        "barangay",
        "municipality",
        "province",
        "contact_person",
        "contact_number",
        "latitude",
        "longitude",
        "is_active",
        "created_at",
        "updated_at",
      ],
      ((data ?? []) as Array<Record<string, any>>).map((center) => [
        center.id,
        center.incident_id,
        center.incident?.incident_code,
        center.incident?.incident_name,
        center.center_name,
        center.capacity,
        center.address,
        center.barangay,
        center.municipality,
        center.province,
        center.contact_person,
        center.contact_number,
        center.latitude,
        center.longitude,
        center.is_active,
        center.created_at,
        center.updated_at,
      ]),
    );

    sendCsv(response, "dcms-evacuation-centers.csv", csv);
  } catch (error) {
    next(error);
  }
}

export async function exportIncidentPackageJson(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const incident = await assertCanExportIncident(request.params.id, user);
    const incidentIds = [incident.id];

    const { data: incidentRecord, error: incidentError } = await supabase
      .from("incidents")
      .select("*")
      .eq("id", incident.id)
      .single();

    if (incidentError) {
      throw new Error(`Unable to export incident: ${incidentError.message}`);
    }

    const { data: casualtyIncidents, error: casualtyIncidentError } =
      await supabase
        .from("casualty_incidents")
        .select("*")
        .eq("incident_id", incident.id)
        .is("deleted_at", null);

    if (casualtyIncidentError) {
      throw new Error(
        `Unable to export casualty records: ${casualtyIncidentError.message}`,
      );
    }

    const casualtyIncidentIds = (casualtyIncidents ?? [])
      .map((record) => record.id)
      .filter((id): id is string => typeof id === "string");
    const casualtyIds = [
      ...new Set(
        (casualtyIncidents ?? [])
          .map((record) => record.casualty_id)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];

    const [
      casualties,
      attachments,
      triageAssessments,
      transportRecords,
      treatments,
      facilityEncounters,
      outcomes,
      statusHistory,
      verificationHistory,
      sitreps,
      timelines,
      evacuationCenters,
      responderSafetyResponses,
      responderSafetyReports,
      medicalCoordinationAssessments,
      continuityAssessments,
      facilityResourceSnapshots,
      dmmpStaffCallDowns,
    ] = await Promise.all([
      selectByIds("casualties", "id", casualtyIds),
      selectByIds("attachments", "casualty_incident_id", casualtyIncidentIds),
      selectByIds(
        "casualty_triage_assessments",
        "casualty_incident_id",
        casualtyIncidentIds,
      ),
      selectByIds(
        "casualty_transport_records",
        "casualty_incident_id",
        casualtyIncidentIds,
      ),
      selectByIds("casualty_treatments", "casualty_incident_id", casualtyIncidentIds),
      selectByIds("facility_encounters", "casualty_incident_id", casualtyIncidentIds),
      selectByIds("casualty_outcomes", "casualty_incident_id", casualtyIncidentIds),
      selectByIds(
        "casualty_status_history",
        "casualty_incident_id",
        casualtyIncidentIds,
      ),
      selectByIds(
        "casualty_verification_history",
        "casualty_incident_id",
        casualtyIncidentIds,
      ),
      selectByIncidentIds("sitreps", incidentIds),
      selectByIncidentIds("incident_response_timelines", incidentIds),
      selectByIncidentIds("evacuation_centers", incidentIds),
      selectByIncidentIds("responder_safety_responses", incidentIds),
      selectByIncidentIds("responder_safety_reports", incidentIds),
      selectByIncidentIds("medical_coordination_assessments", incidentIds),
      selectByIncidentIds("continuity_of_care_assessments", incidentIds),
      selectByIncidentIds("facility_resource_snapshots", incidentIds),
      selectByIncidentIds("dmmp_staff_call_downs", incidentIds),
    ]);

    sendJsonDownload(
      response,
      `${incident.incident_code}-incident-package.json`,
      {
        exportedAt: new Date().toISOString(),
        exportType: "incident_package",
        permissions: {
          scope: user.role === "super_admin" ? "system" : "admin_incident",
          exportedBy: user.id,
        },
        incident: incidentRecord,
        casualtyRecords: casualtyIncidents ?? [],
        casualties,
        attachments,
        casualtyTriageAssessments: triageAssessments,
        casualtyTransportRecords: transportRecords,
        casualtyTreatments: treatments,
        facilityEncounters,
        casualtyOutcomes: outcomes,
        casualtyStatusHistory: statusHistory,
        casualtyVerificationHistory: verificationHistory,
        sitreps,
        incidentResponseTimelines: timelines,
        evacuationCenters,
        responderSafetyResponses,
        responderSafetyReports,
        medicalCoordinationAssessments,
        continuityOfCareAssessments: continuityAssessments,
        facilityResourceSnapshots,
        dmmpStaffCallDowns,
      },
    );
  } catch (error) {
    next(error);
  }
}

export async function exportSystemBackupJson(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    if (user.role !== "super_admin") {
      response.status(403).json({
        success: false,
        message: "Only super admin accounts can export a system backup.",
      });
      return;
    }

    const tableNames = [
      "users",
      "incidents",
      "casualties",
      "casualty_incidents",
      "attachments",
      "casualty_triage_assessments",
      "casualty_transport_records",
      "casualty_treatments",
      "facility_encounters",
      "casualty_outcomes",
      "casualty_status_history",
      "casualty_verification_history",
      "healthcare_facilities",
      "evacuation_centers",
      "sitreps",
      "incident_response_timelines",
      "dmmp_staff_call_downs",
      "medical_coordination_assessments",
      "responder_safety_reports",
      "responder_safety_responses",
      "continuity_of_care_assessments",
      "facility_resource_snapshots",
      "notifications",
      "audit_logs",
    ];
    const tableEntries = await Promise.all(
      tableNames.map(async (tableName) => {
        const { data, error } = await supabase.from(tableName).select("*");

        if (error) {
          throw new Error(`Unable to export ${tableName}: ${error.message}`);
        }

        return [tableName, data ?? []] as const;
      }),
    );

    sendJsonDownload(response, "dcms-system-backup.json", {
      exportedAt: new Date().toISOString(),
      exportType: "system_backup",
      permissions: {
        scope: "system",
        exportedBy: user.id,
      },
      tables: Object.fromEntries(tableEntries),
    });
  } catch (error) {
    next(error);
  }
}
