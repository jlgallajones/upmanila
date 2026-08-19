import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { isAuthenticationTokenError } from "../../api/client";
import { clearSession, getCurrentUserId } from "../../auth/session";
import {
  getResponderAssignment,
  saveResponderAssignment,
  type ResponderAssignment,
} from "../../auth/responderAssignment";

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

const SCREEN_PADDING = 16;

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

function isResponderRole(role: string | null | undefined): boolean {
  return (
    role === "responder" ||
    role === "field_responder" ||
    role === "sa_responder"
  );
}

function getProfileSubtitle(role: string | null | undefined): string {
  if (role === "documenter" || role === "medical_personnel") {
    return "Healthcare Facility Dashboard";
  }

  if (isResponderRole(role)) {
    return "Responder Dashboard";
  }

  if (role === "admin" || role === "administrator") {
    return "Administrator Dashboard";
  }

  if (role === "super_admin") {
    return "Super Admin Dashboard";
  }

  return "Account Dashboard";
}

function getInformationSectionTitle(
  role: string | null | undefined,
): string {
  if (role === "documenter" || role === "medical_personnel") {
    return "DOCUMENTATION INFORMATION";
  }

  if (isResponderRole(role)) {
    return "RESPONDER INFORMATION";
  }

  return "ACCOUNT INFORMATION";
}

function getDefaultResponderAssignment(
  role: string | null | undefined,
): ResponderAssignment | null {
  if (role === "field_responder") {
    return "field_responder";
  }

  if (role === "sa_responder") {
    return "sa_responder";
  }

  return null;
}

function formatResponderAssignment(
  assignment: ResponderAssignment | null,
): string {
  switch (assignment) {
    case "field_responder":
      return "Field Responder";
    case "sa_responder":
      return "Stabilization Area Responder";
    default:
      return "Not selected";
  }
}

