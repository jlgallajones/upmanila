import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { ProfileUser } from "../api/profile";
import { clearResponderAssignment } from "./responderAssignment";

const userKey = "dcms.currentUser";
const accessTokenKey = "dcms.accessToken";
const refreshTokenKey = "dcms.refreshToken";

export type CurrentSession = {
  user: ProfileUser;
  accessToken: string | null;
  refreshToken: string | null;
};

const isWeb = Platform.OS === "web";

async function setSessionItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getSessionItem(key: string): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function deleteSessionItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function saveSession(session: CurrentSession): Promise<void> {
  await setSessionItem(userKey, JSON.stringify(session.user));

  if (session.accessToken) {
    await setSessionItem(accessTokenKey, session.accessToken);
  }

  if (session.refreshToken) {
    await setSessionItem(refreshTokenKey, session.refreshToken);
  }
}

export async function getCurrentUser(): Promise<ProfileUser | null> {
  const storedUser = await getSessionItem(userKey);

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
  return getSessionItem(accessTokenKey);
}

export async function clearSession(): Promise<void> {
  await deleteSessionItem(userKey);
  await deleteSessionItem(accessTokenKey);
  await deleteSessionItem(refreshTokenKey);
  await clearResponderAssignment();
}
