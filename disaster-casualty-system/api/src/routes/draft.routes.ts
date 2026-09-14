import { Router } from "express";

import {
  createDraft,
  deleteDraft,
  getDrafts,
  updateDraft,
} from "../controllers/draft.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const draftRouter = Router();

draftRouter.get("/", requireAuth, getDrafts);
draftRouter.post("/", requireAuth, createDraft);
draftRouter.patch("/:id", requireAuth, updateDraft);
draftRouter.delete("/:id", requireAuth, deleteDraft);

