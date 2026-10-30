import assert from "node:assert/strict";

import {
  isSubmittedTriageModeAllowed,
  normalizeIncidentTriageMode,
} from "./incident-triage-mode.js";

assert.equal(normalizeIncidentTriageMode("assisted"), "assisted");
assert.equal(normalizeIncidentTriageMode("unassisted"), "unassisted");
assert.equal(normalizeIncidentTriageMode("both"), "both");
assert.equal(normalizeIncidentTriageMode("unexpected"), "assisted");

assert.equal(isSubmittedTriageModeAllowed("assisted", "assisted"), true);
assert.equal(isSubmittedTriageModeAllowed("assisted", "unassisted"), false);
assert.equal(isSubmittedTriageModeAllowed("unassisted", "unassisted"), true);
assert.equal(isSubmittedTriageModeAllowed("unassisted", "assisted"), false);
assert.equal(isSubmittedTriageModeAllowed("both", "assisted"), true);
assert.equal(isSubmittedTriageModeAllowed("both", "unassisted"), true);
assert.equal(isSubmittedTriageModeAllowed("both", null), false);

console.log("Incident triage mode tests passed.");
