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
};

type IncidentResponse = {
  success: boolean;
  count: number;
  data: Incident[];
};

export async function getIncidents(): Promise<Incident[]> {
  const response = await api.get<IncidentResponse>("/incidents");
  return response.data.data;
}