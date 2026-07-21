import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isAuthenticationTokenError } from "../../api/client";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRecord,
  type NotificationType,
} from "../../api/notifications";
import { getAccessToken } from "../../auth/session";
import { getQueuedCasualtyCount } from "../../offline/casualtyQueue";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  text: "#17213A",
  secondaryText: "#66738B",
  mutedText: "#8C98AE",
  border: "#E2E7EF",

  red: "#D44B4F",
  redBackground: "#FFE8E9",

  green: "#4B744A",
  greenBackground: "#DDF8E8",

  blue: "#2E83B6",
  blueBackground: "#EAF4FF",

  orange: "#DF7B17",
  orangeBackground: "#FFF0DA",

  gray: "#68758A",
  grayBackground: "#EEF1F5",
};

type NotificationKind =
  | "emergency"
  | "sync"
  | "verification"
  | "incident"
  | "scheduled"
  | "system";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  kind: NotificationKind;
  section: "New" | "Earlier";
  unread: boolean;
  source: "server" | "local";
  userId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
};

function getVisuals(kind: NotificationKind) {
  switch (kind) {
    case "emergency":
      return {
        icon: "warning-outline" as const,
        iconColor: COLORS.red,
        iconBackground: COLORS.redBackground,
        accent: COLORS.red,
      };

    case "sync":
      return {
        icon: "cloud-upload-outline" as const,
        iconColor: COLORS.green,
        iconBackground: COLORS.greenBackground,
        accent: COLORS.green,
      };

    case "verification":
      return {
        icon: "shield-checkmark-outline" as const,
        iconColor: COLORS.blue,
        iconBackground: COLORS.blueBackground,
        accent: COLORS.blue,
      };

    case "incident":
      return {
        icon: "radio-outline" as const,
        iconColor: COLORS.red,
        iconBackground: COLORS.redBackground,
        accent: COLORS.red,
      };

    case "scheduled":
      return {
        icon: "time-outline" as const,
        iconColor: COLORS.orange,
        iconBackground: COLORS.orangeBackground,
        accent: COLORS.orange,
      };

    case "system":
      return {
        icon: "information-circle-outline" as const,
        iconColor: COLORS.gray,
        iconBackground: COLORS.grayBackground,
        accent: COLORS.gray,
      };
  }
}

