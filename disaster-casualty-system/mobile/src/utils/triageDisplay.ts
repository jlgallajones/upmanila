export type TriageDisplayAssessment = {
  triage_system?: string | null;
  triage_category?: string | null;
  responder_category?: string | null;
  calculated_category?: string | null;
  assessment_answers?: Record<string, unknown> | null;
};

type TriageDisplayOptions = {
  preferFinalResult?: boolean;
  fallback?: string;
};

function normalizeTriageValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isMissingTriageValue(value: unknown): boolean {
  const normalized = normalizeTriageValue(value);

  return (
    !normalized ||
    normalized === "unknown" ||
    normalized === "unavailable" ||
    normalized === "not_recorded"
  );
}

function formatTriageValue(value: unknown, triageSystem: string): string {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const normalized = normalizeTriageValue(text);

  if (normalized.startsWith("esi_") && /^esi_[1-5]$/.test(normalized)) {
    return `ESI ${normalized.slice(-1)}`;
  }

  if (
    (triageSystem === "esi" ||
      triageSystem === "ed_triage" ||
      triageSystem === "emergency_severity_index") &&
    /^(?:1|2|3|4|5|level_[1-5])$/.test(normalized)
  ) {
    return `ESI ${normalized.slice(-1)}`;
  }

  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function getTriageDisplayLabel(
  assessment: TriageDisplayAssessment | null | undefined,
  options: TriageDisplayOptions = {},
): string {
  const fallback = options.fallback ?? "Unknown";

  if (!assessment) {
    return fallback;
  }

  const triageSystem = normalizeTriageValue(assessment.triage_system);
  const answers = assessment.assessment_answers ?? {};

  if (options.preferFinalResult) {
    const finalResult = [
      answers.finalTriage,
      answers.final_triage,
      answers.triageResult,
      answers.triage_result,
      answers.result,
    ].find((value) => !isMissingTriageValue(value));

    if (finalResult !== undefined) {
      return formatTriageValue(finalResult, triageSystem);
    }
  }

  const category = [
    assessment.triage_category,
    assessment.responder_category,
    assessment.calculated_category,
  ].find((value) => !isMissingTriageValue(value));

  if (category !== undefined) {
    const formatted = formatTriageValue(category, triageSystem);

    switch (normalizeTriageValue(category)) {
      case "minimal":
      case "minor":
        return "Minor";
      case "immediate":
        return "Immediate";
      case "delayed":
        return "Delayed";
      case "expectant":
        return "Expectant";
      default:
        return formatted;
    }
  }

  return fallback;
}
