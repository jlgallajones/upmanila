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

function scoreSortValue(
  value: string | null,
  scores: Record<string, number>,
): number | null {
  return value ? scores[value] ?? null : null;
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

function calculateSieveTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  const respirations = readString(answers, "respirations");

  if (respirations === "absent") {
    return "expectant";
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
  if (readBoolean(answers, "breathing") === false) {
    return "expectant";
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

    case "nato":
      return calculateNatoTriage(algorithmAnswers);

    case "sieve":
    case "sieve_sort":
      return calculateSieveTriage(algorithmAnswers);

    case "care_flight":
      return calculateCareFlightTriage(algorithmAnswers);

    case "salt":
      return calculateSaltTriage(algorithmAnswers);

    case "sort":
    case "rts":
      return calculateSortTriage(algorithmAnswers);

    case "mass":
      return calculateMassTriage(algorithmAnswers);

    case "urgent_non_urgent":
      return calculateUrgentNonUrgentTriage(algorithmAnswers);

    case "smart":
      return calculateSmartTriage(algorithmAnswers);

    case "ed_triage":
    case "other":
      return "unknown";

    default:
      throw new Error("Unsupported triage system.");
  }
}
