import { Router } from "express";

import { getProfile } from "../controllers/profile.controller.js";

export const profileRouter = Router();

profileRouter.get("/:userId", getProfile);