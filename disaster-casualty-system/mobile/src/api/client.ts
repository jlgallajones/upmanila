import axios from "axios";

import { clearSession, getAccessToken } from "../auth/session";

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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    const normalizedMessage =
      typeof message === "string" ? message.toLowerCase() : "";

    if (
      status === 401 ||
      normalizedMessage.includes("authentication token") ||
      normalizedMessage.includes("invalid or expired")
    ) {
      await clearSession();
    }

    if (typeof message === "string" && message.trim().length > 0) {
      return Promise.reject(new Error(message));
    }

    return Promise.reject(error);
  },
);
