import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { supabase } from "../config/supabase.js";

export async function getNotifications(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId =
      typeof request.query.userId === "string"
        ? request.query.userId
        : undefined;

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
      });

    if (userId) {
      query = query.eq("user_id", userId);
    }

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

    const { data, error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
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
    const userId =
      typeof request.body.userId === "string"
        ? request.body.userId
        : undefined;

    if (!userId) {
      response.status(400).json({
        success: false,
        message: "userId is required.",
      });
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
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