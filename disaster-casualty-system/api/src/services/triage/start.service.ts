import type {
  StartAssessmentAnswers,
  TriageCategory,
} from "../../types/triage.types.js";

export function calculateStartTriage(
  answers: StartAssessmentAnswers,
): TriageCategory {
  // START: Walking patients are classified as minimal/green.
  if (answers.canWalk) {
    return "minimal";
  }

  if (
    answers.spontaneousBreathing === false ||
    answers.respirations === "absent"
  ) {
    if (answers.breathingAfterAirwayManagement === true) {
      return "immediate";
    }

    return "expectant";
  }

  // Non-walking patients must have respiration data.
  if (!answers.respirations) {
    throw new Error(
      "Respiration status is required when the patient cannot walk.",
    );
  }

  // Respiratory rate greater than 30.
  if (answers.respirations === "more_than_30") {
    return "immediate";
  }

  // Respirations are 30 or below, so circulation is assessed.
  if (!answers.capillaryRefill) {
    throw new Error(
      "Capillary refill is required when respirations are 30 or below.",
    );
  }

  if (answers.capillaryRefill === "more_than_2_seconds") {
    return "immediate";
  }

  if (answers.radialPulse === "absent") {
    return "immediate";
  }

  // Circulation is acceptable, so mental status is assessed.
  if (answers.followsSimpleCommands === undefined) {
    throw new Error(
      "Mental status is required when capillary refill is 2 seconds or less.",
    );
  }

  if (!answers.followsSimpleCommands) {
    return "immediate";
  }

  return "delayed";
}
