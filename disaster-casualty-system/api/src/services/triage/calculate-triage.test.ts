import assert from "node:assert/strict";

import { calculateTriageCategory } from "./calculate-triage.js";

const cases = [
  {
    name: "START incomplete non-walking assessment remains unknown",
    system: "start",
    answers: {
      canWalk: false,
    },
    expected: "unknown",
  },
  {
    name: "STIEVE catastrophic hemorrhage is immediate",
    system: "stieve",
    answers: {
      specialPopulation: false,
      canWalkOrNoVisibleInjuries: false,
      catastrophicHemorrhage: true,
    },
    expected: "immediate",
  },
  {
    name: "mSTART walking patient is minimal",
    system: "mstart",
    answers: {
      canWalk: true,
    },
    expected: "minimal",
  },
  {
    name: "JumpSTART absent breathing and no pulse is expectant",
    system: "jumpstart",
    answers: {
      canWalk: false,
      spontaneousBreathing: false,
      breathingAfterAirwayManagement: false,
      palpablePulseAfterAirwayManagement: false,
    },
    expected: "expectant",
  },
  {
    name: "PTT abnormal pulse rate is immediate",
    system: "ptt",
    answers: {
      height: "80_to_100_cm",
      alertAndMovingAllLimbs: true,
      spontaneousBreathing: true,
      pttRespiratoryRate: 24,
      capillaryRefill: "less_than_or_equal_to_2_seconds",
      pttPulseRate: 180,
    },
    expected: "immediate",
  },
  {
    name: "MITT walking patient is minimal",
    system: "mitt",
    answers: {
      catastrophicHemorrhage: false,
      canWalk: true,
    },
    expected: "minimal",
  },
  {
    name: "MPTT abnormal respiration is immediate",
    system: "mptt",
    answers: {
      catastrophicHemorrhage: false,
      canWalk: false,
      spontaneousBreathing: true,
      respondsToVoice: true,
      respirations: "more_than_23",
      heartRate: "less_than_100",
    },
    expected: "immediate",
  },
  {
    name: "Homebush follows START-compatible delayed path",
    system: "homebush",
    answers: {
      canWalk: false,
      spontaneousBreathing: true,
      respirations: "less_than_30",
      capillaryRefill: "less_than_or_equal_to_2_seconds",
      radialPulse: "present",
      followsSimpleCommands: true,
    },
    expected: "delayed",
  },
  {
    name: "SAVE immediate intervention maps to immediate",
    system: "save",
    answers: {
      saveCategory: "immediate_intervention_to_live",
    },
    expected: "immediate",
  },
  {
    name: "META airway risk maps to immediate",
    system: "meta",
    answers: {
      airwayRisk: true,
      breathingRisk: false,
      circulationRisk: false,
      disabilityRisk: false,
      exposureRisk: false,
    },
    expected: "immediate",
  },
  {
    name: "META disability-only risk maps to delayed",
    system: "meta",
    answers: {
      airwayRisk: false,
      breathingRisk: false,
      circulationRisk: false,
      disabilityRisk: true,
      exposureRisk: false,
    },
    expected: "delayed",
  },
  {
    name: "SwiFT remains unknown until rule set is provided",
    system: "swift",
    answers: {},
    expected: "unknown",
  },
  {
    name: "NATO life-saving surgery maps to immediate",
    system: "nato",
    answers: {
      canWalk: false,
      minorSelfCare: false,
      lifeSavingSurgeryHighSurvival: true,
    },
    expected: "immediate",
  },
  {
    name: "MASS stable minor injuries map to minimal",
    system: "mass",
    answers: {
      lifeSavingInterventionPerformed: false,
      breathing: true,
      obeysCommands: true,
      breathingNormally: true,
      purposefulMovements: true,
      majorBleedingControlled: true,
      radialPulse: "present",
      minorInjuriesOnly: true,
    },
    expected: "minimal",
  },
  {
    name: "ESI remains unknown because it does not map to T1-T4",
    system: "esi",
    answers: {
      finalTriage: "esi_1",
      requiresImmediateLifeSavingIntervention: true,
    },
    expected: "unknown",
  },
  {
    name: "METTS remains unknown because it does not map cleanly to T1-T4",
    system: "metts",
    answers: {
      airway: "obstructed",
      finalTriage: "orange",
    },
    expected: "unknown",
  },
] as const;

for (const testCase of cases) {
  assert.equal(
    calculateTriageCategory(testCase.system, testCase.answers),
    testCase.expected,
    testCase.name,
  );
}

console.log(`Triage calculation tests passed (${cases.length}).`);
