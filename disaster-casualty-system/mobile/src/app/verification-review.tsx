import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCasualties,
  updateCasualtyVerification,
  type CasualtyRecord,
  type UpdateCasualtyVerificationPayload,
} from "../api/casualties";
import { isAuthenticationTokenError } from "../api/client";
import { getCurrentUser } from "../auth/session";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  card: "#FFFFFF",
  text: "#17213A",
  secondaryText: "#7C88A0",
  border: "#E4E8EF",
  fieldBackground: "#F7F9FC",
  fieldBorder: "#D9E0EA",
  paleOrange: "#FFF0DF",
  orange: "#D96D12",
  paleBlue: "#DFF2FC",
  blue: "#0B6B9B",
  paleGreen: "#E8F4EA",
  green: "#2E7D4F",
  paleRed: "#FCE6E7",
  red: "#C92D32",
  paleGray: "#EEF1F5",
  gray: "#68758A",
};

const SCREEN_PADDING = 16;

const filters = [
  "Needs Review",
  "Submitted",
  "Under Review",
  "Rejected",
  "Verified",
  "All",
] as const;

type FilterOption = (typeof filters)[number];
type VerificationAction =
  UpdateCasualtyVerificationPayload["status"];

function canReviewRecords(role: string | null): boolean {
  return (
    role === "super_admin" ||
    role === "admin" ||
    role === "administrator"
  );
}

