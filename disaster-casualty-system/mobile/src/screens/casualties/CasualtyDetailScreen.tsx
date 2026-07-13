import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
  white: "#FFFFFF",
  background: "#F3F5F9",
  card: "#FFFFFF",
  text: "#17213A",
  secondary: "#8490A8",
  border: "#E5E9F0",

  orange: "#E87916",
  orangeBackground: "#FFF0DE",
  orangeBorder: "#F6C78F",

  green: "#26975A",
  greenBackground: "#DDF7E8",

  blue: "#2582BA",
  blueBackground: "#E4F3FD",

  grayBackground: "#F2F5F9",
};

type DetailRowProps = {
  label: string;
  value: string;
  valueColor?: string;
};

function DetailRow({
  label,
  value,
  valueColor = COLORS.text,
}: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>

      <Text
        style={[
          styles.detailValue,
          {
            color: valueColor,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

type SectionCardProps = {
  title: string;
  children: React.ReactNode;
};

function SectionCard({
  title,
  children,
}: SectionCardProps) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

type TimelineItemProps = {
  title: string;
  time: string;
  user: string;
  color: string;
  backgroundColor: string;
  isLast?: boolean;
};

function TimelineItem({
  title,
  time,
  user,
  color,
  backgroundColor,
  isLast = false,
}: TimelineItemProps) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineIndicatorColumn}>
        <View
          style={[
            styles.timelineIcon,
            {
              backgroundColor,
              borderColor: color,
            },
          ]}
        >
          <View
            style={[
              styles.timelineDot,
              {
                backgroundColor: color,
              },
            ]}
          />
        </View>

        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>

      <View style={styles.timelineContent}>
        <Text
          style={[
            styles.timelineTitle,
            {
              color,
            },
          ]}
        >
          {title}
        </Text>

        <Text style={styles.timelineTime}>{time}</Text>
        <Text style={styles.timelineUser}>By: {user}</Text>
      </View>
    </View>
  );
}

export default function CasualtyDetailScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const casualty = {
    id: id ?? "C-2026-001",
    fullName: "Juan dela Cruz",
    initials: "J",
    age: 42,
    sex: "Male",
    dateOfBirth: "January 15, 1984",

    street: "123 Rizal Ave., Brgy. San Isidro",
    municipality: "Quezon City",
    province: "Metro Manila",

    incident: "Typhoon Egay",
    evacuationCenter: "Batasan Elementary School",
    gpsLocation: "14.6760° N, 121.0437° E",
    dateTime: "July 10, 2026 · 09:00 AM",

    status: "Injured",
    injury:
      "Laceration on right arm, possible fracture — Requires hospital evaluation",

    lastUpdated: "09:14 AM",
    verified: true,
  };

  function handleEdit() {
    Alert.alert(
      "Edit casualty",
      `Editing ${casualty.id} will be added later.`,
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
          <View style={styles.headerDecoration} />

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={23}
              color={COLORS.white}
            />
          </Pressable>

          <Text style={styles.recordCode}>
            CASUALTY RECORD · {casualty.id}
          </Text>

          <Text style={styles.headerName}>
            {casualty.fullName}
          </Text>

          <View style={styles.headerStatusRow}>
            <View style={styles.headerStatusBadge}>
              <View style={styles.headerStatusDot} />

              <Text style={styles.headerStatusText}>
                {casualty.status}
              </Text>
            </View>

            <Text style={styles.lastUpdated}>
              Last updated: {casualty.lastUpdated}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.identityCardWrapper}>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {casualty.initials}
            </Text>
          </View>

          <View style={styles.identityInformation}>
            <Text style={styles.identityName}>
              {casualty.fullName}
            </Text>

            <Text style={styles.identityDescription}>
              {casualty.sex} · {casualty.age} years old ·{" "}
              {casualty.dateOfBirth}
            </Text>

            <View style={styles.identityBadges}>
              <View style={styles.idBadge}>
                <Text style={styles.idBadgeText}>
                  ID: {casualty.id}
                </Text>
              </View>

              {casualty.verified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons
                    name="checkmark"
                    size={13}
                    color={COLORS.green}
                  />

                  <Text style={styles.verifiedText}>
                    Verified
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={COLORS.maroon}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard title="PERSONAL INFORMATION">
          <DetailRow
            label="Full Name"
            value={casualty.fullName}
          />

          <DetailRow
            label="Age"
            value={`${casualty.age} years old`}
          />

          <DetailRow
            label="Sex"
            value={casualty.sex}
          />

          <DetailRow
            label="Date of Birth"
            value={casualty.dateOfBirth}
          />
        </SectionCard>

        <SectionCard title="ADDRESS">
          <DetailRow
            label="Street"
            value={casualty.street}
          />

          <DetailRow
            label="Municipality"
            value={casualty.municipality}
          />

          <DetailRow
            label="Province"
            value={casualty.province}
          />
        </SectionCard>

        <SectionCard title="INCIDENT INFORMATION">
          <DetailRow
            label="Disaster Incident"
            value={casualty.incident}
          />

          <DetailRow
            label="Evacuation Center"
            value={casualty.evacuationCenter}
          />

          <DetailRow
            label="GPS Location"
            value={casualty.gpsLocation}
            valueColor={COLORS.maroon}
          />

          <DetailRow
            label="Date & Time"
            value={casualty.dateTime}
          />
        </SectionCard>

        <SectionCard title="MEDICAL STATUS">
          <View style={styles.medicalStatusCard}>
            <View style={styles.medicalIcon}>
              <Ionicons
                name="warning-outline"
                size={26}
                color={COLORS.white}
              />
            </View>

            <View style={styles.medicalContent}>
              <Text style={styles.medicalTitle}>
                {casualty.status}
              </Text>

              <Text style={styles.medicalDescription}>
                {casualty.injury}
              </Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="STATUS TIMELINE">
          <TimelineItem
            title="Injured"
            time="09:14 AM · Jul 10, 2026"
            user="Responder Marcos"
            color={COLORS.orange}
            backgroundColor={COLORS.orangeBackground}
          />

          <TimelineItem
            title="Reported"
            time="09:05 AM · Jul 10, 2026"
            user="Responder Marcos"
            color={COLORS.blue}
            backgroundColor={COLORS.blueBackground}
          />

          <TimelineItem
            title="Encoded"
            time="09:00 AM · Jul 10, 2026"
            user="Responder Marcos"
            color={COLORS.green}
            backgroundColor={COLORS.greenBackground}
            isLast
          />
        </SectionCard>

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
    minHeight: 225,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: COLORS.maroon,
  },

  headerDecoration: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -55,
    top: -100,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  recordCode: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    letterSpacing: 0.2,
    marginTop: 15,
  },

  headerName: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10,
  },

  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
  },

  headerStatusBadge: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: "#B15A0F",
    borderWidth: 1,
    borderColor: "#E38E30",
  },

  headerStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: COLORS.white,
  },

  headerStatusText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "800",
  },

  lastUpdated: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 10,
    marginLeft: 11,
  },

  identityCardWrapper: {
    marginTop: -44,
    paddingHorizontal: 11,
    zIndex: 30,
    elevation: 30,
  },

  identityCard: {
    minHeight: 133,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    elevation: 12,
    shadowColor: "#71809A",
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },

  avatar: {
    width: 67,
    height: 67,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
    backgroundColor: COLORS.maroon,
  },

  avatarText: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: "900",
  },

  identityInformation: {
    flex: 1,
  },

  identityName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  identityDescription: {
    color: COLORS.secondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  identityBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 7,
  },

  idBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: COLORS.grayBackground,
  },

  idBadgeText: {
    color: COLORS.secondary,
    fontSize: 9,
  },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: COLORS.greenBackground,
  },

  verifiedText: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: "800",
    marginLeft: 3,
  },

  editButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 11,
    paddingTop: 17,
    paddingBottom: 25,
  },

  sectionCard: {
    marginTop: 17,
    paddingHorizontal: 16,
    paddingTop: 19,
    paddingBottom: 13,
    borderRadius: 18,
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
    marginBottom: 14,
  },

  detailRow: {
    minHeight: 31,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  detailLabel: {
    width: "40%",
    color: COLORS.secondary,
    fontSize: 11,
    lineHeight: 17,
  },

  detailValue: {
    width: "58%",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "right",
  },

  medicalStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
    backgroundColor: COLORS.orangeBackground,
  },

  medicalIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: COLORS.orange,
  },

  medicalContent: {
    flex: 1,
  },

  medicalTitle: {
    color: "#B95307",
    fontSize: 14,
    fontWeight: "900",
  },

  medicalDescription: {
    color: "#C35C0F",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  timelineItem: {
    minHeight: 92,
    flexDirection: "row",
  },

  timelineIndicatorColumn: {
    width: 43,
    alignItems: "center",
  },

  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 4,
    backgroundColor: COLORS.border,
  },

  timelineContent: {
    flex: 1,
    paddingLeft: 6,
    paddingBottom: 20,
  },

  timelineTitle: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },

  timelineTime: {
    color: COLORS.secondary,
    fontSize: 10,
    marginTop: 6,
  },

  timelineUser: {
    color: COLORS.text,
    fontSize: 10,
    marginTop: 5,
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },

  bottomSpacing: {
    height: 25,
  },
});