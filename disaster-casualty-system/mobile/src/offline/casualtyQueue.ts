import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createCasualty,
  type CreateCasualtyPayload,
} from "../api/casualties";
import { uploadAttachment } from "../api/attachments";
import { getAccessToken } from "../auth/session";

const queueKey = "dcms.offlineCasualtyQueue";

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

export type QueuedCasualtySyncStatus =
  | "pending"
  | "syncing"
  | "failed";

export type QueuedCasualtySubmission = {
  id: string;
  payload: QueuedCasualtyPayload;
  createdAt: string;
  updatedAt: string;
  status: QueuedCasualtySyncStatus;
  attempts: number;
  lastError?: string;
  attachments?: QueuedCasualtyAttachment[];
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
    payload: item.payload,
    createdAt,
    updatedAt: item.updatedAt ?? createdAt,
    status,
    attempts: item.attempts ?? 0,
    lastError: item.lastError,
    attachments: Array.isArray(item.attachments)
      ? item.attachments
      : [],
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

export async function queueCasualtySubmission(
  payload: QueuedCasualtyPayload,
  options: { attachments?: QueuedCasualtyAttachment[] } = {},
): Promise<void> {
  const queue = await readQueue();
  const now = new Date().toISOString();

  await writeQueue([
    ...queue,
    {
      id: createQueueId(),
      payload,
      createdAt: now,
      updatedAt: now,
      status: "pending",
      attempts: 0,
      attachments: options.attachments ?? [],
    },
  ]);
}

export async function getQueuedCasualtyCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function getQueuedCasualtySubmissions(): Promise<
  QueuedCasualtySubmission[]
> {
  return readQueue();
}

export async function assignQueuedCasualtyIncident(
  queueId: string,
  incident: { id: string; name: string },
): Promise<void> {
  const queue = await readQueue();
  const now = new Date().toISOString();

  await writeQueue(
    queue.map((item) =>
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

async function markQueueItemSyncing(
  queueId: string,
): Promise<void> {
  const queue = await readQueue();
  const now = new Date().toISOString();

  await writeQueue(
    queue.map((item) =>
      item.id === queueId
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
        lastError: "Queued casualty has no selected incident.",
      },
      issue: {
        queueId: item.id,
        reason: "Queued casualty has no selected incident.",
      },
    };
  }

  let casualtyIncidentId = item.syncedCasualtyIncidentId;

  try {
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

export async function retryQueuedCasualtySubmission(
  queueId: string,
): Promise<QueueSyncResult> {
  await markQueueItemSyncing(queueId);

  const queue = await readQueue();
  const token = await getAccessToken();
  const item = queue.find((candidate) => candidate.id === queueId);

  if (!item) {
    return {
      synced: 0,
      remaining: queue.length,
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

    await writeQueue(
      queue.map((candidate) =>
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
      remaining: queue.length,
      skipped: 0,
      failed: 1,
      issues: [issue],
    };
  }

  const result = await syncQueueItem(item);
  const latestQueue = await readQueue();
  const remaining = result.synced
    ? latestQueue.filter((candidate) => candidate.id !== queueId)
    : latestQueue.map((candidate) =>
        candidate.id === queueId && result.item
          ? result.item
          : candidate,
      );

  await writeQueue(remaining);

  return {
    synced: result.synced ? 1 : 0,
    remaining: remaining.length,
    skipped: 0,
    failed: result.synced ? 0 : 1,
    issues: result.issue ? [result.issue] : [],
  };
}

export async function syncQueuedCasualtySubmissions(): Promise<{
  synced: number;
  remaining: number;
  skipped: number;
  failed: number;
  issues: QueueSyncIssue[];
}> {
  const queue = await readQueue();
  const token = await getAccessToken();

  if (!token || queue.length === 0) {
    if (!token && queue.length > 0) {
      const now = new Date().toISOString();
      const reason =
        "Login is required before queued records can sync.";

      await writeQueue(
        queue.map((item) => ({
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
      remaining: queue.length,
      skipped: queue.length,
      failed: !token ? queue.length : 0,
      issues: !token && queue.length > 0
        ? queue.map((item) => ({
            queueId: item.id,
            reason: "Login is required before queued records can sync.",
          }))
        : [],
    };
  }

  const remaining: QueuedCasualtySubmission[] = [];
  const issues: QueueSyncIssue[] = [];
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of queue) {
    if (!item.payload.incidentId) {
      skipped += 1;
      failed += 1;
      const reason = "Queued casualty has no selected incident.";
      issues.push({
        queueId: item.id,
        reason,
      });
      remaining.push({
        ...item,
        status: "failed",
        attempts: item.attempts + 1,
        updatedAt: new Date().toISOString(),
        lastError: reason,
      });
      continue;
    }

    await markQueueItemSyncing(item.id);
    const result = await syncQueueItem(item);

    if (result.synced) {
      synced += 1;
      continue;
    }

    failed += 1;

    if (result.issue) {
      issues.push(result.issue);
    }

    if (result.item) {
      remaining.push(result.item);
    }
  }

  await writeQueue(remaining);

  return {
    synced,
    remaining: remaining.length,
    skipped,
    failed,
    issues,
  };
}
