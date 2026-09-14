import { Router } from "express";

import {
  createCallDownStaff,
  getCallDownStaff,
  updateCallDownStaff,
} from "../controllers/call-down-staff.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const callDownStaffRouter = Router();

const managerRoles = ["super_admin", "admin", "administrator", "encoder"] as const;

callDownStaffRouter.get(
  "/",
  requireAuth,
  requireRole([...managerRoles]),
  getCallDownStaff,
);

callDownStaffRouter.post(
  "/",
  requireAuth,
  requireRole([...managerRoles]),
  createCallDownStaff,
);

callDownStaffRouter.patch(
  "/:id",
  requireAuth,
  requireRole([...managerRoles]),
  updateCallDownStaff,
);

