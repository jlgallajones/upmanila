import { Router } from "express";

import { getProfile } from "../controllers/profile.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const profileRouter = Router();

profileRouter.get("/:userId", requireAuth, getProfile);
