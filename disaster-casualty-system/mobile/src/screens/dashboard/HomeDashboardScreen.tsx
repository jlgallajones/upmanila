import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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

import {
  getDashboardSummary,
  getRecentActivity,
  type DashboardSummary,
  type RecentActivity,
} from "../../api/dashboard";
import {
  getQueuedCasualtyCount,
  syncQueuedCasualtySubmissions,
} from "../../offline/casualtyQueue";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  text: "#15213A",
  secondaryText: "#78849A",

  green: "#3B6E54",
  orange: "#E47A18",
  blue: "#267ABD",
  red: "#BF2529",
  gray: "#68758A",

  paleRed: "#FFF0F0",
  paleOrange: "#FFF4E9",
  paleGreen: "#EDF7F1",
  paleBlue: "#EDF5FD",
  paleGray: "#EEF1F5",

  border: "#E4E8EF",
};

const initialSummary: DashboardSummary = {
  encodedToday: 0,
  verifiedRecords: 0,
  pendingRecords: 0,
  activeIncidents: 0,
};

const SCREEN_PADDING = 12;

type SummaryCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  caption: string;
  valueColor: string;
  iconBackground: string;
  iconColor: string;
  loading?: boolean;
};

function SummaryCard({
  icon,
  value,
  label,
  caption,
  valueColor,
  iconBackground,
  iconColor,
  loading = false,
}: SummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <View
        style={[
          styles.summaryIcon,
          {
            backgroundColor: iconBackground,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={iconColor}
        />
      </View>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={valueColor}
          style={styles.summaryLoader}
        />
      ) : (
        <Text
          style={[
            styles.summaryValue,
            {
              color: valueColor,
            },
          ]}
        >
          {value}
        </Text>
      )}

      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryCaption}>{caption}</Text>
    </View>
  );
}

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  caption: string;
  iconColor: string;
  iconBackground: string;
  onPress: () => void;
};

function QuickAction({
  icon,
  label,
  caption,
  iconColor,
  iconBackground,
  onPress,
}: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionCard,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.quickActionIcon,
          {
            backgroundColor: iconBackground,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={iconColor}
        />
      </View>

      <Text style={styles.quickActionLabel}>
        {label}
      </Text>

      <Text style={styles.quickActionCaption}>
        {caption}
      </Text>
    </Pressable>
  );
}

type RecentActivityCardProps = {
  item: RecentActivity;
};

function RecentActivityCard({
  item,
}: RecentActivityCardProps) {
  const fullName = getFullName(item);
  const status = formatStatus(item.current_status);
  const visuals = getStatusVisuals(item.current_status);

  return (
    <Pressable
      onPress={() =>
        router.push(
          `/casualty/${encodeURIComponent(item.id)}` as never,
        )
      }
      style={({ pressed }) => [
        styles.activityCard,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.activityAvatar,
          {
            backgroundColor: visuals.backgroundColor,
          },
        ]}
      >
        <Text
          style={[
            styles.activityInitials,
            {
              color: visuals.color,
            },
          ]}
        >
          {getInitials(fullName)}
        </Text>
      </View>

      <View style={styles.activityInformation}>
        <Text
          style={styles.activityName}
          numberOfLines={1}
        >
          {fullName}
        </Text>

        <Text
          style={styles.activityIncident}
          numberOfLines={1}
        >
          {item.incident?.incident_name ??
            "Incident unavailable"}
        </Text>
      </View>

      <View style={styles.activityMeta}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: visuals.backgroundColor,
            },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: visuals.color,
              },
            ]}
          >
            {status}
          </Text>
        </View>

        <Text style={styles.activityTime}>
          {formatRelativeTime(item.reported_at)}
        </Text>
      </View>
    </Pressable>
  );
}

function getFullName(activity: RecentActivity): string {
  const parts = [
    activity.casualty?.first_name,
    activity.casualty?.middle_name,
    activity.casualty?.last_name,
  ].filter(
    (part): part is string =>
      typeof part === "string" &&
      part.trim().length > 0,
  );

  return parts.length > 0
    ? parts.join(" ")
    : "Unidentified Casualty";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);

  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "UC";
}

function formatStatus(status: string): string {
  if (!status) {
    return "Unknown";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1).toLowerCase()
  );
}

