import axios from "axios";

import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveCurrentUser,
  saveSessionTokens,
} from "../auth/session";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is missing.");
}

export const API_BASE_URL = apiUrl;

export const api = axios.create({
  baseURL: apiUrl,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

type RefreshSessionResponse = {
  success: boolean;
  data: {
    user: Parameters<typeof saveCurrentUser>[0];
    accessToken: string | null;
    refreshToken: string | null;
  };
};

let refreshSessionPromise: Promise<string | null> | null = null;

export function isAuthenticationTokenError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("authentication token") ||
    message.includes("invalid or expired") ||
    message.includes("unauthorized")
  );
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (!refreshSessionPromise) {
    refreshSessionPromise = axios
      .post<RefreshSessionResponse>(
        `${API_BASE_URL}/auth/refresh`,
        {
          refreshToken,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 15000,
        },
      )
      .then(async (response) => {
        const session = response.data.data;

        await Promise.all([
          saveCurrentUser(session.user),
          saveSessionTokens(
            session.accessToken,
            session.refreshToken,
          ),
        ]);

        return session.accessToken;
      })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    const normalizedMessage =
      typeof message === "string" ? message.toLowerCase() : "";
    const shouldRefresh =
      status === 401 ||
      normalizedMessage.includes("authentication token") ||
      normalizedMessage.includes("invalid or expired");

    if (
      shouldRefresh &&
      originalRequest &&
      !originalRequest._retry &&
      !String(originalRequest.url ?? "").includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        originalRequest.headers = {
          ...(originalRequest.headers ?? {}),
          Authorization: `Bearer ${newAccessToken}`,
        };

        return api(originalRequest);
      }
    }

    if (
      shouldRefresh
    ) {
      await clearSession();
    }

    if (typeof message === "string" && message.trim().length > 0) {
      return Promise.reject(new Error(message));
    }

    return Promise.reject(error);
  },
);
