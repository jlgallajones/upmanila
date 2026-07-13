import { Router } from "express";

import {
  getDashboardSummary,
  getRecentActivity,
} from "../controllers/dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", getDashboardSummary);
dashboardRouter.get("/recent-activity", getRecentActivity);