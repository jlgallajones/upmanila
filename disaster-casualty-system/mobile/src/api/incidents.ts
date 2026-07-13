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

export type CreateIncidentPayload = {
  incidentName: string;
  disasterType: string;
  createdBy: string;
  description?: string;
  province?: string;
  municipality?: string;
  barangay?: string;
  startedAt?: string;
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
