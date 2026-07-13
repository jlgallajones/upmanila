import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  maroon: "#7B1113",
  deepMaroon: "#620B0D",
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
};

type NotificationKind =
  | "emergency"
  | "sync"
  | "verified"
  | "incident"
  | "scheduled";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  kind: NotificationKind;
  section: "New" | "Earlier";
  unread: boolean;
};

const initialNotifications: NotificationItem[] = [
  {
    id: "1",
    title: "Typhoon Egay — Level 4 Alert",
    message:
      "PAGASA has upgraded Typhoon Egay to Super Typhoon category. Evacuation orders are in effect for coastal barangays in Quezon City.",
    time: "2 min ago",
    kind: "emergency",
    section: "New",
    unread: true,
  },
  {
    id: "2",
    title: "Sync Successful",
    message:
      "47 casualty records have been uploaded to the NDRRMC central database. Verification pending.",
    time: "18 min ago",
    kind: "sync",
    section: "New",
    unread: true,
  },
  {
    id: "3",
    title: "Record Verified — C-2026-001",
    message:
      "Record for Juan dela Cruz (Injured) has been verified by NDRRMC central. No further action needed.",
    time: "42 min ago",
    kind: "verified",
    section: "New",
    unread: true,
  },
  {
    id: "4",
    title: "New Disaster Incident Declared",
    message:
      "Flooding reported in Batasan Hills and Commonwealth areas. Responders are requested to deploy immediately.",
    time: "1 hr ago",
    kind: "incident",
    section: "Earlier",
    unread: false,
  },
  {
    id: "5",
    title: "Auto-Sync Scheduled",
    message:
      "Next automatic synchronization is scheduled for 3:00 PM today. Ensure connectivity before then.",
    time: "2 hr ago",
    kind: "scheduled",
    section: "Earlier",
    unread: false,
  },
];

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

    case "verified":
      return {
        icon: "checkmark-outline" as const,
        iconColor: COLORS.blue,
        iconBackground: COLORS.blueBackground,
        accent: COLORS.blue,
      };

    case "incident":
      return {
        icon: "warning-outline" as const,
        iconColor: COLORS.red,
        iconBackground: COLORS.redBackground,
        accent: COLORS.red,
      };

    case "scheduled":
      return {
        icon: "sync-outline" as const,
        iconColor: COLORS.orange,
        iconBackground: COLORS.orangeBackground,
        accent: COLORS.orange,
      };
  }
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

        <Text style={styles.notificationTime}>{item.time}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] =
    useState(initialNotifications);

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

  function markAllAsRead() {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        unread: false,
      })),
    );
  }

  function markOneAsRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              unread: false,
            }
          : notification,
      ),
    );
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
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>

              <Text style={styles.headerSubtitle}>
                {unreadCount} unread{" "}
                {unreadCount === 1 ? "alert" : "alerts"}
              </Text>
            </View>

            <Pressable
              onPress={markAllAsRead}
              disabled={unreadCount === 0}
              style={({ pressed }) => [
                styles.markReadButton,
                unreadCount === 0 && styles.markReadButtonDisabled,
                pressed && unreadCount > 0 && styles.pressed,
              ]}
            >
              <Text style={styles.markReadText}>
                Mark all read
              </Text>
            </Pressable>
          </View>

          <View style={styles.emergencyBanner}>
            <Ionicons
              name="warning-outline"
              size={16}
              color={COLORS.white}
            />

            <Text style={styles.emergencyBannerText}>
              ACTIVE EMERGENCY — Typhoon Egay at Signal 4
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>NEW</Text>

        <View style={styles.sectionList}>
          {newNotifications.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              onPress={() => markOneAsRead(item.id)}
            />
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.earlierLabel]}>
          EARLIER
        </Text>

        <View style={styles.sectionList}>
          {earlierNotifications.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              onPress={() => markOneAsRead(item.id)}
            />
          ))}
        </View>

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
    paddingHorizontal: 20,
    paddingTop: 18,
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
    marginTop: 22,
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
    paddingHorizontal: 7,
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
    minHeight: 126,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 17,
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
  notificationTime: {
    color: COLORS.mutedText,
    fontSize: 11,
    marginTop: 7,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  bottomSpacing: {
    height: 30,
  },
});