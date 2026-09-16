import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCasualties,
  getCasualtyVerificationActionLogs,
  type CasualtyRecord,
  type CasualtyVerificationActionLogItem,
} from "../api/casualties";
import type { ProfileUser } from "../api/profile";
import {
  getCurrentUser,
} from "../auth/session";
import {
  getResponderAssignment,
  type ResponderAssignment,
} from "../auth/responderAssignment";
import {
  getQueuedCasualtySubmissions,
  type QueuedCasualtySubmission,
} from "../offline/casualtyQueue";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  card: "#FFFFFF",
  text: "#17213A",
  secondaryText: "#7C88A0",
  border: "#E4E8EF",
  paleGreen: "#E8F4EA",
  green: "#2E7D4F",
  paleRed: "#FCE6E7",
  red: "#C92D32",
  paleOrange: "#FFF0DF",
  orange: "#D96D12",
  paleBlue: "#DFF2FC",
  blue: "#0B6B9B",
  fieldBackground: "#F7F9FC",
};

const RESPONDER_ROLES = new Set([
  "responder",
  "field_responder",
  "sa_responder",
]);

type DisplayActionLog = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  unitAssignment: string;
  actionPerformed: string;
  previousStatus: string;
  newStatus: string;
  rejectionReason: string | null;
  actionAt: string;
  casualtyLoggedAt: string;
  location: string;
  result: string;
};

function formatRole(role: string | null | undefined): string {
  if (role === "administrator" || role === "admin") {
    return "Admin";
  }

  if (role === "super_admin") {
    return "Super Admin";
  }

  return role
    ? role
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Admin";
}

function formatResponderRole(
  userRole: string | null | undefined,
  assignment: ResponderAssignment | null,
): string {
  if (assignment === "field_responder" || userRole === "field_responder") {
    return "Field Responder";
  }

  if (assignment === "sa_responder" || userRole === "sa_responder") {
    return "Advanced Medical Responder";
  }

  return "Responder";
}

function formatRecordResponderRole(record: CasualtyRecord): string {
  if (record.encoder.role === "field_responder") {
    return "Field Responder";
  }

  if (record.encoder.role === "sa_responder") {
    return "Advanced Medical Responder";
  }

  return formatResponderRole(record.encoder.role, null);
}

function formatStatus(status: string | null | undefined): string {
  switch (status) {
    case "verified":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "under_review":
      return "Under Review";
    case "submitted":
      return "Submitted";
    default:
      return status
        ? status
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ")
        : "Under Review";
  }
}

function getActionLabel(log: CasualtyVerificationActionLogItem): string {
  const idNumber =
    log.casualty_record?.casualty.id_number?.trim() ||
    log.casualty_incident_id;

  return `${formatStatus(log.new_status)} - ${idNumber}`;
}

function formatResponderNewStatus(
  status: string | null | undefined,
  isLocal: boolean,
): string {
  if (isLocal) {
    return "Submitted (local)";
  }

  switch (status) {
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    case "under_review":
    case "submitted":
    default:
      return "Under Review";
  }
}

function buildUnitAssignment(
  barangay: string | null | undefined,
  municipality: string | null | undefined,
): string {
  const parts = [barangay, municipality].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : "None";
}

