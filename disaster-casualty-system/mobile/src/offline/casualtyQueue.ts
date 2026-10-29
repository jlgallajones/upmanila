import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createCasualty,
  type CreateCasualtyPayload,
} from "../api/casualties";
import { uploadAttachment } from "../api/attachments";
import {
  saveResponderSafetyResponse,
  type ResponderSafetyResponsePayload,
} from "../api/incidents";
import {
  getAccessToken,
  getCurrentUserId,
} from "../auth/session";

const queueKey = "dcms.offlineCasualtyQueue";
const queueSyncConcurrency = 3;
let syncAllQueuePromise: Promise<QueueSyncResult> | null = null;

export type QueuedCasualtyPayload = Omit<
  CreateCasualtyPayload,
  "incidentId"
> & {
  incidentId?: string;
  offlineIncidentName?: string;
};

export type QueuedCasualtyAttachment = {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  base64Data: string;
  fileSizeBytes?: number;
};

export type QueuedResponderSafetyResponse = ResponderSafetyResponsePayload;

export type QueuedCasualtySyncStatus =
  | "pending"
  | "syncing"
  | "failed";

export type QueuedCasualtySubmission = {
  id: string;
  ownerUserId: string | null;
  payload: QueuedCasualtyPayload;
  createdAt: string;
  updatedAt: string;
  status: QueuedCasualtySyncStatus;
  attempts: number;
  lastError?: string;
  attachments?: QueuedCasualtyAttachment[];
  responderSafetyResponse?: QueuedResponderSafetyResponse;
  syncedCasualtyIncidentId?: string;
};

export type QueueSyncIssue = {
  queueId: string;
  reason: string;
};

export type QueueSyncResult = {
  synced: number;
  remaining: number;
  skipped: number;
  failed: number;
  issues: QueueSyncIssue[];
};

function createQueueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeQueueItem(
  item: Partial<QueuedCasualtySubmission>,
): QueuedCasualtySubmission | null {
  if (!item || !item.id || !item.payload) {
    return null;
  }

  const createdAt = item.createdAt ?? new Date().toISOString();
  const status =
    item.status === "syncing"
      ? "pending"
      : item.status ?? "pending";

  return {
    id: item.id,
    ownerUserId:
      typeof item.ownerUserId === "string"
        ? item.ownerUserId
        : null,
    payload: item.payload,
    createdAt,
    updatedAt: item.updatedAt ?? createdAt,
    status,
    attempts: item.attempts ?? 0,
    lastError: item.lastError,
    attachments: Array.isArray(item.attachments)
      ? item.attachments
      : [],
    responderSafetyResponse: item.responderSafetyResponse,
    syncedCasualtyIncidentId: item.syncedCasualtyIncidentId,
  };
}

async function readQueue(): Promise<QueuedCasualtySubmission[]> {
  const stored = await AsyncStorage.getItem(queueKey);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as QueuedCasualtySubmission[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeQueueItem(item))
      .filter(
        (item): item is QueuedCasualtySubmission => item !== null,
      );
  } catch {
    return [];
  }
}

async function writeQueue(
  queue: QueuedCasualtySubmission[],
): Promise<void> {
  await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
}

async function getQueueScope(): Promise<{
  all: QueuedCasualtySubmission[];
  owned: QueuedCasualtySubmission[];
  ownerUserId: string | null;
}> {
  const [all, ownerUserId] = await Promise.all([
    readQueue(),
    getCurrentUserId(),
  ]);

  return {
    all,
    owned: ownerUserId
      ? all.filter((item) => item.ownerUserId === ownerUserId)
      : [],
    ownerUserId,
  };
}

async function replaceOwnedQueue(
  all: QueuedCasualtySubmission[],
  ownerUserId: string,
  owned: QueuedCasualtySubmission[],
): Promise<void> {
  const ownedById = new Map(
    owned.map((item) => [item.id, item]),
  );

  await writeQueue(
    all.flatMap((item) => {
      if (item.ownerUserId !== ownerUserId) {
        return [item];
      }

      const replacement = ownedById.get(item.id);
      return replacement ? [replacement] : [];
    }),
  );
}

export function isNetworkSubmissionError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("connection") ||
    message.includes("internet")
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unknown sync error.";
}

