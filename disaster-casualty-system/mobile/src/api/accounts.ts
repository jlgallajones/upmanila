import { api } from "./client";
import type { ProfileUser } from "./profile";

export type ManagedAccount = ProfileUser & {
  created_by: string | null;
  last_seen_at: string | null;
};

type ManagedAccountsResponse = {
  success: boolean;
  count: number;
  data: ManagedAccount[];
};

type RegisterAdminResponse = {
  success: boolean;
  message: string;
  data: ManagedAccount;
};

export type RegisterAdminAccountPayload = {
  fullName: string;
  email: string;
  password: string;
  role: "administrator" | "super_admin";
  phoneNumber?: string;
  assignedMunicipality?: string;
  assignedBarangay?: string;
};

export type RegisterUnitUserPayload = {
  fullName: string;
  email: string;
  password: string;
  role: "responder" | "documenter";
  phoneNumber?: string;
  assignedMunicipality?: string;
  assignedBarangay?: string;
};

type RegisterUnitUserResponse = {
  success: boolean;
  message: string;
  data: ManagedAccount;
};

export async function getManagedAccounts(): Promise<ManagedAccount[]> {
  const response = await api.get<ManagedAccountsResponse>("/auth/accounts");
  return response.data.data;
}

export async function getUnitUsers(): Promise<ManagedAccount[]> {
  const response = await api.get<ManagedAccountsResponse>("/auth/unit-users");
  return response.data.data;
}

export async function registerAdminAccount(
  payload: RegisterAdminAccountPayload,
): Promise<ManagedAccount> {
  const response = await api.post<RegisterAdminResponse>(
    "/auth/register-admin",
    payload,
  );

  return response.data.data;
}

export async function registerUnitUser(
  payload: RegisterUnitUserPayload,
): Promise<ManagedAccount> {
  const response = await api.post<RegisterUnitUserResponse>(
    "/auth/register-unit-user",
    payload,
  );

  return response.data.data;
}
