import { Router } from "express";

import {
  getIncidentResponderSafetyResponses,
  updateResponderSafetyResponseStatus,
} from "../controllers/responder-safety-response.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const responderSafetyResponseRouter = Router();

responderSafetyResponseRouter.get(
  "/:incidentId/responder-safety-responses",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator"]),
  getIncidentResponderSafetyResponses,
);

responderSafetyResponseRouter.patch(
  "/:incidentId/responder-safety-responses/:responseId",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator"]),
  updateResponderSafetyResponseStatus,
);
