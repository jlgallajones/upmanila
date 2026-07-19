import axios from "axios";

import { getAccessToken } from "../auth/session";

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

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message;

    if (typeof message === "string" && message.trim().length > 0) {
      return Promise.reject(new Error(message));
    }

    return Promise.reject(error);
  },
);
