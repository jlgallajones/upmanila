import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

import { calculateTriageCategory } from "../services/triage/calculate-triage.js";
import { compareTriageCategories } from "../services/triage/compare-triage.js";

import type {
  CreateTriageAssessmentRequest,
  TriageCategory,
  TriageStage,
  TriageSystem,
} from "../types/triage.types.js";

const supportedTriageSystems: TriageSystem[] = [
  "start",
  "nato",
  "sieve",
  "sieve_sort",
  "sort",
  "smart",
  "care_flight",
  "mass",
  "salt",
  "urgent_non_urgent",
  "ed_triage",
  "other",
];

const triageCategories: TriageCategory[] = [
  "immediate",
  "delayed",
  "minimal",
  "expectant",
  "unknown",
];

const triageStages: TriageStage[] = [
  "on_site",
  "facility_arrival",
  "reassessment",
];

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function createTriageAssessment(
  request: Request<
    { id: string },
    unknown,
    CreateTriageAssessmentRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const casualtyIncidentId = request.params.id;

    const {
      triageSystem,
      responderCategory,
      triageStage = "on_site",
      triagedAt,
      assessmentAnswers,
      location,
      notes,
    } = request.body;

    const authenticatedUser = getAuthenticatedUser(request);

    if (!casualtyIncidentId) {
      response.status(400).json({
        success: false,
        message: "Casualty incident ID is required.",
      });
      return;
    }

    if (!triageSystem) {
      response.status(400).json({
        success: false,
        message: "Triage system is required.",
      });
      return;
    }

    if (!supportedTriageSystems.includes(triageSystem)) {
      response.status(400).json({
        success: false,
        message: "Unsupported triage system.",
        supportedSystems: supportedTriageSystems,
      });
      return;
    }

    if (!responderCategory) {
      response.status(400).json({
        success: false,
        message: "Responder category is required.",
      });
      return;
    }

    if (!triageCategories.includes(responderCategory)) {
      response.status(400).json({
        success: false,
        message: "Invalid responder triage category.",
      });
      return;
    }

    if (!triageStages.includes(triageStage)) {
      response.status(400).json({
        success: false,
        message: "Invalid triage stage.",
      });
      return;
    }

    if (!isObject(assessmentAnswers)) {
      response.status(400).json({
        success: false,
        message: "assessmentAnswers must be an object.",
      });
      return;
    }

    let normalizedTriagedAt = new Date().toISOString();

    if (triagedAt) {
      const parsedTriagedAt = new Date(triagedAt);

      if (Number.isNaN(parsedTriagedAt.getTime())) {
        response.status(400).json({
          success: false,
          message: "Invalid triagedAt date and time.",
        });
        return;
      }

      normalizedTriagedAt = parsedTriagedAt.toISOString();
    }

    /*
     * Confirm that the casualty_incidents record exists.
     */
    const {
      data: casualtyIncident,
      error: casualtyIncidentError,
    } = await supabase
      .from("casualty_incidents")
      .select(
        `
          id,
          casualty_id,
          incident_id,
          deleted_at
        `,
      )
      .eq("id", casualtyIncidentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (casualtyIncidentError) {
      throw new Error(
        `Unable to verify casualty incident: ${casualtyIncidentError.message}`,
      );
    }

    if (!casualtyIncident) {
      response.status(404).json({
        success: false,
        message: "Casualty incident record not found.",
      });
      return;
    }

    let calculatedCategory: TriageCategory;

    try {
      calculatedCategory = calculateTriageCategory(
        triageSystem,
        assessmentAnswers,
      );
    } catch (calculationError) {
      response.status(400).json({
        success: false,
        message:
          calculationError instanceof Error
            ? calculationError.message
            : "Unable to calculate triage category.",
      });
      return;
    }

    const comparison = compareTriageCategories(
      responderCategory,
      calculatedCategory,
    );

    const algorithmVersion =
      triageSystem === "start"
        ? "start-v1"
        : `${triageSystem}-v1`;

    /*
     * triage_category remains populated for compatibility with
     * the project's existing mobile app and history endpoints.
     */
    const {
      data: savedAssessment,
      error: insertError,
    } = await supabase
      .from("casualty_triage_assessments")
      .insert({
        casualty_incident_id: casualtyIncidentId,

        triage_system: triageSystem,
        triage_category: responderCategory,

        responder_category: responderCategory,
        calculated_category: calculatedCategory,

        triage_stage: triageStage,
        triaged_at: normalizedTriagedAt,
        triaged_by: authenticatedUser.id,

        assessment_answers: assessmentAnswers,
        algorithm_version: algorithmVersion,

        is_over_triage: comparison.isOverTriage,
        is_under_triage: comparison.isUnderTriage,

        location: location?.trim() || null,
        notes: notes?.trim() || null,
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(
        `Unable to save triage assessment: ${insertError.message}`,
      );
    }

    response.status(201).json({
      success: true,
      message: "Triage assessment created successfully.",
      data: savedAssessment,
      comparison: {
        matches: comparison.matches,
        responderCategory,
        calculatedCategory,
        isOverTriage: comparison.isOverTriage,
        isUnderTriage: comparison.isUnderTriage,
      },
    });
  } catch (error) {
    next(error);
  }
}
