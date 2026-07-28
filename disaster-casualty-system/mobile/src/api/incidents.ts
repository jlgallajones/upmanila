import * as FileSystem from "expo-file-system/legacy";

import { getAccessToken } from "../auth/session";
import { api } from "./client";
import { API_BASE_URL } from "./client";

export type Incident = {
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
  status: "draft" | "active" | "closed" | "archived";
  created_at?: string;
  updated_at?: string;
};

export type IncidentResponseTimeline = {
  id: string;
  incident_id: string;
  event_notification_at: string | null;
  dmmp_activated: boolean | null;
  dmmp_activation_trigger: string | null;
  dmmp_activated_at: string | null;
  medical_coordinator_notified_at: string | null;
  first_ems_on_scene_at: string | null;
  triage_ordered_at: string | null;
  first_site_triage_at: string | null;
  last_site_triage_at: string | null;
  first_transport_from_scene_at: string | null;
  last_transport_from_scene_at: string | null;
  scene_demobilized_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DmmpStaffRecord = {
  id: string;
  incident_id: string;
  staff_name: string | null;
  role_name: string | null;
  was_contacted: boolean;
  contacted_at: string | null;
  required_arrival_at: string | null;
  arrived_at: string | null;
  arrived_within_standard: boolean | null;
  recorded_by: string | null;
  created_at: string;
};

export type DmmpStaffSummary = {
  totalStaffRecords: number;
  totalContacted: number;
  totalArrived: number;
  totalArrivedWithinStandard: number;
  reportingPercentage: number;
  formula: string;
};

export type DmmpStaffPayload = {
  staffName?: string | null;
  roleName?: string | null;
  wasContacted?: boolean | null;
  contactedAt?: string | null;
  requiredArrivalAt?: string | null;
  arrivedAt?: string | null;
};

export type CoordinationRating = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type MedicalCoordinationAssessment = {
  id: string;
  incident_id: string;
  initial_actions_rating: CoordinationRating | null;
  scene_coordination_rating: CoordinationRating | null;
  system_coordination_rating: CoordinationRating | null;
  communications_rating: CoordinationRating | null;
  resource_management_rating: CoordinationRating | null;
  notes: string | null;
  assessed_by: string | null;
  assessed_at: string;
};

export type OnsiteTriageIntervalMetric = {
  minutes: number;
  cutoffAt: string | null;
  count: number;
  totalSurvivors: number;
  percentage: number;
};

export type OnsiteTriageAccuracyMetric = {
  label: string;
  numerator: number;
  denominator: number;
  percentage: number;
};

export type OnsiteTriageSummary = {
  incidentId: string;
  totalSurvivors: number;
  onSiteTriagedTotal: number;
  triageSystemUsed: string | null;
  firstTriageSystemCounts: Record<string, number>;
  responseInitiatedAt: string | null;
  responseInitiationSource: string;
  triageOrderedAt: string | null;
  firstSiteTriageAt: string | null;
  lastSiteTriageAt: string | null;
  intervalMinutes: number[];
  categories: {
    immediate: OnsiteTriageIntervalMetric[];
    delayed: OnsiteTriageIntervalMetric[];
  };
  accuracy: {
    undertriagedT1: OnsiteTriageAccuracyMetric;
    undertriagedT2: OnsiteTriageAccuracyMetric;
    overtriagedT2: OnsiteTriageAccuracyMetric;
    overtriagedT3: OnsiteTriageAccuracyMetric;
  };
  formula: string;
  accuracyFormula: string;
};

export type FacilityTriageSummary = {
  incidentId: string;
  totalSurvivors: number;
  facilityTriagedTotal: number;
  triageSystemUsed: string | null;
  firstTriageSystemCounts: Record<string, number>;
  firstFacilityTriageAt: string | null;
  lastFacilityTriageAt: string | null;
  accuracy: {
    undertriagedT1: OnsiteTriageAccuracyMetric;
    undertriagedT2: OnsiteTriageAccuracyMetric;
    overtriagedT2: OnsiteTriageAccuracyMetric;
    overtriagedT3: OnsiteTriageAccuracyMetric;
  };
  accuracyFormula: string;
};

export type OnsiteCareIntervalMetric = {
  minutes: number;
  cutoffAt: string | null;
  count: number;
  totalSurvivors: number;
  percentage: number;
};

export type OnsiteCareSummary = {
  incidentId: string;
  totalSurvivors: number;
  treatmentRecordedTotal: number;
  stabilizedT1Total: number;
  stabilizedT2Total: number;
  treatmentStrategyCounts: Record<string, number>;
  responseInitiatedAt: string | null;
  responseInitiationSource: string;
  intervalMinutes: number[];
  categories: {
    immediate: OnsiteCareIntervalMetric[];
    delayed: OnsiteCareIntervalMetric[];
  };
};

export type SceneClearanceTransportMetric = {
  minutes: number;
  cutoffAt: string | null;
  count: number;
  totalSurvivors: number;
  percentage: number;
};

export type SceneClearanceAmbulanceMetric = {
  minutes: number;
  cutoffAt: string | null;
  count: number;
};

export type SceneClearanceSummary = {
  incidentId: string;
  totalSurvivors: number;
  emsTransportedTotal: number;
  firstEmsVehicleOnSceneAt: string | null;
  firstTransportFromSceneAt: string | null;
  lastTransportFromSceneAt: string | null;
  responseInitiatedAt: string | null;
  responseInitiationSource: string;
  intervalMinutes: number[];
  transported: {
    immediate: SceneClearanceTransportMetric[];
    delayed: SceneClearanceTransportMetric[];
  };
  ambulances: {
    bls: SceneClearanceAmbulanceMetric[];
    als: SceneClearanceAmbulanceMetric[];
  };
};

export type SurvivorDistributionFacilityMetric = {
  level: "primary" | "secondary" | "tertiary" | "specialized";
  transportUse: "ems" | "non_ems";
  numerator: number;
  denominator: number;
  percentage: number;
};

export type SurvivorDistributionIntervalMetric = {
  minutes: number;
  cutoffAt: string | null;
  count: number;
  totalArrivals: number;
  percentage: number;
};

export type SurvivorDistributionRatioMetric = {
  numerator: number;
  denominator: number;
  percentage: number;
};

export type SurvivorDistributionSummary = {
  incidentId: string;
  totalSurvivors: number;
  totalFacilityArrivals: number;
  responseInitiatedAt: string | null;
  responseInitiationSource: string;
  facilityLevels: Record<
    "primary" | "secondary" | "tertiary" | "specialized",
    {
      nonEms: SurvivorDistributionFacilityMetric;
      ems: SurvivorDistributionFacilityMetric;
    }
  >;
  edArrivalsByInterval: SurvivorDistributionIntervalMetric[];
  interhospitalTransfer: SurvivorDistributionRatioMetric;
};

export type CoordinationAssessmentPayload = {
  initialActionsRating?: CoordinationRating | null;
  sceneCoordinationRating?: CoordinationRating | null;
  systemCoordinationRating?: CoordinationRating | null;
  communicationsRating?: CoordinationRating | null;
  resourceManagementRating?: CoordinationRating | null;
  notes?: string | null;
  assessedAt?: string | null;
};

export type IncidentSitrepPayload = {
  incident: Incident;
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
  timeline: IncidentResponseTimeline | null;
  casualtySummary: {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byVerification: Record<string, number>;
    identified: number;
    partiallyIdentified: number;
    unidentified: number;
  };
  triageSummary: {
    totalAssessments: number;
    latestByCategory: Record<string, number>;
    latestByStage: Record<string, number>;
  };
  transportSummary: {
    totalRecords: number;
    required: Record<string, number>;
    modes: Record<string, number>;
    emsUnits: Record<string, number>;
    departedScene: number;
    arrivedFacility: number;
  };
  facilitySummary: {
    evacuationCenters: Record<string, number>;
    receivingFacilities: Record<string, number>;
    activeEvacuationCenterCount?: number;
  };
};

export type IncidentSitrep = {
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

type IncidentResponse = {
  success: boolean;
  count: number;
  data: Incident[];
};

type SingleIncidentResponse = {
  success: boolean;
  message: string;
  data: Incident;
};

type IncidentTimelineResponse = {
  success: boolean;
  message?: string;
  data: IncidentResponseTimeline | null;
};

type DmmpStaffResponse = {
  success: boolean;
  data: DmmpStaffRecord[];
};

type SingleDmmpStaffResponse = {
  success: boolean;
  message?: string;
  data: DmmpStaffRecord;
};

type DmmpStaffSummaryResponse = {
  success: boolean;
  data: DmmpStaffSummary;
};

type CoordinationAssessmentResponse = {
  success: boolean;
  message?: string;
  data: MedicalCoordinationAssessment | null;
};

type OnsiteTriageSummaryResponse = {
  success: boolean;
  data: OnsiteTriageSummary;
};

type FacilityTriageSummaryResponse = {
  success: boolean;
  data: FacilityTriageSummary;
};

type OnsiteCareSummaryResponse = {
  success: boolean;
  data: OnsiteCareSummary;
};

type SceneClearanceSummaryResponse = {
  success: boolean;
  data: SceneClearanceSummary;
};

type SurvivorDistributionSummaryResponse = {
  success: boolean;
  data: SurvivorDistributionSummary;
};

type IncidentSitrepResponse = {
  success: boolean;
  message?: string;
  data: IncidentSitrep;
};

export type CreateIncidentPayload = {
  incidentName: string;
  disasterType: string;
  description?: string;
  province?: string;
  municipality?: string;
  barangay?: string;
  startedAt?: string;
};

export type UpdateIncidentTimelinePayload = {
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

export async function getIncidents(): Promise<Incident[]> {
  const response = await api.get<IncidentResponse>("/incidents");
  return response.data.data;
}

export async function createIncident(
  payload: CreateIncidentPayload,
): Promise<Incident> {
  const response = await api.post<SingleIncidentResponse>(
    "/incidents",
    payload,
  );

  return response.data.data;
}

export async function closeIncident(id: string): Promise<Incident> {
  const response = await api.patch<SingleIncidentResponse>(
    `/incidents/${encodeURIComponent(id)}/close`,
  );

  return response.data.data;
}

export async function getIncidentTimeline(
  id: string,
): Promise<IncidentResponseTimeline | null> {
  const response = await api.get<IncidentTimelineResponse>(
    `/incidents/${encodeURIComponent(id)}/timeline`,
  );

  return response.data.data;
}

export async function updateIncidentTimeline(
  id: string,
  payload: UpdateIncidentTimelinePayload,
): Promise<IncidentResponseTimeline> {
  const response = await api.put<IncidentTimelineResponse>(
    `/incidents/${encodeURIComponent(id)}/timeline`,
    payload,
  );

  if (!response.data.data) {
    throw new Error("Incident timeline was not returned.");
  }

  return response.data.data;
}

export async function getDmmpStaff(
  id: string,
): Promise<DmmpStaffRecord[]> {
  const response = await api.get<DmmpStaffResponse>(
    `/incidents/${encodeURIComponent(id)}/dmmp-staff`,
  );

  return response.data.data;
}

export async function createDmmpStaff(
  id: string,
  payload: DmmpStaffPayload,
): Promise<DmmpStaffRecord> {
  const response = await api.post<SingleDmmpStaffResponse>(
    `/incidents/${encodeURIComponent(id)}/dmmp-staff`,
    payload,
  );

  return response.data.data;
}

export async function updateDmmpStaff(
  staffId: string,
  payload: DmmpStaffPayload,
): Promise<DmmpStaffRecord> {
  const response = await api.patch<SingleDmmpStaffResponse>(
    `/dmmp-staff/${encodeURIComponent(staffId)}`,
    payload,
  );

  return response.data.data;
}

export async function deleteDmmpStaff(staffId: string): Promise<void> {
  await api.delete(`/dmmp-staff/${encodeURIComponent(staffId)}`);
}

export async function getDmmpStaffSummary(
  id: string,
): Promise<DmmpStaffSummary> {
  const response = await api.get<DmmpStaffSummaryResponse>(
    `/incidents/${encodeURIComponent(id)}/dmmp-staff-summary`,
  );

  return response.data.data;
}

export async function getCoordinationAssessment(
  id: string,
): Promise<MedicalCoordinationAssessment | null> {
  const response = await api.get<CoordinationAssessmentResponse>(
    `/incidents/${encodeURIComponent(id)}/coordination-assessment`,
  );

  return response.data.data;
}

export async function saveCoordinationAssessment(
  id: string,
  payload: CoordinationAssessmentPayload,
): Promise<MedicalCoordinationAssessment> {
  const response = await api.put<CoordinationAssessmentResponse>(
    `/incidents/${encodeURIComponent(id)}/coordination-assessment`,
    payload,
  );

  if (!response.data.data) {
    throw new Error("Coordination assessment was not returned.");
  }

  return response.data.data;
}

export async function getOnsiteTriageSummary(
  id: string,
): Promise<OnsiteTriageSummary> {
  const response = await api.get<OnsiteTriageSummaryResponse>(
    `/incidents/${encodeURIComponent(id)}/onsite-triage-summary`,
  );

  return response.data.data;
}

export async function getFacilityTriageSummary(
  id: string,
): Promise<FacilityTriageSummary> {
  const response = await api.get<FacilityTriageSummaryResponse>(
    `/incidents/${encodeURIComponent(id)}/facility-triage-summary`,
  );

  return response.data.data;
}

export async function getOnsiteCareSummary(
  id: string,
): Promise<OnsiteCareSummary> {
  const response = await api.get<OnsiteCareSummaryResponse>(
    `/incidents/${encodeURIComponent(id)}/onsite-care-summary`,
  );

  return response.data.data;
}

export async function getSceneClearanceSummary(
  id: string,
): Promise<SceneClearanceSummary> {
  const response = await api.get<SceneClearanceSummaryResponse>(
    `/incidents/${encodeURIComponent(id)}/scene-clearance-summary`,
  );

  return response.data.data;
}

export async function getSurvivorDistributionSummary(
  id: string,
): Promise<SurvivorDistributionSummary> {
  const response = await api.get<SurvivorDistributionSummaryResponse>(
    `/incidents/${encodeURIComponent(id)}/survivor-distribution-summary`,
  );

  return response.data.data;
}

export async function generateIncidentSitrep(
  id: string,
): Promise<IncidentSitrep> {
  const response = await api.post<IncidentSitrepResponse>(
    `/incidents/${encodeURIComponent(id)}/sitreps`,
  );

  return response.data.data;
}

type IncidentExportKind = "sitrep-pdf" | "sitrep-csv" | "casualties-csv";

const exportPaths: Record<IncidentExportKind, string> = {
  "sitrep-pdf": "sitrep.pdf",
  "sitrep-csv": "sitrep.csv",
  "casualties-csv": "casualties.csv",
};

const exportExtensions: Record<IncidentExportKind, string> = {
  "sitrep-pdf": "pdf",
  "sitrep-csv": "csv",
  "casualties-csv": "csv",
};

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-|-$/g, "");
}

export async function downloadIncidentExport(
  incidentId: string,
  kind: IncidentExportKind,
): Promise<string> {
  const token = await getAccessToken();
  const encodedIncidentId = encodeURIComponent(incidentId);
  const endpoint = `${API_BASE_URL.replace(/\/$/, "")}/incidents/${encodedIncidentId}/export/${exportPaths[kind]}`;
  const fileName = sanitizeFileName(
    `dcms-${incidentId}-${kind}.${exportExtensions[kind]}`,
  );
  const directory =
    FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

  if (!directory) {
    throw new Error("No writable file directory is available.");
  }

  const result = await FileSystem.downloadAsync(
    endpoint,
    `${directory}${fileName}`,
    {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    },
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error("Unable to download export file.");
  }

  return result.uri;
}
