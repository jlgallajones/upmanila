import assert from "node:assert/strict";

import { classifyMortalityOutcome } from "./mortality.js";

assert.equal(
  classifyMortalityOutcome({
    medical_contact_before_death: false,
    reached_hospital: false,
    death_stage: "prehospital",
  }),
  "impact",
);

assert.equal(
  classifyMortalityOutcome({
    medical_contact_before_death: true,
    reached_hospital: false,
    death_stage: "prehospital",
  }),
  "prehospital",
);

assert.equal(
  classifyMortalityOutcome({
    medical_contact_before_death: true,
    reached_hospital: true,
    death_stage: "prehospital",
  }),
  "in_hospital",
);

assert.equal(
  classifyMortalityOutcome({
    medical_contact_before_death: null,
    reached_hospital: false,
    death_stage: "prehospital",
  }),
  null,
);

assert.equal(
  classifyMortalityOutcome(
    null,
    {
      arrived_at: "2026-11-06T09:00:00.000Z",
      disposition: "deceased",
    },
  ),
  "in_hospital",
);

assert.equal(
  classifyMortalityOutcome(
    {
      medical_contact_before_death: false,
      reached_hospital: false,
      death_stage: "impact",
    },
    {
      hospital_admitted_at: "2026-11-06T09:15:00.000Z",
      disposition: "deceased",
    },
  ),
  "in_hospital",
);

console.log("Mortality classification tests passed.");
