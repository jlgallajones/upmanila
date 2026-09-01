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

function formatCasualtyIdDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${month}${day}${year}`;
}

function createRetryIdNumber(
  originalIdNumber: string | undefined,
  increment: number,
): string {
  const match = /^CAS:(\d{6}):([A-Z0-9]+?)(\d{3,})$/i.exec(
    originalIdNumber ?? "",
  );

  if (match) {
    const [, dateCode, userCode, sequenceText] = match;
    const nextSequence = Number(sequenceText) + increment;

    return `CAS:${dateCode}:${userCode.toUpperCase()}${String(
      nextSequence,
    ).padStart(3, "0")}`;
  }

  const fallbackSequence = String(increment).padStart(3, "0");

  return `CAS:${formatCasualtyIdDate()}:USR${fallbackSequence}`;
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

function isDuplicateIdNumberError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("id number") &&
    message.includes("already exists")
  );
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

      if (isDuplicateIdNumberError(error)) {
        let retryError: unknown = error;

        for (let retryCount = 1; retryCount <= 25; retryCount += 1) {
          try {
            await createCasualty({
              ...item.payload,
              incidentId: item.payload.incidentId,
              person: {
                ...item.payload.person,
                idNumber: createRetryIdNumber(
                  item.payload.person.idNumber,
                  retryCount,
                ),
              },
            });
            synced += 1;
            retryError = null;
            break;
          } catch (nextError) {
            retryError = nextError;

            if (!isDuplicateIdNumberError(nextError)) {
              break;
            }
          }
        }

        if (retryError === null) {
          continue;
        }

        failed += 1;
        issues.push({
          queueId: item.id,
          reason: getErrorMessage(retryError),
        });
        remaining.push(item);
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
