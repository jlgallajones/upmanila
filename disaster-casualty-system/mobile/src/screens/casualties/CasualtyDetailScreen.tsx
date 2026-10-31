import { Ionicons } from "@expo/vector-icons";
import { createThemePalette } from "@/constants/theme";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCasualty,
  getCasualtyStatusHistory,
  getCasualtyTreatmentHistory,
  getCasualtyTriageHistory,
  getCasualtyTransportHistory,
  type CasualtyRecord,
  type CasualtyStatusHistoryItem,
  type CasualtyTreatmentHistoryItem,
  type CasualtyTriageHistoryItem,
  type CasualtyTransportHistoryItem,
} from "../../api/casualties";
import {
  getAttachments,
  type Attachment,
} from "../../api/attachments";
import { isAuthenticationTokenError } from "../../api/client";
import {
  getAccessToken,
  getCurrentUser,
} from "../../auth/session";
import {
  getResponderAssignment,
  type ResponderAssignment,
} from "../../auth/responderAssignment";

const COLORS = createThemePalette({
  maroon: "#242424",
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
  redBackground: "#FFF4F4",

  grayBackground: "#F2F5F9",
});

function canEditRecord(
  role: string | null,
  verificationStatus: string | null | undefined,
): boolean {
  if (
    role === "super_admin" ||
    role === "admin" ||
    role === "administrator" ||
    role === "encoder"
  ) {
    return true;
  }

  return verificationStatus === "rejected";
}

function isResponderRole(role: string | null): boolean {
  return (
    role === "responder" ||
    role === "field_responder" ||
  role === "sa_responder" ||
  role === "minor_incident_documenter"
  );
}

function isFieldResponderView(
  role: string | null,
  assignment: ResponderAssignment | null,
): boolean {
  return (
    role === "field_responder" ||
    (role === "responder" && assignment === "field_responder")
  );
}

function isSaResponderView(
  role: string | null,
  assignment: ResponderAssignment | null,
): boolean {
  return (
    role === "sa_responder" ||
  role === "minor_incident_documenter" ||
    (role === "responder" && assignment === "sa_responder")
  );
}

function isAmpResponderView(
  role: string | null,
  assignment: ResponderAssignment | null,
): boolean {
  return (
    role === "sa_responder" ||
    (role === "responder" && assignment === "sa_responder")
  );
}

function isHealthcareDocumenterView(role: string | null): boolean {
  return role === "documenter" || role === "medical_personnel";
}

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
  action?: React.ReactNode;
  children: React.ReactNode;
};

function SectionCard({
  title,
  action,
  children,
}: SectionCardProps) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
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

function isImageAttachment(item: Attachment): boolean {
  return (
    item.mime_type?.startsWith("image/") === true ||
    /\.(gif|jpe?g|png|webp|heic|heif)$/i.test(item.file_name)
  );
}

