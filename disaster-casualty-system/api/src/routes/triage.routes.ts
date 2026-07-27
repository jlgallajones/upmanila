import { Router } from "express";

import { createTriageAssessment } from "../controllers/triage.controller.js";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth.js";

export const triageRouter = Router();

triageRouter.post(
  "/:id/triage",
  requireAuth,
  requireRole([
    "super_admin",
    "administrator",
    "responder",
    "encoder",
    "medical_personnel",
  ]),
  createTriageAssessment,
);