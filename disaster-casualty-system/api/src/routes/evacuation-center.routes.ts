import { Router } from "express";

import {
  createEvacuationCenter,
  getEvacuationCenters,
} from "../controllers/evacuation-center.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const evacuationCenterRouter = Router();

evacuationCenterRouter.get("/", requireAuth, getEvacuationCenters);
evacuationCenterRouter.post(
  "/",
  requireAuth,
  requireRole(["super_admin", "administrator", "encoder"]),
  createEvacuationCenter,
);