function formatReportingContext(
  reportingContext: string | null | undefined,
): string {
  switch (reportingContext) {
    case "scene":
      return "Scene";
    case "transport":
      return "Transport / Ambulance";
    case "receiving_facility_ed":
      return "Receiving Facility / ED";
    case "hospital_ward":
      return "Hospital Ward";
    case "evacuation_center":
      return "Evacuation Center";
    case "command_admin":
      return "Command / Admin";
    default:
      return "Not assigned";
  }
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

  const [
    selectedResponderAssignment,
    setSelectedResponderAssignment,
  ] = useState<ResponderAssignment | null>(null);

  const loadProfile = useCallback(async () => {
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      setProfile(null);
      setErrorMessage(null);
      setLastLoadedAt(null);
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage(null);

      const data = await getProfile(currentUserId);

      setProfile(data);
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(
        "Unable to load profile:",
        error,
      );

      if (isAuthenticationTokenError(error)) {
        setProfile(null);
        setErrorMessage(null);
        setLastLoadedAt(null);
        return;
      }

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
      void getResponderAssignment().then(
        setSelectedResponderAssignment,
      );
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

  async function performLogout() {
    try {
      setIsLoggingOut(true);

      await clearSession();

      setProfile(null);
      setErrorMessage(null);
      setLastLoadedAt(null);

      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleLogout() {
    if (Platform.OS === "web") {
      const shouldLogout =
        typeof window === "undefined"
          ? true
          : window.confirm(
              "Are you sure you want to log out from DCMS?",
            );

      if (shouldLogout) {
        void performLogout();
      }

      return;
    }

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
            await performLogout();
          },
        },
      ],
    );
  }

  async function handleResponderAssignmentChange(
    assignment: ResponderAssignment,
  ) {
    await saveResponderAssignment(assignment);
    setSelectedResponderAssignment(assignment);
  }

  const user = profile?.user;
  const isResponderAccount = isResponderRole(user?.role);
  const effectiveResponderAssignment =
    selectedResponderAssignment ??
    getDefaultResponderAssignment(user?.role);

  const statistics = profile?.statistics ?? {
    encoded: 0,
    verified: 0,
    pending: 0,
  };

  const fullName =
    user?.full_name ?? "Guest Responder";

  const role = user
    ? formatRole(user.role)
    : "Offline Capture";

  const initials = getInitials(fullName);

  const assignedBarangay =
    user?.assigned_barangay ??
    "No assigned barangay";

  const assignedMunicipality =
    user?.assigned_municipality ??
    "No assigned municipality";

  const reportingContext = formatReportingContext(
    user?.reporting_context,
  );
  const profileSubtitle = getProfileSubtitle(user?.role);
  const informationSectionTitle = getInformationSectionTitle(user?.role);

  const appVersion =
    Constants.expoConfig?.version ?? "1.0.0";

  const lastSync = lastLoadedAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(lastLoadedAt)
    : "Not synced";

  const responderFunctionCard = isResponderAccount ? (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>
        RESPONDER FUNCTION
      </Text>

      <Text style={styles.assignmentHelpText}>
        Choose which responder window this account should use when adding casualties.
      </Text>

      <View style={styles.assignmentOptions}>
        <Pressable
          onPress={() =>
            void handleResponderAssignmentChange(
              "field_responder",
            )
          }
          style={({ pressed }) => [
            styles.assignmentOption,
            effectiveResponderAssignment ===
              "field_responder" &&
              styles.assignmentOptionSelected,
            pressed && styles.assignmentOptionPressed,
          ]}
        >
          <View style={styles.assignmentOptionIcon}>
            <Ionicons
              name="medkit-outline"
              size={19}
              color={
                effectiveResponderAssignment ===
                "field_responder"
                  ? COLORS.white
                  : COLORS.maroon
              }
            />
          </View>

          <View style={styles.assignmentOptionTextGroup}>
            <Text
              style={[
                styles.assignmentOptionTitle,
                effectiveResponderAssignment ===
                  "field_responder" &&
                  styles.assignmentOptionTitleSelected,
              ]}
            >
              Field Responder
            </Text>
            <Text
              style={[
                styles.assignmentOptionDescription,
                effectiveResponderAssignment ===
                  "field_responder" &&
                  styles.assignmentOptionDescriptionSelected,
              ]}
            >
              Add Casualty shows only Triage and Status notes.
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() =>
            void handleResponderAssignmentChange(
              "sa_responder",
            )
          }
          style={({ pressed }) => [
            styles.assignmentOption,
            effectiveResponderAssignment ===
              "sa_responder" &&
              styles.assignmentOptionSelected,
            pressed && styles.assignmentOptionPressed,
          ]}
        >
          <View style={styles.assignmentOptionIcon}>
            <Ionicons
              name="bandage-outline"
              size={19}
              color={
                effectiveResponderAssignment ===
                "sa_responder"
                  ? COLORS.white
                  : COLORS.maroon
              }
            />
          </View>

          <View style={styles.assignmentOptionTextGroup}>
            <Text
              style={[
                styles.assignmentOptionTitle,
                effectiveResponderAssignment ===
                  "sa_responder" &&
                  styles.assignmentOptionTitleSelected,
              ]}
            >
              Stabilization Area Responder
            </Text>
            <Text
              style={[
                styles.assignmentOptionDescription,
                effectiveResponderAssignment ===
                  "sa_responder" &&
                  styles.assignmentOptionDescriptionSelected,
              ]}
            >
              Add Casualty keeps the original full form for now.
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  ) : null;

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
            {profileSubtitle}
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
                      : "Guest"}
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

        {!user ? (
          <View style={styles.guestCard}>
            <Ionicons
              name="cloud-offline-outline"
              size={22}
              color={COLORS.orange}
            />

            <View style={styles.guestContent}>
              <Text style={styles.guestTitle}>
                Guest capture mode
              </Text>

              <Text style={styles.guestMessage}>
                You can add casualty records offline. Log in to sync, view cloud records, and manage incidents.
              </Text>
            </View>
          </View>
        ) : null}

        {responderFunctionCard}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {informationSectionTitle}
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
            icon="navigate-outline"
            label="Reporting Context"
            value={reportingContext}
          />

          {isResponderAccount ? (
            <InformationRow
              icon="swap-horizontal-outline"
              label="Responder Function"
              value={formatResponderAssignment(
                effectiveResponderAssignment,
              )}
            />
          ) : null}

          <InformationRow
            icon="shield-checkmark-outline"
            label="Account Status"
            value={
              user
                ? user.is_active
                  ? "Active"
                  : "Inactive"
                : "Guest mode"
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
              !user
                ? "Login required"
                : errorMessage
                ? "Connection problem"
                : "Connected"
            }
          />
        </View>

        <Pressable
          disabled={isLoggingOut}
          onPress={() => {
            if (user) {
              handleLogout();
              return;
            }

            router.push("/login");
          }}
          style={({ pressed }) => [
            user ? styles.logoutButton : styles.loginButton,
            pressed &&
              styles.logoutButtonPressed,
            isLoggingOut &&
              styles.logoutButtonDisabled,
          ]}
        >
          <Ionicons
            name={user ? "log-out-outline" : "log-in-outline"}
            size={21}
            color={user ? COLORS.red : COLORS.white}
          />

          <Text
            style={
              user
                ? styles.logoutButtonText
                : styles.loginButtonText
            }
          >
            {user
              ? isLoggingOut
                ? "Logging out..."
                : "Logout from DCMS"
              : "Login to DCMS"}
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
    paddingHorizontal: SCREEN_PADDING,
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
    paddingHorizontal: SCREEN_PADDING,
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
    paddingHorizontal: SCREEN_PADDING,
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

  guestCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#F4D3AF",
    backgroundColor: COLORS.orangeBackground,
  },

  guestContent: {
    flex: 1,
    marginLeft: 9,
  },

  guestTitle: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: "800",
  },

  guestMessage: {
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

  assignmentHelpText: {
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },

  assignmentOptions: {
    gap: 10,
    paddingBottom: 7,
  },

  assignmentOption: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.iconBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  assignmentOptionSelected: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },

  assignmentOptionPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },

  assignmentOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  assignmentOptionTextGroup: {
    flex: 1,
    minWidth: 0,
  },

  assignmentOptionTitle: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },

  assignmentOptionTitleSelected: {
    color: COLORS.white,
  },

  assignmentOptionDescription: {
    color: COLORS.secondaryText,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  assignmentOptionDescriptionSelected: {
    color: "rgba(255,255,255,0.78)",
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

  loginButton: {
    minHeight: 57,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: COLORS.maroon,
    gap: 9,
  },

  loginButtonText: {
    color: COLORS.white,
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
