import { Router } from "express";

import {
  getUnitUsers,
  login,
  registerAdmin,
  registerUnitUser,
  updateUnitUser,
} from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post(
  "/register-admin",
  requireAuth,
  requireRole(["super_admin"]),
  registerAdmin,
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
