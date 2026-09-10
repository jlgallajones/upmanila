import { Router } from "express";

import { getAuditLogs } from "../controllers/audit-log.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const auditLogRouter = Router();

auditLogRouter.get(
  "/",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  getAuditLogs,
);
