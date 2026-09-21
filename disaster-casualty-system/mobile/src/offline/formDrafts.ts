import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCurrentUser } from "../auth/session";

const formDraftsKey = "dcms.formDrafts.v1";

export type LocalFormDraft = {
  id: string;
  ownerUserId: string;
  formType: string;
  title: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

async function readDrafts(): Promise<LocalFormDraft[]> {
  const stored = await AsyncStorage.getItem(formDraftsKey);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (draft): draft is LocalFormDraft =>
        typeof draft === "object" &&
        draft !== null &&
        typeof draft.ownerUserId === "string" &&
        draft.ownerUserId.trim().length > 0,
    );
  } catch {
    return [];
  }
}

async function writeDrafts(drafts: LocalFormDraft[]): Promise<void> {
  await AsyncStorage.setItem(formDraftsKey, JSON.stringify(drafts));
}

export async function getLocalFormDrafts(): Promise<LocalFormDraft[]> {
  const user = await getCurrentUser();

  if (!user?.id) {
    return [];
  }

  const drafts = await readDrafts();

  return drafts
    .filter((draft) => draft.ownerUserId === user.id)
    .sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() -
        new Date(first.updatedAt).getTime(),
    );
}

export async function getLocalFormDraft(
  id: string,
): Promise<LocalFormDraft | null> {
  const user = await getCurrentUser();

  if (!user?.id) {
    return null;
  }

  const drafts = await readDrafts();

  return (
    drafts.find(
      (draft) =>
        draft.id === id &&
        draft.ownerUserId === user.id,
    ) ?? null
  );
}

export async function saveLocalFormDraft({
  id,
  formType,
  title,
  payload,
}: {
  id?: string | null;
  formType: string;
  title: string;
  payload: Record<string, unknown>;
}): Promise<LocalFormDraft> {
  const user = await getCurrentUser();

  if (!user?.id) {
    throw new Error(
      "Unable to save draft because no logged-in user was found.",
    );
  }

  const drafts = await readDrafts();
  const now = new Date().toISOString();
  const existingDraft = id
    ? drafts.find((draft) => draft.id === id)
    : null;

  const draft: LocalFormDraft = {
    id:
      existingDraft?.id ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ownerUserId: user.id,
    formType,
    title,
    payload,
    createdAt: existingDraft?.createdAt ?? now,
    updatedAt: now,
  };

  await writeDrafts([
    draft,
    ...drafts.filter((item) => item.id !== draft.id),
  ]);

  return draft;
}

export async function deleteLocalFormDraft(
  id: string,
): Promise<void> {
  const user = await getCurrentUser();

  if (!user?.id) {
    return;
  }

  const drafts = await readDrafts();

  await writeDrafts(
    drafts.filter(
      (draft) =>
        draft.id !== id ||
        draft.ownerUserId !== user.id,
    ),
  );
}