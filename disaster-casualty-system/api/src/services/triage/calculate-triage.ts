import type {
  AppendixAssessmentAnswers,
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

function categoryFromFinalTriageColor(
  color: unknown,
): TriageCategory | null {
  switch (color) {
    case "red":
      return "immediate";
    case "yellow":
      return "delayed";
    case "green":
      return "minimal";
    case "black":
      return "expectant";
    default:
      return null;
  }
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

  if (readBoolean(answers, "lowSurvivalComplexTreatment") === true) {
    return "expectant";
  }

  if (readBoolean(answers, "lifeSavingSurgeryHighSurvival") === true) {
    return "immediate";
  }

  if (readBoolean(answers, "delayedSurgeryPermitted") === true) {
    return "delayed";
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
    respirations === "more_than_29"
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
    readBoolean(answers, "likelyToSurviveGivenResources") === false
  ) {
    return "expectant";
  }

  if (
    readBoolean(answers, "breathing") === true &&
    readBoolean(answers, "obeysCommandsOrPurposefulMovement") === true &&
    readBoolean(answers, "hasPeripheralPulse") === true &&
    readBoolean(answers, "respiratoryDistress") === false &&
    readBoolean(answers, "majorHemorrhageControlled") === true &&
    readBoolean(answers, "minorInjuriesOnly") === true
  ) {
    return "minimal";
  }

  if (
    readBoolean(answers, "breathing") === false ||
    readBoolean(answers, "obeysCommandsOrPurposefulMovement") === false ||
    readBoolean(answers, "hasPeripheralPulse") === false ||
    readBoolean(answers, "respiratoryDistress") === true ||
    readBoolean(answers, "majorHemorrhageControlled") === false
  ) {
    return "immediate";
  }

  return "delayed";
}

export function calculateTriageCategory(
  triageSystem: TriageSystem,
  assessmentAnswers: Record<string, unknown>,
): TriageCategory {
  const finalTriageCategory = categoryFromFinalTriageColor(
    (assessmentAnswers as AppendixAssessmentAnswers).finalTriage,
  );

  if (finalTriageCategory) {
    return finalTriageCategory;
  }

  switch (triageSystem) {
    case "start":
      return calculateStartTriage(
        assessmentAnswers as unknown as StartAssessmentAnswers,
      );

    case "nato":
      return calculateNatoTriage(assessmentAnswers);

    case "sieve":
    case "sieve_sort":
      return calculateSieveTriage(assessmentAnswers);

    case "care_flight":
      return calculateCareFlightTriage(assessmentAnswers);

    case "salt":
      return calculateSaltTriage(assessmentAnswers);

    case "sort":
    case "smart":
    case "mass":
    case "urgent_non_urgent":
    case "ed_triage":
    case "other":
      return "unknown";

    default:
      throw new Error("Unsupported triage system.");
  }
}
