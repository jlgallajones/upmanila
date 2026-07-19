import { Router } from "express";

import {
  createHealthcareFacility,
  getHealthcareFacilities,
} from "../controllers/healthcare-facility.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const healthcareFacilityRouter = Router();

healthcareFacilityRouter.get("/", requireAuth, getHealthcareFacilities);
healthcareFacilityRouter.post(
  "/",
  requireAuth,
  requireRole(["super_admin", "administrator", "encoder"]),
  createHealthcareFacility,
);

