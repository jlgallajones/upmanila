import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCasualty,
  getCasualtyStatusHistory,
  getCasualtyTriageHistory,
  getCasualtyTransportHistory,
  getCasualtyVerificationHistory,
  updateCasualtyVerification,
  type CasualtyRecord,
  type CasualtyStatusHistoryItem,
  type CasualtyTriageHistoryItem,
  type CasualtyTransportHistoryItem,
  type CasualtyVerificationHistoryItem,
  type UpdateCasualtyVerificationPayload,
} from "../../api/casualties";
import {
  getAttachments,
  type Attachment,
} from "../../api/attachments";
import { getCurrentUser } from "../../auth/session";

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

  red: "#C92D32",
  redBackground: "#FCE6E7",

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

type VerificationAction =
  UpdateCasualtyVerificationPayload["status"];

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

function AttachmentCard({ item }: { item: Attachment }) {
  const isImage = item.mime_type?.startsWith("image/") ?? false;

  return (
    <View style={styles.attachmentCard}>
      {isImage && item.signed_url ? (
        <Image
          source={{ uri: item.signed_url }}
          style={styles.attachmentImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.attachmentIcon}>
          <Ionicons
            name="document-attach-outline"
            size={22}
            color={COLORS.maroon}
          />
        </View>
      )}

      <View style={styles.attachmentInfo}>
        <Text style={styles.attachmentName} numberOfLines={1}>
          {item.file_name}
        </Text>
        <Text style={styles.attachmentMeta}>
          {formatDateTime(item.created_at)}
        </Text>
      </View>
    </View>
  );
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  return String(value);
}

