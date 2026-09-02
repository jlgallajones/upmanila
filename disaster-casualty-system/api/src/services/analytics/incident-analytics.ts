export type AnalyticsEventRow = {
  casualty_incident_id: string;
  occurred_at: string | null;
};

export type AnalyticsIntervalRow = {
  minutes: number;
  label: string;
  cutoffAt: string | null;
  count: number;
  total: number;
  percentage: number;
};

export type TimelineItem = {
  at: string | null | undefined;
};

export type TimelineItemWithElapsed<T extends TimelineItem> = T & {
  elapsedSincePreviousMinutes: number | null;
  elapsedSinceActivationMinutes: number | null;
};

function calculatePercentage(numerator: number, denominator: number): number {
  return denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(2))
    : 0;
}

function minutesBetween(start: string, end: string): number | null {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / 60000),
  );
}

export function dedupeEarliestEventRows(
  rows: AnalyticsEventRow[],
): AnalyticsEventRow[] {
  const earliestByCasualty = new Map<string, string>();

  for (const row of rows) {
    if (!row.occurred_at) {
      continue;
    }

    const occurredAt = new Date(row.occurred_at);

    if (Number.isNaN(occurredAt.getTime())) {
      continue;
    }

    const existing = earliestByCasualty.get(row.casualty_incident_id);

    if (!existing || occurredAt < new Date(existing)) {
      earliestByCasualty.set(
        row.casualty_incident_id,
        occurredAt.toISOString(),
      );
    }
  }

  return Array.from(earliestByCasualty.entries()).map(
    ([casualty_incident_id, occurred_at]) => ({
      casualty_incident_id,
      occurred_at,
    }),
  );
}

export function buildCumulativeIntervalRows({
  rows,
  activationAt,
  intervalMinutes,
  denominator,
}: {
  rows: AnalyticsEventRow[];
  activationAt: string | null;
  intervalMinutes: number[];
  denominator: number;
}): AnalyticsIntervalRow[] {
  const activationDate = activationAt ? new Date(activationAt) : null;
  const hasActivationDate =
    activationDate !== null && !Number.isNaN(activationDate.getTime());

  return intervalMinutes.map((minutes) => {
    const cutoff = hasActivationDate
      ? new Date(activationDate.getTime() + minutes * 60 * 1000)
      : null;
    const count =
      cutoff === null
        ? 0
        : rows.filter((row) => {
            if (!row.occurred_at) {
              return false;
            }

            const occurredAt = new Date(row.occurred_at);

            return (
              !Number.isNaN(occurredAt.getTime()) && occurredAt <= cutoff
            );
          }).length;
    const boundedCount = Math.min(count, denominator);

    return {
      minutes,
      label: minutes === 60 ? "1 hour" : `${minutes} minutes`,
      cutoffAt: cutoff?.toISOString() ?? null,
      count: boundedCount,
      total: denominator,
      percentage: Math.min(
        100,
        calculatePercentage(boundedCount, denominator),
      ),
    };
  });
}

export function addTimelineElapsedMetrics<T extends TimelineItem>(
  items: T[],
  activationAt: string | null,
): Array<TimelineItemWithElapsed<T>> {
  return items.map((item, index) => {
    const previousTimedEvent = items
      .slice(0, index)
      .reverse()
      .find((previous) => previous.at);

    return {
      ...item,
      elapsedSincePreviousMinutes:
        item.at && previousTimedEvent?.at
          ? minutesBetween(previousTimedEvent.at, item.at)
          : null,
      elapsedSinceActivationMinutes:
        item.at && activationAt ? minutesBetween(activationAt, item.at) : null,
    };
  });
}
