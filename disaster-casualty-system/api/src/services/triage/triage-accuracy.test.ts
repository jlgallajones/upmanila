import assert from "node:assert/strict";

import { buildTriageAccuracySummary } from "./accuracy-summary.js";
import { compareTriageCategories } from "./compare-triage.js";

assert.deepEqual(compareTriageCategories("delayed", "immediate"), {
  matches: false,
  isOverTriage: false,
  isUnderTriage: true,
});

assert.deepEqual(compareTriageCategories("minimal", "delayed"), {
  matches: false,
  isOverTriage: false,
  isUnderTriage: true,
});

assert.deepEqual(compareTriageCategories("immediate", "delayed"), {
  matches: false,
  isOverTriage: true,
  isUnderTriage: false,
});

assert.deepEqual(compareTriageCategories("immediate", "minimal"), {
  matches: false,
  isOverTriage: true,
  isUnderTriage: false,
});

assert.deepEqual(compareTriageCategories("expectant", "immediate"), {
  matches: false,
  isOverTriage: false,
  isUnderTriage: true,
});

assert.deepEqual(compareTriageCategories("immediate", "expectant"), {
  matches: false,
  isOverTriage: true,
  isUnderTriage: false,
});

assert.deepEqual(compareTriageCategories("unknown", "immediate"), {
  matches: false,
  isOverTriage: false,
  isUnderTriage: false,
});

const primarySummary = buildTriageAccuracySummary([
  {
    calculated_category: "immediate",
    responder_category: "delayed",
    triage_category: "delayed",
  },
  {
    calculated_category: "immediate",
    responder_category: "expectant",
    triage_category: "expectant",
  },
  {
    calculated_category: "delayed",
    responder_category: "minimal",
    triage_category: "minimal",
  },
  {
    calculated_category: "delayed",
    responder_category: "immediate",
    triage_category: "immediate",
  },
  {
    calculated_category: "delayed",
    responder_category: "delayed",
    triage_category: "delayed",
  },
  {
    calculated_category: "minimal",
    responder_category: "immediate",
    triage_category: "immediate",
  },
  {
    calculated_category: "minimal",
    responder_category: "delayed",
    triage_category: "delayed",
  },
  {
    calculated_category: "minimal",
    responder_category: "minimal",
    triage_category: "minimal",
  },
  {
    calculated_category: "unknown",
    responder_category: "immediate",
    triage_category: "immediate",
  },
]);

assert.equal(primarySummary.undertriagedT1.numerator, 2);
assert.equal(primarySummary.undertriagedT1.denominator, 2);
assert.equal(primarySummary.undertriagedT1.percentage, 100);
assert.equal(primarySummary.undertriagedT2.numerator, 1);
assert.equal(primarySummary.undertriagedT2.denominator, 3);
assert.equal(primarySummary.undertriagedT2.percentage, 33.33);
assert.equal(primarySummary.overtriagedT2.numerator, 1);
assert.equal(primarySummary.overtriagedT2.denominator, 3);
assert.equal(primarySummary.overtriagedT2.percentage, 33.33);
assert.equal(primarySummary.overtriagedT3.numerator, 2);
assert.equal(primarySummary.overtriagedT3.denominator, 3);
assert.equal(primarySummary.overtriagedT3.percentage, 66.67);

const secondarySummary = buildTriageAccuracySummary([
  {
    calculated_category: "immediate",
    responder_category: "minimal",
    triage_category: "minimal",
  },
  {
    calculated_category: "delayed",
    responder_category: "immediate",
    triage_category: "immediate",
  },
]);

assert.equal(secondarySummary.undertriagedT1.numerator, 1);
assert.equal(secondarySummary.overtriagedT2.numerator, 1);

const tertiarySummary = buildTriageAccuracySummary([
  {
    calculated_category: "minimal",
    responder_category: "delayed",
    triage_category: "delayed",
  },
  {
    calculated_category: "unknown",
    responder_category: "immediate",
    triage_category: "immediate",
  },
]);

assert.equal(tertiarySummary.overtriagedT3.numerator, 1);
assert.equal(tertiarySummary.overtriagedT3.denominator, 1);
assert.equal(tertiarySummary.undertriagedT1.denominator, 0);

console.log("Triage accuracy tests passed.");
