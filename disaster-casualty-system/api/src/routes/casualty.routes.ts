import { Router } from "express";

import {
  createCasualty,
  getCasualties,
  getCasualtyById,
  getCasualtyStatusHistory,
  updateCasualty,
} from "../controllers/casualty.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const casualtyRouter = Router();

casualtyRouter.get("/", requireAuth, getCasualties);
casualtyRouter.get("/:id", requireAuth, getCasualtyById);
casualtyRouter.get(
  "/:id/status-history",
  requireAuth,
  getCasualtyStatusHistory,
);
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
