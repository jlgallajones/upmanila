import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createCasualty,
  type CreateCasualtyPayload,
} from "../api/casualties";
import { getAccessToken } from "../auth/session";

const queueKey = "dcms.offlineCasualtyQueue";

export type QueuedCasualtyPayload = Omit<
  CreateCasualtyPayload,
  "incidentId"
> & {
  incidentId?: string;
  offlineIncidentName?: string;
};

export type QueuedCasualtySubmission = {
  id: string;
  payload: QueuedCasualtyPayload;
  createdAt: string;
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

async function readQueue(): Promise<QueuedCasualtySubmission[]> {
  const stored = await AsyncStorage.getItem(queueKey);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as QueuedCasualtySubmission[];
    return Array.isArray(parsed) ? parsed : [];
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
): Promise<void> {
  const queue = await readQueue();

  await writeQueue([
    ...queue,
    {
      id: createQueueId(),
      payload,
      createdAt: new Date().toISOString(),
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
    return {
      synced: 0,
      remaining: queue.length,
      skipped: queue.length,
      failed: 0,
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
      issues.push({
        queueId: item.id,
        reason: "Queued casualty has no selected incident.",
      });
      remaining.push(item);
      continue;
    }

    try {
      await createCasualty({
        ...item.payload,
        incidentId: item.payload.incidentId,
      });
      synced += 1;
    } catch (error) {
      if (isAlreadySynchronizedError(error)) {
        synced += 1;
        continue;
      }

      failed += 1;
      issues.push({
        queueId: item.id,
        reason: getErrorMessage(error),
      });
      remaining.push(item);
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
