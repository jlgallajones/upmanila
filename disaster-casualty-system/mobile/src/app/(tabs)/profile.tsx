import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  getProfile,
  type ProfileData,
} from "../../api/profile";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  card: "#FFFFFF",
  text: "#17213A",
  secondaryText: "#69758C",
  mutedText: "#9AA6BA",
  border: "#E5E9F0",

  green: "#28B463",
  greenDark: "#486B54",
  greenBackground: "#ECFAF1",

  red: "#D73333",
  redBackground: "#FFF4F4",

  orange: "#E67E22",
  orangeBackground: "#FFF3E5",

  iconBackground: "#F7F9FC",
};

const testUserId =
  process.env.EXPO_PUBLIC_TEST_USER_ID;

type InformationRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function InformationRow({
  icon,
  label,
  value,
}: InformationRowProps) {
  return (
    <View style={styles.informationRow}>
      <View style={styles.informationIcon}>
        <Ionicons
          name={icon}
          size={17}
          color="#8D9AB0"
        />
      </View>

      <View style={styles.informationContent}>
        <Text style={styles.informationLabel}>
          {label}
        </Text>

        <Text style={styles.informationValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

type StatisticProps = {
  value: number;
  label: string;
  color: string;
  loading: boolean;
};

function Statistic({
  value,
  label,
  color,
  loading,
}: StatisticProps) {
  return (
    <View style={styles.statistic}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={color}
        />
      ) : (
        <Text
          style={[
            styles.statisticValue,
            {
              color,
            },
          ]}
        >
          {value}
        </Text>
      )}

      <Text style={styles.statisticLabel}>
        {label}
      </Text>
    </View>
  );
}

function formatRole(role: string): string {
  return role
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "U";
}

export default function ProfileScreen() {
  const [profile, setProfile] =
    useState<ProfileData | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [lastLoadedAt, setLastLoadedAt] =
    useState<Date | null>(null);

  const loadProfile = useCallback(async () => {
    if (!testUserId) {
      setErrorMessage(
        "EXPO_PUBLIC_TEST_USER_ID is missing from the mobile .env file.",
      );
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage(null);

      const data = await getProfile(testUserId);

      setProfile(data);
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(
        "Unable to load profile:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load profile information.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadProfile();
    }, [loadProfile]),
  );

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadProfile();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadProfile]);

  function handleLogout() {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out from DCMS?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoggingOut(true);

              /*
               * Supabase sign-out and SecureStore cleanup
               * will be added when authentication is connected.
               */

              router.replace("/login");
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
    );
  }

  const user = profile?.user;

  const statistics = profile?.statistics ?? {
    encoded: 0,
    verified: 0,
    pending: 0,
  };

  const fullName =
    user?.full_name ?? "Loading profile...";

  const role = user
    ? formatRole(user.role)
    : "Responder";

  const initials = getInitials(fullName);

  const assignedBarangay =
    user?.assigned_barangay ??
    "No assigned barangay";

  const assignedMunicipality =
    user?.assigned_municipality ??
    "No assigned municipality";

  const appVersion =
    Constants.expoConfig?.version ?? "1.0.0";

  const lastSync = lastLoadedAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(lastLoadedAt)
    : "Not synced";

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
          <View style={styles.headerDecorationOne} />
          <View style={styles.headerDecorationTwo} />

          <Text style={styles.headerTitle}>
            My Profile
          </Text>

          <Text style={styles.headerSubtitle}>
            Responder Dashboard
          </Text>
        </View>
      </SafeAreaView>

      <View style={styles.profileCardWrapper}>
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initials}
                </Text>
              </View>

              <View style={styles.onlineIndicator}>
                <View
                  style={[
                    styles.onlineIndicatorInner,
                    !user?.is_active &&
                      styles.offlineIndicatorInner,
                  ]}
                />
              </View>
            </View>

            <View style={styles.profileInformation}>
              <Text
                style={styles.profileName}
                numberOfLines={1}
              >
                {fullName}
              </Text>

              <Text
                style={styles.profileId}
                numberOfLines={2}
              >
                {role} · ID:{" "}
                {user?.id
                  ? user.id.slice(0, 8).toUpperCase()
                  : "--------"}
              </Text>

              <View style={styles.badgesRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>
                    {role}
                  </Text>
                </View>

                <View
                  style={[
                    styles.activeBadge,
                    !user?.is_active &&
                      styles.inactiveBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.activeBadgeText,
                      !user?.is_active &&
                        styles.inactiveBadgeText,
                    ]}
                  >
                    {user?.is_active
                      ? "Active"
                      : "Inactive"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statisticsRow}>
            <Statistic
              value={statistics.encoded}
              label="Encoded"
              color={COLORS.maroon}
              loading={isLoading}
            />

            <View style={styles.statisticDivider} />

            <Statistic
              value={statistics.verified}
              label="Verified"
              color={COLORS.greenDark}
              loading={isLoading}
            />

            <View style={styles.statisticDivider} />

            <Statistic
              value={statistics.pending}
              label="Pending"
              color={COLORS.orange}
              loading={isLoading}
            />
          </View>
        </View>
      </View>

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
                Unable to load profile
              </Text>

              <Text style={styles.errorMessage}>
                {errorMessage}
              </Text>
            </View>

            <Pressable
              onPress={() => void loadProfile()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            RESPONDER INFORMATION
          </Text>

          <InformationRow
            icon="document-text-outline"
            label="Full Name"
            value={user?.full_name ?? "Unavailable"}
          />

          <InformationRow
            icon="mail-outline"
            label="Email"
            value={user?.email ?? "Unavailable"}
          />

          <InformationRow
            icon="call-outline"
            label="Mobile"
            value={
              user?.phone_number ??
              "No phone number"
            }
          />

          <InformationRow
            icon="calendar-outline"
            label="Joined"
            value={
              user?.created_at
                ? formatDate(user.created_at)
                : "Unavailable"
            }
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            ASSIGNMENT
          </Text>

          <InformationRow
            icon="location-outline"
            label="Municipality"
            value={assignedMunicipality}
          />

          <InformationRow
            icon="map-outline"
            label="Barangay Covered"
            value={assignedBarangay}
          />

          <InformationRow
            icon="briefcase-outline"
            label="Role"
            value={role}
          />

          <InformationRow
            icon="shield-checkmark-outline"
            label="Account Status"
            value={
              user?.is_active
                ? "Active"
                : "Inactive"
            }
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            SYSTEM
          </Text>

          <InformationRow
            icon="phone-portrait-outline"
            label="App Version"
            value={`DCMS v${appVersion}`}
          />

          <InformationRow
            icon="sync-outline"
            label="Last Profile Sync"
            value={lastSync}
          />

          <InformationRow
            icon="cloud-done-outline"
            label="Server Connection"
            value={
              errorMessage
                ? "Connection problem"
                : "Connected"
            }
          />
        </View>

        <Pressable
          disabled={isLoggingOut}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed &&
              styles.logoutButtonPressed,
            isLoggingOut &&
              styles.logoutButtonDisabled,
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={21}
            color={COLORS.red}
          />

          <Text style={styles.logoutButtonText}>
            {isLoggingOut
              ? "Logging out..."
              : "Logout from DCMS"}
          </Text>
        </Pressable>

        <Text style={styles.footerText}>
          Disaster Casualty Management System
        </Text>

        <Text style={styles.footerVersion}>
          University of the Philippines
        </Text>

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
    minHeight: 150,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingTop: 10,
    backgroundColor: COLORS.maroon,
  },

  headerDecorationOne: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -68,
    top: -125,
    backgroundColor: "rgba(255,255,255,0.045)",
  },

  headerDecorationTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    left: -35,
    bottom: -105,
    backgroundColor: "rgba(255,255,255,0.04)",
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

  profileCardWrapper: {
    marginTop: -52,
    paddingHorizontal: 4,
    zIndex: 30,
    elevation: 30,
  },

  profileCard: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 19,
    backgroundColor: COLORS.card,
    elevation: 12,
    shadowColor: "#72809A",
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },

  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatarWrapper: {
    position: "relative",
    marginRight: 15,
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6E392C",
  },

  avatarText: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: "900",
  },

  onlineIndicator: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  onlineIndicatorInner: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: COLORS.green,
    borderWidth: 3,
    borderColor: COLORS.white,
  },

  offlineIndicatorInner: {
    backgroundColor: COLORS.red,
  },

  profileInformation: {
    flex: 1,
    minWidth: 0,
  },

  profileName: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },

  profileId: {
    color: COLORS.secondaryText,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
  },

  levelBadge: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#FFF2F2",
    borderWidth: 1,
    borderColor: "#F4BFC1",
  },

  levelBadgeText: {
    color: COLORS.maroon,
    fontSize: 9,
    fontWeight: "800",
  },

  activeBadge: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: COLORS.greenBackground,
    borderWidth: 1,
    borderColor: "#B9E8C9",
  },

  activeBadgeText: {
    color: "#24733E",
    fontSize: 9,
    fontWeight: "800",
  },

  inactiveBadge: {
    backgroundColor: COLORS.redBackground,
    borderColor: "#F3BFC1",
  },

  inactiveBadgeText: {
    color: COLORS.red,
  },

  divider: {
    height: 1,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: COLORS.border,
  },

  statisticsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  statistic: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },

  statisticValue: {
    fontSize: 25,
    fontWeight: "900",
  },

  statisticLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    marginTop: 7,
  },

  statisticDivider: {
    width: 1,
    height: 47,
    backgroundColor: COLORS.border,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 4,
    paddingTop: 17,
    paddingBottom: 20,
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

  sectionCard: {
    borderRadius: 17,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 9,
    marginBottom: 17,
    backgroundColor: COLORS.card,
    elevation: 2,
    shadowColor: "#718099",
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  sectionTitle: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.3,
    marginBottom: 13,
  },

  informationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 58,
  },

  informationIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: COLORS.iconBackground,
    borderWidth: 1,
    borderColor: "#EDF0F5",
  },

  informationContent: {
    flex: 1,
    paddingTop: 1,
  },

  informationLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
  },

  informationValue: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 4,
  },

  logoutButton: {
    minHeight: 57,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFCACA",
    backgroundColor: COLORS.redBackground,
    gap: 9,
  },

  logoutButtonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },

  logoutButtonDisabled: {
    opacity: 0.55,
  },

  logoutButtonText: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: "800",
  },

  footerText: {
    color: COLORS.secondaryText,
    fontSize: 10,
    textAlign: "center",
    marginTop: 24,
  },

  footerVersion: {
    color: COLORS.mutedText,
    fontSize: 9,
    textAlign: "center",
    marginTop: 5,
  },

  bottomSpacing: {
    height: 25,
  },
});