function AttachmentCard({
  item,
  onPress,
}: {
  item: Attachment;
  onPress?: () => void;
}) {
  const isImage = isImageAttachment(item) && Boolean(item.signed_url);

  const card = (
    <View style={styles.attachmentCard}>
      {isImage ? (
        <View style={styles.attachmentImageFrame}>
          <Image
            source={{ uri: item.signed_url ?? undefined }}
            style={styles.attachmentImage}
            resizeMode="cover"
          />
          <View style={styles.attachmentImageHint}>
            <Ionicons
              name="expand-outline"
              size={14}
              color={COLORS.white}
            />
          </View>
        </View>
      ) : (
        <View style={styles.attachmentIcon}>
          <Ionicons
            name="document-attach-outline"
            size={22}
            color={COLORS.text}
          />
        </View>
      )}

      <View style={styles.attachmentInfo}>
        <Text style={styles.attachmentName} numberOfLines={1}>
          {item.file_name}
        </Text>
        <Text style={styles.attachmentMeta}>
          {isImage ? "Tap to view photo" : "Attachment"} - {formatDateTime(item.created_at)}
        </Text>
      </View>
    </View>
  );

  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.file_name}`}
    >
      {card}
    </Pressable>
  ) : (
    card
  );
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  return String(value);
}

function formatBooleanValue(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";

  return "Unavailable";
}

function formatDetailUnknown(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" || typeof value === "number") {
    return formatStatus(String(value));
  }

  return JSON.stringify(value);
}

function extractRecordSectionValue(
  text: string | null | undefined,
  sectionTitle: string,
  label: string,
): string | null {
  if (!text) {
    return null;
  }

  const lines = String(text).split(/\r?\n/);
  const targetSection = `[${sectionTitle}]`.toLowerCase();
  const targetLabel = `${label}:`.toLowerCase();
  let insideSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      insideSection = line.toLowerCase() === targetSection;
      continue;
    }

    if (insideSection && line.toLowerCase().startsWith(targetLabel)) {
      const value = line.slice(label.length + 1).trim();
      return value || null;
    }
  }

  return null;
}

function extractLatestTransportSectionValue(
  text: string | null | undefined,
  label: string,
): string | null {
  if (!text) {
    return null;
  }

  const targetLabel = `${label}:`.toLowerCase();
  let insideTransportSection = false;
  let value: string | null = null;

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      const sectionTitle = line.slice(1, -1).trim().toLowerCase();
      insideTransportSection = sectionTitle.endsWith("transport / release");
      continue;
    }

    if (
      insideTransportSection &&
      line.toLowerCase().startsWith(targetLabel)
    ) {
      value = line.slice(label.length + 1).trim() || null;
    }
  }

  return value;
}

function extractRecordBaseText(text: string | null | undefined): string {
  if (!text) {
    return "Unavailable";
  }

  const lines = String(text).split(/\r?\n/);
  const baseLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("[") && line.endsWith("]")) {
      break;
    }

    if (line) {
      baseLines.push(line);
    }
  }

  return baseLines.join("\n").trim() || "Unavailable";
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

function formatTriageCategory(
  category: string | null | undefined,
): string {
  switch (category?.trim().toLowerCase()) {
    case "minimal":
    case "minor":
      return "Minor";
    default:
      return formatStatus(category);
  }
}

function formatCasualtyDisplayId(
  idNumber: string | null | undefined,
  clientRecordId: string | null | undefined,
  fallbackId: string,
): string {
  const id = idNumber?.trim();

  if (id) {
    const generatedMatch = /^CAS:\d{6}:([A-Z0-9]+)$/i.exec(id);

    if (generatedMatch) {
      return generatedMatch[1].toUpperCase();
    }

    if (!/^CAS-/i.test(id) && !/^CAS-SYNC-/i.test(id)) {
      return id;
    }
  }

  const clientId = clientRecordId?.trim();

  if (clientId && !/^CAS-/i.test(clientId)) {
    return clientId;
  }

  return fallbackId.slice(0, 8);
}

function getVerificationPalette(status: string | null | undefined) {
  switch (status?.trim().toLowerCase()) {
    case "verified":
    case "accepted":
    case "approved":
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

function formatVerificationStatus(
  status: string | null | undefined,
): string {
  switch (status?.trim().toLowerCase()) {
    case "verified":
    case "accepted":
    case "approved":
      return "Verified";

    case "rejected":
      return "Rejected";

    case "under_review":
    case "under review":
      return "Under Review";

    case "submitted":
      return "Submitted";

    case "draft":
      return "Draft";

    default:
      return "Submitted";
  }
}

function formatTriageSystem(value: string | null | undefined): string {
  switch (value?.trim().toLowerCase()) {
    case "urgent_non_urgent":
      return "Urgent/Non-urgent";
    case "stieve":
      return "STIEVE";
    case "nato":
      return "NATO";
    case "start":
      return "START";
    case "mstart":
      return "mSTART";
    case "jumpstart":
      return "JumpSTART";
    case "sieve_sort":
      return "SIEVE/SORT";
    case "sieve":
      return "SIEVE";
    case "save":
      return "SAVE";
    case "sort":
      return "SORT";
    case "meta":
      return "META";
    case "swift":
      return "SwiFT";
    case "smart":
      return "SMART";
    case "rts":
      return "RTS";
    case "care_flight":
      return "Care Flight";
    case "mass":
      return "MASS";
    case "esi":
      return "ESI";
    case "metts":
      return "METTS";
    case "salt":
      return "SALT";
    case "ptt":
      return "PTT";
    case "mitt":
      return "MITT";
    case "homebush":
      return "Homebush";
    case "mptt":
      return "MPTT";
    case "stm":
      return "STM";
    case "ed_triage":
      return "ED Triage";
    case "other":
      return "Other";
    default:
      return "Unknown";
  }
}

function formatTriageStage(value: string | null | undefined): string {
  switch (value?.trim().toLowerCase()) {
    case "on_site":
      return "Primary Triage";
    case "reassessment":
      return "Secondary Triage";
    case "facility_arrival":
      return "Tertiary Triage";
    default:
      return formatStatus(value);
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

function getTriagePalette(category: string | null | undefined) {
  switch (category?.toLowerCase()) {
    case "immediate":
    case "red":
      return {
        color: COLORS.red,
        backgroundColor: COLORS.redBackground,
        borderColor: COLORS.warningBorder,
      };
    case "delayed":
    case "yellow":
      return {
        color: COLORS.orange,
        backgroundColor: COLORS.orangeBackground,
        borderColor: COLORS.orangeBorder,
      };
    case "minor":
    case "minimal":
    case "green":
      return {
        color: COLORS.green,
        backgroundColor: COLORS.greenBackground,
        borderColor: COLORS.greenBackground,
      };
    case "expectant":
    case "black":
      return {
        color: COLORS.text,
        backgroundColor: COLORS.grayBackground,
        borderColor: COLORS.border,
      };
    default:
      return {
        color: COLORS.blue,
        backgroundColor: COLORS.blueBackground,
        borderColor: "#A8D7F4",
      };
  }
}

function formatTreatmentStrategy(value: string | null | undefined): string {
  switch (value) {
    case "scoop_and_run":
      return "Scoop and Run/Load and Go";
    case "scooter":
      return "Scooter";
    case "stay_and_play":
      return "Stay and Play";
    case "play_and_run":
      return "Scooter";
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
    : "Unidentified Victim";
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
        borderColor: COLORS.warningBorder,
      };
    case "safe":
    case "rescued":
    case "evacuated":
      return {
        color: COLORS.green,
        backgroundColor: COLORS.greenBackground,
        borderColor: COLORS.greenBackground,
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
  const [treatmentHistory, setTreatmentHistory] = useState<
    CasualtyTreatmentHistoryItem[]
  >([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(
    null,
  );
  const [
    currentResponderAssignment,
    setCurrentResponderAssignment,
  ] = useState<ResponderAssignment | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [selectedImageAttachment, setSelectedImageAttachment] =
    useState<Attachment | null>(null);

  const loadCasualty = useCallback(async () => {
    if (!casualtyId) {
      setErrorMessage("Victim record ID is missing.");
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage(null);

      const [user, token, responderAssignment] = await Promise.all([
        getCurrentUser(),
        getAccessToken(),
        getResponderAssignment(),
      ]);

      setCurrentUserRole(user?.role ?? null);
      setCurrentUserId(user?.id ?? null);
      setCurrentResponderAssignment(responderAssignment);

      if (!token) {
        setErrorMessage(
          "Your session has expired. Please sign in again before opening victim records.",
        );
        router.replace("/login");
        return;
      }

      const data = await getCasualty(casualtyId);
      const [
        attachmentData,
        historyData,
        triageData,
        transportData,
        treatmentData,
      ] = await Promise.all([
        getAttachments(casualtyId),
        getCasualtyStatusHistory(casualtyId),
        getCasualtyTriageHistory(casualtyId),
        getCasualtyTransportHistory(casualtyId),
        getCasualtyTreatmentHistory(casualtyId),
      ]);

      setRecord(data);
      setAttachments(attachmentData);
      setStatusHistory(historyData);
      setTriageHistory(triageData);
      setTransportHistory(transportData);
      setTreatmentHistory(treatmentData);
    } catch (error) {
      console.error("Failed to load casualty detail:", error);

      if (isAuthenticationTokenError(error)) {
        setErrorMessage(null);
        router.replace("/login");
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load victim details.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [casualtyId]);

  useFocusEffect(
    useCallback(() => {
      void loadCasualty();

      return undefined;
    }, [loadCasualty]),
  );

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
      id: formatCasualtyDisplayId(
        record.casualty.id_number,
        record.client_record_id,
        record.id,
      ),
      recordId: record.id,
      encoderId: record.encoder.id,
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
      verificationStatus: formatVerificationStatus(
        record.verification_status,
      ),
      verificationStatusRaw: record.verification_status,
      verifiedAt: formatDateTime(record.verified_at),
      notes:
        notes.length > 0
          ? notes.join("\n")
          : "No medical notes recorded.",
      lastUpdated: formatDateTime(record.updated_at),
      encoderName: record.encoder.full_name,
      latestTriage: triageHistory[0],
      latestTransport: transportHistory[0],
      latestTreatment: treatmentHistory[0],
    };
  }, [record, triageHistory, transportHistory, treatmentHistory]);

  function handleEdit() {
    if (!casualty) {
      return;
    }

    router.push({
      pathname: "/add-casualty",
      params: {
        editId: casualty.recordId,
        returnToDetail: "true",
      },
    } as never);
  }

  function handleEditTransport() {
    if (!casualty) {
      return;
    }

    router.push({
      pathname: "/add-casualty",
      params: {
        editId: casualty.recordId,
        focusStep: "Transport",
        returnToDetail: "true",
      },
    } as never);
  }

  function handleEditHealthcareStep(
    focusStep: "Management" | "Disposition",
  ) {
    if (!casualty) {
      return;
    }

    router.push({
      pathname: "/add-casualty",
      params: {
        editId: casualty.recordId,
        focusStep,
        returnToDetail: "true",
      },
    } as never);
  }

  const canEditCurrentRecord = canEditRecord(
    currentUserRole,
    casualty?.verificationStatusRaw,
  );
  const isResponderCurrentUser = isResponderRole(currentUserRole);
  const isOwnRecord = casualty?.encoderId === currentUserId;
  const showFieldResponderDetails =
    Boolean(isOwnRecord) &&
    isFieldResponderView(currentUserRole, currentResponderAssignment);
  const showSaResponderDetails =
    Boolean(isOwnRecord) &&
    isSaResponderView(currentUserRole, currentResponderAssignment);
  const showHealthcareDocumenterDetails =
    Boolean(isOwnRecord) &&
    isHealthcareDocumenterView(currentUserRole);
  const canEditHealthcareDocumenterSections =
    showHealthcareDocumenterDetails;
  const canShowHeaderEdit =
    canEditCurrentRecord &&
    !isResponderCurrentUser &&
    !showHealthcareDocumenterDetails;
  const requiresLogin =
    errorMessage?.toLowerCase().includes("sign in") ?? false;

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={COLORS.text}
        />

        <Text style={styles.centerStateText}>
          Loading victim details...
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
          color={COLORS.text}
        />

        <Text style={styles.centerStateTitle}>
          Unable to open record
        </Text>

        <Text style={styles.centerStateText}>
          {errorMessage ?? "Victim record unavailable."}
        </Text>

        <Pressable
          onPress={() => {
            if (requiresLogin) {
              router.replace("/login");
              return;
            }

            setIsLoading(true);
            void loadCasualty();
          }}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.retryButtonText}>
            {requiresLogin ? "Sign In" : "Retry"}
          </Text>
        </Pressable>
      </View>
    );
  }

  const triageCategory =
    casualty.latestTriage?.calculated_category ??
    casualty.latestTriage?.triage_category ??
    record?.latest_triage_assessment?.calculated_category ??
    record?.latest_triage_assessment?.triage_category ??
    casualty.status;
  const triageCategoryLabel = formatTriageCategory(triageCategory);
  const triagePalette = getTriagePalette(triageCategory);
  const statusPalette = getStatusPalette(casualty.status);
  const verificationPalette = getVerificationPalette(
    casualty.verificationStatusRaw,
  );
  const remarks = record?.remarks ?? null;
  const triageNotes = casualty.latestTriage?.notes ?? null;
  const treatmentNotes = casualty.latestTreatment?.notes ?? null;
  const transportNotes = casualty.latestTransport?.notes ?? null;
  const patientFor =
    casualty.latestTransport?.transport_required === "yes"
      ? "Referral or Transfer to Health Facility"
      : casualty.latestTransport?.transport_required === "no"
        ? "Release"
        : extractLatestTransportSectionValue(
              transportNotes,
              "Patient for",
            ) ??
            (casualty.latestTransport?.transport_required === "unknown"
              ? "Pending Departure"
              : null);
  const isPendingDeparture =
    patientFor?.trim().toLowerCase() === "pending departure";
  const canEditTransportCard = isAmpResponderView(
    currentUserRole,
    currentResponderAssignment,
  )
    ? Boolean(isOwnRecord && isPendingDeparture)
    : canEditCurrentRecord ||
      (isResponderCurrentUser && isOwnRecord);
  const facilityEncounter = record?.latest_facility_encounter ?? null;
  const treatmentDetails =
    casualty.latestTreatment?.treatment_details ?? {};
  const admittedUnitFromFacility =
    facilityEncounter?.icu_admitted_at
      ? "ICU"
      : facilityEncounter?.hospital_admitted_at ||
          facilityEncounter?.admitted_to_hospital === true
        ? "Ward"
        : null;
  const admittedUnit =
    extractRecordSectionValue(
      treatmentNotes,
      "Management",
      "Admitted to unit",
    ) ??
    (typeof treatmentDetails.admittedToUnit === "string"
      ? treatmentDetails.admittedToUnit
      : null) ??
    admittedUnitFromFacility;

  const imageAttachments = attachments.filter(
    (attachment) =>
      isImageAttachment(attachment) && Boolean(attachment.signed_url),
  );
  const selectedImageIndex = selectedImageAttachment
    ? imageAttachments.findIndex(
        (attachment) => attachment.id === selectedImageAttachment.id,
      )
    : -1;

  function closeImageViewer() {
    setSelectedImageAttachment(null);
  }

  function moveToImage(offset: number) {
    if (imageAttachments.length === 0 || selectedImageIndex < 0) {
      return;
    }

    const nextIndex =
      (selectedImageIndex + offset + imageAttachments.length) %
      imageAttachments.length;
    setSelectedImageAttachment(imageAttachments[nextIndex] ?? null);
  }

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.text}
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
            VICTIM RECORD - {casualty.id}
          </Text>

          <Text style={styles.headerName}>
            {casualty.fullName}
          </Text>

          <View style={styles.headerStatusRow}>
            <View
              style={[
                styles.headerStatusBadge,
                {
                  backgroundColor: triagePalette.color,
                  borderColor: triagePalette.borderColor,
                },
              ]}
            >
              <View style={styles.headerStatusDot} />

              <Text style={styles.headerStatusText}>
                {triageCategoryLabel}
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
              {showFieldResponderDetails
                ? `Triage Category: ${triageCategoryLabel}`
                : `Sex: ${casualty.sex} - Age: ${casualty.age} - Date of Birth: ${casualty.dateOfBirth}`}
            </Text>

            <View style={styles.identityBadges}>
              <View style={styles.idBadge}>
                <Text style={styles.idBadgeText}>
                  ID: {casualty.id}
                </Text>
              </View>

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

          {canShowHeaderEdit ? (
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit victim"
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={COLORS.text}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showFieldResponderDetails ? (
          <>
            <SectionCard title="FIELD RESPONDER CODES">
              <DetailRow
                label="Victim Code"
                value={formatValue(
                  extractRecordSectionValue(
                    triageNotes,
                    "Field Responder Codes",
                    "Victim code",
                  ),
                )}
              />

              <DetailRow
                label="User Code"
                value={formatValue(
                  extractRecordSectionValue(
                    triageNotes,
                    "Field Responder Codes",
                    "User code",
                  ),
                )}
              />

              <DetailRow
                label="Victim ID"
                value={casualty.id}
              />

              <DetailRow
                label="Incident"
                value={casualty.incident}
              />

              <DetailRow
                label="Encoded At"
                value={casualty.dateTime}
              />
            </SectionCard>

            <SectionCard title="RESPONDER SAFETY">
              <DetailRow
                label="Are You Safe?"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Responder Safety",
                    "Are you safe",
                  ),
                )}
              />

              <DetailRow
                label="Time of PPE Use"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Responder Safety",
                    "Time of PPE Use",
                  ),
                )}
              />
            </SectionCard>

            <SectionCard title="FIELD TRIAGE">
              {casualty.latestTriage ? (
                <>
                  <DetailRow
                    label="System"
                    value={formatTriageSystem(
                      casualty.latestTriage.triage_system,
                    )}
                  />

                  <DetailRow
                    label="Final Triage"
                    value={formatTriageCategory(
                      casualty.latestTriage.calculated_category ??
                        casualty.latestTriage.triage_category,
                    )}
                    valueColor={COLORS.text}
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

                  <DetailRow
                    label="Triage Notes"
                    value={extractRecordBaseText(triageNotes)}
                  />
                </>
              ) : (
                <Text style={styles.emptyAttachmentText}>
                  No field triage assessment recorded.
                </Text>
              )}
            </SectionCard>
          </>
        ) : showSaResponderDetails ? (
          <>
            <SectionCard title="INTRO">
              <DetailRow
                label="Victim Code"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Advanced Medical Responder Details",
                    "Victim code",
                  ) ||
                    extractRecordSectionValue(
                      remarks,
                      "SA Responder Details",
                      "Victim code",
                    ),
                )}
              />

              <DetailRow
                label="Witness Present"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Advanced Medical Responder Details",
                    "Witness present",
                  ) ||
                    extractRecordSectionValue(
                      remarks,
                      "SA Responder Details",
                      "Witness present",
                    ),
                )}
              />

              <DetailRow
                label="Witness Response"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Advanced Medical Responder Details",
                    "Witness response",
                  ) ||
                    extractRecordSectionValue(
                      remarks,
                      "SA Responder Details",
                      "Witness response",
                    ),
                )}
              />

              <DetailRow
                label="CPR Type"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Advanced Medical Responder Details",
                    "CPR type",
                  ) ||
                    extractRecordSectionValue(
                      remarks,
                      "SA Responder Details",
                      "CPR type",
                    ),
                )}
              />
            </SectionCard>

            <SectionCard title="INFO">
              <DetailRow
                label="Patient Identified"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Advanced Medical Responder Details",
                    "Patient identified",
                  ) ||
                    extractRecordSectionValue(
                      remarks,
                      "SA Responder Details",
                      "Patient identified",
                    ),
                )}
              />

              <DetailRow
                label="Full Name"
                value={casualty.fullName}
              />

              <DetailRow
                label="Age"
                value={`${casualty.age} years old`}
              />

              <DetailRow label="Sex" value={casualty.sex} />

              <DetailRow
                label="Date of Birth"
                value={casualty.dateOfBirth}
              />
              <DetailRow
                label="Newborn"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Advanced Medical Responder Details",
                    "Newborn",
                  ) ||
                    extractRecordSectionValue(
                      remarks,
                      "SA Responder Details",
                      "Newborn",
                    ),
                )}
              />

              <DetailRow
                label="Pregnant"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Advanced Medical Responder Details",
                    "Pregnant",
                  ) ||
                    extractRecordSectionValue(
                      remarks,
                      "SA Responder Details",
                      "Pregnant",
                    ),
                )}
              />

              <DetailRow
                label="Religion"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Advanced Medical Responder Details",
                    "Religion",
                  ) ||
                    extractRecordSectionValue(
                      remarks,
                      "SA Responder Details",
                      "Religion",
                    ),
                )}
              />
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
                    label="Final Triage"
                    value={formatTriageCategory(
                      casualty.latestTriage.calculated_category ??
                        casualty.latestTriage.triage_category,
                    )}
                    valueColor={COLORS.text}
                  />

                  <DetailRow
                    label="Stage"
                    value={formatTriageStage(
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

                  <DetailRow
                    label="Triage Notes"
                    value={extractRecordBaseText(triageNotes)}
                  />
                </>
              ) : (
                <Text style={styles.emptyAttachmentText}>
                  No AMP triage assessment recorded.
                </Text>
              )}
            </SectionCard>

            <SectionCard title="CARE / TREATMENT">
              <DetailRow
                label="Treatment Strategy"
                value={formatTreatmentStrategy(
                  casualty.latestTreatment?.treatment_strategy,
                )}
              />

              <DetailRow
                label="Stabilized Time"
                value={formatValue(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Patient Care Report",
                    "Stabilized time",
                  ) ?? formatDateTime(casualty.latestTreatment?.stabilized_at),
                )}
              />

              <DetailRow
                label="Fill in Patient Care Report"
                value={formatValue(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Patient Care Report",
                    "Fill in Patient Care Report",
                  ),
                )}
              />

              <DetailRow
                label="Notes"
                value={extractRecordBaseText(treatmentNotes)}
              />
            </SectionCard>

            <SectionCard
              title="TRANSPORT"
              action={
                canEditTransportCard ? (
                  <Pressable
                    onPress={handleEditTransport}
                    style={({ pressed }) => [
                      styles.sectionEditButton,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit transport"
                  >
                    <Ionicons
                      name="create-outline"
                      size={15}
                      color={COLORS.text}
                    />
                    <Text style={styles.sectionEditButtonText}>
                      Edit
                    </Text>
                  </Pressable>
                ) : null
              }
            >
              {casualty.latestTransport ? (
                <>
                  <DetailRow
                    label="Patient For"
                    value={formatValue(patientFor)}
                  />

                  <DetailRow
                    label="Condition Before Release"
                    value={formatValue(
                      extractLatestTransportSectionValue(
                        transportNotes,
                        "Condition before release",
                      ),
                    )}
                  />

                  <DetailRow
                    label="Condition Before Transfer"
                    value={formatValue(
                      extractLatestTransportSectionValue(
                        transportNotes,
                        "Condition before transfer",
                      ),
                    )}
                  />

                  <DetailRow
                    label="Receiving Facility"
                    value={formatValue(
                      casualty.latestTransport.receiving_facility
                        ?.facility_name ??
                        extractLatestTransportSectionValue(
                          transportNotes,
                          "Receiving facility",
                        ),
                    )}
                    valueColor={COLORS.text}
                  />

                  <DetailRow
                    label="Departed Scene"
                    value={formatDateTime(
                      casualty.latestTransport.departed_scene_at,
                    )}
                  />

                  <DetailRow
                    label="Used EMS Vehicle"
                    value={formatValue(
                      extractLatestTransportSectionValue(
                        transportNotes,
                        "Used EMS vehicle",
                      ),
                    )}
                  />

                  <DetailRow
                    label="Arrived Facility"
                    value={formatDateTime(
                      casualty.latestTransport.arrived_facility_at,
                    )}
                  />

                  <DetailRow
                    label="Release of Liability Accepted"
                    value={formatValue(
                      extractLatestTransportSectionValue(
                        transportNotes,
                        "Release of liability accepted",
                      ),
                    )}
                  />

                  <DetailRow
                    label="Transport / Release Notes"
                    value={extractRecordBaseText(transportNotes)}
                  />
                </>
              ) : (
                <Text style={styles.emptyAttachmentText}>
                  No SAR transport record saved.
                </Text>
              )}
            </SectionCard>
          </>
        ) : showHealthcareDocumenterDetails ? (
          <>
            <SectionCard title="GENERAL INFORMATION">
              <DetailRow
                label="Receiving Facility"
                value={casualty.receivingFacility}
                valueColor={COLORS.text}
              />

              <DetailRow
                label="Disaster Plan Activation Time"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Healthcare Facility Documenter",
                    "Disaster plan activation time",
                  ),
                )}
              />

              <DetailRow
                label="Time of Arrival of Victim"
                value={formatDateTime(facilityEncounter?.arrived_at)}
              />

              <DetailRow
                label="Disposition Upon Hospital Arrival"
                value={formatValue(
                  extractRecordSectionValue(
                    remarks,
                    "Healthcare Facility Documenter",
                    "Disposition upon hospital arrival",
                  ) ?? facilityEncounter?.disposition,
                )}
              />
            </SectionCard>

            <SectionCard title="PATIENT INFORMATION">
              <DetailRow
                label="First Name"
                value={formatValue(record?.casualty.first_name)}
              />
              <DetailRow
                label="Middle Name"
                value={formatValue(record?.casualty.middle_name)}
              />
              <DetailRow
                label="Last Name"
                value={formatValue(record?.casualty.last_name)}
              />
              <DetailRow label="Sex" value={casualty.sex} />
              <DetailRow
                label="Date of Birth"
                value={casualty.dateOfBirth}
              />
            </SectionCard>

            <SectionCard title="TRIAGE">
              {casualty.latestTriage ? (
                <>
                  <DetailRow
                    label="Triage System"
                    value={formatTriageSystem(
                      casualty.latestTriage.triage_system,
                    )}
                  />

                  <DetailRow
                    label="Triage Assessment"
                    value={formatTriageCategory(
                      casualty.latestTriage.calculated_category ??
                        casualty.latestTriage.triage_category,
                    )}
                    valueColor={COLORS.text}
                  />

                  <DetailRow
                    label="Triage Time"
                    value={formatDateTime(
                      casualty.latestTriage.triaged_at,
                    )}
                  />

                  <DetailRow
                    label="Admitted to Hospital"
                    value={formatValue(
                      extractRecordSectionValue(
                        triageNotes,
                        "Healthcare Facility Triage",
                        "Admitted to hospital",
                      ) ??
                        formatBooleanValue(
                          facilityEncounter?.admitted_to_hospital,
                        ),
                    )}
                  />

                  <DetailRow
                    label="Discharged from Hospital"
                    value={formatValue(
                      extractRecordSectionValue(
                        triageNotes,
                        "Healthcare Facility Triage",
                        "Discharged from hospital",
                      ) ??
                        formatBooleanValue(
                          facilityEncounter?.discharged_home,
                        ),
                    )}
                  />
                </>
              ) : (
                <Text style={styles.emptyAttachmentText}>
                  No healthcare facility triage recorded.
                </Text>
              )}
            </SectionCard>

            <SectionCard
              title="MANAGEMENT"
              action={
                canEditHealthcareDocumenterSections ? (
                  <Pressable
                    onPress={() =>
                      handleEditHealthcareStep("Management")
                    }
                    style={({ pressed }) => [
                      styles.sectionEditButton,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit management"
                  >
                    <Ionicons
                      name="create-outline"
                      size={15}
                      color={COLORS.text}
                    />
                    <Text style={styles.sectionEditButtonText}>
                      Edit
                    </Text>
                  </Pressable>
                ) : null
              }
            >
              <DetailRow
                label="Resuscitation Room Used"
                value={formatValue(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Management",
                    "Resuscitation room used",
                  ),
                )}
              />

              <DetailRow
                label="Surgical Intervention"
                value={formatValue(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Management",
                    "Surgical intervention",
                  ),
                )}
              />

              <DetailRow
                label="Operating Room Used"
                value={formatValue(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Management",
                    "Operating room used",
                  ),
                )}
              />

              <DetailRow
                label="Number of Operating Rooms"
                value={formatDetailUnknown(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Management",
                    "Number of operating rooms",
                  ) ?? treatmentDetails.numberOfOperatingRooms,
                )}
              />

              <DetailRow
                label="X-Ray Used"
                value={formatBooleanValue(
                  facilityEncounter?.xray_required,
                )}
              />

              <DetailRow
                label="Ultrasound Used"
                value={formatBooleanValue(
                  facilityEncounter?.ultrasound_required,
                )}
              />

              <DetailRow
                label="CT Scan Used"
                value={formatBooleanValue(
                  facilityEncounter?.ct_required,
                )}
              />

              <DetailRow
                label="Admitted to Unit"
                value={formatDetailUnknown(admittedUnit)}
              />

              <DetailRow
                label="Mechanical Ventilation Used"
                value={formatBooleanValue(
                  facilityEncounter?.mechanical_ventilation_required,
                )}
              />
            </SectionCard>

            <SectionCard
              title="DISPOSITION"
              action={
                canEditHealthcareDocumenterSections ? (
                  <Pressable
                    onPress={() =>
                      handleEditHealthcareStep("Disposition")
                    }
                    style={({ pressed }) => [
                      styles.sectionEditButton,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit disposition"
                  >
                    <Ionicons
                      name="create-outline"
                      size={15}
                      color={COLORS.text}
                    />
                    <Text style={styles.sectionEditButtonText}>
                      Edit
                    </Text>
                  </Pressable>
                ) : null
              }
            >
              <DetailRow
                label="Discharged from Hospital"
                value={formatDetailUnknown(
                  formatBooleanValue(facilityEncounter?.discharged_home),
                )}
              />

              <DetailRow
                label="Time of Discharge"
                value={formatDateTime(
                  facilityEncounter?.hospital_discharged_at,
                )}
              />
            </SectionCard>
          </>
        ) : (
          <>
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
            valueColor={COLORS.text}
          />

          <DetailRow
            label="Date & Time"
            value={casualty.dateTime}
          />
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
                value={formatTriageCategory(
                      casualty.latestTriage.calculated_category ??
                        casualty.latestTriage.triage_category,
                )}
                valueColor={COLORS.text}
              />

              <DetailRow
                label="Stage"
                value={formatTriageStage(
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
                  title={`${formatTriageCategory(triage.calculated_category ?? triage.triage_category)} - ${formatTriageSystem(triage.triage_system)}`}
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

        <SectionCard
          title="TRANSPORT"
          action={
            canEditTransportCard && !showSaResponderDetails ? (
              <Pressable
                onPress={handleEditTransport}
                style={({ pressed }) => [
                  styles.sectionEditButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Edit transport"
              >
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={COLORS.text}
                />
                <Text style={styles.sectionEditButtonText}>
                  Edit
                </Text>
              </Pressable>
            ) : null
          }
        >
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
                valueColor={COLORS.text}
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
          </>
        )}

        <SectionCard title="ATTACHMENTS">
          {attachments.length > 0 ? (
            <View style={styles.attachmentList}>
              {attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  item={attachment}
                  onPress={
                    isImageAttachment(attachment) && attachment.signed_url
                      ? () => setSelectedImageAttachment(attachment)
                      : undefined
                  }
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
                Photos uploaded from add or edit victim will appear here.
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Modal
        visible={Boolean(selectedImageAttachment)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeImageViewer}
      >
        <View style={styles.attachmentViewerBackdrop}>
          <SafeAreaView style={styles.attachmentViewer}>
            <View style={styles.attachmentViewerHeader}>
              <View style={styles.attachmentViewerHeading}>
                <Text style={styles.attachmentViewerTitle}>
                  Attached photo
                </Text>
                <Text style={styles.attachmentViewerCount}>
                  {selectedImageIndex >= 0
                    ? `Photo ${selectedImageIndex + 1} of ${imageAttachments.length}`
                    : ""}
                </Text>
              </View>

              <Pressable
                onPress={closeImageViewer}
                style={({ pressed }) => [
                  styles.attachmentViewerClose,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.white}
                />
              </Pressable>
            </View>

            {selectedImageAttachment?.signed_url ? (
              <View style={styles.attachmentViewerImageFrame}>
                <Image
                  source={{ uri: selectedImageAttachment.signed_url }}
                  style={styles.attachmentViewerImage}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            <Text
              style={styles.attachmentViewerFileName}
              numberOfLines={2}
            >
              {selectedImageAttachment?.file_name ?? ""}
            </Text>

            {imageAttachments.length > 1 ? (
              <View style={styles.attachmentViewerActions}>
                <Pressable
                  onPress={() => moveToImage(-1)}
                  style={({ pressed }) => [
                    styles.attachmentViewerNavButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous attached photo"
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={COLORS.white}
                  />
                  <Text style={styles.attachmentViewerNavText}>
                    Previous
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => moveToImage(1)}
                  style={({ pressed }) => [
                    styles.attachmentViewerNavButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next attached photo"
                >
                  <Text style={styles.attachmentViewerNavText}>
                    Next
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={COLORS.white}
                  />
                </Pressable>
              </View>
            ) : null}
          </SafeAreaView>
        </View>
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.surface,
    elevation: 2,
    shadowColor: "#718099",
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  sectionTitleRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  sectionEditButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningBackground,
    gap: 5,
  },

  sectionEditButtonText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "900",
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
    borderColor: COLORS.greenBackground,
    backgroundColor: COLORS.greenBackground,
  },

  reviewActionReject: {
    borderColor: COLORS.warningBorder,
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
    backgroundColor: COLORS.border,
  },

  attachmentImageFrame: {
    width: 58,
    height: 58,
    position: "relative",
    marginRight: 11,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: COLORS.border,
  },

  attachmentImageHint: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(23,33,58,0.78)",
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

  attachmentViewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,16,29,0.94)",
  },

  attachmentViewer: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  attachmentViewerHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  attachmentViewerHeading: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },

  attachmentViewerTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
  },

  attachmentViewerCount: {
    color: "#C7D0E0",
    fontSize: 11,
    marginTop: 3,
  },

  attachmentViewerClose: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  attachmentViewerImageFrame: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.24)",
  },

  attachmentViewerImage: {
    width: "100%",
    height: "100%",
  },

  attachmentViewerFileName: {
    color: "#E8EDF6",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },

  attachmentViewerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
  },

  attachmentViewerNavButton: {
    minWidth: 132,
    minHeight: 44,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  attachmentViewerNavText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.surface,
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
