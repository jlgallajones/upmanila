import { Router } from "express";

import {
  createDmmpStaff,
  deleteDmmpStaff,
  getCoordinationAssessment,
  getDeactivationContinuity,
  getDmmpStaff,
  getDmmpStaffSummary,
  getHospitalResources,
  getResponderSafetyReport,
  getUtsteinOperations,
  saveCoordinationAssessment,
  saveDeactivationContinuity,
  saveHospitalResources,
  saveResponderSafetyReport,
  saveUtsteinOperations,
  updateDmmpStaff,
} from "../controllers/incident-operations.controller.js";

import {
  requireAuth,
  requireRole,
  type UserRole,
} from "../middleware/auth.js";

export const incidentOperationsRouter =
  Router();

const readableRoles: UserRole[] = [
  "super_admin",
  "admin",
  "administrator",
  "responder",
  "encoder",
  "medical_personnel",
  "viewer",
];

const writableRoles: UserRole[] = [
  "super_admin",
  "admin",
  "administrator",
  "responder",
  "encoder",
  "medical_personnel",
];

incidentOperationsRouter.get(
  "/incidents/:id/utstein-operations",
  requireAuth,
  requireRole(readableRoles),
  getUtsteinOperations,
);

incidentOperationsRouter.put(
  "/incidents/:id/utstein-operations",
  requireAuth,
  requireRole(writableRoles),
  saveUtsteinOperations,
);

incidentOperationsRouter.get(
  "/incidents/:id/dmmp-staff",
  requireAuth,
  requireRole(readableRoles),
  getDmmpStaff,
);

incidentOperationsRouter.post(
  "/incidents/:id/dmmp-staff",
  requireAuth,
  requireRole(writableRoles),
  createDmmpStaff,
);

incidentOperationsRouter.patch(
  "/dmmp-staff/:staffId",
  requireAuth,
  requireRole(writableRoles),
  updateDmmpStaff,
);

incidentOperationsRouter.delete(
  "/dmmp-staff/:staffId",
  requireAuth,
  requireRole(writableRoles),
  deleteDmmpStaff,
);

incidentOperationsRouter.get(
  "/incidents/:id/dmmp-staff-summary",
  requireAuth,
  requireRole(readableRoles),
  getDmmpStaffSummary,
);

incidentOperationsRouter.get(
  "/incidents/:id/coordination-assessment",
  requireAuth,
  requireRole(readableRoles),
  getCoordinationAssessment,
);

incidentOperationsRouter.put(
  "/incidents/:id/coordination-assessment",
  requireAuth,
  requireRole(writableRoles),
  saveCoordinationAssessment,
);

incidentOperationsRouter.get(
  "/incidents/:id/responder-safety-report",
  requireAuth,
  requireRole(readableRoles),
  getResponderSafetyReport,
);

incidentOperationsRouter.put(
  "/incidents/:id/responder-safety-report",
  requireAuth,
  requireRole(writableRoles),
  saveResponderSafetyReport,
);

incidentOperationsRouter.get(
  "/incidents/:id/deactivation-continuity",
  requireAuth,
  requireRole(readableRoles),
  getDeactivationContinuity,
);

incidentOperationsRouter.put(
  "/incidents/:id/deactivation-continuity",
  requireAuth,
  requireRole(writableRoles),
  saveDeactivationContinuity,
);

incidentOperationsRouter.get(
  "/incidents/:id/hospital-resources",
  requireAuth,
  requireRole(readableRoles),
  getHospitalResources,
);

incidentOperationsRouter.put(
  "/incidents/:id/hospital-resources",
  requireAuth,
  requireRole(writableRoles),
  saveHospitalResources,
);
