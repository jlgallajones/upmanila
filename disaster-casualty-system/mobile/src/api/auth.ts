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

type MessageResponse = {
  success: boolean;
  message: string;
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

export async function requestPasswordReset(
  email: string,
  redirectTo?: string,
): Promise<string> {
  const response = await api.post<MessageResponse>(
    "/auth/forgot-password",
    {
      email,
      ...(redirectTo ? { redirectTo } : {}),
    },
  );

  return response.data.message;
}

export async function recoverPassword(
  accessToken: string,
  password: string,
): Promise<string> {
  const response = await api.post<MessageResponse>(
    "/auth/recover-password",
    {
      accessToken,
      password,
    },
  );

  return response.data.message;
}