function getUnitAssignment(
  log: CasualtyVerificationActionLogItem,
): string {
  const reviewer = log.reviewed_by_user;
  const parts = [
    reviewer?.assigned_barangay,
    reviewer?.assigned_municipality,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : "None";
}

function getLocation(log: CasualtyVerificationActionLogItem): string {
  const record = log.casualty_record;
  const casualty = record?.casualty;
  const savedLocation = record?.current_location?.trim();

  if (savedLocation) {
    return savedLocation;
  }

  const address = [
    casualty?.house_street,
    casualty?.barangay,
    casualty?.municipality,
    casualty?.province,
    casualty?.region,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  if (address.length > 0) {
    return address.join(", ");
  }

  if (
    typeof record?.latitude === "number" &&
    typeof record.longitude === "number"
  ) {
    return `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`;
  }

  return "No location recorded";
}

function getRecordLocation(record: CasualtyRecord): string {
  const savedLocation = record.current_location?.trim();

  if (savedLocation) {
    return savedLocation;
  }

  const parts = [
    record.casualty.house_street,
    record.casualty.barangay,
    record.casualty.municipality,
    record.casualty.province,
    record.casualty.region,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  if (parts.length > 0) {
    return parts.join(", ");
  }

  if (
    typeof record.latitude === "number" &&
    typeof record.longitude === "number"
  ) {
    return `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`;
  }

  return "No location recorded";
}

function getQueuedLocation(item: QueuedCasualtySubmission): string {
  const savedLocation = item.payload.incidentDetails.currentLocation?.trim();

  if (savedLocation) {
    return savedLocation;
  }

  const parts = [
    item.payload.person.houseStreet,
    item.payload.person.barangay,
    item.payload.person.municipality,
    item.payload.person.province,
    item.payload.person.region,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  if (parts.length > 0) {
    return parts.join(", ");
  }

  const { latitude, longitude } = item.payload.incidentDetails;

  if (
    typeof latitude === "number" &&
    typeof longitude === "number"
  ) {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }

  return "No location recorded";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDateFilterInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function isValidDateFilterInput(value: string): boolean {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    return false;
  }

  const [monthText, dayText, yearText] =
    value.split("-");

  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);

  const date = new Date(
    year,
    month - 1,
    day,
  );

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatDateFilterValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${month}-${day}-${year}`;
}

function getCasualtyLoggedAt(
  log: CasualtyVerificationActionLogItem,
): string {
  return (
    log.casualty_record?.reported_at ||
    log.casualty_record?.created_at ||
    log.created_at
  );
}

function toAdminDisplayLog(
  log: CasualtyVerificationActionLogItem,
): DisplayActionLog {
  const reviewer = log.reviewed_by_user;
  const idNumber =
    log.casualty_record?.casualty.id_number?.trim() ||
    log.casualty_record?.client_record_id ||
    log.casualty_incident_id;

  if (log.action_type === "casualty_submission") {
    return {
      id: log.id,
      fullName: reviewer?.full_name || "Logged in user",
      email: reviewer?.email || "No email",
      role: formatRole(reviewer?.role),
      unitAssignment: getUnitAssignment(log),
      actionPerformed: `Added victim record ${idNumber}`,
      previousStatus: "-",
      newStatus: formatResponderNewStatus(log.new_status, false),
      rejectionReason: null,
      actionAt: log.created_at,
      casualtyLoggedAt: getCasualtyLoggedAt(log),
      location: getLocation(log),
      result: log.result || "Successful",
    };
  }

  return {
    id: log.id,
    fullName: reviewer?.full_name || "Logged in admin",
    email: reviewer?.email || "No email",
    role: formatRole(reviewer?.role),
    unitAssignment: getUnitAssignment(log),
    actionPerformed: getActionLabel(log),
    previousStatus: "Under Review",
    newStatus: formatStatus(log.new_status),
    rejectionReason:
      log.new_status === "rejected"
        ? log.review_notes?.trim() || "No reason recorded"
        : null,
    actionAt: log.created_at,
    casualtyLoggedAt: getCasualtyLoggedAt(log),
    location: getLocation(log),
    result: log.result || "Successful",
  };
}

function toResponderDisplayLog(
  record: CasualtyRecord,
  user: ProfileUser,
): DisplayActionLog {
  const idNumber =
    record.casualty.id_number?.trim() ||
    record.client_record_id ||
    record.id;

  return {
    id: record.id,
    fullName: user.full_name,
    email: user.email,
    role: formatRecordResponderRole(record),
    unitAssignment: buildUnitAssignment(
      user.assigned_barangay,
      user.assigned_municipality,
    ),
    actionPerformed: `Added victim record ${idNumber}`,
    previousStatus: "-",
    newStatus: formatResponderNewStatus(
      record.verification_status,
      false,
    ),
    rejectionReason:
      record.verification_status === "rejected"
        ? "See Verification Review for admin notes."
        : null,
    actionAt: record.created_at,
    casualtyLoggedAt: record.reported_at || record.created_at,
    location: getRecordLocation(record),
    result: "Successful",
  };
}

function toQueuedResponderDisplayLog(
  item: QueuedCasualtySubmission,
  user: ProfileUser,
  assignment: ResponderAssignment | null,
): DisplayActionLog {
  const idNumber =
    item.payload.person.idNumber?.trim() ||
    item.payload.clientRecordId;

  return {
    id: item.id,
    fullName: user.full_name,
    email: user.email,
    role: formatResponderRole(user.role, assignment),
    unitAssignment: buildUnitAssignment(
      user.assigned_barangay,
      user.assigned_municipality,
    ),
    actionPerformed: `Added victim record ${idNumber}`,
    previousStatus: "-",
    newStatus: formatResponderNewStatus(null, true),
    rejectionReason: null,
    actionAt: item.createdAt,
    casualtyLoggedAt:
      item.payload.incidentDetails.reportedAt || item.createdAt,
    location: getQueuedLocation(item),
    result: "Successful",
  };
}

function getResultColor(result: string): {
  backgroundColor: string;
  color: string;
} {
  return result.toLowerCase().includes("not")
    ? {
        backgroundColor: COLORS.paleRed,
        color: COLORS.red,
      }
    : {
        backgroundColor: COLORS.paleGreen,
        color: COLORS.green,
      };
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ActionLogListItem({
  item,
  onPress,
}: {
  item: DisplayActionLog;
  onPress: () => void;
}) {
  const resultStyle = getResultColor(item.result);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listItem,
        pressed && styles.listItemPressed,
      ]}
    >
      <View style={styles.iconBadge}>
        <Ionicons
          name="clipboard-outline"
          size={20}
          color={COLORS.maroon}
        />
      </View>

      <View style={styles.listItemBody}>
        <View style={styles.listItemTopRow}>
          <Text style={styles.actionTitle} numberOfLines={2}>
            {item.actionPerformed}
          </Text>

          <View
            style={[
              styles.resultPill,
              { backgroundColor: resultStyle.backgroundColor },
            ]}
          >
            <Text style={[styles.resultText, { color: resultStyle.color }]}>
              {item.result || "Successful"}
            </Text>
          </View>
        </View>

        <Text style={styles.timestamp}>
          {formatTimestamp(item.actionAt)}
        </Text>

        <View style={styles.listMetaRow}>
          <Text style={styles.listMetaText} numberOfLines={1}>
            {item.role}
          </Text>
          <Text style={styles.listMetaDot}>|</Text>
          <Text style={styles.listMetaText} numberOfLines={1}>
            {item.newStatus}
          </Text>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.secondaryText}
      />
    </Pressable>
  );
}

function ActionLogDetailsModal({
  item,
  onClose,
}: {
  item: DisplayActionLog | null;
  onClose: () => void;
}) {
  if (!item) {
    return null;
  }

  const resultStyle = getResultColor(item.result);
  const isRejected = item.rejectionReason !== null;

  return (
    <Modal
      visible={Boolean(item)}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBlock}>
              <Text style={styles.modalEyebrow}>ACTION LOG DETAILS</Text>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {item.actionPerformed}
              </Text>
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={22} color={COLORS.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconBadge}>
                <Ionicons
                  name="clipboard-outline"
                  size={20}
                  color={COLORS.maroon}
                />
              </View>

              <View style={styles.cardHeaderText}>
                <Text style={styles.actionTitle}>{item.actionPerformed}</Text>
                <Text style={styles.timestamp}>
                  {formatTimestamp(item.actionAt)}
                </Text>
              </View>

              <View
                style={[
                  styles.resultPill,
                  { backgroundColor: resultStyle.backgroundColor },
                ]}
              >
                <Text
                  style={[styles.resultText, { color: resultStyle.color }]}
                >
                  {item.result || "Successful"}
                </Text>
              </View>
            </View>

            <View style={styles.detailGroup}>
              <DetailRow
                label="Full Name"
                value={item.fullName}
              />
              <DetailRow label="Email" value={item.email} />
              <DetailRow label="Role" value={item.role} />
              <DetailRow
                label="Unit Assignment"
                value={item.unitAssignment}
              />
            </View>

            <View style={styles.statusBlock}>
              <Text style={styles.statusLabel}>Action Performed</Text>
              <Text style={styles.statusValue}>{item.actionPerformed}</Text>

              <View style={styles.statusGrid}>
                <View style={styles.statusCell}>
                  <Text style={styles.detailLabel}>Previous Status</Text>
                  <Text style={styles.statusCellValue}>
                    {item.previousStatus}
                  </Text>
                </View>

                <View style={styles.statusCell}>
                  <Text style={styles.detailLabel}>New Status</Text>
                  <Text style={styles.statusCellValue}>
                    {item.newStatus}
                  </Text>
                </View>
              </View>

              {isRejected ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.detailLabel}>Rejection Reason</Text>
                  <Text style={styles.reasonText}>
                    {item.rejectionReason}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.detailGroup}>
              <DetailRow
                label="Action Date/Time"
                value={formatTimestamp(item.actionAt)}
              />
              <DetailRow
                label="Logged Victim Date/Time"
                value={formatTimestamp(item.casualtyLoggedAt)}
              />
              <DetailRow label="Location" value={item.location} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ActionLogsScreen() {
  const [logs, setLogs] = useState<DisplayActionLog[]>([]);
  const [screenEyebrow, setScreenEyebrow] = useState("ADMIN");
  const [screenSubtitle, setScreenSubtitle] = useState(
    "Verification decisions made by the logged in admin",
  );
  const [selectedLog, setSelectedLog] =
    useState<DisplayActionLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const showInvalidDate =
  dateFilter.length === 10 &&
  !isValidDateFilterInput(dateFilter);
  const [isDatePickerVisible, setIsDatePickerVisible] =
  useState(false);

  const [datePickerMonth, setDatePickerMonth] =
  useState(() => new Date());

  const loadLogs = useCallback(async () => {
    try {
      setErrorMessage(null);
      const user = await getCurrentUser();

      if (user && RESPONDER_ROLES.has(user.role)) {
        const [assignment, syncedRecords, queuedRecords] =
          await Promise.all([
            getResponderAssignment(),
            getCasualties(),
            getQueuedCasualtySubmissions(),
          ]);

        setScreenSubtitle(
          "Victim records added by the logged in responder",
        );
        setScreenEyebrow("RESPONDER");
        setLogs([
          ...syncedRecords.map((record) =>
            toResponderDisplayLog(record, user),
          ),
          ...queuedRecords.map((item) =>
            toQueuedResponderDisplayLog(item, user, assignment),
          ),
        ]);
        return;
      }

      const data = await getCasualtyVerificationActionLogs();
      setScreenSubtitle(
        "Verification decisions made by the logged in admin",
      );
      setScreenEyebrow("ADMIN");
      setLogs(data.map(toAdminDisplayLog));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load action logs.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadLogs();
    }, [loadLogs]),
  );

  const sortedLogs = useMemo(
    () =>
      [...logs].sort(
        (first, second) =>
          new Date(second.actionAt).getTime() -
          new Date(first.actionAt).getTime(),
      ),
    [logs],
  );

  const visibleLogs = useMemo(
    () =>
      sortedLogs.filter((log) => {
        const normalizedFilter =
          dateFilter.trim();

        if (!normalizedFilter) {
          return true;
        }

        if (
          !isValidDateFilterInput(
            normalizedFilter,
          )
        ) {
          return true;
        }

        return (
          formatDateFilterValue(log.actionAt) ===
          normalizedFilter
        );
      }),
    [dateFilter, sortedLogs],
  );

  const datePickerMonthDays = useMemo(() => {
  const year = datePickerMonth.getFullYear();
  const month = datePickerMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(
    year,
    month + 1,
    0,
  ).getDate();

  return [
    ...Array.from(
      { length: firstDay },
      () => null,
    ),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => index + 1,
    ),
  ];
}, [datePickerMonth]);

const datePickerMonthLabel = useMemo(
  () =>
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(datePickerMonth),
  [datePickerMonth],
);

function changeDatePickerMonth(offset: number) {
  setDatePickerMonth(
    (current) =>
      new Date(
        current.getFullYear(),
        current.getMonth() + offset,
        1,
      ),
  );
}

function selectDatePickerDay(day: number) {
  const selectedDate = new Date(
    datePickerMonth.getFullYear(),
    datePickerMonth.getMonth(),
    day,
  );

  const month = String(
    selectedDate.getMonth() + 1,
  ).padStart(2, "0");

  const formattedDay = String(
    selectedDate.getDate(),
  ).padStart(2, "0");

  const year = selectedDate.getFullYear();

  setDateFilter(
    `${month}-${formattedDay}-${year}`,
  );
  

  setIsDatePickerVisible(false);
}

function isDatePickerDaySelected(day: number): boolean {
  const selectedDate = new Date(
    datePickerMonth.getFullYear(),
    datePickerMonth.getMonth(),
    day,
  );

  const month = String(
    selectedDate.getMonth() + 1,
  ).padStart(2, "0");

  const formattedDay = String(
    selectedDate.getDate(),
  ).padStart(2, "0");

  const year = selectedDate.getFullYear();

  return (
    dateFilter.trim() ===
    `${month}-${formattedDay}-${year}`
  );
}

function openDatePicker() {
  const parts = dateFilter.trim().split("-");

  if (parts.length === 3) {
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    const year = Number(parts[2]);

    const selectedDate = new Date(
      year,
      month - 1,
      day,
    );

    const isValidDate =
      !Number.isNaN(selectedDate.getTime()) &&
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month - 1 &&
      selectedDate.getDate() === day;

    if (isValidDate) {
      setDatePickerMonth(
        new Date(year, month - 1, 1),
      );
    }
  } else {
    setDatePickerMonth(new Date());
  }

  setIsDatePickerVisible(true);
}



  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadLogs();
  }, [loadLogs]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.maroon} />

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={COLORS.white} />
        </Pressable>

        <View>
          <Text style={styles.eyebrow}>{screenEyebrow}</Text>
          <Text style={styles.title}>Action Logs</Text>
          <Text style={styles.subtitle}>{screenSubtitle}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.maroon} />
          <Text style={styles.centerText}>Loading action logs...</Text>
        </View>
      ) : (
        <FlatList
          data={visibleLogs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ActionLogListItem
              item={item}
              onPress={() => setSelectedLog(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.maroon}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.filterCard}>
                <Pressable
                  onPress={openDatePicker}
                  style={({ pressed }) => [
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.filterLabel}>
                    Filter by date
                  </Text>
                </Pressable>
                <View style={styles.filterInputRow}>
                  <TextInput
                    value={dateFilter}
                    onChangeText={(value) =>
                      setDateFilter(formatDateFilterInput(value))
                    }
                    placeholder="MM-DD-YYYY"
                    placeholderTextColor={COLORS.secondaryText}
                    style={styles.filterInput}
                    autoCapitalize="none"
                    keyboardType="numeric"
                    maxLength={10}
                  />

                  <Pressable
                    onPress={openDatePicker}
                    style={({ pressed }) => [
                      styles.calendarButton,
                      pressed && styles.calendarButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={COLORS.maroon}
                    />
                  </Pressable>

                  {dateFilter.trim() ? (
                    <Pressable
                      onPress={() => setDateFilter("")}
                      style={styles.clearFilterButton}
                    >
                      <Text style={styles.clearFilterText}>
                        Clear
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {showInvalidDate ? (
                  <Text style={styles.dateFilterError}>
                    Enter a valid date in MM-DD-YYYY format.
                  </Text>
                ) : null}
                <Text style={styles.filterHint}>
                  Showing {visibleLogs.length} newest-first action log
                  {visibleLogs.length === 1 ? "" : "s"}.
                </Text>
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={20}
                    color={COLORS.red}
                  />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="clipboard-outline"
                size={42}
                color={COLORS.secondaryText}
              />
              <Text style={styles.emptyTitle}>No action logs yet</Text>
              <Text style={styles.emptyText}>
                Added victim records and verification decisions will appear
                here when this account performs actions.
              </Text>
            </View>
          }
        />
      )}

      <Modal
  visible={isDatePickerVisible}
  transparent
  animationType="fade"
  onRequestClose={() =>
    setIsDatePickerVisible(false)
  }
>
  <Pressable
    style={styles.datePickerOverlay}
    onPress={() =>
      setIsDatePickerVisible(false)
    }
  >
    <Pressable
      style={styles.datePickerCard}
      onPress={(event) =>
        event.stopPropagation()
      }
    >
      <View style={styles.datePickerHeader}>
        <Pressable
          onPress={() =>
            changeDatePickerMonth(-1)
          }
          style={styles.datePickerNavButton}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={COLORS.maroon}
          />
        </Pressable>

        <Text style={styles.datePickerTitle}>
          {datePickerMonthLabel}
        </Text>

        <Pressable
          onPress={() =>
            changeDatePickerMonth(1)
          }
          style={styles.datePickerNavButton}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={COLORS.maroon}
          />
        </Pressable>
      </View>

      <View style={styles.datePickerWeekRow}>
        {[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].map((day) => (
          <Text
            key={day}
            style={styles.datePickerWeekday}
          >
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.datePickerGrid}>
        {datePickerMonthDays.map(
          (day, index) =>
            day === null ? (
              <View
                key={`blank-${index}`}
                style={styles.datePickerDaySpacer}
              />
            ) : (
              <Pressable
                key={day}
                onPress={() =>
                  selectDatePickerDay(day)
                }
                style={({ pressed }) => [
                  styles.datePickerDay,
                  isDatePickerDaySelected(day) &&
                    styles.datePickerDaySelected,
                  pressed &&
                    styles.datePickerDayPressed,
                ]}
              >
                <Text
                  style={[
                    styles.datePickerDayText,
                    isDatePickerDaySelected(day) &&
                      styles.datePickerDayTextSelected,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            ),
        )}
      </View>

      <Pressable
        onPress={() =>
          setIsDatePickerVisible(false)
        }
        style={styles.datePickerCancel}
      >
        <Text
          style={styles.datePickerCancelText}
        >
          Cancel
        </Text>
      </Pressable>
    </Pressable>
  </Pressable>
</Modal>

      <ActionLogDetailsModal
        item={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  dateFilterError: {
  color: COLORS.red,
  fontSize: 11,
  fontWeight: "700",
},

  datePickerDaySelected: {
  backgroundColor: COLORS.maroon,
},

datePickerDayTextSelected: {
  color: COLORS.white,
},

  datePickerOverlay: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  backgroundColor: "rgba(8, 12, 24, 0.48)",
},

datePickerCard: {
  width: "100%",
  maxWidth: 390,
  padding: 18,
  borderRadius: 14,
  backgroundColor: COLORS.white,
  borderWidth: 1,
  borderColor: COLORS.border,
},

datePickerHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
},

datePickerTitle: {
  color: COLORS.text,
  fontSize: 17,
  fontWeight: "900",
},

datePickerNavButton: {
  width: 38,
  height: 38,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  backgroundColor: COLORS.paleRed,
},

datePickerWeekRow: {
  flexDirection: "row",
  marginBottom: 8,
},

datePickerWeekday: {
  flex: 1,
  color: COLORS.secondaryText,
  fontSize: 11,
  fontWeight: "800",
  textAlign: "center",
},

datePickerGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
},

datePickerDaySpacer: {
  width: "14.28%",
  aspectRatio: 1,
},

datePickerDay: {
  width: "14.28%",
  aspectRatio: 1,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
},

datePickerDayPressed: {
  backgroundColor: COLORS.paleRed,
},

datePickerDayText: {
  color: COLORS.text,
  fontSize: 13,
  fontWeight: "800",
},

datePickerCancel: {
  minHeight: 42,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 14,
  borderRadius: 8,
  backgroundColor: COLORS.fieldBackground,
},

datePickerCancelText: {
  color: COLORS.maroon,
  fontSize: 13,
  fontWeight: "900",
},

  calendarButton: {
  width: 44,
  height: 44,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  borderWidth: 1,
  borderColor: COLORS.border,
  backgroundColor: COLORS.white,
},

calendarButtonPressed: {
  opacity: 0.75,
},
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  eyebrow: {
    color: "#FFD9D9",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
  },
  title: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  subtitle: {
    color: "#F4CACA",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  listContent: {
    padding: 14,
    paddingBottom: 36,
    gap: 12,
  },
  filterCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 8,
  },
  filterLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },
  filterInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.fieldBackground,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  clearFilterButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  clearFilterText: {
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: "900",
  },
  filterHint: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    shadowColor: "#1B2438",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  listItemPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  listItemBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  listItemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  listMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listMetaText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  listMetaDot: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(8, 12, 24, 0.48)",
    justifyContent: "flex-end",
    padding: 12,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#1B2438",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    overflow: "hidden",
  },
  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  modalTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  modalEyebrow: {
    color: COLORS.maroon,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.fieldBackground,
  },
  modalContent: {
    padding: 14,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.paleRed,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
  timestamp: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  resultPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultText: {
    fontSize: 11,
    fontWeight: "900",
  },
  detailGroup: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  detailLabel: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  detailValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  statusBlock: {
    backgroundColor: COLORS.fieldBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 10,
  },
  statusLabel: {
    color: COLORS.maroon,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
  statusGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statusCell: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    gap: 5,
  },
  statusCellValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },
  reasonBox: {
    backgroundColor: COLORS.paleRed,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F4B7BA",
    padding: 10,
    gap: 5,
  },
  reasonText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  centerText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.paleRed,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F4B7BA",
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: COLORS.red,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    gap: 8,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 6,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
