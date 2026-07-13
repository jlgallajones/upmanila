import { Router } from "express";

import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth, getNotifications);
notificationRouter.patch(
  "/read-all",
  requireAuth,
  markAllNotificationsAsRead,
);
notificationRouter.patch(
  "/:id/read",
  requireAuth,
  markNotificationAsRead,
);
