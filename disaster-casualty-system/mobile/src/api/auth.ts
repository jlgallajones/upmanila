import { api } from "./client";
import type { ProfileUser } from "./profile";

export type LoginResponse = {
  success: boolean;
  data: {
    user: ProfileUser;
    accessToken: string | null;
    refreshToken: string | null;
  };
};

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse["data"]> {
  const response = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });

  return response.data.data;
}
