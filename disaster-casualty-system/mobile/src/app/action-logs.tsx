import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCasualtyVerificationActionLogs,
  type CasualtyVerificationActionLogItem,
} from "../api/casualties";

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

  return parts.length > 0 ? parts.join(", ") : "Not assigned";
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

function getCasualtyLoggedAt(
  log: CasualtyVerificationActionLogItem,
): string {
  return (
    log.casualty_record?.reported_at ||
    log.casualty_record?.created_at ||
    log.created_at
  );
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

function ActionLogCard({
  item,
}: {
  item: CasualtyVerificationActionLogItem;
}) {
  const resultStyle = getResultColor(item.result);
  const isRejected = item.new_status === "rejected";
  const reviewer = item.reviewed_by_user;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBadge}>
          <Ionicons
            name="clipboard-outline"
            size={20}
            color={COLORS.maroon}
          />
        </View>

        <View style={styles.cardHeaderText}>
          <Text style={styles.actionTitle}>{getActionLabel(item)}</Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(item.created_at)}
          </Text>
        </View>

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

      <View style={styles.detailGroup}>
        <DetailRow
          label="Full Name"
          value={reviewer?.full_name || "Logged in admin"}
        />
        <DetailRow label="Email" value={reviewer?.email || "No email"} />
        <DetailRow label="Role" value={formatRole(reviewer?.role)} />
        <DetailRow
          label="Unit Assignment"
          value={getUnitAssignment(item)}
        />
      </View>

      <View style={styles.statusBlock}>
        <Text style={styles.statusLabel}>Action Performed</Text>
        <Text style={styles.statusValue}>{getActionLabel(item)}</Text>

        <View style={styles.statusGrid}>
          <View style={styles.statusCell}>
            <Text style={styles.detailLabel}>Previous Status</Text>
            <Text style={styles.statusCellValue}>Under Review</Text>
          </View>

          <View style={styles.statusCell}>
            <Text style={styles.detailLabel}>New Status</Text>
            <Text style={styles.statusCellValue}>
              {formatStatus(item.new_status)}
            </Text>
          </View>
        </View>

        {isRejected ? (
          <View style={styles.reasonBox}>
            <Text style={styles.detailLabel}>Rejection Reason</Text>
            <Text style={styles.reasonText}>
              {item.review_notes?.trim() || "No reason recorded"}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.detailGroup}>
        <DetailRow
          label="Action Date/Time"
          value={formatTimestamp(item.created_at)}
        />
        <DetailRow
          label="Logged Casualty Date/Time"
          value={formatTimestamp(getCasualtyLoggedAt(item))}
        />
        <DetailRow label="Location" value={getLocation(item)} />
      </View>
    </View>
  );
}

export default function ActionLogsScreen() {
  const [logs, setLogs] = useState<CasualtyVerificationActionLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setErrorMessage(null);
      const data = await getCasualtyVerificationActionLogs();
      setLogs(data);
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
          new Date(second.created_at).getTime() -
          new Date(first.created_at).getTime(),
      ),
    [logs],
  );

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
          <Text style={styles.eyebrow}>ADMIN</Text>
          <Text style={styles.title}>Action Logs</Text>
          <Text style={styles.subtitle}>
            Verification decisions made by the logged in admin
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.maroon} />
          <Text style={styles.centerText}>Loading action logs...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedLogs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ActionLogCard item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.maroon}
            />
          }
          ListHeaderComponent={
            errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={COLORS.red}
                />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null
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
                Approved, rejected, and under-review casualty decisions will
                appear here after the admin reviews entries.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    shadowColor: "#1B2438",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
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
