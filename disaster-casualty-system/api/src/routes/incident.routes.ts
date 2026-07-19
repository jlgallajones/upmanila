import { Router } from "express";

import {
  closeIncident,
  createIncident,
  exportIncidentCasualtiesCsv,
  exportLatestSitrepCsv,
  exportLatestSitrepPdf,
  generateIncidentSitrep,
  getIncidents,
  getIncidentTimeline,
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
incidentRouter.put(
  "/:id/timeline",
  requireAuth,
  requireRole(["super_admin", "administrator", "encoder"]),
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
