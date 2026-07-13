import { api } from "./client";

export type DashboardSummary = {
  encodedToday: number;
  verifiedRecords: number;
  pendingRecords: number;
  activeIncidents: number;
};

export type RecentActivity = {
  id: string;
  current_status: string;
  verification_status: string;
  reported_at: string;

  casualty: {
    id: string;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    identification_status: string;
  };

  incident: {
    id: string;
    incident_name: string;
  };
};

type DashboardSummaryResponse = {
  success: boolean;
  data: DashboardSummary;
};

type RecentActivityResponse = {
  success: boolean;
  count: number;
  data: RecentActivity[];
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response =
    await api.get<DashboardSummaryResponse>(
      "/dashboard/summary",
    );

  return response.data.data;
}

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const response =
    await api.get<RecentActivityResponse>(
      "/dashboard/recent-activity?limit=5",
    );

  return response.data.data;
}