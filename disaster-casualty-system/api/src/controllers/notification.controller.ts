import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

export async function getNotifications(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    let query = supabase
      .from("notifications")
      .select(`
        id,
        user_id,
        title,
        message,
        notification_type,
        is_read,
        related_entity_type,
        related_entity_id,
        created_at,
        read_at
      `)
      .order("created_at", {
        ascending: false,
      })
      .or(`user_id.is.null,user_id.eq.${user.id}`);

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    response.status(200).json({
      success: true,
      count: data?.length ?? 0,
      unreadCount:
        data?.filter((notification) => !notification.is_read)
          .length ?? 0,
      data: data ?? [],
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationAsRead(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = request.params;
    const user = getAuthenticatedUser(request);

    const { data, error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      response.status(404).json({
        success: false,
        message: "Notification was not found for this account.",
      });
      return;
    }

    response.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsAsRead(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      throw new Error(error.message);
    }

    response.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    next(error);
  }
}
