import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
  type CasualtyRecord,
} from "../../api/casualties";
import { isAuthenticationTokenError } from "../../api/client";
import {
  getAccessToken,
  getCurrentUser,
} from "../../auth/session";
import {
  getResponderAssignment,
  type ResponderAssignment,
} from "../../auth/responderAssignment";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  text: "#17213A",
  secondaryText: "#7C88A0",
  border: "#E4E8EF",

  paleRed: "#FCE6E7",
  red: "#C92D32",

  paleOrange: "#FFF0DF",
  orange: "#D96D12",

  paleBlue: "#DFF2FC",
  blue: "#0B6B9B",

  paleGreen: "#E8F4EA",
  green: "#3C6D4A",

  paleGray: "#EEF1F5",
  gray: "#68758A",

  synced: "#28B463",
  pending: "#F0A000",
};

const filters = [
  "All",
  "Missing",
  "Injured",
  "Evacuated",
  "Safe",
] as const;

const fieldResponderReviewFilters = [
  "Draft",
  "Unsynced",
  "Under Review",
  "Returned",
  "Confirmed",
] as const;

const saResponderReviewFilters = [
  ...fieldResponderReviewFilters,
  "Released",
  "Referred",
] as const;

const fieldResponderTriageFilters = [
  "All",
  "Immediate",
  "Delayed",
  "Minor",
  "Expectant",
] as const;

const SCREEN_PADDING = 16;

type FilterOption = (typeof filters)[number];
type FieldResponderReviewFilter =
  (typeof saResponderReviewFilters)[number];
type FieldResponderTriageFilter =
  (typeof fieldResponderTriageFilters)[number];

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
  const parts = name.trim().split(/\s+/);

  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "UC";
}

