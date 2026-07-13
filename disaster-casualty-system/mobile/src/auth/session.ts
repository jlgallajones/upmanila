import * as SecureStore from "expo-secure-store";

import type { ProfileUser } from "../api/profile";

const userKey = "dcms.currentUser";
const accessTokenKey = "dcms.accessToken";
const refreshTokenKey = "dcms.refreshToken";

export type CurrentSession = {
  user: ProfileUser;
  accessToken: string | null;
  refreshToken: string | null;
};

export async function saveSession(session: CurrentSession): Promise<void> {
  await SecureStore.setItemAsync(userKey, JSON.stringify(session.user));

  if (session.accessToken) {
    await SecureStore.setItemAsync(accessTokenKey, session.accessToken);
  }

  if (session.refreshToken) {
    await SecureStore.setItemAsync(refreshTokenKey, session.refreshToken);
  }
}

export async function getCurrentUser(): Promise<ProfileUser | null> {
  const storedUser = await SecureStore.getItemAsync(userKey);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as ProfileUser;
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(accessTokenKey);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(userKey);
  await SecureStore.deleteItemAsync(accessTokenKey);
  await SecureStore.deleteItemAsync(refreshTokenKey);
}