function formatStatus(status: string | null | undefined): string {
  if (!status) {
    return "Unknown";
  }

  if (status === "verified") {
    return "Accepted";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function getUnitName(record: CasualtyRecord): string {
  const municipality = record.encoder.assigned_municipality?.trim();
  const barangay = record.encoder.assigned_barangay?.trim();
  const parts = [municipality, barangay].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(", ") : "Unassigned unit";
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getCasualtySortLabel(record: CasualtyRecord): string {
  const fullName = getFullName(record);

  return fullName === "Unidentified Casualty"
    ? record.casualty.id_number ?? fullName
    : fullName;
}

function compareVerificationRecords(
  first: CasualtyRecord,
  second: CasualtyRecord,
): number {
  return (
    compareText(getUnitName(first), getUnitName(second)) ||
    compareText(
      first.incident.incident_name ?? "Unknown incident",
      second.incident.incident_name ?? "Unknown incident",
    ) ||
    compareText(
      getCasualtySortLabel(first),
      getCasualtySortLabel(second),
    )
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getVerificationPalette(status: string | null | undefined) {
  switch (status) {
    case "verified":
      return {
        color: COLORS.green,
        backgroundColor: COLORS.paleGreen,
      };
    case "rejected":
      return {
        color: COLORS.red,
        backgroundColor: COLORS.paleRed,
      };
    case "under_review":
      return {
        color: COLORS.blue,
        backgroundColor: COLORS.paleBlue,
      };
    case "submitted":
      return {
        color: COLORS.orange,
        backgroundColor: COLORS.paleOrange,
      };
    default:
      return {
        color: COLORS.gray,
        backgroundColor: COLORS.paleGray,
      };
  }
}

function matchesFilter(record: CasualtyRecord, filter: FilterOption) {
  const status = record.verification_status;

  switch (filter) {
    case "Needs Review":
      return (
        status === "submitted" ||
        status === "under_review" ||
        status === "rejected"
      );
    case "Submitted":
      return status === "submitted";
    case "Under Review":
      return status === "under_review";
    case "Rejected":
      return status === "rejected";
    case "Verified":
      return status === "verified";
    case "All":
      return true;
  }
}

export default function VerificationReviewScreen() {
  const params = useLocalSearchParams<{
    incidentId?: string;
    incidentName?: string;
  }>();
  const [records, setRecords] = useState<CasualtyRecord[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FilterOption>("Needs Review");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] =
    useState<CasualtyRecord | null>(null);
  const [reviewAction, setReviewAction] =
    useState<VerificationAction | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);

  const canReview = canReviewRecords(currentUserRole);
  const incidentFilterName =
    typeof params.incidentName === "string"
      ? params.incidentName
      : null;
  const visibleFilters = canReview
    ? filters
    : filters.filter((filter) => filter !== "Needs Review");

  useEffect(() => {
    if (!canReview && activeFilter === "Needs Review") {
      setActiveFilter("All");
    }
  }, [activeFilter, canReview]);

  const loadRecords = useCallback(async () => {
    try {
      setErrorMessage(null);

      const [user, data] = await Promise.all([
        getCurrentUser(),
        getCasualties(),
      ]);

      setCurrentUserRole(user?.role ?? null);
      setRecords(data);
    } catch (error) {
      console.error("Failed to load verification review records:", error);

      setErrorMessage(
        isAuthenticationTokenError(error)
          ? "Log in to view records for verification review."
          : error instanceof Error
            ? error.message
            : "Unable to load verification review records.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadRecords();
    }, [loadRecords]),
  );

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const selectedIncidentId =
      typeof params.incidentId === "string"
        ? params.incidentId
        : null;

    return records
      .filter((record) => {
        if (
          selectedIncidentId &&
          record.incident.id !== selectedIncidentId
        ) {
          return false;
        }

        if (!matchesFilter(record, activeFilter)) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchable = [
          getFullName(record),
          getUnitName(record),
          record.casualty.id_number,
          record.incident.incident_name,
          record.current_location,
          record.encoder.full_name,
          formatStatus(record.verification_status),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .sort(compareVerificationRecords);
  }, [activeFilter, params.incidentId, records, searchQuery]);

  async function handleRefresh() {
    try {
      setIsRefreshing(true);
      await loadRecords();
    } finally {
      setIsRefreshing(false);
    }
  }

  function openReviewModal(
    record: CasualtyRecord,
    action: VerificationAction,
  ) {
    setSelectedRecord(record);
    setReviewAction(action);
    setReviewNotes("");
  }

  function closeReviewModal() {
    if (isSavingReview) {
      return;
    }

    setSelectedRecord(null);
    setReviewAction(null);
    setReviewNotes("");
  }

  async function handleSaveReview() {
    if (!selectedRecord || !reviewAction) {
      return;
    }

    if (reviewAction === "rejected" && !reviewNotes.trim()) {
      Alert.alert(
        "Review note required",
        "Enter a reason before rejecting this casualty record.",
      );
      return;
    }

    try {
      setIsSavingReview(true);

      const updated = await updateCasualtyVerification(
        selectedRecord.id,
        {
          status: reviewAction,
          notes: reviewNotes.trim() || undefined,
        },
      );

      setRecords((current) =>
        current.map((record) =>
          record.id === updated.id ? updated : record,
        ),
      );
      closeReviewModal();

      Alert.alert(
        "Review saved",
        "The casualty verification status has been updated.",
      );
    } catch (error) {
      console.error("Unable to save verification review:", error);

      Alert.alert(
        "Unable to save review",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSavingReview(false);
    }
  }

  function renderRecord({ item }: { item: CasualtyRecord }) {
    const palette = getVerificationPalette(item.verification_status);
    const fullName = getFullName(item);

    return (
      <View style={styles.reviewCard}>
        <View style={styles.recordTopRow}>
          <View style={styles.recordMain}>
            <Text style={styles.recordName} numberOfLines={1}>
              {fullName}
            </Text>
            <Text style={styles.recordMeta} numberOfLines={1}>
              {item.casualty.id_number ?? "No ID"} -{" "}
              {item.incident.incident_name}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: palette.backgroundColor,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: palette.color,
                },
              ]}
            >
              {formatStatus(item.verification_status)}
            </Text>
          </View>
        </View>

        <Text style={styles.unitText} numberOfLines={1}>
          Unit: {getUnitName(item)}
        </Text>

        <Text style={styles.detailText}>
          Encoded by {item.encoder.full_name}
          {"\n"}Reported {formatDateTime(item.reported_at)}
        </Text>

      {!canReview ? (
        <View style={styles.statusOnlyNotice}>
          <Ionicons
            name="information-circle-outline"
            size={15}
            color={palette.color}
          />
          <Text style={[styles.statusOnlyText, { color: palette.color }]}>
            Admin review status: {formatStatus(item.verification_status)}
          </Text>
        </View>
      ) : null}

        <Pressable
          onPress={() =>
            router.push(`/casualty/${encodeURIComponent(item.id)}` as never)
          }
          style={({ pressed }) => [
            styles.viewButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={COLORS.maroon}
          />
          <Text style={styles.viewButtonText}>View Record</Text>
        </Pressable>

        {canReview ? (
          <View style={styles.reviewActions}>
            <Pressable
              onPress={() => openReviewModal(item, "under_review")}
              style={({ pressed }) => [
                styles.reviewActionButton,
                styles.reviewActionNeutral,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="eye-outline"
                size={16}
                color={COLORS.blue}
              />
              <Text style={[styles.reviewActionText, { color: COLORS.blue }]}>
                Review
              </Text>
            </Pressable>

            <Pressable
              onPress={() => openReviewModal(item, "verified")}
              style={({ pressed }) => [
                styles.reviewActionButton,
                styles.reviewActionApprove,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={COLORS.green}
              />
              <Text style={[styles.reviewActionText, { color: COLORS.green }]}>
                Approve
              </Text>
            </Pressable>

            <Pressable
              onPress={() => openReviewModal(item, "rejected")}
              style={({ pressed }) => [
                styles.reviewActionButton,
                styles.reviewActionReject,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="close-circle-outline"
                size={16}
                color={COLORS.red}
              />
              <Text style={[styles.reviewActionText, { color: COLORS.red }]}>
                Reject
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={COLORS.maroon} />
        <Text style={styles.centerStateText}>
          Loading verification review queue...
        </Text>
      </View>
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
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons
                name="chevron-back"
                size={23}
                color={COLORS.white}
              />
            </Pressable>
            <Text style={styles.headerTitle}>
              Verification Review
            </Text>
          </View>

          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={19}
              color="rgba(255,255,255,0.72)"
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholder="Search record, unit, incident, or encoder..."
              placeholderTextColor="rgba(255,255,255,0.65)"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </SafeAreaView>

      {incidentFilterName ? (
        <View style={styles.incidentFilterBanner}>
          <Ionicons
            name="warning-outline"
            size={18}
            color={COLORS.maroon}
          />
          <View style={styles.incidentFilterTextGroup}>
            <Text style={styles.incidentFilterLabel}>
              Managing reports for
            </Text>
            <Text style={styles.incidentFilterName} numberOfLines={1}>
              {incidentFilterName}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.filterSection}>
        <FlatList
          horizontal
          data={visibleFilters}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = activeFilter === item;

            return (
              <Pressable
                onPress={() => setActiveFilter(item)}
                style={({ pressed }) => [
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={COLORS.red}
          />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        renderItem={renderRecord}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="shield-checkmark-outline"
              size={48}
              color={COLORS.secondaryText}
            />
            <Text style={styles.emptyTitle}>
              No records in this review list
            </Text>
            <Text style={styles.emptyText}>
              Change the filter or pull down to refresh.
            </Text>
          </View>
        }
      />

      <Modal
        visible={selectedRecord !== null && reviewAction !== null}
        transparent
        animationType="fade"
        onRequestClose={closeReviewModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={closeReviewModal}
        >
          <Pressable style={styles.reviewModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>
                  {reviewAction === "verified"
                    ? "Approve Record"
                    : reviewAction === "rejected"
                      ? "Reject Record"
                      : "Mark Under Review"}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedRecord ? getFullName(selectedRecord) : ""}
                </Text>
              </View>
              <Pressable
                onPress={closeReviewModal}
                style={styles.modalClose}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            <Text style={styles.reviewNoteLabel}>REVIEW NOTES</Text>
            <TextInput
              value={reviewNotes}
              onChangeText={setReviewNotes}
              style={styles.reviewNoteInput}
              placeholder={
                reviewAction === "rejected"
                  ? "Required reason for rejection"
                  : "Optional reviewer note"
              }
              placeholderTextColor={COLORS.secondaryText}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeReviewModal}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isSavingReview}
                onPress={() => {
                  void handleSaveReview();
                }}
                style={({ pressed }) => [
                  styles.saveButton,
                  isSavingReview && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveButtonText}>
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
  centerStateText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  headerSafeArea: {
    backgroundColor: COLORS.maroon,
  },
  header: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
    paddingBottom: 18,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: "900",
  },
  searchBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: COLORS.white,
    fontSize: 14,
    paddingLeft: 9,
  },
  incidentFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SCREEN_PADDING,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E7D4D5",
    backgroundColor: COLORS.white,
    gap: 10,
  },
  incidentFilterTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  incidentFilterLabel: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  incidentFilterName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  filterSection: {
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  filterList: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 9,
  },
  filterChip: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    backgroundColor: COLORS.maroon,
  },
  filterChipText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F4C3C5",
    backgroundColor: "#FFF1F1",
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: COLORS.red,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 28,
    gap: 12,
  },
  reviewCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    elevation: 2,
    shadowColor: "#758197",
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },
  recordTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recordMain: {
    flex: 1,
    minWidth: 0,
  },
  recordName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
  recordMeta: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 5,
  },
  unitText: {
    color: COLORS.maroon,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 12,
  },
  statusBadge: {
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "900",
  },
  detailText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  statusOnlyNotice: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 11,
    paddingHorizontal: 10,
    marginTop: 10,
    backgroundColor: COLORS.fieldBackground,
    gap: 6,
  },
  statusOnlyText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
  },
  viewButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E7D4D5",
    marginTop: 12,
    backgroundColor: "#FFF8F8",
    gap: 7,
  },
  viewButtonText: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "800",
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  reviewActionButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  reviewActionNeutral: {
    borderColor: "#B9DCF4",
    backgroundColor: COLORS.paleBlue,
  },
  reviewActionApprove: {
    borderColor: "#B8E5C3",
    backgroundColor: COLORS.paleGreen,
  },
  reviewActionReject: {
    borderColor: "#F4C3C5",
    backgroundColor: COLORS.paleRed,
  },
  reviewActionText: {
    fontSize: 11,
    fontWeight: "900",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 80,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 14,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 7,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23,33,58,0.38)",
  },
  reviewModal: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitleGroup: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  modalSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.fieldBackground,
  },
  reviewNoteLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  reviewNoteInput: {
    minHeight: 104,
    paddingHorizontal: 14,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    backgroundColor: COLORS.fieldBackground,
    color: COLORS.text,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.white,
  },
  cancelButtonText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontWeight: "800",
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: COLORS.maroon,
    gap: 7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.72,
  },
});