function isAlreadySynchronizedError(error: unknown): boolean {
  return getErrorMessage(error)
    .toLowerCase()
    .includes("already been synchronized");
}

function isDuplicateIdNumberError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("id number") &&
    message.includes("already")
  );
}

function isSystemGeneratedIdNumber(
  idNumber: string | null | undefined,
): boolean {
  return (
    /^CAS:\d{6}:[A-Z0-9]+?\d{3,}$/i.test(idNumber ?? "") ||
    /^CAS-\d{8}-/i.test(idNumber ?? "") ||
    /^CAS-UNIT-/i.test(idNumber ?? "") ||
    /^CAS-SYNC-/i.test(idNumber ?? "")
  );
}

function generateQueuedSyncIdNumber(): string {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `CAS-SYNC-${Date.now()}-${randomPart}`;
}

function replaceOrAppendFieldResponderCodeNotes(
  notes: string | undefined,
  victimCode: string,
  userCode: string,
): string {
  const baseNotes = notes ?? "";
  let nextNotes = baseNotes;

  if (/Victim code:\s*[^\r\n]*/i.test(nextNotes)) {
    nextNotes = nextNotes.replace(
      /Victim code:\s*[^\r\n]*/i,
      `Victim code: ${victimCode}`,
    );
  } else {
    nextNotes = [nextNotes.trim(), `[Field Responder Codes]\nVictim code: ${victimCode}`]
      .filter(Boolean)
      .join("\n\n");
  }

  if (/User code:\s*[^\r\n]*/i.test(nextNotes)) {
    nextNotes = nextNotes.replace(
      /User code:\s*[^\r\n]*/i,
      `User code: ${userCode}`,
    );
  } else {
    nextNotes = [nextNotes.trim(), `User code: ${userCode}`]
      .filter(Boolean)
      .join("\n");
  }

  return nextNotes;
}

export async function queueCasualtySubmission(
  payload: QueuedCasualtyPayload,
  options: {
    attachments?: QueuedCasualtyAttachment[];
    ownerUserId?: string | null;
    responderSafetyResponse?: QueuedResponderSafetyResponse;
  } = {},
): Promise<void> {
  const queue = await readQueue();
  const ownerUserId =
    options.ownerUserId !== undefined
      ? options.ownerUserId
      : await getCurrentUserId();
  const now = new Date().toISOString();

  await writeQueue([
    ...queue,
    {
      id: createQueueId(),
      ownerUserId,
      payload,
      createdAt: now,
      updatedAt: now,
      status: "pending",
      attempts: 0,
      attachments: options.attachments ?? [],
      responderSafetyResponse: options.responderSafetyResponse,
    },
  ]);
}

export async function getQueuedCasualtyCount(): Promise<number> {
  const { owned } = await getQueueScope();
  return owned.length;
}

export async function getQueuedCasualtySubmissions(): Promise<
  QueuedCasualtySubmission[]
> {
  const { owned } = await getQueueScope();
  return owned;
}

export async function assignQueuedCasualtyIncident(
  queueId: string,
  incident: { id: string; name: string },
): Promise<void> {
  const { all, owned, ownerUserId } = await getQueueScope();

  if (!ownerUserId) {
    return;
  }

  const now = new Date().toISOString();

  await replaceOwnedQueue(
    all,
    ownerUserId,
    owned.map((item) =>
      item.id === queueId
        ? {
            ...item,
            payload: {
              ...item.payload,
              incidentId: incident.id,
              offlineIncidentName: incident.name,
            },
            status: "pending",
            updatedAt: now,
            lastError: undefined,
          }
        : item,
    ),
  );
}

export async function updateQueuedCasualtyVictimCode(
  queueId: string,
  victimCode: string,
  userCode: string,
): Promise<void> {
  const { all, owned, ownerUserId } = await getQueueScope();

  if (!ownerUserId) {
    return;
  }

  const now = new Date().toISOString();

  await replaceOwnedQueue(
    all,
    ownerUserId,
    owned.map((item) =>
      item.id === queueId
        ? {
            ...item,
            payload: {
              ...item.payload,
              person: {
                ...item.payload.person,
                idNumber: victimCode,
              },
              triageAssessment: item.payload.triageAssessment
                ? {
                    ...item.payload.triageAssessment,
                    notes: replaceOrAppendFieldResponderCodeNotes(
                      item.payload.triageAssessment.notes,
                      victimCode,
                      userCode,
                    ),
                  }
                : item.payload.triageAssessment,
            },
            status: "pending",
            updatedAt: now,
            lastError: undefined,
          }
        : item,
    ),
  );
}

