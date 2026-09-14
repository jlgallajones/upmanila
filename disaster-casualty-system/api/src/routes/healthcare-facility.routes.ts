import { Router } from "express";

import {
  bulkCreateHealthcareFacilities,
  createHealthcareFacility,
  getHealthcareFacilities,
  updateHealthcareFacility,
} from "../controllers/healthcare-facility.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const healthcareFacilityRouter = Router();

healthcareFacilityRouter.get("/", requireAuth, getHealthcareFacilities);
healthcareFacilityRouter.post(
  "/",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  createHealthcareFacility,
);
healthcareFacilityRouter.post(
  "/bulk",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  bulkCreateHealthcareFacilities,
);
healthcareFacilityRouter.patch(
  "/:id",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  updateHealthcareFacility,
);

