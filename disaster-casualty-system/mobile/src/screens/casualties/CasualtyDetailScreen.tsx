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
import { getTriageDisplayLabel } from "../../utils/triageDisplay";
import { useThemeMode } from "../../theme/theme-mode";

const COLORS = createThemePalette({
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
  headerBackground: "#F2F2F2",
  headerMutedText: "#6B6B6B",
  headerButtonBackground: "#E6E6E6",
  avatarBackground: "#6B6B6B",
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
    role === "sa_responder"
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
    (role === "responder" && assignment === "sa_responder")
  );
}

function isHealthcareDocumenterView(role: string | null): boolean {
  return role === "documenter" || role === "medical_personnel";
}

function getRecordRoleBucket(
  record: CasualtyRecord | null,
): "field_responder" | "sa_responder" | "minor_incident_documenter" | "documenter" | null {
  const role = record?.encoder?.role;

  if (role === "field_responder") {
    return "field_responder";
  }

  if (role === "sa_responder") {
    return "sa_responder";
  }

  if (role === "minor_incident_documenter") {
    return "minor_incident_documenter";
  }

  if (role === "documenter" || role === "medical_personnel") {
    return "documenter";
  }

  if (role === "responder") {
    const notes = record?.remarks?.toLowerCase() ?? "";
    if (
      notes.includes("advanced medical") ||
      notes.includes("amp responder") ||
      notes.includes("transport / release")
    ) {
      return "sa_responder";
    }

    return record?.latest_triage_assessment?.triage_stage ===
      "reassessment"
      ? "sa_responder"
      : "field_responder";
  }

  return null;
}

type DetailRowProps = {
  label: string;
  value: string;
  valueColor?: string;
};

