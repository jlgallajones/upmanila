import { Router } from "express";

import {
  closeIncident,
  createIncident,
  exportIncidentCasualtiesCsv,
  exportLatestSitrepCsv,
  exportLatestSitrepPdf,
  generateIncidentSitrep,
  getIncidents,
  getIncidentFacilityTriageSummary,
  getIncidentOnsiteCareSummary,
  getIncidentTimeline,
  getIncidentOnsiteTriageSummary,
  getIncidentSceneClearanceSummary,
  getIncidentSurvivorDistributionSummary,
  updateIncidentTimeline,
} from "../controllers/incident.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const incidentRouter = Router();

incidentRouter.get("/", requireAuth, getIncidents);
incidentRouter.get(
  "/:id/export/casualties.csv",
  requireAuth,
  exportIncidentCasualtiesCsv,
);
incidentRouter.get(
  "/:id/export/sitrep.csv",
  requireAuth,
  exportLatestSitrepCsv,
);
incidentRouter.get(
  "/:id/export/sitrep.pdf",
  requireAuth,
  exportLatestSitrepPdf,
);
incidentRouter.get(
  "/:id/timeline",
  requireAuth,
  getIncidentTimeline,
);
incidentRouter.get(
  "/:id/onsite-triage-summary",
  requireAuth,
  getIncidentOnsiteTriageSummary,
);
incidentRouter.get(
  "/:id/facility-triage-summary",
  requireAuth,
  getIncidentFacilityTriageSummary,
);
incidentRouter.get(
  "/:id/onsite-care-summary",
  requireAuth,
  getIncidentOnsiteCareSummary,
);
incidentRouter.get(
  "/:id/scene-clearance-summary",
  requireAuth,
  getIncidentSceneClearanceSummary,
);
incidentRouter.get(
  "/:id/survivor-distribution-summary",
  requireAuth,
  getIncidentSurvivorDistributionSummary,
);
incidentRouter.put(
  "/:id/timeline",
  requireAuth,
  requireRole([
    "super_admin",
    "administrator",
    "responder",
    "encoder",
    "medical_personnel",
  ]),
  updateIncidentTimeline,
);
incidentRouter.post(
  "/:id/sitreps",
  requireAuth,
  requireRole([
    "super_admin",
    "administrator",
    "encoder",
    "medical_personnel",
  ]),
  generateIncidentSitrep,
);
incidentRouter.post(
  "/",
  requireAuth,
  requireRole(["super_admin", "administrator", "encoder"]),
  createIncident,
);
incidentRouter.patch(
  "/:id/close",
  requireAuth,
  requireRole(["super_admin", "administrator", "encoder"]),
  closeIncident,
);