function formatStatus(status: string | null | undefined): string {
  if (!status) {
    return "Unknown";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getVerificationPalette(status: string | null | undefined) {
  switch (status) {
    case "verified":
      return {
        color: COLORS.green,
        backgroundColor: COLORS.greenBackground,
      };
    case "rejected":
      return {
        color: COLORS.red,
        backgroundColor: COLORS.redBackground,
      };
    case "under_review":
      return {
        color: COLORS.blue,
        backgroundColor: COLORS.blueBackground,
      };
    default:
      return {
        color: COLORS.orange,
        backgroundColor: COLORS.orangeBackground,
      };
  }
}

function canReviewRecords(role: string | null): boolean {
  return (
    role === "super_admin" ||
    role === "administrator" ||
    role === "medical_personnel"
  );
}

function formatTriageSystem(value: string | null | undefined): string {
  switch (value) {
    case "urgent_non_urgent":
      return "Urgent/Non-urgent";
    case "nato":
      return "NATO";
    case "start":
      return "START";
    case "sieve_sort":
      return "SIEVE/SORT";
    case "smart":
      return "SMART";
    case "care_flight":
      return "Care Flight";
    case "mass":
      return "MASS";
    case "salt":
      return "SALT";
    case "ed_triage":
      return "ED Triage";
    case "other":
      return "Other";
    default:
      return "Unknown";
  }
}

function formatTransportRequired(
  value: string | null | undefined,
): string {
  switch (value) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "unknown":
      return "Unknown";
    default:
      return "Unavailable";
  }
}

function formatTransportMode(value: string | null | undefined): string {
  switch (value) {
    case "ems":
      return "EMS";
    case "private_vehicle":
      return "Private Vehicle";
    case "independent":
      return "Independent";
    case "walk_in":
      return "Walk-in";
    case "other":
      return "Other";
    case "unknown":
      return "Unknown";
    default:
      return "Unavailable";
  }
}

function formatEmsUnitType(value: string | null | undefined): string {
  switch (value) {
    case "bls":
      return "BLS";
    case "als":
      return "ALS";
    case "other":
      return "Other";
    case "unknown":
      return "Unknown";
    default:
      return "Unavailable";
  }
}

function getFullName(record: CasualtyRecord): string {
  const parts = [
    record.casualty.first_name,
    record.casualty.middle_name,
    record.casualty.last_name,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0
    ? parts.join(" ")
    : "Unidentified Casualty";
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "UC"
  );
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) {
    return "Unavailable";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return "Unavailable";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return "Unavailable";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatCoordinates(record: CasualtyRecord): string {
  if (record.latitude === null || record.longitude === null) {
    return "Unavailable";
  }

  return `${record.latitude}, ${record.longitude}`;
}

function getStatusPalette(status: string) {
  switch (status.toLowerCase()) {
    case "missing":
    case "deceased":
      return {
        color: COLORS.red,
        backgroundColor: COLORS.redBackground,
        borderColor: "#F2B6B8",
      };
    case "safe":
    case "rescued":
    case "evacuated":
      return {
        color: COLORS.green,
        backgroundColor: COLORS.greenBackground,
        borderColor: "#A9E7C2",
      };
    default:
      return {
        color: COLORS.orange,
        backgroundColor: COLORS.orangeBackground,
        borderColor: COLORS.orangeBorder,
      };
  }
}

export default function CasualtyDetailScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const casualtyId = Array.isArray(id) ? id[0] : id;
  const [record, setRecord] = useState<CasualtyRecord | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [statusHistory, setStatusHistory] = useState<
    CasualtyStatusHistoryItem[]
  >([]);
  const [triageHistory, setTriageHistory] = useState<
    CasualtyTriageHistoryItem[]
  >([]);
  const [transportHistory, setTransportHistory] = useState<
    CasualtyTransportHistoryItem[]
  >([]);
  const [verificationHistory, setVerificationHistory] = useState<
    CasualtyVerificationHistoryItem[]
  >([]);
  const [currentUserRole, setCurrentUserRole] = useState<
    string | null
  >(null);
  const [reviewAction, setReviewAction] =
    useState<VerificationAction | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isReviewModalVisible, setIsReviewModalVisible] =
    useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadCasualty = useCallback(async () => {
    if (!casualtyId) {
      setErrorMessage("Casualty record id is missing.");
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage(null);

      const [
        currentUser,
        data,
        attachmentData,
        historyData,
        triageData,
        transportData,
        verificationData,
      ] =
        await Promise.all([
          getCurrentUser(),
          getCasualty(casualtyId),
          getAttachments(casualtyId),
          getCasualtyStatusHistory(casualtyId),
          getCasualtyTriageHistory(casualtyId),
          getCasualtyTransportHistory(casualtyId),
          getCasualtyVerificationHistory(casualtyId),
        ]);

      setCurrentUserRole(currentUser?.role ?? null);
      setRecord(data);
      setAttachments(attachmentData);
      setStatusHistory(historyData);
      setTriageHistory(triageData);
      setTransportHistory(transportData);
      setVerificationHistory(verificationData);
    } catch (error) {
      console.error("Failed to load casualty detail:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load casualty details.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [casualtyId]);

  useEffect(() => {
    void loadCasualty();
  }, [loadCasualty]);

  const casualty = useMemo(() => {
    if (!record) {
      return null;
    }

    const fullName = getFullName(record);
    const notes = [
      record.visible_injury,
      record.medical_condition,
      record.assistance_needed,
    ].filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    );

    return {
      id: record.casualty.id_number ?? record.id.slice(0, 8),
      recordId: record.id,
      fullName,
      initials: getInitials(fullName),
      age: formatValue(record.casualty.estimated_age),
      sex: formatValue(record.casualty.sex),
      dateOfBirth: formatDate(record.casualty.date_of_birth),
      street: formatValue(record.casualty.house_street),
      barangay: formatValue(record.casualty.barangay),
      municipality: formatValue(record.casualty.municipality),
      province: formatValue(record.casualty.province),
      region: formatValue(record.casualty.region),
      incident: record.incident.incident_name,
      evacuationCenter: formatValue(
        record.evacuation_center?.center_name ??
          record.evacuation_center_id,
      ),
      receivingFacility: formatValue(
        record.healthcare_facility?.facility_name ??
          record.hospital_name,
      ),
      gpsLocation: formatCoordinates(record),
      dateTime: formatDateTime(record.reported_at),
      status: formatStatus(record.current_status),
      severity: formatStatus(record.severity),
      verificationStatus: formatStatus(record.verification_status),
      verificationStatusRaw: record.verification_status,
      verifiedAt: formatDateTime(record.verified_at),
      notes:
        notes.length > 0
          ? notes.join("\n")
          : "No medical notes recorded.",
      lastUpdated: formatTime(record.updated_at),
      verified: record.verification_status === "verified",
      encoderName: record.encoder.full_name,
      latestTriage: triageHistory[0],
      latestTransport: transportHistory[0],
    };
  }, [record, triageHistory, transportHistory]);

  function handleEdit() {
    if (!casualty) {
      return;
    }

    router.push({
      pathname: "/add-casualty",
      params: {
        editId: casualty.recordId,
      },
    } as never);
  }

  function openReviewModal(action: VerificationAction) {
    setReviewAction(action);
    setReviewNotes("");
    setIsReviewModalVisible(true);
  }

  function closeReviewModal() {
    if (isSavingReview) {
      return;
    }

    setIsReviewModalVisible(false);
    setReviewAction(null);
    setReviewNotes("");
  }

  async function handleSaveReview() {
    if (!casualtyId || !reviewAction) {
      return;
    }

    if (reviewAction === "rejected" && !reviewNotes.trim()) {
      Alert.alert(
        "Review note required",
        "Please enter a reason before rejecting this casualty record.",
      );
      return;
    }

    try {
      setIsSavingReview(true);

      const updatedRecord = await updateCasualtyVerification(
        casualtyId,
        {
          status: reviewAction,
          notes: reviewNotes.trim() || undefined,
        },
      );
      const updatedHistory =
        await getCasualtyVerificationHistory(casualtyId);

      setRecord(updatedRecord);
      setVerificationHistory(updatedHistory);
      setIsReviewModalVisible(false);
      setReviewAction(null);
      setReviewNotes("");

      Alert.alert(
        "Review saved",
        "The casualty verification status has been updated.",
      );
    } catch (error) {
      console.error("Unable to save verification review:", error);

      Alert.alert(
        "Unable to save review",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsSavingReview(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
        />

        <Text style={styles.centerStateText}>
          Loading casualty details...
        </Text>
      </View>
    );
  }

  if (errorMessage || !casualty) {
    return (
      <View style={styles.centerState}>
        <Ionicons
          name="alert-circle-outline"
          size={42}
          color={COLORS.maroon}
        />

        <Text style={styles.centerStateTitle}>
          Unable to open record
        </Text>

        <Text style={styles.centerStateText}>
          {errorMessage ?? "Casualty record unavailable."}
        </Text>

        <Pressable
          onPress={() => {
            setIsLoading(true);
            void loadCasualty();
          }}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const statusPalette = getStatusPalette(casualty.status);
  const verificationPalette = getVerificationPalette(
    casualty.verificationStatusRaw,
  );
  const canReview = canReviewRecords(currentUserRole);

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
            CASUALTY RECORD - {casualty.id}
          </Text>

          <Text style={styles.headerName}>
            {casualty.fullName}
          </Text>

          <View style={styles.headerStatusRow}>
            <View
              style={[
                styles.headerStatusBadge,
                {
                  backgroundColor: statusPalette.color,
                  borderColor: statusPalette.borderColor,
                },
              ]}
            >
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
              {casualty.sex} - {casualty.age} years old -{" "}
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

              <View
                style={[
                  styles.verificationBadge,
                  {
                    backgroundColor:
                      verificationPalette.backgroundColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.verificationBadgeText,
                    {
                      color: verificationPalette.color,
                    },
                  ]}
                >
                  {casualty.verificationStatus}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Edit casualty"
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
            label="Barangay"
            value={casualty.barangay}
          />

          <DetailRow
            label="Municipality"
            value={casualty.municipality}
          />

          <DetailRow
            label="Province"
            value={casualty.province}
          />

          <DetailRow
            label="Region"
            value={casualty.region}
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
            label="Receiving Facility"
            value={casualty.receivingFacility}
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

        <SectionCard title="VERIFICATION REVIEW">
          <View
            style={[
              styles.reviewStatusCard,
              {
                borderColor: verificationPalette.color,
                backgroundColor: verificationPalette.backgroundColor,
              },
            ]}
          >
            <Ionicons
              name={
                casualty.verificationStatusRaw === "verified"
                  ? "shield-checkmark-outline"
                  : casualty.verificationStatusRaw === "rejected"
                    ? "close-circle-outline"
                    : "hourglass-outline"
              }
              size={25}
              color={verificationPalette.color}
            />
            <View style={styles.reviewStatusContent}>
              <Text
                style={[
                  styles.reviewStatusTitle,
                  {
                    color: verificationPalette.color,
                  },
                ]}
              >
                {casualty.verificationStatus}
              </Text>
              <Text
                style={[
                  styles.reviewStatusText,
                  {
                    color: verificationPalette.color,
                  },
                ]}
              >
                {casualty.verified
                  ? `Verified at ${casualty.verifiedAt}`
                  : "Record is waiting for review or revision."}
              </Text>
            </View>
          </View>

          {canReview ? (
            <View style={styles.reviewActions}>
              <Pressable
                onPress={() => openReviewModal("under_review")}
                style={({ pressed }) => [
                  styles.reviewActionButton,
                  styles.reviewActionNeutral,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="eye-outline"
                  size={17}
                  color={COLORS.blue}
                />
                <Text
                  style={[
                    styles.reviewActionText,
                    {
                      color: COLORS.blue,
                    },
                  ]}
                >
                  Review
                </Text>
              </Pressable>

              <Pressable
                onPress={() => openReviewModal("verified")}
                style={({ pressed }) => [
                  styles.reviewActionButton,
                  styles.reviewActionApprove,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={17}
                  color={COLORS.green}
                />
                <Text
                  style={[
                    styles.reviewActionText,
                    {
                      color: COLORS.green,
                    },
                  ]}
                >
                  Approve
                </Text>
              </Pressable>

              <Pressable
                onPress={() => openReviewModal("rejected")}
                style={({ pressed }) => [
                  styles.reviewActionButton,
                  styles.reviewActionReject,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={17}
                  color={COLORS.red}
                />
                <Text
                  style={[
                    styles.reviewActionText,
                    {
                      color: COLORS.red,
                    },
                  ]}
                >
                  Reject
                </Text>
              </Pressable>
            </View>
          ) : null}

          {verificationHistory.length > 0 ? (
            <View style={styles.triageTimeline}>
              {verificationHistory.map((review, index) => {
                const palette = getVerificationPalette(
                  review.new_status,
                );
                const oldStatus = review.old_status
                  ? `${formatStatus(review.old_status)} to `
                  : "";

                return (
                  <TimelineItem
                    key={review.id}
                    title={`${oldStatus}${formatStatus(review.new_status)}`}
                    time={formatDateTime(review.created_at)}
                    user={
                      review.reviewed_by_user?.full_name ??
                      "System"
                    }
                    color={palette.color}
                    backgroundColor={palette.backgroundColor}
                    isLast={
                      index === verificationHistory.length - 1
                    }
                  />
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyAttachmentText}>
              No verification review has been recorded yet.
            </Text>
          )}
        </SectionCard>

        <SectionCard title="MEDICAL STATUS">
          <View
            style={[
              styles.medicalStatusCard,
              {
                backgroundColor: statusPalette.backgroundColor,
                borderColor: statusPalette.borderColor,
              },
            ]}
          >
            <View
              style={[
                styles.medicalIcon,
                {
                  backgroundColor: statusPalette.color,
                },
              ]}
            >
              <Ionicons
                name="warning-outline"
                size={26}
                color={COLORS.white}
              />
            </View>

            <View style={styles.medicalContent}>
              <Text
                style={[
                  styles.medicalTitle,
                  {
                    color: statusPalette.color,
                  },
                ]}
              >
                {casualty.status} - {casualty.severity}
              </Text>

              <Text
                style={[
                  styles.medicalDescription,
                  {
                    color: statusPalette.color,
                  },
                ]}
              >
                {casualty.notes}
              </Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="TRIAGE">
          {casualty.latestTriage ? (
            <>
              <DetailRow
                label="System"
                value={formatTriageSystem(
                  casualty.latestTriage.triage_system,
                )}
              />

              <DetailRow
                label="Category"
                value={formatStatus(
                  casualty.latestTriage.triage_category,
                )}
                valueColor={COLORS.maroon}
              />

              <DetailRow
                label="Stage"
                value={formatStatus(
                  casualty.latestTriage.triage_stage,
                )}
              />

              <DetailRow
                label="Triage Time"
                value={formatDateTime(
                  casualty.latestTriage.triaged_at,
                )}
              />

              <DetailRow
                label="Location"
                value={formatValue(casualty.latestTriage.location)}
              />
            </>
          ) : (
            <Text style={styles.emptyAttachmentText}>
              No triage assessment recorded.
            </Text>
          )}

          {triageHistory.length > 0 ? (
            <View style={styles.triageTimeline}>
              {triageHistory.map((triage, index) => (
                <TimelineItem
                  key={triage.id}
                  title={`${formatStatus(triage.triage_category)} - ${formatTriageSystem(triage.triage_system)}`}
                  time={formatDateTime(triage.triaged_at)}
                  user={
                    triage.triaged_by_user?.full_name ?? "System"
                  }
                  color={COLORS.blue}
                  backgroundColor={COLORS.blueBackground}
                  isLast={index === triageHistory.length - 1}
                />
              ))}
            </View>
          ) : null}
        </SectionCard>

        <SectionCard title="TRANSPORT">
          {casualty.latestTransport ? (
            <>
              <DetailRow
                label="Required"
                value={formatTransportRequired(
                  casualty.latestTransport.transport_required,
                )}
              />

              <DetailRow
                label="Mode"
                value={formatTransportMode(
                  casualty.latestTransport.transport_mode,
                )}
              />

              <DetailRow
                label="EMS Unit"
                value={formatEmsUnitType(
                  casualty.latestTransport.ems_unit_type,
                )}
              />

              <DetailRow
                label="Departed Scene"
                value={formatDateTime(
                  casualty.latestTransport.departed_scene_at,
                )}
              />

              <DetailRow
                label="Arrived Facility"
                value={formatDateTime(
                  casualty.latestTransport.arrived_facility_at,
                )}
              />

              <DetailRow
                label="Receiving Facility"
                value={formatValue(
                  casualty.latestTransport.receiving_facility
                    ?.facility_name,
                )}
                valueColor={COLORS.maroon}
              />
            </>
          ) : (
            <Text style={styles.emptyAttachmentText}>
              No transport record saved.
            </Text>
          )}

          {transportHistory.length > 0 ? (
            <View style={styles.triageTimeline}>
              {transportHistory.map((transport, index) => (
                <TimelineItem
                  key={transport.id}
                  title={`${formatTransportRequired(transport.transport_required)} - ${formatTransportMode(transport.transport_mode)}`}
                  time={formatDateTime(transport.created_at)}
                  user={
                    transport.recorded_by_user?.full_name ??
                    "System"
                  }
                  color={COLORS.green}
                  backgroundColor={COLORS.greenBackground}
                  isLast={index === transportHistory.length - 1}
                />
              ))}
            </View>
          ) : null}
        </SectionCard>

        <SectionCard title="STATUS TIMELINE">
          {statusHistory.length > 0
            ? statusHistory.map((history, index) => {
                const palette = getStatusPalette(history.new_status);
                const oldStatus = history.old_status
                  ? `${formatStatus(history.old_status)} to `
                  : "";

                return (
                  <TimelineItem
                    key={history.id}
                    title={`${oldStatus}${formatStatus(history.new_status)}`}
                    time={formatDateTime(history.created_at)}
                    user={
                      history.changed_by_user?.full_name ??
                      "System"
                    }
                    color={palette.color}
                    backgroundColor={palette.backgroundColor}
                    isLast={false}
                  />
                );
              })
            : null}

          <TimelineItem
            title="Reported"
            time={casualty.dateTime}
            user={casualty.encoderName}
            color={COLORS.blue}
            backgroundColor={COLORS.blueBackground}
          />

          <TimelineItem
            title="Encoded"
            time={formatDateTime(record?.created_at)}
            user={casualty.encoderName}
            color={COLORS.green}
            backgroundColor={COLORS.greenBackground}
            isLast
          />
        </SectionCard>

        <SectionCard title="ATTACHMENTS">
          {attachments.length > 0 ? (
            <View style={styles.attachmentList}>
              {attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  item={attachment}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyAttachmentCard}>
              <Ionicons
                name="images-outline"
                size={31}
                color={COLORS.secondary}
              />
              <Text style={styles.emptyAttachmentTitle}>
                No attachments yet
              </Text>
              <Text style={styles.emptyAttachmentText}>
                Photos uploaded from add or edit casualty will appear here.
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Modal
        visible={isReviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeReviewModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={closeReviewModal}
        >
          <Pressable style={styles.reviewModal}>
            <View style={styles.reviewModalHeader}>
              <View>
                <Text style={styles.reviewModalTitle}>
                  {reviewAction === "verified"
                    ? "Approve Record"
                    : reviewAction === "rejected"
                      ? "Reject Record"
                      : "Mark Under Review"}
                </Text>
                <Text style={styles.reviewModalSubtitle}>
                  {casualty.fullName}
                </Text>
              </View>
              <Pressable
                onPress={closeReviewModal}
                style={styles.reviewModalClose}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondary}
                />
              </Pressable>
            </View>

            <Text style={styles.reviewNoteLabel}>
              REVIEW NOTES
            </Text>
            <TextInput
              value={reviewNotes}
              onChangeText={setReviewNotes}
              style={styles.reviewNoteInput}
              placeholder={
                reviewAction === "rejected"
                  ? "Required reason for rejection"
                  : "Optional reviewer note"
              }
              placeholderTextColor={COLORS.secondary}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.reviewModalActions}>
              <Pressable
                onPress={closeReviewModal}
                style={({ pressed }) => [
                  styles.reviewCancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.reviewCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isSavingReview}
                onPress={() => {
                  void handleSaveReview();
                }}
                style={({ pressed }) => [
                  styles.reviewSaveButton,
                  isSavingReview && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.reviewSaveText}>
                  {isSavingReview ? "Saving..." : "Save Review"}
                </Text>
                {isSavingReview ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.white}
                  />
                ) : (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={COLORS.white}
                  />
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: COLORS.background,
  },

  centerStateTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 14,
  },

  centerStateText: {
    color: COLORS.secondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 9,
  },

  retryButton: {
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: 12,
    marginTop: 18,
    backgroundColor: COLORS.maroon,
  },

  retryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
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
    borderWidth: 1,
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
    minWidth: 0,
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

  verificationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },

  verificationBadgeText: {
    fontSize: 9,
    fontWeight: "800",
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
  },

  reviewStatusCard: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },

  reviewStatusContent: {
    flex: 1,
    marginLeft: 12,
  },

  reviewStatusTitle: {
    fontSize: 14,
    fontWeight: "900",
  },

  reviewStatusText: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  reviewActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  reviewActionButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },

  reviewActionNeutral: {
    borderColor: "#B9D8EE",
    backgroundColor: COLORS.blueBackground,
  },

  reviewActionApprove: {
    borderColor: "#A9E7C2",
    backgroundColor: COLORS.greenBackground,
  },

  reviewActionReject: {
    borderColor: "#F2B6B8",
    backgroundColor: COLORS.redBackground,
  },

  reviewActionText: {
    fontSize: 11,
    fontWeight: "900",
  },

  medicalIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  medicalContent: {
    flex: 1,
  },

  medicalTitle: {
    fontSize: 14,
    fontWeight: "900",
  },

  medicalDescription: {
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

  triageTimeline: {
    marginTop: 14,
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

  attachmentList: {
    gap: 10,
  },

  attachmentCard: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: COLORS.grayBackground,
  },

  attachmentImage: {
    width: 58,
    height: 58,
    borderRadius: 11,
    marginRight: 11,
    backgroundColor: COLORS.border,
  },

  attachmentIcon: {
    width: 58,
    height: 58,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    backgroundColor: COLORS.redBackground,
  },

  attachmentInfo: {
    flex: 1,
    minWidth: 0,
  },

  attachmentName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  attachmentMeta: {
    color: COLORS.secondary,
    fontSize: 10,
    marginTop: 5,
  },

  emptyAttachmentCard: {
    minHeight: 118,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 13,
    backgroundColor: COLORS.grayBackground,
  },

  emptyAttachmentTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },

  emptyAttachmentText: {
    color: COLORS.secondary,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 5,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23,33,58,0.38)",
  },

  reviewModal: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.white,
  },

  reviewModalHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  reviewModalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },

  reviewModalSubtitle: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 4,
  },

  reviewModalClose: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.grayBackground,
  },

  reviewNoteLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
    marginBottom: 8,
  },

  reviewNoteInput: {
    minHeight: 110,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.grayBackground,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },

  reviewModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  reviewCancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  reviewCancelText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "900",
  },

  reviewSaveButton: {
    flex: 1.4,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: COLORS.maroon,
    gap: 8,
  },

  reviewSaveText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.7,
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },

  bottomSpacing: {
    height: 25,
  },
});
