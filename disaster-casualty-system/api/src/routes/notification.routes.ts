import { Router } from "express";

import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../controllers/notification.controller.js";

export const notificationRouter = Router();

notificationRouter.get("/", getNotifications);
notificationRouter.patch("/read-all", markAllNotificationsAsRead);
notificationRouter.patch("/:id/read", markNotificationAsRead);