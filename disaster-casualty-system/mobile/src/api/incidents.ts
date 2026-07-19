import { api } from "./client";

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
