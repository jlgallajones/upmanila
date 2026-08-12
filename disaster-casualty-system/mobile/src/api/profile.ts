import { api } from "./client";

export type UserRole =
  | "super_admin"
  | "administrator"
  | "responder"
  | "encoder"
  | "medical_personnel"
  | "viewer";

export type ReportingContext =
  | "scene"
  | "transport"
  | "receiving_facility_ed"
  | "hospital_ward"
  | "evacuation_center"
  | "command_admin";

export type ProfileUser = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: UserRole;
  reporting_context: ReportingContext | null;
  assigned_barangay: string | null;
  assigned_municipality: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileStatistics = {
  encoded: number;
  verified: number;
  pending: number;
};

export type ProfileData = {
  user: ProfileUser;
  statistics: ProfileStatistics;
};

type ProfileResponse = {
  success: boolean;
  data: ProfileData;
};

export async function getProfile(
  userId: string,
): Promise<ProfileData> {
  const response = await api.get<ProfileResponse>(
    `/profile/${encodeURIComponent(userId)}`,
  );

  return response.data.data;
}
