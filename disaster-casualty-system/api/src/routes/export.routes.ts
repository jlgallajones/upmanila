import { Router } from "express";

import {
  exportEvacuationCentersCsv,
  exportHealthcareFacilitiesCsv,
  exportIncidentPackageJson,
  exportRespondersDocumentersCsv,
  exportSystemBackupJson,
} from "../controllers/export.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const exportRouter = Router();

const exportRoles = ["super_admin", "admin", "administrator", "encoder"] as const;

exportRouter.get(
  "/responders-documenters.csv",
  requireAuth,
  requireRole([...exportRoles]),
  exportRespondersDocumentersCsv,
);

exportRouter.get(
  "/healthcare-facilities.csv",
  requireAuth,
  requireRole([...exportRoles]),
  exportHealthcareFacilitiesCsv,
);

exportRouter.get(
  "/evacuation-centers.csv",
  requireAuth,
  requireRole([...exportRoles]),
  exportEvacuationCentersCsv,
);

exportRouter.get(
  "/incidents/:id/package.json",
  requireAuth,
  requireRole([...exportRoles]),
  exportIncidentPackageJson,
);

exportRouter.get(
  "/system-backup.json",
  requireAuth,
  requireRole(["super_admin"]),
  exportSystemBackupJson,
);
