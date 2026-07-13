import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createCasualty,
  type CreateCasualtyPayload,
} from "../api/casualties";

const queueKey = "dcms.offlineCasualtyQueue";

type QueuedCasualtySubmission = {
  id: string;
  payload: CreateCasualtyPayload;
  createdAt: string;
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

export async function queueCasualtySubmission(
  payload: CreateCasualtyPayload,
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

export async function syncQueuedCasualtySubmissions(): Promise<{
  synced: number;
  remaining: number;
}> {
  const queue = await readQueue();
  const remaining: QueuedCasualtySubmission[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await createCasualty(item.payload);
      synced += 1;
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);

  return {
    synced,
    remaining: remaining.length,
  };
}
