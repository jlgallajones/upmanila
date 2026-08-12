import type { TriageCategory } from "../../types/triage.types.js";

export type TriageAccuracyRow = {
  responder_category: TriageCategory | string | null;
  triage_category: TriageCategory | string | null;
  calculated_category: TriageCategory | string | null;
};

export type TriageAccuracyMetric = {
  label: string;
  numerator: number;
  denominator: number;
  percentage: number;
};

export type TriageAccuracySummary = {
  undertriagedT1: TriageAccuracyMetric;
  undertriagedT2: TriageAccuracyMetric;
  overtriagedT2: TriageAccuracyMetric;
  overtriagedT3: TriageAccuracyMetric;
};

function buildAccuracyMetric(
  rows: TriageAccuracyRow[],
  label: string,
  trueCategory: TriageCategory,
  assignedCategories: TriageCategory[],
): TriageAccuracyMetric {
  const denominator = rows.filter(
    (row) => row.calculated_category === trueCategory,
  ).length;
  const numerator = rows.filter((row) => {
    const assignedCategory =
      row.responder_category ?? row.triage_category;

    return (
      row.calculated_category === trueCategory &&
      assignedCategory !== null &&
      assignedCategories.includes(assignedCategory as TriageCategory)
    );
  }).length;

  return {
    label,
    numerator,
    denominator,
    percentage:
      denominator > 0
        ? Number(((numerator / denominator) * 100).toFixed(2))
        : 0,
  };
}

export function buildTriageAccuracySummary(
  rows: TriageAccuracyRow[],
): TriageAccuracySummary {
  return {
    undertriagedT1: buildAccuracyMetric(
      rows,
      "T1 survivors assigned T2, T3, or T4",
      "immediate",
      ["delayed", "minimal", "expectant"],
    ),
    undertriagedT2: buildAccuracyMetric(
      rows,
      "T2 survivors assigned T3 or T4",
      "delayed",
      ["minimal", "expectant"],
    ),
    overtriagedT2: buildAccuracyMetric(
      rows,
      "T2 survivors assigned T1",
      "delayed",
      ["immediate"],
    ),
    overtriagedT3: buildAccuracyMetric(
      rows,
      "T3 survivors assigned T1 or T2",
      "minimal",
      ["immediate", "delayed"],
    ),
  };
}
