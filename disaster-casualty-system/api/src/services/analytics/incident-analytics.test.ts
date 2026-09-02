import assert from "node:assert/strict";

import {
  addTimelineElapsedMetrics,
  buildCumulativeIntervalRows,
  dedupeEarliestEventRows,
} from "./incident-analytics.js";

const activationAt = "2026-08-19T10:00:00.000Z";
const intervals = [1, 5, 10, 15, 30, 60];

const dedupedRows = dedupeEarliestEventRows([
  {
    casualty_incident_id: "cas-1",
    occurred_at: "2026-08-19T10:04:00.000Z",
  },
  {
    casualty_incident_id: "cas-1",
    occurred_at: "2026-08-19T10:02:00.000Z",
  },
  {
    casualty_incident_id: "cas-2",
    occurred_at: "2026-08-19T10:11:00.000Z",
  },
  {
    casualty_incident_id: "cas-3",
    occurred_at: "2026-08-19T11:02:00.000Z",
  },
  {
    casualty_incident_id: "cas-4",
    occurred_at: null,
  },
]);

assert.deepEqual(dedupedRows, [
  {
    casualty_incident_id: "cas-1",
    occurred_at: "2026-08-19T10:02:00.000Z",
  },
  {
    casualty_incident_id: "cas-2",
    occurred_at: "2026-08-19T10:11:00.000Z",
  },
  {
    casualty_incident_id: "cas-3",
    occurred_at: "2026-08-19T11:02:00.000Z",
  },
]);

const intervalRows = buildCumulativeIntervalRows({
  rows: dedupedRows,
  activationAt,
  intervalMinutes: intervals,
  denominator: 2,
});

assert.deepEqual(
  intervalRows.map((row) => row.count),
  [0, 1, 1, 2, 2, 2],
);
assert.deepEqual(
  intervalRows.map((row) => row.percentage),
  [0, 50, 50, 100, 100, 100],
);
assert.equal(intervalRows.at(-1)?.percentage, 100);

const missingActivationRows = buildCumulativeIntervalRows({
  rows: dedupedRows,
  activationAt: null,
  intervalMinutes: intervals,
  denominator: 2,
});

assert.deepEqual(
  missingActivationRows.map((row) => row.count),
  [0, 0, 0, 0, 0, 0],
);
assert.ok(missingActivationRows.every((row) => row.cutoffAt === null));

const timeline = addTimelineElapsedMetrics(
  [
    { key: "incidentOnset", at: "2026-08-19T09:55:00.000Z" },
    { key: "dmmpActivation", at: activationAt },
    { key: "triageInitiated", at: "2026-08-19T10:07:00.000Z" },
    { key: "missing", at: null },
  ],
  activationAt,
);

assert.equal(timeline[0]?.elapsedSincePreviousMinutes, null);
assert.equal(timeline[0]?.elapsedSinceActivationMinutes, 0);
assert.equal(timeline[2]?.elapsedSincePreviousMinutes, 7);
assert.equal(timeline[2]?.elapsedSinceActivationMinutes, 7);
assert.equal(timeline[3]?.elapsedSincePreviousMinutes, null);
assert.equal(timeline[3]?.elapsedSinceActivationMinutes, null);

console.log("Incident analytics calculation tests passed.");
