import { Router } from "express";

import {
  bulkRegisterAdmins,
  bulkRegisterUnitUsers,
  backupOperationalData,
  deleteUnitUser,
  forgotPassword,
  getManagedAccounts,
  getUnitUsers,
  login,
  previewOperationalDataReset,
  recoverPassword,
  registerAdmin,
  registerUnitUser,
  restoreOperationalData,
  resetOperationalData,
  refreshSession,
  updateAdminAccount,
  updateCurrentUser,
  updateUnitUser,
} from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/refresh", refreshSession);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/recover-password", recoverPassword);
authRouter.patch("/me", requireAuth, updateCurrentUser);
authRouter.get(
  "/reset-operational-data/preview",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator"]),
  previewOperationalDataReset,
);
authRouter.get(
  "/backup-operational-data",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator"]),
  backupOperationalData,
);
authRouter.post(
  "/restore-operational-data",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator"]),
  restoreOperationalData,
);
authRouter.post(
  "/reset-operational-data",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator"]),
  resetOperationalData,
);
authRouter.post(
  "/register-admin",
  requireAuth,
  requireRole(["super_admin"]),
  registerAdmin,
);
authRouter.post(
  "/bulk-register-admins",
  requireAuth,
  requireRole(["super_admin"]),
  bulkRegisterAdmins,
);
authRouter.get(
  "/accounts",
  requireAuth,
  requireRole(["super_admin"]),
  getManagedAccounts,
);
authRouter.patch(
  "/admin-accounts/:id",
  requireAuth,
  requireRole(["super_admin"]),
  updateAdminAccount,
);
authRouter.post(
  "/register-unit-user",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  registerUnitUser,
);
authRouter.post(
  "/bulk-register-unit-users",
  requireAuth,
  requireRole(["super_admin", "admin", "administrator", "encoder"]),
  bulkRegisterUnitUsers,
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
