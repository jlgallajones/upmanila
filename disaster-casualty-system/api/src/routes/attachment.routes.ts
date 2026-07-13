import { Router } from "express";

import {
  getAttachments,
  uploadAttachment,
} from "../controllers/attachment.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const attachmentRouter = Router();

attachmentRouter.get("/", requireAuth, getAttachments);
attachmentRouter.post(
  "/",
  requireAuth,
  requireRole([
    "super_admin",
    "administrator",
    "responder",
    "encoder",
    "medical_personnel",
  ]),
  uploadAttachment,
);
