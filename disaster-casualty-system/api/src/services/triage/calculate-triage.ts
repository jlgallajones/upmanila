import type {
  StartAssessmentAnswers,
  TriageCategory,
  TriageSystem,
} from "../../types/triage.types.js";

import { calculateStartTriage } from "./start.service.js";

function readString(
  answers: Record<string, unknown>,
  key: string,
): string | null {
  const value = answers[key];

  return typeof value === "string" ? value : null;
}

function readBoolean(
  answers: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = answers[key];

  return typeof value === "boolean" ? value : null;
}

function readNumber(
  answers: Record<string, unknown>,
  key: string,
): number | null {
  const value = answers[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function scoreSortValue(
  value: string | null,
  scores: Record<string, number>,
): number | null {
  return value ? scores[value] ?? null : null;
}

function calculateStieveTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readBoolean(answers, "catastrophicHemorrhage") === true ||
    readBoolean(answers, "suckingChestWound") === true
  ) {
    return "immediate";
  }

  if (
    readBoolean(answers, "canWalkOrNoVisibleInjuries") === true &&
    readBoolean(answers, "specialPopulation") !== true
  ) {
    return "minimal";
  }

  if (readString(answers, "respirations") === "absent") {
    return readBoolean(answers, "breathingAfterAirwayManagement") === true
      ? "immediate"
      : "expectant";
  }

  if (
    readString(answers, "respirations") === "less_than_10" ||
    readString(answers, "respirations") === "more_than_30"
  ) {
    return "immediate";
  }

  if (
    readString(answers, "pulse") === "absent" ||
    readString(answers, "pulse") === "weak" ||
    readString(answers, "capillaryRefill") === "more_than_2_seconds" ||
    readBoolean(answers, "followsSimpleCommands") === false
  ) {
    return "immediate";
  }

  return readString(answers, "respirations") ? "delayed" : "unknown";
}

function calculateNatoTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readBoolean(answers, "canWalk") === true ||
    readBoolean(answers, "minorSelfCare") === true
  ) {
    return "minimal";
  }

  if (readBoolean(answers, "lifeSavingSurgeryHighSurvival") === true) {
    return "immediate";
  }

  if (readBoolean(answers, "delayedSurgeryPermitted") === true) {
    return "delayed";
  }

  if (readBoolean(answers, "lowSurvivalComplexTreatment") === true) {
    return "expectant";
  }

  return "unknown";
}

function calculateMstartTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (
    readBoolean(answers, "spontaneousBreathing") === false ||
    readString(answers, "respirations") === "absent"
  ) {
    return readBoolean(answers, "breathingAfterAirwayManagement") === true
      ? "immediate"
      : "expectant";
  }

  if (readString(answers, "respirations") === "more_than_30") {
    return "immediate";
  }

  if (
    readString(answers, "radialPulse") === "absent" ||
    readBoolean(answers, "followsSimpleCommands") === false
  ) {
    return "immediate";
  }

  return readString(answers, "respirations") ? "delayed" : "unknown";
}

function calculateJumpstartTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (
    readBoolean(answers, "spontaneousBreathing") === false ||
    readString(answers, "respirations") === "absent"
  ) {
    if (readBoolean(answers, "breathingAfterAirwayManagement") === true) {
      return "immediate";
    }

    if (readBoolean(answers, "palpablePulseAfterAirwayManagement") === false) {
      return "expectant";
    }

    return readBoolean(answers, "breathingAfterRescueBreaths") === true
      ? "immediate"
      : "expectant";
  }

  const respirations = readString(answers, "respirations");

  if (
    respirations === "less_than_15" ||
    respirations === "more_than_45" ||
    readString(answers, "radialPulse") === "absent" ||
    readString(answers, "mentalStatus") === "painful" ||
    readString(answers, "mentalStatus") === "unresponsive"
  ) {
    return "immediate";
  }

  return respirations ? "delayed" : "unknown";
}

function calculateSieveTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readBoolean(answers, "canWalk") === true) {
    return readString(answers, "injury") === "present" ? "delayed" : "minimal";
  }

  const respirations = readString(answers, "respirations");

  if (respirations === "absent") {
    return readBoolean(answers, "breathingAfterAirwayManagement") === true
      ? "immediate"
      : "expectant";
  }

  if (
    respirations === "less_than_10" ||
    respirations === "less_than_or_equal_to_10" ||
    respirations === "more_than_29" ||
    respirations === "more_than_or_equal_to_30"
  ) {
    return "immediate";
  }

  if (readString(answers, "heartRate") === "more_than_120") {
    return "immediate";
  }

  if (readString(answers, "capillaryRefill") === "more_than_2_seconds") {
    return "immediate";
  }

  return respirations ? "delayed" : "unknown";
}

function calculateSortTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  const gcsScore = scoreSortValue(readString(answers, "gcs"), {
    "13_to_15": 4,
    "9_to_12": 3,
    "6_to_8": 2,
    "4_to_5": 1,
    "3": 0,
  });
  const respiratoryRateScore = scoreSortValue(
    readString(answers, "respiratoryRate"),
    {
      "10_to_29": 4,
      "more_than_29": 3,
      "more_than_or_equal_to_30": 3,
      "6_to_9": 2,
      "1_to_5": 1,
      "0": 0,
    },
  );
  const systolicBpScore = scoreSortValue(
    readString(answers, "systolicBp"),
    {
      "more_than_80": 4,
      "more_than_89": 4,
      "more_than_or_equal_to_90": 4,
      "76_to_80": 3,
      "76_to_89": 3,
      "50_to_75": 2,
      "1_to_49": 1,
      "0": 0,
    },
  );

  if (
    gcsScore === null ||
    respiratoryRateScore === null ||
    systolicBpScore === null
  ) {
    return "unknown";
  }

  const totalScore = gcsScore + respiratoryRateScore + systolicBpScore;

  if (totalScore === 0) {
    return "expectant";
  }

  if (totalScore <= 10) {
    return "immediate";
  }

  if (totalScore === 11) {
    return "delayed";
  }

  return "minimal";
}

function calculateSaveTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  switch (readString(answers, "saveCategory")) {
    case "immediate_intervention_to_live":
      return "immediate";
    case "brief_delay_tolerated":
      return "delayed";
    case "no_life_or_limb_intervention_needed":
      return "minimal";
    case "dead_unsalvageable":
      return "expectant";
    default:
      return "unknown";
  }
}

function calculateMetaTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readBoolean(answers, "airwayRisk") === true ||
    readBoolean(answers, "breathingRisk") === true ||
    readBoolean(answers, "circulationRisk") === true
  ) {
    return "immediate";
  }

  if (
    readBoolean(answers, "disabilityRisk") === true ||
    readBoolean(answers, "exposureRisk") === true
  ) {
    return "delayed";
  }

  const answeredKeys = [
    "airwayRisk",
    "breathingRisk",
    "circulationRisk",
    "disabilityRisk",
    "exposureRisk",
  ];
  const allAnswered = answeredKeys.every(
    (key) => readBoolean(answers, key) !== null,
  );

  return allAnswered ? "minimal" : "unknown";
}

function calculateCareFlightTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (readBoolean(answers, "breathingWithOpenAirway") === false) {
    return "expectant";
  }

  if (
    readBoolean(answers, "canObeyCommands") === false ||
    readString(answers, "palpableRadialPulse") === "absent"
  ) {
    return "immediate";
  }

  return readBoolean(answers, "canObeyCommands") === true
    ? "delayed"
    : "unknown";
}

function calculateSaltTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readBoolean(answers, "canWalk") === true ||
    readBoolean(answers, "canWave") === true
  ) {
    return "minimal";
  }

  if (
    readBoolean(answers, "breathing") === false ||
    readString(answers, "respirations") === "absent"
  ) {
    return readBoolean(answers, "breathingAfterAirwayManagement") === true
      ? "immediate"
      : "expectant";
  }

  const stable =
    readBoolean(answers, "breathing") === true &&
    readBoolean(answers, "obeysCommandsOrPurposefulMovement") === true &&
    readBoolean(answers, "hasPeripheralPulse") === true &&
    readBoolean(answers, "respiratoryDistress") === false &&
    readBoolean(answers, "majorHemorrhageControlled") === true;

  if (
    !stable &&
    readBoolean(answers, "likelyToSurviveGivenResources") === false
  ) {
    return "expectant";
  }

  if (!stable) {
    return readBoolean(answers, "likelyToSurviveGivenResources") === true
      ? "immediate"
      : "unknown";
  }

  if (readBoolean(answers, "minorInjuriesOnly") === true) {
    return "minimal";
  }

  if (readBoolean(answers, "minorInjuriesOnly") === false) {
    return "delayed";
  }

  return "unknown";
}

function getPttNormalRanges(
  height: string | null,
): { minRespiratoryRate: number; maxRespiratoryRate: number; minPulseRate: number; maxPulseRate: number } | null {
  switch (height) {
    case "40_to_80_cm":
      return {
        minRespiratoryRate: 20,
        maxRespiratoryRate: 50,
        minPulseRate: 90,
        maxPulseRate: 180,
      };
    case "80_to_100_cm":
      return {
        minRespiratoryRate: 15,
        maxRespiratoryRate: 40,
        minPulseRate: 80,
        maxPulseRate: 160,
      };
    case "100_to_140_cm":
      return {
        minRespiratoryRate: 10,
        maxRespiratoryRate: 30,
        minPulseRate: 70,
        maxPulseRate: 140,
      };
    default:
      return null;
  }
}

function calculatePttTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readBoolean(answers, "spontaneousBreathing") === false &&
    readBoolean(answers, "breathingAfterAirwayManagement") !== true
  ) {
    return "expectant";
  }

  if (readBoolean(answers, "breathingAfterAirwayManagement") === true) {
    return "immediate";
  }

  if (readBoolean(answers, "alertAndMovingAllLimbs") === false) {
    return "immediate";
  }

  const ranges = getPttNormalRanges(readString(answers, "height"));
  const respiratoryRate = readNumber(answers, "pttRespiratoryRate");
  const pulseRate = readNumber(answers, "pttPulseRate");

  if (!ranges || respiratoryRate === null || pulseRate === null) {
    return "unknown";
  }

  if (
    respiratoryRate < ranges.minRespiratoryRate ||
    respiratoryRate > ranges.maxRespiratoryRate ||
    pulseRate < ranges.minPulseRate ||
    pulseRate > ranges.maxPulseRate ||
    readString(answers, "capillaryRefill") === "more_than_2_seconds"
  ) {
    return "immediate";
  }

  return readBoolean(answers, "alertAndMovingAllLimbs") === true
    ? "minimal"
    : "delayed";
}

function calculateMittTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readBoolean(answers, "catastrophicHemorrhage") === true) {
    return "immediate";
  }

  if (readBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (
    readBoolean(answers, "spontaneousBreathing") === false ||
    readString(answers, "respirations") === "absent"
  ) {
    return "expectant";
  }

  if (
    readBoolean(answers, "respondsToVoice") === false ||
    readString(answers, "respirations") === "less_than_12" ||
    readString(answers, "respirations") === "more_than_23" ||
    readString(answers, "heartRate") === "absent" ||
    readString(answers, "heartRate") === "more_than_100"
  ) {
    return "immediate";
  }

  return readString(answers, "respirations") ? "delayed" : "unknown";
}

function calculateMassTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readBoolean(answers, "lifeSavingInterventionPerformed") === true) {
    return "immediate";
  }

  if (readBoolean(answers, "breathing") === false) {
    return "expectant";
  }

  const stable =
    readBoolean(answers, "breathing") === true &&
    readBoolean(answers, "obeysCommands") === true &&
    readBoolean(answers, "breathingNormally") === true &&
    readBoolean(answers, "purposefulMovements") === true &&
    readBoolean(answers, "majorBleedingControlled") === true &&
    readString(answers, "radialPulse") === "present";

  if (!stable) {
    return readBoolean(answers, "likelyToSurviveGivenResources") === false
      ? "expectant"
      : readBoolean(answers, "likelyToSurviveGivenResources") === true
        ? "immediate"
        : "unknown";
  }

  if (readBoolean(answers, "minorInjuriesOnly") === true) {
    return "minimal";
  }

  if (readBoolean(answers, "minorInjuriesOnly") === false) {
    return "delayed";
  }

  return "unknown";
}

function calculateUrgentNonUrgentTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  const urgent = readBoolean(answers, "urgent");

  if (urgent === true) {
    return "immediate";
  }

  if (urgent === false) {
    return "minimal";
  }

  return "unknown";
}

function calculateSmartTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readBoolean(answers, "walking") === true) {
    return "minimal";
  }

  const breathing = readBoolean(answers, "breathing");

  if (breathing === false) {
    return "expectant";
  }

  if (
    readBoolean(answers, "obeysCommandsOrPurposefulMovement") === false ||
    readBoolean(answers, "hasPeripheralPulse") === false
  ) {
    return "immediate";
  }

  return breathing === true ? "delayed" : "unknown";
}

export function calculateTriageCategory(
  triageSystem: TriageSystem,
  assessmentAnswers: Record<string, unknown>,
): TriageCategory {
  const { finalTriage: _ignoredFinalTriage, ...algorithmAnswers } =
    assessmentAnswers;

  switch (triageSystem) {
    case "start":
      return calculateStartTriage(
        algorithmAnswers as unknown as StartAssessmentAnswers,
      );

    case "stieve":
      return calculateStieveTriage(algorithmAnswers);

    case "mstart":
      return calculateMstartTriage(algorithmAnswers);

    case "jumpstart":
      return calculateJumpstartTriage(algorithmAnswers);

    case "nato":
      return calculateNatoTriage(algorithmAnswers);

    case "sieve":
    case "sieve_sort":
      return calculateSieveTriage(algorithmAnswers);

    case "care_flight":
      return calculateCareFlightTriage(algorithmAnswers);

    case "salt":
      return calculateSaltTriage(algorithmAnswers);

    case "ptt":
      return calculatePttTriage(algorithmAnswers);

    case "mitt":
    case "mptt":
      return calculateMittTriage(algorithmAnswers);

    case "homebush":
      return calculateStartTriage(
        algorithmAnswers as unknown as StartAssessmentAnswers,
      );

    case "sort":
    case "rts":
      return calculateSortTriage(algorithmAnswers);

    case "save":
      return calculateSaveTriage(algorithmAnswers);

    case "meta":
      return calculateMetaTriage(algorithmAnswers);

    case "mass":
      return calculateMassTriage(algorithmAnswers);

    case "esi":
    case "metts":
      return "unknown";

    case "urgent_non_urgent":
      return calculateUrgentNonUrgentTriage(algorithmAnswers);

    case "smart":
      return calculateSmartTriage(algorithmAnswers);

    case "ed_triage":
    case "stm":
    case "swift":
    case "other":
      return "unknown";

    default:
      throw new Error("Unsupported triage system.");
  }
}
