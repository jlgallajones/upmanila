import { Router } from "express";

import {
  bulkCreateEvacuationCenters,
  createEvacuationCenter,
  getEvacuationCenters,
} from "../controllers/evacuation-center.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const evacuationCenterRouter = Router();

evacuationCenterRouter.get("/", requireAuth, getEvacuationCenters);
evacuationCenterRouter.post(
  "/",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  createEvacuationCenter,
);
evacuationCenterRouter.post(
  "/bulk",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  bulkCreateEvacuationCenters,
);
