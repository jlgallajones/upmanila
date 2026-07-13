import { Router } from "express";

import {
  closeIncident,
  createIncident,
  getIncidents,
} from "../controllers/incident.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const incidentRouter = Router();

incidentRouter.get("/", requireAuth, getIncidents);
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
