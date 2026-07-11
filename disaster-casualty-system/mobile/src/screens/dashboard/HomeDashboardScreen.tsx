import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
  darkMaroon: "#600C0E",
  lightMaroon: "#A7191D",
  white: "#FFFFFF",
  background: "#F3F5F9",
  text: "#15213A",
  secondaryText: "#78849A",
  green: "#3B6E54",
  orange: "#E47A18",
  blue: "#267ABD",
  red: "#BF2529",
  paleRed: "#FFF0F0",
  paleOrange: "#FFF4E9",
  paleGreen: "#EDF7F1",
  paleBlue: "#EDF5FD",
  border: "#E4E8EF",
};

type SummaryCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  caption: string;
  valueColor: string;
  iconBackground: string;
  iconColor: string;
};

function SummaryCard({
  icon,
  value,
  label,
  caption,
  valueColor,
  iconBackground,
  iconColor,
}: SummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <View
        style={[
          styles.summaryIcon,
          { backgroundColor: iconBackground },
        ]}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <Text style={[styles.summaryValue, { color: valueColor }]}>
        {value}
      </Text>

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
          { backgroundColor: iconBackground },
        ]}
      >
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>

      <Text style={styles.quickActionLabel}>{label}</Text>
      <Text style={styles.quickActionCaption}>{caption}</Text>
    </Pressable>
  );
}

type RecentActivityProps = {
  initials: string;
  name: string;
  incident: string;
  status: string;
  time: string;
  accentColor: string;
  iconBackground: string;
  statusBackground: string;
};

function RecentActivity({
  initials,
  name,
  incident,
  status,
  time,
  accentColor,
  iconBackground,
  statusBackground,
}: RecentActivityProps) {
  return (
    <Pressable style={({ pressed }) => [
      styles.activityCard,
      pressed && styles.pressed,
    ]}>
      <View
        style={[
          styles.activityAvatar,
          { backgroundColor: iconBackground },
        ]}
      >
        <Text style={[styles.activityInitials, { color: accentColor }]}>
          {initials}
        </Text>
      </View>

      <View style={styles.activityInformation}>
        <Text style={styles.activityName}>{name}</Text>
        <Text style={styles.activityIncident}>{incident}</Text>
      </View>

      <View style={styles.activityMeta}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusBackground },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: accentColor }]}>
            {status}
          </Text>
        </View>

        <Text style={styles.activityTime}>{time}</Text>
      </View>
    </Pressable>
  );
}

export default function HomeDashboardScreen() {
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
              <Text style={styles.greeting}>Good afternoon,</Text>
              <Text style={styles.responderName}>
                Responder Marcos
              </Text>

              <View style={styles.activeRow}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>
                  Active · Brgy. San Isidro, QC
                </Text>
              </View>
            </View>

            <Pressable style={styles.notificationButton}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={COLORS.white}
              />

              <View style={styles.notificationDot} />
            </Pressable>
          </View>

          <View style={styles.incidentBanner}>
            <View style={styles.incidentDot} />

            <Text style={styles.incidentText}>
              Active: Typhoon Egay — Level 3 Response
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>
          SUMMARY — JULY 10, 2026
        </Text>

        <View style={styles.summaryGrid}>
          <SummaryCard
            icon="clipboard-outline"
            value="47"
            label="Encoded Today"
            caption="+12 this hour"
            valueColor={COLORS.maroon}
            iconBackground={COLORS.paleRed}
            iconColor={COLORS.red}
          />

          <SummaryCard
            icon="sync-outline"
            value="8"
            label="Pending Sync"
            caption="Awaiting connection"
            valueColor={COLORS.orange}
            iconBackground={COLORS.paleOrange}
            iconColor={COLORS.orange}
          />

          <SummaryCard
            icon="star-outline"
            value="312"
            label="Verified Records"
            caption="All incidents"
            valueColor={COLORS.green}
            iconBackground={COLORS.paleGreen}
            iconColor={COLORS.green}
          />

          <SummaryCard
            icon="warning-outline"
            value="3"
            label="Active Incidents"
            caption="Typhoon Egay + 2"
            valueColor={COLORS.blue}
            iconBackground={COLORS.paleBlue}
            iconColor={COLORS.blue}
          />
        </View>

        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="add-circle-outline"
            label="Add Casualty"
            caption="New record"
            iconColor={COLORS.maroon}
            iconBackground="#F5E9EB"
            onPress={() => router.push("/(tabs)/add-casualty")}
          />

          <QuickAction
            icon="document-text-outline"
            label="View Records"
            caption="All entries"
            iconColor={COLORS.green}
            iconBackground="#EEF3EF"
            onPress={() => router.push("/(tabs)/records")}
          />

          <QuickAction
            icon="sync-outline"
            label="Sync Data"
            caption="8 pending"
            iconColor={COLORS.orange}
            iconBackground={COLORS.paleOrange}
            onPress={() => {}}
          />

          <QuickAction
            icon="person-outline"
            label="My Profile"
            caption="Settings"
            iconColor={COLORS.blue}
            iconBackground={COLORS.paleBlue}
            onPress={() => router.push("/(tabs)/profile")}
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>

          <Pressable onPress={() => router.push("/(tabs)/records")}>
            <Text style={styles.seeAllText}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.activitiesList}>
          <RecentActivity
            initials="J"
            name="Juan dela Cruz"
            incident="Typhoon Egay"
            status="Injured"
            time="14 min ago"
            accentColor={COLORS.orange}
            iconBackground={COLORS.paleOrange}
            statusBackground={COLORS.paleOrange}
          />

          <RecentActivity
            initials="M"
            name="Maria Santos"
            incident="Flooding - QC"
            status="Evacuated"
            time="38 min ago"
            accentColor={COLORS.green}
            iconBackground="#EEF3EF"
            statusBackground="#EEF3EF"
          />

          <RecentActivity
            initials="R"
            name="Roberto Reyes"
            incident="Typhoon Egay"
            status="Missing"
            time="1 hr ago"
            accentColor={COLORS.red}
            iconBackground="#F8E7E8"
            statusBackground="#FCE9EA"
          />
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
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 10,
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
  incidentText: {
    flex: 1,
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 5,
    paddingTop: 20,
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
  summaryCard: {
    width: "48.5%",
    minHeight: 146,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#758197",
    shadowOpacity: 0.10,
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
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
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
  bottomSpacing: {
    height: 28,
  },
});