export const incidentTriageModes = [
  "assisted",
  "unassisted",
  "both",
] as const;

export type IncidentTriageMode = (typeof incidentTriageModes)[number];
export type SubmittedTriageMode = Exclude<IncidentTriageMode, "both">;

export function normalizeIncidentTriageMode(
  value: unknown,
): IncidentTriageMode {
  return incidentTriageModes.includes(value as IncidentTriageMode)
    ? (value as IncidentTriageMode)
    : "assisted";
}

export function isSubmittedTriageModeAllowed(
  configuredMode: IncidentTriageMode,
  submittedMode: SubmittedTriageMode | null,
): boolean {
  return submittedMode !== null &&
    (configuredMode === "both" || configuredMode === submittedMode);
}
