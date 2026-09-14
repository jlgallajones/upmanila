import AsyncStorage from "@react-native-async-storage/async-storage";

const formDraftsKey = "dcms.formDrafts.v1";

export type LocalFormDraft = {
  id: string;
  formType: string;
  title: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

async function readDrafts(): Promise<LocalFormDraft[]> {
  const stored = await AsyncStorage.getItem(formDraftsKey);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDrafts(drafts: LocalFormDraft[]): Promise<void> {
  await AsyncStorage.setItem(formDraftsKey, JSON.stringify(drafts));
}

export async function getLocalFormDrafts(): Promise<LocalFormDraft[]> {
  const drafts = await readDrafts();
  return drafts.sort(
    (first, second) =>
      new Date(second.updatedAt).getTime() -
      new Date(first.updatedAt).getTime(),
  );
}

export async function getLocalFormDraft(
  id: string,
): Promise<LocalFormDraft | null> {
  const drafts = await readDrafts();
  return drafts.find((draft) => draft.id === id) ?? null;
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
  const drafts = await readDrafts();
  const now = new Date().toISOString();
  const existingDraft = id
    ? drafts.find((draft) => draft.id === id)
    : null;
  const draft: LocalFormDraft = {
    id:
      existingDraft?.id ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

export async function deleteLocalFormDraft(id: string): Promise<void> {
  const drafts = await readDrafts();
  await writeDrafts(drafts.filter((draft) => draft.id !== id));
}
