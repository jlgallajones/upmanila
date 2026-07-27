export type TriageSystem =
  | "start"
  | "nato"
  | "sieve"
  | "sort"
  | "care_flight"
  | "salt";

export type TriageCategory =
  | "immediate"
  | "delayed"
  | "minimal"
  | "expectant"
  | "unknown";

export type TriageStage =
  | "on_site"
  | "facility_arrival"
  | "reassessment";

export type StartRespirationStatus =
  | "absent"
  | "more_than_30"
  | "less_than_or_equal_to_30";

export type StartCapillaryRefill =
  | "more_than_2_seconds"
  | "less_than_or_equal_to_2_seconds";

export interface StartAssessmentAnswers {
  canWalk: boolean;
  respirations: StartRespirationStatus;
  capillaryRefill?: StartCapillaryRefill;
  followsSimpleCommands?: boolean;
}

export interface CreateTriageAssessmentRequest {
  triageSystem: TriageSystem;

  /**
   * The category selected by the responder.
   */
  responderCategory: TriageCategory;

  triageStage?: TriageStage;
  triagedAt?: string;
  location?: string;
  notes?: string;

  assessmentAnswers: Record<string, unknown>;
}

export interface TriageComparison {
  matches: boolean;
  isOverTriage: boolean;
  isUnderTriage: boolean;
}