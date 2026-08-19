import { Router } from "express";

import {
  deleteUnitUser,
  getManagedAccounts,
  getUnitUsers,
  login,
  registerAdmin,
  registerUnitUser,
  refreshSession,
  updateUnitUser,
} from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/refresh", refreshSession);
authRouter.post(
  "/register-admin",
  requireAuth,
  requireRole(["super_admin"]),
  registerAdmin,
);
authRouter.get(
  "/accounts",
  requireAuth,
  requireRole(["super_admin"]),
  getManagedAccounts,
);
authRouter.post(
  "/register-unit-user",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  registerUnitUser,
);
authRouter.get(
  "/unit-users",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  getUnitUsers,
);
authRouter.patch(
  "/unit-users/:id",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  updateUnitUser,
);
authRouter.delete(
  "/unit-users/:id",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  deleteUnitUser,
);