function getStatusVisuals(status: string) {
  switch (status.toLowerCase()) {
    case "missing":
    case "deceased":
      return {
        color: COLORS.red,
        backgroundColor: COLORS.paleRed,
      };

    case "injured":
    case "hospitalized":
      return {
        color: COLORS.orange,
        backgroundColor: COLORS.paleOrange,
      };

    case "safe":
    case "rescued":
    case "evacuated":
      return {
        color: COLORS.green,
        backgroundColor: COLORS.paleGreen,
      };

    case "displaced":
      return {
        color: COLORS.blue,
        backgroundColor: COLORS.paleBlue,
      };

    default:
      return {
        color: COLORS.gray,
        backgroundColor: COLORS.paleGray,
      };
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const differenceMs = Date.now() - date.getTime();
  const differenceMinutes = Math.max(
    0,
    Math.floor(differenceMs / 60000),
  );

  if (differenceMinutes < 1) {
    return "Just now";
  }

  if (differenceMinutes < 60) {
    return `${differenceMinutes} min ago`;
  }

  const differenceHours = Math.floor(
    differenceMinutes / 60,
  );

  if (differenceHours < 24) {
    return `${differenceHours} ${
      differenceHours === 1 ? "hr" : "hrs"
    } ago`;
  }

  const differenceDays = Math.floor(
    differenceHours / 24,
  );

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

export default function HomeDashboardScreen() {
  const [summary, setSummary] =
    useState<DashboardSummary>(initialSummary);

  const [activities, setActivities] = useState<
    RecentActivity[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [queuedCasualtyCount, setQueuedCasualtyCount] =
    useState(0);

  const loadDashboard = useCallback(async () => {
    try {
      setErrorMessage(null);

      const syncResult = await syncQueuedCasualtySubmissions();
      setQueuedCasualtyCount(syncResult.remaining);

      const [summaryData, activityData] =
        await Promise.all([
          getDashboardSummary(),
          getRecentActivity(),
        ]);

      setSummary(summaryData);
      setActivities(activityData);
    } catch (error) {
      console.error(
        "Failed to load dashboard:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard information.",
      );

      const queuedCount = await getQueuedCasualtyCount();
      setQueuedCasualtyCount(queuedCount);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadDashboard();
    }, [loadDashboard]),
  );

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadDashboard();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  const formattedDate = new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  )
    .format(new Date())
    .toUpperCase();

  const activeIncidentCaption =
    summary.activeIncidents === 1
      ? "1 incident currently active"
      : `${summary.activeIncidents} incidents currently active`;

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
          <View style={styles.headerCircleOne} />
          <View style={styles.headerCircleTwo} />

          <View style={styles.headerTopRow}>
            <View style={styles.greetingWrapper}>
              <Text style={styles.greeting}>
                Good day,
              </Text>

              <Text style={styles.responderName}>
                Responder
              </Text>

              <View style={styles.activeRow}>
                <View style={styles.activeDot} />

                <Text style={styles.activeText}>
                  Connected to DCMS
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() =>
                router.push("/notifications")
              }
              style={({ pressed }) => [
                styles.notificationButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color={COLORS.white}
              />

              <View style={styles.notificationDot} />
            </Pressable>
          </View>

          <View style={styles.incidentBanner}>
            <View
              style={[
                styles.incidentDot,
                summary.activeIncidents === 0 &&
                  styles.incidentDotInactive,
              ]}
            />

            <Text style={styles.incidentText}>
              {summary.activeIncidents > 0
                ? `ACTIVE RESPONSE — ${activeIncidentCaption}`
                : "NO ACTIVE DISASTER INCIDENT"}
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
              size={22}
              color={COLORS.red}
            />

            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>
                Unable to update dashboard
              </Text>

              <Text style={styles.errorMessage}>
                {errorMessage}
              </Text>
            </View>

            <Pressable
              onPress={() => void loadDashboard()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.retryText}>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}

        {queuedCasualtyCount > 0 ? (
          <View style={styles.offlineBanner}>
            <Ionicons
              name="cloud-offline-outline"
              size={19}
              color={COLORS.orange}
            />
            <Text style={styles.offlineBannerText}>
              {queuedCasualtyCount} casualty record
              {queuedCasualtyCount === 1 ? "" : "s"} waiting to sync.
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>
          SUMMARY — {formattedDate}
        </Text>

        <View style={styles.summaryGrid}>
          <SummaryCard
            icon="clipboard-outline"
            value={String(summary.encodedToday)}
            label="Encoded Today"
            caption="Records created today"
            valueColor={COLORS.maroon}
            iconBackground={COLORS.paleRed}
            iconColor={COLORS.red}
            loading={isLoading}
          />

          <SummaryCard
            icon="time-outline"
            value={String(summary.pendingRecords)}
            label="Pending Review"
            caption="Awaiting verification"
            valueColor={COLORS.orange}
            iconBackground={COLORS.paleOrange}
            iconColor={COLORS.orange}
            loading={isLoading}
          />

          <SummaryCard
            icon="checkmark-circle-outline"
            value={String(summary.verifiedRecords)}
            label="Verified Records"
            caption="Official records"
            valueColor={COLORS.green}
            iconBackground={COLORS.paleGreen}
            iconColor={COLORS.green}
            loading={isLoading}
          />

          <SummaryCard
            icon="warning-outline"
            value={String(summary.activeIncidents)}
            label="Active Incidents"
            caption="Current responses"
            valueColor={COLORS.blue}
            iconBackground={COLORS.paleBlue}
            iconColor={COLORS.blue}
            loading={isLoading}
          />
        </View>

        <Text style={styles.sectionTitle}>
          QUICK ACTIONS
        </Text>

        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="add-circle-outline"
            label="Add Casualty"
            caption="New record"
            iconColor={COLORS.maroon}
            iconBackground="#F5E9EB"
            onPress={() =>
              router.push("/add-casualty")
            }
          />

          <QuickAction
            icon="document-text-outline"
            label="View Records"
            caption="All entries"
            iconColor={COLORS.green}
            iconBackground={COLORS.paleGreen}
            onPress={() => router.push("/records")}
          />

          <QuickAction
            icon="sync-outline"
            label="Refresh Data"
            caption="Sync now"
            iconColor={COLORS.orange}
            iconBackground={COLORS.paleOrange}
            onPress={() => void handleRefresh()}
          />

          <QuickAction
            icon="person-outline"
            label="My Profile"
            caption="Account"
            iconColor={COLORS.blue}
            iconBackground={COLORS.paleBlue}
            onPress={() => router.push("/profile")}
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            RECENT ACTIVITY
          </Text>

          <Pressable
            onPress={() => router.push("/records")}
          >
            <Text style={styles.seeAllText}>
              See all
            </Text>
          </Pressable>
        </View>

        {isLoading && activities.length === 0 ? (
          <View style={styles.activityLoadingCard}>
            <ActivityIndicator
              size="small"
              color={COLORS.maroon}
            />

            <Text style={styles.activityLoadingText}>
              Loading recent activity...
            </Text>
          </View>
        ) : activities.length > 0 ? (
          <View style={styles.activitiesList}>
            {activities.map((activity) => (
              <RecentActivityCard
                key={activity.id}
                item={activity}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyActivityCard}>
            <Ionicons
              name="document-text-outline"
              size={38}
              color={COLORS.secondaryText}
            />

            <Text style={styles.emptyActivityTitle}>
              No recent activity
            </Text>

            <Text style={styles.emptyActivityDescription}>
              Newly submitted casualty records will appear
              here.
            </Text>
          </View>
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
    backgroundColor: COLORS.maroon,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 7,
    paddingBottom: 28,
  },

  headerCircleOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -60,
    top: -115,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  headerCircleTwo: {
    position: "absolute",
    width: 95,
    height: 95,
    borderRadius: 48,
    right: 55,
    top: -35,
    backgroundColor: "rgba(255,255,255,0.035)",
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  greetingWrapper: {
    flex: 1,
  },

  greeting: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
  },

  responderName: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 7,
  },

  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
  },

  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#31D46D",
    marginRight: 6,
  },

  activeText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 11,
  },

  notificationButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFBE4D",
  },

  incidentBanner: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  incidentDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#FF6B6F",
    marginRight: 10,
  },

  incidentDotInactive: {
    backgroundColor: "#8FD6A7",
  },

  incidentText: {
    flex: 1,
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "700",
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#F2C4C6",
    borderRadius: 14,
    backgroundColor: "#FFF2F2",
    padding: 13,
    marginBottom: 17,
  },

  errorContent: {
    flex: 1,
    marginLeft: 10,
  },

  errorTitle: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "800",
  },

  errorMessage: {
    color: COLORS.secondaryText,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  retryButton: {
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  retryText: {
    color: COLORS.maroon,
    fontSize: 11,
    fontWeight: "800",
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 13,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 26,
  },

  offlineBanner: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F4D3AF",
    borderRadius: 13,
    backgroundColor: COLORS.paleOrange,
    paddingHorizontal: 12,
    marginBottom: 17,
    gap: 8,
  },

  offlineBannerText: {
    flex: 1,
    color: COLORS.orange,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  summaryCard: {
    width: "48.5%",
    minHeight: 146,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#758197",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  summaryIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 11,
  },

  summaryLoader: {
    height: 33,
    alignSelf: "flex-start",
  },

  summaryValue: {
    fontSize: 29,
    fontWeight: "900",
    lineHeight: 33,
  },

  summaryLabel: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 2,
  },

  summaryCaption: {
    color: COLORS.secondaryText,
    fontSize: 10,
    marginTop: 6,
  },

  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  quickActionCard: {
    width: "23.5%",
    minHeight: 120,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: "center",
    paddingHorizontal: 5,
    paddingTop: 14,
    elevation: 2,
    shadowColor: "#758197",
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  quickActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  quickActionLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  quickActionCaption: {
    color: COLORS.secondaryText,
    fontSize: 9,
    textAlign: "center",
    marginTop: 5,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  seeAllText: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 13,
  },

  activitiesList: {
    gap: 10,
  },

  activityCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: "#758197",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  activityAvatar: {
    width: 41,
    height: 41,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  activityInitials: {
    fontSize: 13,
    fontWeight: "900",
  },

  activityInformation: {
    flex: 1,
    minWidth: 0,
  },

  activityName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  activityIncident: {
    color: COLORS.secondaryText,
    fontSize: 10,
    marginTop: 6,
  },

  activityMeta: {
    alignItems: "flex-end",
    marginLeft: 8,
  },

  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  statusBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },

  activityTime: {
    color: COLORS.secondaryText,
    fontSize: 9,
    marginTop: 7,
  },

  activityLoadingCard: {
    minHeight: 85,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: COLORS.white,
  },

  activityLoadingText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginLeft: 10,
  },

  emptyActivityCard: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: COLORS.white,
    paddingHorizontal: 25,
  },

  emptyActivityTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },

  emptyActivityDescription: {
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 5,
  },

  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },

  bottomSpacing: {
    height: 28,
  },
});
