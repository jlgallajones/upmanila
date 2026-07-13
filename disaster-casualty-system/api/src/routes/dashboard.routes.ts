import { Router } from "express";

import {
  getDashboardSummary,
  getRecentActivity,
} from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", requireAuth, getDashboardSummary);
dashboardRouter.get(
  "/recent-activity",
  requireAuth,
  getRecentActivity,
);