async function markQueueItemSyncing(
  queueId: string,
  ownerUserId: string,
): Promise<void> {
  const queue = await readQueue();
  const now = new Date().toISOString();

  await writeQueue(
    queue.map((item) =>
      item.id === queueId && item.ownerUserId === ownerUserId
        ? {
            ...item,
            status: "syncing",
            updatedAt: now,
            lastError: undefined,
          }
        : item,
    ),
  );
}

async function syncQueueItem(
  item: QueuedCasualtySubmission,
  options: { allowGeneratedIdRetry?: boolean } = {},
): Promise<{
  synced: boolean;
  item?: QueuedCasualtySubmission;
  issue?: QueueSyncIssue;
}> {
  if (!item.payload.incidentId && !item.syncedCasualtyIncidentId) {
    return {
      synced: false,
      item: {
        ...item,
        status: "failed",
        attempts: item.attempts + 1,
        updatedAt: new Date().toISOString(),
        lastError: "Queued victim has no selected incident.",
      },
      issue: {
        queueId: item.id,
        reason: "Queued victim has no selected incident.",
      },
    };
  }

  let casualtyIncidentId = item.syncedCasualtyIncidentId;

  try {
    if (
      !casualtyIncidentId &&
      item.responderSafetyResponse &&
      item.payload.incidentId
    ) {
      await saveResponderSafetyResponse(
        item.payload.incidentId,
        {
          ...item.responderSafetyResponse,
          recordedAt: item.createdAt,
        },
      );
    }

    if (!casualtyIncidentId) {
      const response = await createCasualty({
        ...item.payload,
        incidentId: item.payload.incidentId as string,
      });

      casualtyIncidentId =
        response.data.casualtyIncident.id;
    }

    for (const attachment of item.attachments ?? []) {
      await uploadAttachment({
        casualtyIncidentId,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        mimeType: attachment.mimeType,
        base64Data: attachment.base64Data,
        fileSizeBytes: attachment.fileSizeBytes,
      });
    }

    return {
      synced: true,
    };
  } catch (error) {
    if (isAlreadySynchronizedError(error)) {
      return {
        synced: true,
      };
    }

    if (
      options.allowGeneratedIdRetry !== false &&
      isDuplicateIdNumberError(error) &&
      isSystemGeneratedIdNumber(item.payload.person.idNumber)
    ) {
      const nextItem: QueuedCasualtySubmission = {
        ...item,
        payload: {
          ...item.payload,
          person: {
            ...item.payload.person,
            idNumber: generateQueuedSyncIdNumber(),
          },
        },
      };

      return syncQueueItem(nextItem, {
        allowGeneratedIdRetry: false,
      });
    }

    const reason = getErrorMessage(error);

    return {
      synced: false,
      item: {
        ...item,
        status: "failed",
        attempts: item.attempts + 1,
        updatedAt: new Date().toISOString(),
        lastError: reason,
        syncedCasualtyIncidentId:
          casualtyIncidentId ?? item.syncedCasualtyIncidentId,
      },
      issue: {
        queueId: item.id,
        reason,
      },
    };
  }
}

type QueueItemSyncResult = Awaited<
  ReturnType<typeof syncQueueItem>
>;

async function syncQueueItemsConcurrently(
  items: QueuedCasualtySubmission[],
): Promise<QueueItemSyncResult[]> {
  const results: QueueItemSyncResult[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      results[itemIndex] = await syncQueueItem(items[itemIndex]);
    }
  }

  const workerCount = Math.min(
    queueSyncConcurrency,
    items.length,
  );

  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  return results;
}

