import { api } from "./client";

export type NotificationType =
  | "emergency"
  | "sync"
  | "verification"
  | "incident"
  | "scheduled"
  | "system";

export type NotificationRecord = {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  notification_type: NotificationType;
  is_read: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  read_at: string | null;
};

type NotificationListResponse = {
  success: boolean;
  count: number;
  unreadCount: number;
  data: NotificationRecord[];
};

export async function getNotifications(
  userId?: string,
): Promise<NotificationListResponse> {
  const response =
    await api.get<NotificationListResponse>(
      "/notifications",
      {
        params: userId
          ? {
              userId,
            }
          : undefined,
      },
    );

  return response.data;
}

export async function markNotificationAsRead(
  id: string,
): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsAsRead(
  userId: string,
): Promise<void> {
  await api.patch("/notifications/read-all", {
    userId,
  });
}