import type {
  StartAssessmentAnswers,
  TriageCategory,
  TriageSystem,
} from "../../types/triage.types.js";

import { calculateStartTriage } from "./start.service.js";

export function calculateTriageCategory(
  triageSystem: TriageSystem,
  assessmentAnswers: Record<string, unknown>,
): TriageCategory {
  switch (triageSystem) {
    case "start":
      return calculateStartTriage(
        assessmentAnswers as unknown as StartAssessmentAnswers,
      );

    case "nato":
    case "sieve":
    case "sort":
    case "care_flight":
    case "salt":
      throw new Error(
        `${triageSystem.toUpperCase()} triage calculation is not implemented yet.`,
      );

    default:
      throw new Error("Unsupported triage system.");
  }
}