function DetailRow({
  label,
  value,
  valueColor,
}: DetailRowProps) {
  const { colors } = useThemeMode();

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>

      <Text
        style={[
          styles.detailValue,
          {
            color: valueColor ?? colors.text,
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
  const { colors } = useThemeMode();

  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
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
  const { colors } = useThemeMode();

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

        <Text style={[styles.timelineTime, { color: colors.textSecondary }]}>
          {time}
        </Text>
        <Text style={[styles.timelineUser, { color: colors.text }]}>
          By: {user}
        </Text>
      </View>
    </View>
  );
}

function AttachmentCard({ item }: { item: Attachment }) {
  const { colors } = useThemeMode();
  const isImage = item.mime_type?.startsWith("image/") ?? false;

  return (
    <View
      style={[
        styles.attachmentCard,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      {isImage && item.signed_url ? (
        <Image
          source={{ uri: item.signed_url }}
          style={[
            styles.attachmentImage,
            { backgroundColor: colors.border },
          ]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.attachmentIcon,
            { backgroundColor: colors.warningBackground },
          ]}
        >
          <Ionicons
            name="document-attach-outline"
            size={22}
            color={COLORS.maroon}
          />
        </View>
      )}

      <View style={styles.attachmentInfo}>
        <Text
          style={[styles.attachmentName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.file_name}
        </Text>
        <Text style={[styles.attachmentMeta, { color: colors.textSecondary }]}>
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

function formatDetailDate(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  if (typeof value === "string" || typeof value === "number") {
    return formatDateTime(String(value));
  }

  return formatDetailUnknown(value);
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
  const normalizeSectionTitle = (value: string) =>
    value
      .toLowerCase()
      .replace(/\bpost\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const targetSection = normalizeSectionTitle(sectionTitle);
  const targetLabel = `${label}:`.toLowerCase();
  let insideSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      insideSection =
        normalizeSectionTitle(line.slice(1, -1)) === targetSection;
      continue;
    }

    if (insideSection && line.toLowerCase().startsWith(targetLabel)) {
      const value = line.slice(label.length + 1).trim();
      return value || null;
    }
  }

  return null;
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

function formatTriageSystem(value: string | null | undefined): string {
  switch (value) {
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
        borderColor: "#F2B6B8",
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
        borderColor: "#A9E7C2",
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
      return "SCOOTER";
    case "stay_and_play":
      return "Stay and Play";
    case "play_and_run":
      return "Play and Run";
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

function getRecordVictimCode(record: CasualtyRecord | null): string {
  if (!record) {
    return "Unavailable";
  }

  const noteSources = [
    record.remarks,
    record.latest_triage_assessment?.notes,
  ];

  for (const notes of noteSources) {
    const value =
      extractRecordSectionValue(
        notes,
        "Field Responder Codes",
        "Victim code",
      ) ??
      extractRecordSectionValue(
        notes,
        "Advanced Medical Responder Details",
        "Victim code",
      ) ??
      extractRecordSectionValue(
        notes,
        "SA Responder Details",
        "Victim code",
      ) ??
      extractRecordSectionValue(
        notes,
        "Minor Incident Documenter Details",
        "Victim code",
      );

    if (value) {
      return value;
    }
  }

  return "Unavailable";
}

function extractResponderDetailsValue(
  text: string | null | undefined,
  label: string,
): string | null {
  return (
    extractRecordSectionValue(
      text,
      "Advanced Medical Responder Details",
      label,
    ) ??
    extractRecordSectionValue(text, "SA Responder Details", label) ??
    extractRecordSectionValue(
      text,
      "Minor Incident Documenter Details",
      label,
    )
  );
}

function extractRecordTransportValue(
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
      insideTransportSection = line
        .slice(1, -1)
        .toLowerCase()
        .includes("transport / release");
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

function formatPatientFor(
  transport: CasualtyTransportHistoryItem | null | undefined,
  notes: string | null,
): string {
  const savedValue = extractRecordTransportValue(notes, "Patient for");

  if (savedValue) {
    return savedValue;
  }

  if (transport?.transport_required === "unknown") {
    return "Pending Departure";
  }

  return formatTransportRequired(transport?.transport_required);
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
  const { colors, isDark } = useThemeMode();
  const headerBackground = isDark ? colors.background : "#F2F2F2";
  const headerText = isDark ? colors.text : "#3A3A3A";
  const headerMutedText = isDark ? colors.textSecondary : "#6B6B6B";
  const headerButtonBackground = isDark
    ? "rgba(255,255,255,0.16)"
    : "#E6E6E6";
  const avatarBackground = isDark ? colors.surfaceRaised : "#6B6B6B";

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

  const loadCasualty = useCallback(async () => {
    if (!casualtyId) {
      setErrorMessage("Victim record id is missing.");
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
      console.error("Failed to load victim detail:", error);

      setErrorMessage(
        isAuthenticationTokenError(error)
          ? "Your session has expired. Please sign in again before opening victim records."
          : error instanceof Error
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
      verificationStatus: formatStatus(record.verification_status),
      verificationStatusRaw: record.verification_status,
      verifiedAt: formatDateTime(record.verified_at),
      notes:
        notes.length > 0
          ? notes.join("\n")
          : "No medical notes recorded.",
      lastUpdated: formatDateTime(record.updated_at),
      verified: record.verification_status === "verified",
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

  const canEditCurrentRecord = canEditRecord(
    currentUserRole,
    casualty?.verificationStatusRaw,
  );
  const isResponderCurrentUser = isResponderRole(currentUserRole);
  const isOwnRecord = casualty?.encoderId === currentUserId;
  const canEditRejectedOwnRecord =
    isResponderCurrentUser &&
    isOwnRecord &&
    casualty?.verificationStatusRaw === "rejected";
  const canShowHeaderEdit =
    canEditCurrentRecord &&
    (!isResponderCurrentUser || canEditRejectedOwnRecord);
  const canEditTransportCard =
    canEditCurrentRecord ||
    (isResponderCurrentUser && isOwnRecord);
  const requiresLogin =
    errorMessage?.toLowerCase().includes("sign in") ?? false;
  const recordRoleBucket = getRecordRoleBucket(record);
  const showFieldResponderDetails =
    recordRoleBucket === "field_responder";
  const showSaResponderDetails =
    recordRoleBucket === "sa_responder" ||
    recordRoleBucket === "minor_incident_documenter";
  const showMinorIncidentDocumenterDetails =
    recordRoleBucket === "minor_incident_documenter";
  const showHealthcareDocumenterDetails =
    recordRoleBucket === "documenter";

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
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
          color={COLORS.maroon}
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
    casualty.latestTriage?.triage_category ??
    record?.latest_triage_assessment?.triage_category ??
    casualty.status;
  const triageAssessment =
    casualty.latestTriage ??
    record?.latest_triage_assessment ??
    null;
  const triageCategoryLabel = getTriageDisplayLabel(
    triageAssessment,
    {
      preferFinalResult:
        getRecordRoleBucket(record) === "documenter",
      fallback: formatStatus(triageCategory),
    },
  );
  const triagePalette = getTriagePalette(triageCategory);
  const statusPalette = getStatusPalette(casualty.status);
  const verificationPalette = getVerificationPalette(
    casualty.verificationStatusRaw,
  );
  const remarks = record?.remarks ?? null;
  const triageNotes = casualty.latestTriage?.notes ?? null;
  const treatmentNotes = casualty.latestTreatment?.notes ?? null;
  const transportNotes = casualty.latestTransport?.notes ?? null;
  const facilityEncounter = record?.latest_facility_encounter ?? null;
  const treatmentDetails =
    casualty.latestTreatment?.treatment_details ?? {};
  const healthcareTreatmentValue = (
    label: string,
    key: string,
  ): unknown =>
    extractRecordSectionValue(
      treatmentNotes,
      "Management",
      label,
    ) ?? treatmentDetails[key];
  const healthcareDisasterPlanActivationTime =
    extractRecordSectionValue(
      remarks,
      "Healthcare Facility Documenter",
      "Disaster plan activation time",
    ) ?? treatmentDetails.disasterPlanActivationTime;
  const healthcareDispositionUponArrival =
    extractRecordSectionValue(
      remarks,
      "Healthcare Facility Documenter",
      "Disposition upon hospital arrival",
    ) ?? treatmentDetails.dispositionUponHospitalArrival;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={headerBackground}
      />

      <SafeAreaView
        edges={["top"]}
        style={[styles.headerSafeArea, { backgroundColor: headerBackground }]}
      >
        <View style={[styles.header, { backgroundColor: headerBackground }]}>
          <View
            style={[
              styles.headerDecoration,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.04)",
              },
            ]}
          />

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: headerButtonBackground },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={23}
              color={headerText}
            />
          </Pressable>

          <Text style={[styles.recordCode, { color: headerMutedText }]}>
            VICTIM RECORD - {casualty.id}
          </Text>

          <Text style={[styles.headerName, { color: headerText }]}>
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

            <Text style={[styles.lastUpdated, { color: headerMutedText }]}>
              Last updated: {casualty.lastUpdated}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.identityCardWrapper}>
        <View style={[styles.identityCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatar, { backgroundColor: avatarBackground }]}>
            <Text style={styles.avatarText}>
              {casualty.initials}
            </Text>
          </View>

          <View style={styles.identityInformation}>
            <Text style={[styles.identityName, { color: colors.text }]}>
              {casualty.fullName}
            </Text>

            <Text
              style={[
                styles.identityDescription,
                { color: colors.textSecondary },
              ]}
            >
              Triage Category: {triageCategoryLabel}
            </Text>

            <View style={styles.identityBadges}>
              <View
                style={[
                  styles.idBadge,
                  { backgroundColor: colors.backgroundElement },
                ]}
              >
                <Text
                  style={[
                    styles.idBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
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
              accessibilityLabel="Edit casualty"
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={COLORS.maroon}
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
                    value={formatStatus(
                      casualty.latestTriage.triage_category,
                    )}
                    valueColor={COLORS.maroon}
                  />

                  <DetailRow
                    label="Triage Time"
                    value={formatDateTime(
                      casualty.latestTriage.triaged_at,
                    )}
                  />
                </>
              ) : (
                <Text style={styles.emptyAttachmentText}>
                  No field triage assessment recorded.
                </Text>
              )}
            </SectionCard>

            <SectionCard title="INTERVENTIONS DONE">
              <DetailRow
                label="On-site Action"
                value={formatTreatmentStrategy(
                  casualty.latestTreatment?.treatment_strategy,
                )}
              />

              <DetailRow
                label="Action Notes"
                value={extractRecordBaseText(treatmentNotes)}
              />
            </SectionCard>

          </>
        ) : showSaResponderDetails ? (
          <>
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

            {showMinorIncidentDocumenterDetails ? (
              <>
            <SectionCard title="INTRO">
              <DetailRow
                label="Incident Name"
                value={casualty.incident}
              />

              <DetailRow
                label="Witness Present"
                value={formatValue(
                  extractResponderDetailsValue(
                    remarks,
                    "Witness present",
                  ),
                )}
              />

              <DetailRow
                label="Witness Response"
                value={formatValue(
                  extractResponderDetailsValue(
                    remarks,
                    "Witness response",
                  ),
                )}
              />

              <DetailRow
                label="Other Witness"
                value={formatValue(
                  extractResponderDetailsValue(
                    remarks,
                    "Witness other",
                  ),
                )}
              />

              <DetailRow
                label="CPR Type"
                value={formatValue(
                  extractResponderDetailsValue(
                    remarks,
                    "CPR type",
                  ),
                )}
              />
            </SectionCard>

            <SectionCard title="INFO">
              <DetailRow
                label="Victim Code"
                value={getRecordVictimCode(record)}
              />

              <DetailRow
                label="ID Number"
                value={formatValue(record?.casualty.id_number)}
              />

              <DetailRow
                label="Patient Identified"
                value={formatValue(
                  extractResponderDetailsValue(
                    remarks,
                    "Patient identified",
                  ),
                )}
              />

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

              <DetailRow
                label="Age"
                value={casualty.age}
              />

              <DetailRow label="Sex" value={casualty.sex} />

              <DetailRow
                label="Date of Birth"
                value={casualty.dateOfBirth}
              />
              <DetailRow
                label="Newborn"
                value={formatValue(
                  extractResponderDetailsValue(
                    remarks,
                    "Newborn",
                  ),
                )}
              />

              <DetailRow
                label="Pregnant"
                value={formatValue(
                  extractResponderDetailsValue(
                    remarks,
                    "Pregnant",
                  ),
                )}
              />

              <DetailRow
                label="Religion"
                value={formatValue(
                  extractResponderDetailsValue(
                    remarks,
                    "Religion",
                  ),
                )}
              />

              <DetailRow
                label="Contact Number"
                value={formatValue(record?.casualty.contact_number)}
              />
            </SectionCard>
              </>
            ) : null}

            {showMinorIncidentDocumenterDetails ? (
              <SectionCard title="ADDRESS">
                <DetailRow
                  label="House / Street"
                  value={formatValue(record?.casualty.house_street)}
                />
                <DetailRow
                  label="Barangay"
                  value={formatValue(record?.casualty.barangay)}
                />
                <DetailRow
                  label="Municipality / City"
                  value={formatValue(record?.casualty.municipality)}
                />
                <DetailRow
                  label="Province"
                  value={formatValue(record?.casualty.province)}
                />
                <DetailRow
                  label="Region"
                  value={formatValue(record?.casualty.region)}
                />
              </SectionCard>
            ) : null}

            <SectionCard title="TRIAGE">
              {casualty.latestTriage ? (
                <>
                  {!showMinorIncidentDocumenterDetails ? (
                    <>
                      <DetailRow
                        label="Victim Code"
                        value={getRecordVictimCode(record)}
                      />
                      <DetailRow
                        label="ID Number"
                        value={formatValue(record?.casualty.id_number)}
                      />
                    </>
                  ) : null}

                  <DetailRow
                    label="Triage System"
                    value={formatTriageSystem(
                      casualty.latestTriage.triage_system,
                    )}
                  />
                  <DetailRow
                    label="Triage Assessment"
                    value={triageCategoryLabel}
                    valueColor={COLORS.maroon}
                  />
                  <DetailRow
                    label="Triage Time"
                    value={formatDateTime(
                      casualty.latestTriage.triaged_at,
                    )}
                  />
                  <DetailRow
                    label="Stabilized Time"
                    value={formatDateTime(
                      casualty.latestTreatment?.stabilized_at,
                    )}
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

            {showMinorIncidentDocumenterDetails ? (
            <SectionCard title="ON-SITE STABILIZATION">
              <DetailRow
                label="On-site Stabilization"
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
                label="Patient Care Report Photo"
                value={formatValue(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Patient Care Report",
                    "Patient Care Report (PCR) photo attached",
                  ),
                )}
              />

              <DetailRow
                label="Notes"
                value={extractRecordBaseText(treatmentNotes)}
              />
              </SectionCard>
            ) : null}

            <SectionCard title="TRANSPORT">
              {casualty.latestTransport ? (
                <>
                  <DetailRow
                    label="Patient For"
                    value={formatPatientFor(
                      casualty.latestTransport,
                      transportNotes,
                    )}
                  />

                  <DetailRow
                    label="Condition Before Release"
                    value={formatValue(
                      extractRecordTransportValue(
                        transportNotes,
                        "Condition before release",
                      ),
                    )}
                  />

                  <DetailRow
                    label="Condition Before Transfer"
                    value={formatValue(
                      extractRecordTransportValue(
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
                        extractRecordTransportValue(
                          transportNotes,
                          "Receiving facility",
                        ),
                    )}
                    valueColor={COLORS.maroon}
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
                    label="Used EMS Vehicle"
                    value={formatValue(
                      extractRecordTransportValue(
                        transportNotes,
                        "Used EMS vehicle",
                      ),
                    )}
                  />
                </>
              ) : (
                <Text style={styles.emptyAttachmentText}>
                  No Advanced Medical Responder transport record saved.
                </Text>
              )}
            </SectionCard>

            <SectionCard title="REMARKS">
              <DetailRow
                label="Remarks"
                value={extractRecordBaseText(remarks)}
              />
            </SectionCard>
          </>
        ) : showHealthcareDocumenterDetails ? (
          <>
            <SectionCard title="GENERAL INFORMATION">
              <DetailRow
                label="Receiving Facility"
                value={casualty.receivingFacility}
                valueColor={COLORS.maroon}
              />

              <DetailRow
                label="Incident Name"
                value={casualty.incident}
              />

              <DetailRow
                label="Time of Arrival of Victim"
                value={formatDateTime(facilityEncounter?.arrived_at)}
              />

              <DetailRow
                label="Triage Before Transport to Healthcare Facility"
                value={formatStatus(
                  facilityEncounter?.pre_transport_triage_category,
                )}
              />

              <DetailRow
                label="Disaster Plan Activation Time"
                value={formatDetailDate(
                  healthcareDisasterPlanActivationTime,
                )}
              />

              <DetailRow
                label="Disposition Upon Hospital Arrival"
                value={formatDetailUnknown(
                  healthcareDispositionUponArrival ??
                    facilityEncounter?.disposition,
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
              <DetailRow
                label="Age"
                value={formatValue(record?.casualty.estimated_age)}
              />
              <DetailRow
                label="Contact Number"
                value={formatValue(record?.casualty.contact_number)}
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
                    value={triageCategoryLabel}
                    valueColor={COLORS.maroon}
                  />

                  <DetailRow
                    label="Triage Time"
                    value={formatDateTime(
                      casualty.latestTriage.triaged_at,
                    )}
                  />

                  <DetailRow
                    label="Triage Location"
                    value={formatValue(
                      casualty.latestTriage.location,
                    )}
                  />

                  <DetailRow
                    label="Other Triage System"
                    value={formatValue(
                      extractRecordSectionValue(
                        triageNotes,
                        "Healthcare Facility Triage",
                        "Other triage system",
                      ),
                    )}
                  />

                  <DetailRow
                    label="Triage Notes"
                    value={extractRecordBaseText(triageNotes)}
                  />

                </>
              ) : (
                <Text style={styles.emptyAttachmentText}>
                  No healthcare facility triage recorded.
                </Text>
              )}
            </SectionCard>

            <SectionCard title="MANAGEMENT">
              <DetailRow
                label="Resuscitation Room Used"
                value={formatDetailUnknown(
                  healthcareTreatmentValue(
                    "Resuscitation room used",
                    "resuscitationRoomUsed",
                  ),
                )}
              />

              <DetailRow
                label="Time of Resuscitation Room Use"
                value={formatDetailDate(
                  facilityEncounter?.ed_resuscitation_started_at,
                )}
              />

              <DetailRow
                label="Surgical Intervention"
                value={formatDetailUnknown(
                  healthcareTreatmentValue(
                    "Surgical intervention",
                    "surgicalInterventionRequired",
                  ),
                )}
              />

              <DetailRow
                label="Surgical Intervention Start"
                value={formatDetailDate(
                  facilityEncounter?.surgical_intervention_started_at,
                )}
              />

              <DetailRow
                label="Surgical Intervention End"
                value={formatDetailDate(
                  facilityEncounter?.surgical_intervention_ended_at,
                )}
              />

              <DetailRow
                label="Operating Room Used"
                value={formatDetailUnknown(
                  healthcareTreatmentValue(
                    "Operating room used",
                    "operatingRoomUsed",
                  ),
                )}
              />

              <DetailRow
                label="Number of Operating Rooms"
                value={formatDetailUnknown(
                  healthcareTreatmentValue(
                    "Number of operating rooms",
                    "numberOfOperatingRooms",
                  ),
                )}
              />

              <DetailRow
                label="Operating Room Use Time"
                value={formatDetailDate(
                  facilityEncounter?.operating_room_started_at,
                )}
              />

              <DetailRow
                label="X-Ray Used"
                value={formatBooleanValue(
                  facilityEncounter?.xray_required,
                )}
              />

              <DetailRow
                label="Time of X-Ray Use"
                value={formatDetailDate(
                  facilityEncounter?.xray_performed_at,
                )}
              />

              <DetailRow
                label="Ultrasound Used"
                value={formatBooleanValue(
                  facilityEncounter?.ultrasound_required,
                )}
              />

              <DetailRow
                label="Time of Ultrasound Use"
                value={formatDetailDate(
                  facilityEncounter?.ultrasound_performed_at,
                )}
              />

              <DetailRow
                label="CT Scan Used"
                value={formatBooleanValue(
                  facilityEncounter?.ct_required,
                )}
              />

              <DetailRow
                label="Time of CT Scan Use"
                value={formatDetailDate(
                  facilityEncounter?.ct_performed_at,
                )}
              />

              <DetailRow
                label="Admitted to Unit"
                value={formatDetailUnknown(
                  healthcareTreatmentValue(
                    "Admitted to unit",
                    "admittedToUnit",
                  ),
                )}
              />

              <DetailRow
                label="Other Unit"
                value={formatDetailUnknown(
                  healthcareTreatmentValue(
                    "Other admitted unit",
                    "otherAdmittedUnit",
                  ),
                )}
              />

              <DetailRow
                label="Unit Admission Time"
                value={formatDetailDate(
                  healthcareTreatmentValue(
                    "Unit admission time",
                    "unitAdmissionTime",
                  ),
                )}
              />

              <DetailRow
                label="ED Admission Time"
                value={formatDetailDate(
                  facilityEncounter?.ed_admitted_at,
                )}
              />

              <DetailRow
                label="ED Departure Time"
                value={formatDetailDate(
                  facilityEncounter?.ed_departed_at,
                )}
              />

              <DetailRow
                label="Mechanical Ventilation Used"
                value={formatBooleanValue(
                  facilityEncounter?.mechanical_ventilation_required,
                )}
              />

              <DetailRow
                label="Ventilation Start Time"
                value={formatDetailDate(
                  facilityEncounter?.ventilation_started_at,
                )}
              />

              <DetailRow
                label="Ventilation End Time"
                value={formatDetailDate(
                  facilityEncounter?.ventilation_ended_at,
                )}
              />

              <DetailRow
                label="ICU Admission Time"
                value={formatDetailDate(
                  facilityEncounter?.icu_admitted_at,
                )}
              />

              <DetailRow
                label="Alternative ICU Used"
                value={formatBooleanValue(
                  facilityEncounter?.alternative_icu_used,
                )}
              />
            </SectionCard>

            <SectionCard title="DISPOSITION">
              <DetailRow
                label="Currently Admitted in ICU"
                value={formatDetailUnknown(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Management",
                    "Currently admitted in ICU",
                  ) ?? treatmentDetails.currentlyAdmittedInIcu,
                )}
              />

              <DetailRow
                label="Transferred to Ward"
                value={formatDetailUnknown(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Management",
                    "Transferred to ward",
                  ) ?? treatmentDetails.transferredToWard,
                )}
              />

              <DetailRow
                label="In Active Care"
                value={formatDetailUnknown(
                  extractRecordSectionValue(
                    treatmentNotes,
                    "Management",
                    "In active care",
                  ) ?? treatmentDetails.inActiveCare,
                )}
              />

              <DetailRow
                label="Hospital Discharge Time"
                value={formatDateTime(
                  facilityEncounter?.hospital_discharged_at,
                )}
              />

              <DetailRow
                label="Hospital Admission Time"
                value={formatDetailDate(
                  facilityEncounter?.hospital_admitted_at,
                )}
              />

              <DetailRow
                label="ICU Discharge Time"
                value={formatDetailDate(
                  facilityEncounter?.icu_discharged_at,
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
            valueColor={COLORS.maroon}
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
                value={triageCategoryLabel}
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
                  color={COLORS.maroon}
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
          </>
        )}

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
                Photos uploaded from add or edit victim will appear here.
              </Text>
            </View>
          )}
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
    backgroundColor: COLORS.headerBackground,
  },

  header: {
    minHeight: 225,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: COLORS.headerBackground,
  },

  headerDecoration: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -55,
    top: -100,
    backgroundColor: "rgba(0,0,0,0.04)",
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.headerButtonBackground,
  },

  recordCode: {
    color: COLORS.headerMutedText,
    fontSize: 11,
    letterSpacing: 0.2,
    marginTop: 15,
  },

  headerName: {
    color: COLORS.text,
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
    color: COLORS.headerMutedText,
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
    backgroundColor: COLORS.avatarBackground,
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
    borderColor: "#E8D4D6",
    backgroundColor: "#FFF6F6",
    gap: 5,
  },

  sectionEditButtonText: {
    color: COLORS.maroon,
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