function getLocation(record: CasualtyRecord): string {
  const parts = [
    record.casualty.barangay,
    record.casualty.municipality,
    record.casualty.province,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return record.current_location?.trim() || "Location unavailable";
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatStatus(status: string): string {
  if (!status) {
    return "Unknown";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "missing":
      return {
        backgroundColor: COLORS.paleRed,
        color: COLORS.red,
      };

    case "injured":
      return {
        backgroundColor: COLORS.paleOrange,
        color: COLORS.orange,
      };

    case "evacuated":
      return {
        backgroundColor: COLORS.paleBlue,
        color: COLORS.blue,
      };

    case "safe":
      return {
        backgroundColor: COLORS.paleGreen,
        color: COLORS.green,
      };

    default:
      return {
        backgroundColor: COLORS.paleGray,
        color: COLORS.gray,
      };
  }
}

function isRecordSynced(record: CasualtyRecord): boolean {
  return record.verification_status !== "draft";
}

function isFieldResponderView(
  role: string | null,
  assignment: ResponderAssignment | null,
): boolean {
  return role === "field_responder" || assignment === "field_responder";
}

function isSaResponderView(
  role: string | null,
  assignment: ResponderAssignment | null,
): boolean {
  return role === "sa_responder" || assignment === "sa_responder";
}

function getRecordReviewFilters(
  record: CasualtyRecord,
  includeTransportDisposition = false,
): FieldResponderReviewFilter[] {
  const filters: FieldResponderReviewFilter[] = [];
  const transportFilter = includeTransportDisposition
    ? getRecordTransportDispositionFilter(record)
    : null;

  if (transportFilter) {
    filters.push(transportFilter);
  }

  switch (record.verification_status) {
    case "draft":
      filters.push("Draft");
      break;
    case "unsynced":
      filters.push("Unsynced");
      break;
    case "submitted":
    case "under_review":
      filters.push("Under Review");
      break;
    case "rejected":
      filters.push("Returned");
      break;
    case "verified":
      filters.push("Confirmed");
      break;
    default:
      break;
  }

  return filters;
}

function getRecordTransportDispositionFilter(
  record: CasualtyRecord,
): FieldResponderReviewFilter | null {
  const transport = record.latest_transport_record;

  if (!transport) {
    return null;
  }

  const notes = transport.notes?.toLowerCase() ?? "";

  if (
    notes.includes("patient for: release") ||
    transport.transport_required === "no"
  ) {
    return "Released";
  }

  if (
    notes.includes("patient for: referral") ||
    notes.includes("patient for: transfer") ||
    transport.transport_required === "yes"
  ) {
    return "Referred";
  }

  return null;
}

function getRecordTriageFilter(
  record: CasualtyRecord,
): FieldResponderTriageFilter | null {
  const category =
    record.latest_triage_assessment?.calculated_category ??
    record.latest_triage_assessment?.triage_category ??
    "";

  switch (category.toLowerCase()) {
    case "immediate":
      return "Immediate";
    case "delayed":
      return "Delayed";
    case "minor":
    case "minimal":
      return "Minor";
    case "expectant":
      return "Expectant";
    default:
      return null;
  }
}

function CasualtyCard({
  item,
}: {
  item: CasualtyRecord;
}) {
  const fullName = getFullName(item);
  const location = getLocation(item);
  const statusLabel = formatStatus(item.current_status);
  const statusStyle = getStatusStyle(item.current_status);
  const synced = isRecordSynced(item);

  return (
    <Pressable
      onPress={() =>
        router.push(`/casualty/${encodeURIComponent(item.id)}` as never)
      }
      style={({ pressed }) => [
        styles.recordCard,
        pressed && styles.recordCardPressed,
      ]}
    >
      <View style={styles.recordTopRow}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: statusStyle.backgroundColor,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              {
                color: statusStyle.color,
              },
            ]}
          >
            {getInitials(fullName)}
          </Text>
        </View>

        <View style={styles.recordMain}>
          <Text style={styles.recordName} numberOfLines={1}>
            {fullName}
          </Text>

          <Text style={styles.recordMeta} numberOfLines={1}>
            {item.casualty.id_number ?? "No ID"}
            {" · "}
            Age {item.casualty.estimated_age ?? "Unknown"}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusStyle.backgroundColor,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: statusStyle.color,
              },
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.recordBottomRow}>
        <View style={styles.locationRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={COLORS.secondaryText}
          />

          <Text
            style={styles.locationText}
            numberOfLines={1}
          >
            {location}
          </Text>
        </View>

        <View style={styles.syncRow}>
          <View
            style={[
              styles.syncDot,
              {
                backgroundColor: synced
                  ? COLORS.synced
                  : COLORS.pending,
              },
            ]}
          />

          <Text style={styles.syncText}>
            {synced ? "Synced" : "Pending"}
          </Text>

          <Text style={styles.timeText}>
            · {formatTime(item.reported_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function FilterCheckbox({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.checkboxRow,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.checkboxBox,
          selected && styles.checkboxBoxSelected,
        ]}
      >
        {selected ? (
          <Ionicons
            name="checkmark"
            size={13}
            color={COLORS.maroon}
          />
        ) : null}
      </View>

      <Text
        style={[
          styles.checkboxLabel,
          selected && styles.checkboxLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function RecordsScreen() {
  const [records, setRecords] = useState<CasualtyRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FilterOption>("All");
  const [
    activeReviewFilters,
    setActiveReviewFilters,
  ] = useState<FieldResponderReviewFilter[]>([]);
  const [
    activeTriageFilters,
    setActiveTriageFilters,
  ] = useState<FieldResponderTriageFilter[]>(["All"]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [formattedDate, setFormattedDate] = useState("");
  const [currentUserRole, setCurrentUserRole] =
    useState<string | null>(null);
  const [
    currentResponderAssignment,
    setCurrentResponderAssignment,
  ] = useState<ResponderAssignment | null>(null);
  const useFieldResponderFilters = isFieldResponderView(
    currentUserRole,
    currentResponderAssignment,
  );
  const useSaResponderFilters = isSaResponderView(
    currentUserRole,
    currentResponderAssignment,
  );
  const useResponderFunctionFilters =
    useFieldResponderFilters || useSaResponderFilters;
  const reviewFilterOptions = useSaResponderFilters
    ? saResponderReviewFilters
    : fieldResponderReviewFilters;
  const [filtersExpanded, setFiltersExpanded] =
    useState(false);

  const loadRecords = useCallback(async () => {
    try {
      setErrorMessage(null);

      const [token, user, responderAssignment] = await Promise.all([
        getAccessToken(),
        getCurrentUser(),
        getResponderAssignment(),
      ]);
      setCurrentUserRole(user?.role ?? null);
      setCurrentResponderAssignment(responderAssignment);

      if (!token) {
        setRecords([]);
        setIsGuestMode(true);
        return;
      }

      setIsGuestMode(false);

      const data = await getCasualties();
      setRecords(data);
    } catch (error) {
      console.error("Failed to load casualty records:", error);

      if (isAuthenticationTokenError(error)) {
        setRecords([]);
        setIsGuestMode(true);
        setErrorMessage(null);
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load casualty records.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
    let isMounted = true;

    async function initialize() {
      try {
        setIsLoading(true);

        const [token, user, responderAssignment] = await Promise.all([
          getAccessToken(),
          getCurrentUser(),
          getResponderAssignment(),
        ]);

        if (!token) {
          if (isMounted) {
            setRecords([]);
            setErrorMessage(null);
            setIsGuestMode(true);
            setCurrentUserRole(null);
            setCurrentResponderAssignment(null);
          }
          return;
        }

        if (isMounted) {
          setIsGuestMode(false);
          setCurrentUserRole(user?.role ?? null);
          setCurrentResponderAssignment(responderAssignment);
        }

        const data = await getCasualties();

        if (isMounted) {
          setRecords(data);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error("Failed to initialize casualty records:", error);

        if (isMounted) {
          if (isAuthenticationTokenError(error)) {
            setRecords([]);
            setErrorMessage(null);
            setIsGuestMode(true);
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load casualty records.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
    }, []),
  );

  useEffect(() => {
    setFormattedDate(
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    );
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadRecords();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRecords]);

  function toggleReviewFilter(filter: FieldResponderReviewFilter) {
    setActiveReviewFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter],
    );
  }

  function toggleTriageFilter(filter: FieldResponderTriageFilter) {
    setActiveTriageFilters((current) => {
      if (filter === "All") {
        return ["All"];
      }

      const withoutAll = current.filter((item) => item !== "All");
      const next = withoutAll.includes(filter)
        ? withoutAll.filter((item) => item !== filter)
        : [...withoutAll, filter];

      return next.length > 0 ? next : ["All"];
    });
  }

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return records.filter((record) => {
      const fullName = getFullName(record).toLowerCase();
      const idNumber =
        record.casualty.id_number?.toLowerCase() ?? "";
      const location = getLocation(record).toLowerCase();
      const status = formatStatus(record.current_status);

      const matchesFilter = useResponderFunctionFilters
        ? (activeReviewFilters.length === 0 ||
            getRecordReviewFilters(
              record,
              useSaResponderFilters,
            ).some((filter) => activeReviewFilters.includes(filter))) &&
          (activeTriageFilters.includes("All") ||
            activeTriageFilters.includes(
              getRecordTriageFilter(record) as FieldResponderTriageFilter,
            ))
        : activeFilter === "All" || status === activeFilter;

      const matchesSearch =
        normalizedSearch.length === 0 ||
        fullName.includes(normalizedSearch) ||
        idNumber.includes(normalizedSearch) ||
        location.includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [
    activeFilter,
    activeReviewFilters,
    activeTriageFilters,
    records,
    searchQuery,
    useResponderFunctionFilters,
    useSaResponderFilters,
  ]);

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
        />

        <Text style={styles.centerStateText}>
          Loading casualty records...
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
          <Text style={styles.headerTitle}>
            Casualty Records
          </Text>

          <Text style={styles.headerSubtitle}>
            {records.length} entries · {formattedDate}
          </Text>

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
              placeholder="Search name or ID..."
              placeholderTextColor="rgba(255,255,255,0.65)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />

            <Pressable
              style={({ pressed }) => [
                styles.filterButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open advanced filters"
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={COLORS.white}
              />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.filterSection}>
        {useResponderFunctionFilters ? (
          <>
            <Pressable
              onPress={() =>
                setFiltersExpanded((current) => !current)
              }
              style={({ pressed }) => [
                styles.filterToggle,
                pressed && styles.pressed,
              ]}
            >
              <View>
                <Text style={styles.filterToggleTitle}>
                  Filters
                </Text>
                <Text style={styles.filterToggleSubtitle}>
                  {useSaResponderFilters
                    ? "Stabilization Area Responder"
                    : "Field Responder"}
                </Text>
              </View>

              <Ionicons
                name={
                  filtersExpanded
                    ? "chevron-up-outline"
                    : "chevron-down-outline"
                }
                size={20}
                color={COLORS.maroon}
              />
            </Pressable>

            {filtersExpanded ? (
              <View style={styles.fieldResponderFilters}>
                <View style={styles.filterGroup}>
                  {reviewFilterOptions.map((item) => (
                    <FilterCheckbox
                      key={item}
                      label={item}
                      selected={activeReviewFilters.includes(item)}
                      onPress={() => toggleReviewFilter(item)}
                    />
                  ))}
                </View>

                <View style={styles.filterGroup}>
                  {fieldResponderTriageFilters.map((item) => (
                    <FilterCheckbox
                      key={item}
                      label={item}
                      selected={activeTriageFilters.includes(item)}
                      onPress={() => toggleTriageFilter(item)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <FlatList
            horizontal
            data={filters}
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
                      isActive &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={COLORS.red}
          />

          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>
              Unable to load records
            </Text>

            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              void handleRefresh();
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CasualtyCard item={item} />
        )}
        style={styles.list}
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
              name={
                isGuestMode
                  ? "lock-closed-outline"
                  : "people-outline"
              }
              size={48}
              color={COLORS.secondaryText}
            />

            <Text style={styles.emptyTitle}>
              {isGuestMode
                ? "Login required to view records"
                : "No casualty records found"}
            </Text>

            <Text style={styles.emptyDescription}>
              {isGuestMode
                ? "You can add casualties offline now. Log in from Profile to view synced database records."
                : "Pull down to refresh or change the search and selected status."}
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() => router.push("/add-casualty")}
        style={({ pressed }) => [
          styles.floatingButton,
          pressed && styles.floatingButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add casualty"
      >
        <Ionicons
          name="add"
          size={31}
          color={COLORS.white}
        />
      </Pressable>
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
    backgroundColor: COLORS.background,
  },

  centerStateText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 12,
  },

  headerSafeArea: {
    backgroundColor: COLORS.maroon,
  },

  header: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 10,
    paddingBottom: 18,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    marginTop: 7,
  },

  searchBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    paddingLeft: 14,
    paddingRight: 9,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  searchInput: {
    flex: 1,
    minHeight: 46,
    color: COLORS.white,
    fontSize: 14,
    paddingHorizontal: 11,
  },

  filterButton: {
    width: 37,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.17)",
  },

  filterSection: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  filterList: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
    gap: 8,
  },

  filterToggle: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 10,
  },

  filterToggleTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },

  filterToggleSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 10,
    marginTop: 3,
    fontWeight: "700",
  },

  fieldResponderFilters: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 2,
    paddingBottom: 12,
    gap: 26,
  },

  filterGroup: {
    flex: 1,
    gap: 7,
  },

  checkboxRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  checkboxBox: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.red,
    backgroundColor: COLORS.white,
    marginRight: 7,
  },

  checkboxBoxSelected: {
    borderColor: COLORS.gray,
    backgroundColor: COLORS.white,
  },

  checkboxLabel: {
    color: COLORS.red,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  checkboxLabelSelected: {
    color: COLORS.text,
  },

  filterChip: {
    minHeight: 33,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F5F8",
  },

  filterChipActive: {
    backgroundColor: COLORS.maroon,
  },

  filterChipText: {
    color: "#35415B",
    fontSize: 12,
    fontWeight: "600",
  },

  filterChipTextActive: {
    color: COLORS.white,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: SCREEN_PADDING,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F4C3C5",
    backgroundColor: "#FFF1F1",
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

  errorText: {
    color: COLORS.secondaryText,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  retryButtonText: {
    color: COLORS.maroon,
    fontSize: 11,
    fontWeight: "800",
  },

  list: {
    flex: 1,
  },

  listContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 13,
    paddingBottom: 110,
    gap: 10,
  },

  recordCard: {
    minHeight: 112,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    elevation: 3,
    shadowColor: "#728099",
    shadowOpacity: 0.1,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  recordCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },

  recordTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  avatarText: {
    fontSize: 14,
    fontWeight: "900",
  },

  recordMain: {
    flex: 1,
    minWidth: 0,
  },

  recordName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },

  recordMeta: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 5,
  },

  statusBadge: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginLeft: 8,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 12,
    marginBottom: 10,
  },

  recordBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  locationRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  locationText: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 10,
    marginLeft: 5,
    marginRight: 8,
  },

  syncRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  syncText: {
    color: COLORS.secondaryText,
    fontSize: 9,
  },

  timeText: {
    color: COLORS.secondaryText,
    fontSize: 9,
    marginLeft: 5,
  },

  floatingButton: {
    position: "absolute",
    right: 20,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.maroon,
    elevation: 10,
    shadowColor: COLORS.maroon,
    shadowOpacity: 0.34,
    shadowRadius: 11,
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },

  floatingButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.95 }],
  },

  pressed: {
    opacity: 0.76,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingTop: 70,
    paddingBottom: 70,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 14,
  },

  emptyDescription: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 7,
  },
});
