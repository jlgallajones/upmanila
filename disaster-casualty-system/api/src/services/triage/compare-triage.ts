import type {
  TriageCategory,
  TriageComparison,
} from "../../types/triage.types.js";

/**
 * Priority is used only for Immediate, Delayed, and Minimal.
 *
 * Expectant is handled separately because it should not be treated
 * as simply lower or higher than the other categories.
 */
const triagePriority: Partial<Record<TriageCategory, number>> = {
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

  // Do not automatically classify comparisons involving
  // expectant or unknown until the medical team defines the rule.
  if (
    responderCategory === "expectant" ||
    calculatedCategory === "expectant" ||
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