function normalizeKind(type: NotificationType): NotificationKind {
  switch (type) {
    case "verified":
      return "verification";
    default:
      return type;
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const differenceMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (differenceMinutes < 1) {
    return "Just now";
  }

  if (differenceMinutes < 60) {
    return `${differenceMinutes} min ago`;
  }

  const differenceHours = Math.floor(differenceMinutes / 60);

  if (differenceHours < 24) {
    return `${differenceHours} ${
      differenceHours === 1 ? "hr" : "hrs"
    } ago`;
  }

  const differenceDays = Math.floor(differenceHours / 24);

  if (differenceDays < 7) {
    return `${differenceDays} ${
      differenceDays === 1 ? "day" : "days"
    } ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getSection(
  createdAt: string,
  unread: boolean,
): "New" | "Earlier" {
  const created = new Date(createdAt);

  if (unread) {
    return "New";
  }

  if (Number.isNaN(created.getTime())) {
    return "Earlier";
  }

  const ageHours = (Date.now() - created.getTime()) / 3600000;
  return ageHours < 24 ? "New" : "Earlier";
}

function mapServerNotification(
  notification: NotificationRecord,
  localReadIds: Set<string>,
): NotificationItem {
  const globalReadKey = getGlobalReadKey(notification.id);
  const isGlobalRead =
    notification.user_id === null && localReadIds.has(globalReadKey);
  const unread = !notification.is_read && !isGlobalRead;

  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    time: formatRelativeTime(notification.created_at),
    kind: normalizeKind(notification.notification_type),
    section: getSection(
      notification.created_at,
      unread,
    ),
    unread,
    source: "server",
    userId: notification.user_id,
    relatedEntityType: notification.related_entity_type,
    relatedEntityId: notification.related_entity_id,
    createdAt: notification.created_at,
  };
}

function getGlobalReadKey(notificationId: string): string {
  return `global-${notificationId}`;
}

function buildLocalNotifications({
  queuedCount,
  isGuestMode,
  localReadIds,
}: {
  queuedCount: number;
  isGuestMode: boolean;
  localReadIds: Set<string>;
}): NotificationItem[] {
  const now = new Date().toISOString();
  const items: NotificationItem[] = [];

  if (queuedCount > 0) {
    const id = "local-pending-sync";

    items.push({
      id,
      title: "Casualty records waiting to sync",
      message: `${queuedCount} local casualty record${
        queuedCount === 1 ? "" : "s"
      } will upload after login, connectivity, and incident assignment are available.`,
      time: "On this device",
      kind: "sync",
      section: localReadIds.has(id) ? "Earlier" : "New",
      unread: !localReadIds.has(id),
      source: "local",
      userId: null,
      relatedEntityType: "offline_queue",
      relatedEntityId: null,
      createdAt: now,
    });
  }

  if (isGuestMode) {
    const id = "local-guest-mode";

    items.push({
      id,
      title: "Guest capture mode is active",
      message:
        "You can add casualty records offline, but cloud records, incident lists, and account notifications require login from Profile.",
      time: "Current session",
      kind: "system",
      section: localReadIds.has(id) ? "Earlier" : "New",
      unread: !localReadIds.has(id),
      source: "local",
      userId: null,
      relatedEntityType: "profile",
      relatedEntityId: null,
      createdAt: now,
    });
  }

  return items;
}

function NotificationCard({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const visuals = getVisuals(item.kind);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notificationCard,
        item.kind === "emergency" && styles.emergencyCard,
        item.unread && styles.unreadCard,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: visuals.iconBackground,
          },
        ]}
      >
        <Ionicons
          name={visuals.icon}
          size={22}
          color={visuals.iconColor}
        />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationTitleRow}>
          <Text style={styles.notificationTitle}>
            {item.title}
          </Text>

          {item.unread ? (
            <View
              style={[
                styles.unreadDot,
                {
                  backgroundColor: visuals.accent,
                },
              ]}
            />
          ) : null}
        </View>

        <Text style={styles.notificationMessage}>
          {item.message}
        </Text>

        <View style={styles.notificationMetaRow}>
          <Text style={styles.notificationTime}>{item.time}</Text>

          {item.source === "local" ? (
            <Text style={styles.localBadge}>Local</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [serverNotifications, setServerNotifications] = useState<
    NotificationRecord[]
  >([]);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [queuedCasualtyCount, setQueuedCasualtyCount] = useState(0);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const notifications = useMemo(() => {
    const localNotifications = buildLocalNotifications({
      queuedCount: queuedCasualtyCount,
      isGuestMode,
      localReadIds,
    });

    const mappedServerNotifications =
      serverNotifications.map((notification) =>
        mapServerNotification(notification, localReadIds),
      );

    return [
      ...localNotifications,
      ...mappedServerNotifications,
    ].sort((first, second) => {
      if (first.unread !== second.unread) {
        return first.unread ? -1 : 1;
      }

      return (
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime()
      );
    });
  }, [
    isGuestMode,
    localReadIds,
    queuedCasualtyCount,
    serverNotifications,
  ]);

  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;

  const newNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => notification.section === "New",
      ),
    [notifications],
  );

  const earlierNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => notification.section === "Earlier",
      ),
    [notifications],
  );

  const activeBanner = useMemo(() => {
    const emergency = notifications.find(
      (notification) =>
        notification.unread &&
        (notification.kind === "emergency" ||
          notification.kind === "incident"),
    );

    return emergency?.title ?? null;
  }, [notifications]);

  const loadNotifications = useCallback(async () => {
    try {
      setErrorMessage(null);

      const [token, queuedCount] = await Promise.all([
        getAccessToken(),
        getQueuedCasualtyCount(),
      ]);

      setQueuedCasualtyCount(queuedCount);

      if (!token) {
        setServerNotifications([]);
        setIsGuestMode(true);
        return;
      }

      setIsGuestMode(false);

      const response = await getNotifications();
      setServerNotifications(response.data);
    } catch (error) {
      console.error("Failed to load notifications:", error);

      const queuedCount = await getQueuedCasualtyCount();
      setQueuedCasualtyCount(queuedCount);

      if (isAuthenticationTokenError(error)) {
        setServerNotifications([]);
        setIsGuestMode(true);
        setErrorMessage(null);
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load notifications.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadNotifications();
    }, [loadNotifications]),
  );

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadNotifications();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadNotifications]);

  async function markAllAsRead() {
    const hasServerUnread = serverNotifications.some(
      (notification) =>
        !notification.is_read && notification.user_id !== null,
    );

    setLocalReadIds(
      new Set(
        notifications.flatMap((notification) => {
          if (notification.source === "local") {
            return [notification.id];
          }

          if (notification.userId === null) {
            return [getGlobalReadKey(notification.id)];
          }

          return [];
        }),
      ),
    );

    setServerNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
        read_at: notification.read_at ?? new Date().toISOString(),
      })),
    );

    if (!hasServerUnread || isGuestMode) {
      return;
    }

    try {
      await markAllNotificationsAsRead();
    } catch (error) {
      console.error("Failed to mark notifications read:", error);
    }
  }

  async function handleNotificationPress(item: NotificationItem) {
    if (item.source === "local") {
      setLocalReadIds((current) => new Set(current).add(item.id));
    } else if (item.userId === null) {
      setLocalReadIds((current) =>
        new Set(current).add(getGlobalReadKey(item.id)),
      );
    } else if (item.unread) {
      setServerNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? {
                ...notification,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : notification,
        ),
      );

      try {
        await markNotificationAsRead(item.id);
      } catch (error) {
        console.error("Failed to mark notification read:", error);
      }
    }

    if (
      item.relatedEntityType === "casualty" &&
      item.relatedEntityId
    ) {
      router.push(
        `/casualty/${encodeURIComponent(item.relatedEntityId)}` as never,
      );
      return;
    }

    if (
      item.relatedEntityType === "incident" ||
      item.relatedEntityType === "offline_queue"
    ) {
      router.push(
        item.relatedEntityType === "incident"
          ? "/incidents"
          : "/add-casualty",
      );
      return;
    }

    if (item.relatedEntityType === "profile") {
      router.push("/profile");
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.maroon}
      />

      <SafeAreaView
        edges={["top"]}
        style={styles.headerSafeArea}
      >
        <View style={styles.header}>
          <View style={styles.headerDecorOne} />
          <View style={styles.headerDecorTwo} />

          <View style={styles.headerTopRow}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>Notifications</Text>

              <Text style={styles.headerSubtitle}>
                {unreadCount} unread{" "}
                {unreadCount === 1 ? "alert" : "alerts"}
              </Text>
            </View>

            <Pressable
              onPress={() => void markAllAsRead()}
              disabled={unreadCount === 0}
              style={({ pressed }) => [
                styles.markReadButton,
                unreadCount === 0 && styles.markReadButtonDisabled,
                pressed && unreadCount > 0 && styles.pressed,
              ]}
            >
              <Text style={styles.markReadText}>Mark all read</Text>
            </Pressable>
          </View>

          <View style={styles.emergencyBanner}>
            <Ionicons
              name={
                activeBanner
                  ? "warning-outline"
                  : isGuestMode
                    ? "cloud-offline-outline"
                    : "notifications-outline"
              }
              size={16}
              color={COLORS.white}
            />

            <Text style={styles.emergencyBannerText}>
              {activeBanner
                ? `ACTIVE NOTICE - ${activeBanner}`
                : isGuestMode
                  ? "GUEST MODE - login to receive cloud alerts"
                  : "DCMS notifications are up to date"}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
      >
        {errorMessage ? (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={COLORS.red}
            />
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>
                Unable to update notifications
              </Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              size="small"
              color={COLORS.maroon}
            />
            <Text style={styles.loadingText}>
              Loading notifications...
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="notifications-off-outline"
              size={44}
              color={COLORS.secondaryText}
            />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyMessage}>
              Incident alerts, verification updates, and sync notices will appear here.
            </Text>
          </View>
        ) : (
          <>
            {newNotifications.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>NEW</Text>

                <View style={styles.sectionList}>
                  {newNotifications.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onPress={() => {
                        void handleNotificationPress(item);
                      }}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {earlierNotifications.length > 0 ? (
              <>
                <Text
                  style={[
                    styles.sectionLabel,
                    newNotifications.length > 0 &&
                      styles.earlierLabel,
                  ]}
                >
                  EARLIER
                </Text>

                <View style={styles.sectionList}>
                  {earlierNotifications.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onPress={() => {
                        void handleNotificationPress(item);
                      }}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  headerSafeArea: {
    backgroundColor: COLORS.maroon,
  },

  header: {
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 13,
    backgroundColor: COLORS.maroon,
  },

  headerDecorOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -72,
    top: -125,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  headerDecorTwo: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    right: 22,
    top: -22,
    backgroundColor: "rgba(255,255,255,0.035)",
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  headerTextGroup: {
    flex: 1,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    marginTop: 7,
  },

  markReadButton: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  markReadButtonDisabled: {
    opacity: 0.5,
  },

  markReadText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "600",
  },

  emergencyBanner: {
    minHeight: 41,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  emergencyBannerText: {
    flex: 1,
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 7,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 17,
  },

  sectionLabel: {
    color: "#8B99B1",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 13,
  },

  earlierLabel: {
    marginTop: 25,
  },

  sectionList: {
    gap: 11,
  },

  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 112,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#718099",
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  unreadCard: {
    borderColor: "#D7DFEB",
  },

  emergencyCard: {
    borderColor: "#F2C5C7",
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  notificationContent: {
    flex: 1,
  },

  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  notificationTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    paddingRight: 8,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },

  notificationMessage: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },

  notificationMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
    gap: 8,
  },

  notificationTime: {
    color: COLORS.mutedText,
    fontSize: 11,
  },

  localBadge: {
    overflow: "hidden",
    color: COLORS.orange,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: COLORS.orangeBackground,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#F3C5C7",
    backgroundColor: COLORS.redBackground,
  },

  errorContent: {
    flex: 1,
    marginLeft: 9,
  },

  errorTitle: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "800",
  },

  errorText: {
    color: COLORS.secondaryText,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  loadingCard: {
    minHeight: 95,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: COLORS.white,
    gap: 10,
  },

  loadingText: {
    color: COLORS.secondaryText,
    fontSize: 12,
  },

  emptyCard: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  emptyMessage: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  bottomSpacing: {
    height: 30,
  },
});
