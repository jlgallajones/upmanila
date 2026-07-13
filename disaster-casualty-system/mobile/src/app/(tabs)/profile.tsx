import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
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
  deepMaroon: "#5E0B0D",
  white: "#FFFFFF",
  background: "#F3F5F9",
  card: "#FFFFFF",
  text: "#17213A",
  secondaryText: "#69758C",
  mutedText: "#9AA6BA",
  border: "#E5E9F0",
  green: "#28B463",
  greenBackground: "#ECFAF1",
  red: "#D73333",
  redBackground: "#FFF4F4",
  orange: "#E67E22",
};

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
        <Text style={styles.informationLabel}>{label}</Text>
        <Text style={styles.informationValue}>{value}</Text>
      </View>
    </View>
  );
}

type StatisticProps = {
  value: string;
  label: string;
  color: string;
};

function Statistic({
  value,
  label,
  color,
}: StatisticProps) {
  return (
    <View style={styles.statistic}>
      <Text style={[styles.statisticValue, { color }]}>
        {value}
      </Text>

      <Text style={styles.statisticLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
               * Clear SecureStore authentication data here later.
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

          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSubtitle}>
            Responder Dashboard
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>M</Text>
              </View>

              <View style={styles.onlineIndicator}>
                <View style={styles.onlineIndicatorInner} />
              </View>
            </View>

            <View style={styles.profileInformation}>
              <Text style={styles.profileName}>
                Carlos Marcos
              </Text>

              <Text style={styles.profileId}>
                Emergency Responder · ID: ER-2024-0094
              </Text>

              <View style={styles.badgesRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>
                    Level 3 Responder
                  </Text>
                </View>

                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>
                    Active
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statisticsRow}>
            <Statistic
              value="312"
              label="Encoded"
              color={COLORS.maroon}
            />

            <View style={styles.statisticDivider} />

            <Statistic
              value="298"
              label="Verified"
              color="#486B54"
            />

            <View style={styles.statisticDivider} />

            <Statistic
              value="14"
              label="Pending"
              color={COLORS.orange}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            RESPONDER INFORMATION
          </Text>

          <InformationRow
            icon="document-text-outline"
            label="Full Name"
            value="Carlos P. Marcos"
          />

          <InformationRow
            icon="mail-outline"
            label="Email"
            value="c.marcos@ndrrmc.gov.ph"
          />

          <InformationRow
            icon="call-outline"
            label="Mobile"
            value="+63 917 234 5678"
          />

          <InformationRow
            icon="calendar-outline"
            label="Joined"
            value="March 12, 2024"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ASSIGNMENT</Text>

          <InformationRow
            icon="location-outline"
            label="Municipality"
            value="Quezon City"
          />

          <InformationRow
            icon="map-outline"
            label="Barangays Covered"
            value="San Isidro, Batasan, Commonwealth"
          />

          <InformationRow
            icon="people-outline"
            label="Team"
            value="Alpha Response Team — Unit 4"
          />

          <InformationRow
            icon="person-outline"
            label="Supervisor"
            value="Insp. Rosario Dizon"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>SYSTEM</Text>

          <InformationRow
            icon="phone-portrait-outline"
            label="App Version"
            value="DCMS v2.4.1"
          />

          <InformationRow
            icon="sync-outline"
            label="Last Sync"
            value="Today, 02:14 PM"
          />

          <InformationRow
            icon="server-outline"
            label="Local Storage"
            value="18.4 MB used"
          />
        </View>

        <Pressable
          disabled={isLoggingOut}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
            isLoggingOut && styles.logoutButtonDisabled,
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
    minHeight: 118,
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

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 20,
  },

  profileCard: {
    marginTop: -22,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 19,
    backgroundColor: COLORS.card,
    elevation: 4,
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
    fontSize: 30,
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
    borderWidth: 4,
    borderColor: COLORS.green,
  },

  profileInformation: {
    flex: 1,
  },
  profileName: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  profileId: {
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 17,
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
    alignItems: "center",
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

  sectionCard: {
    borderRadius: 17,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 9,
    marginTop: 17,
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
    backgroundColor: "#F7F9FC",
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
    marginTop: 18,
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