import { Router } from "express";

import {
  createCasualtyTriageAssessment,
  createCasualtyTransportRecord,
  createCasualty,
  getCasualties,
  getCasualtyById,
  getCasualtyStatusHistory,
  getCasualtyTriageHistory,
  getCasualtyTransportHistory,
  updateCasualty,
} from "../controllers/casualty.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const casualtyRouter = Router();

casualtyRouter.get("/", requireAuth, getCasualties);
casualtyRouter.get(
  "/:id/status-history",
  requireAuth,
  getCasualtyStatusHistory,
);
casualtyRouter.get(
  "/:id/triage-history",
  requireAuth,
  getCasualtyTriageHistory,
);
casualtyRouter.post(
  "/:id/triage-history",
  requireAuth,
  requireRole([
    "super_admin",
    "administrator",
    "responder",
    "encoder",
    "medical_personnel",
  ]),
  createCasualtyTriageAssessment,
);
casualtyRouter.get(
  "/:id/transport-history",
  requireAuth,
  getCasualtyTransportHistory,
);
casualtyRouter.post(
  "/:id/transport-history",
  requireAuth,
  requireRole([
    "super_admin",
    "administrator",
    "responder",
    "encoder",
    "medical_personnel",
  ]),
  createCasualtyTransportRecord,
);
casualtyRouter.get("/:id", requireAuth, getCasualtyById);
casualtyRouter.post(
  "/",
  requireAuth,
  requireRole([
    "super_admin",
    "administrator",
    "responder",
    "encoder",
    "medical_personnel",
  ]),
  createCasualty,
);
casualtyRouter.put(
  "/:id",
  requireAuth,
  requireRole([
    "super_admin",
    "administrator",
    "responder",
    "encoder",
    "medical_personnel",
  ]),
  updateCasualty,
);
