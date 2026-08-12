import type {
  TriageCategory,
  TriageComparison,
} from "../../types/triage.types.js";

/**
 * Lower numbers mean less resource priority in the T1-T4 Utstein
 * comparison set: T4 expectant/black, T3 minimal/green, T2 delayed/yellow,
 * T1 immediate/red.
 *
 * Unknown is excluded because it is not a clinical triage category.
 */
const triagePriority: Partial<Record<TriageCategory, number>> = {
  expectant: 0,
  minimal: 1,
  delayed: 2,
  immediate: 3,
};

export function compareTriageCategories(
  responderCategory: TriageCategory,
  calculatedCategory: TriageCategory,
): TriageComparison {
  if (responderCategory === calculatedCategory) {
    return {
      matches: true,
      isOverTriage: false,
      isUnderTriage: false,
    };
  }

  // Unknown and non-T1-T4 systems are not comparable.
  if (
    responderCategory === "unknown" ||
    calculatedCategory === "unknown"
  ) {
    return {
      matches: false,
      isOverTriage: false,
      isUnderTriage: false,
    };
  }

  const responderPriority = triagePriority[responderCategory];
  const calculatedPriority = triagePriority[calculatedCategory];

  if (
    responderPriority === undefined ||
    calculatedPriority === undefined
  ) {
    return {
      matches: false,
      isOverTriage: false,
      isUnderTriage: false,
    };
  }

  return {
    matches: false,

    // Example:
    // Responder selects Immediate but algorithm says Delayed.
    isOverTriage: responderPriority > calculatedPriority,

    // Example:
    // Responder selects Delayed but algorithm says Immediate.
    isUnderTriage: responderPriority < calculatedPriority,
  };
}