export async function retryQueuedCasualtySubmission(
  queueId: string,
): Promise<QueueSyncResult> {
  const scope = await getQueueScope();
  const { all, owned, ownerUserId } = scope;

  if (!ownerUserId) {
    return {
      synced: 0,
      remaining: 0,
      skipped: 0,
      failed: 0,
      issues: [],
    };
  }

  await markQueueItemSyncing(queueId, ownerUserId);

  const queue = await readQueue();
  const token = await getAccessToken();
  const item = queue.find(
    (candidate) =>
      candidate.id === queueId &&
      candidate.ownerUserId === ownerUserId,
  );

  if (!item) {
    return {
      synced: 0,
      remaining: owned.length,
      skipped: 0,
      failed: 0,
      issues: [],
    };
  }

  if (!token) {
    const issue = {
      queueId,
      reason: "Login is required before queued records can sync.",
    };

    const latestOwned = queue.filter(
      (candidate) => candidate.ownerUserId === ownerUserId,
    );
    await replaceOwnedQueue(
      queue,
      ownerUserId,
      latestOwned.map((candidate) =>
        candidate.id === queueId
          ? {
              ...candidate,
              status: "failed",
              attempts: candidate.attempts + 1,
              updatedAt: new Date().toISOString(),
              lastError: issue.reason,
            }
          : candidate,
      ),
    );

    return {
      synced: 0,
      remaining: latestOwned.length,
      skipped: 0,
      failed: 1,
      issues: [issue],
    };
  }

  const result = await syncQueueItem(item);
  const latestQueue = await readQueue();
  const latestOwned = latestQueue.filter(
    (candidate) => candidate.ownerUserId === ownerUserId,
  );
  const remaining = result.synced
    ? latestOwned.filter((candidate) => candidate.id !== queueId)
    : latestOwned.map((candidate) =>
        candidate.id === queueId && result.item
          ? result.item
          : candidate,
      );

  await replaceOwnedQueue(
    latestQueue,
    ownerUserId,
    remaining,
  );

  return {
    synced: result.synced ? 1 : 0,
    remaining: remaining.length,
    skipped: 0,
    failed: result.synced ? 0 : 1,
    issues: result.issue ? [result.issue] : [],
  };
}

async function runQueuedCasualtySync(): Promise<QueueSyncResult> {
  const { all: queue, owned, ownerUserId } =
    await getQueueScope();
  const token = await getAccessToken();

  if (!token || !ownerUserId || owned.length === 0) {
    if (!token && ownerUserId && owned.length > 0) {
      const now = new Date().toISOString();
      const reason =
        "Login is required before queued records can sync.";

      await replaceOwnedQueue(
        queue,
        ownerUserId,
        owned.map((item) => ({
          ...item,
          status: "failed",
          attempts: item.attempts + 1,
          updatedAt: now,
          lastError: reason,
        })),
      );
    }

    return {
      synced: 0,
      remaining: owned.length,
      skipped: owned.length,
      failed: !token && ownerUserId ? owned.length : 0,
      issues: !token && ownerUserId && owned.length > 0
        ? owned.map((item) => ({
            queueId: item.id,
            reason: "Login is required before queued records can sync.",
          }))
        : [],
    };
  }

  const now = new Date().toISOString();
  await replaceOwnedQueue(
    queue,
    ownerUserId,
    owned.map((item) => ({
      ...item,
      status: "syncing",
      updatedAt: now,
      lastError: undefined,
    })),
  );

  const results = await syncQueueItemsConcurrently(owned);
  const remaining: QueuedCasualtySubmission[] = [];
  const issues: QueueSyncIssue[] = [];
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const result of results) {
    if (result.synced) {
      synced += 1;
      continue;
    }

    failed += 1;

    if (result.issue) {
      issues.push(result.issue);
      if (
        result.issue.reason ===
        "Queued victim has no selected incident."
      ) {
        skipped += 1;
      }
    }

    if (result.item) {
      remaining.push(result.item);
    }
  }

  await replaceOwnedQueue(queue, ownerUserId, remaining);

  return {
    synced,
    remaining: remaining.length,
    skipped,
    failed,
    issues,
  };
}

export async function syncQueuedCasualtySubmissions(): Promise<QueueSyncResult> {
  if (!syncAllQueuePromise) {
    syncAllQueuePromise = runQueuedCasualtySync().finally(() => {
      syncAllQueuePromise = null;
    });
  }

  return syncAllQueuePromise;
}
