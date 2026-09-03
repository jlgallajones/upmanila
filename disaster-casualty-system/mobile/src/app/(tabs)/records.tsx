import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  closeIncident,
  downloadIncidentExport,
  generateIncidentSitrep,
  getIncidents,
  type Incident,
} from "../../api/incidents";
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

const healthcareDocumenterTriageFilters = [
  "All",
  "ESI 1",
  "ESI 2",
  "ESI 3",
  "ESI 4",
  "ESI 5",
] as const;

const healthcareDocumenterLocationFilters = [
  "All",
  "Emergency Department",
  "Ward",
  "ICU",
  "Discharged",
] as const;

const incidentFilters = [
  "All Incidents",
  "Active Incidents",
  "Closed Incidents",
] as const;

const SCREEN_PADDING = 16;

type FilterOption = (typeof filters)[number];
type IncidentFilterOption = (typeof incidentFilters)[number];
type FieldResponderReviewFilter =
  (typeof saResponderReviewFilters)[number];
type FieldResponderTriageFilter =
  (typeof fieldResponderTriageFilters)[number];

type HealthcareDocumenterTriageFilter =
  (typeof healthcareDocumenterTriageFilters)[number];
type HealthcareDocumenterLocationFilter =
  (typeof healthcareDocumenterLocationFilters)[number];

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

function getIncidentLocation(incident: Incident): string {
  const parts = [
    incident.barangay,
    incident.municipality,
    incident.province,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : "Location not set";
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

function isHealthcareDocumenterView(
  role: string | null,
): boolean {
  return (
    role === "documenter" ||
    role === "medical_personnel"
  );
}

function getRecordEsiTriageFilter(
  record: CasualtyRecord,
): HealthcareDocumenterTriageFilter | null {
  const assessment =
    record.latest_triage_assessment;

  if (!assessment) {
    return null;
  }

  if (
    String(assessment.triage_system || "")
      .trim()
      .toLowerCase() !== "esi"
  ) {
    return null;
  }

  const finalTriage =
    assessment.assessment_answers?.finalTriage;

  if (typeof finalTriage !== "string") {
    return null;
  }

  switch (finalTriage.trim().toLowerCase()) {
    case "esi_1":
      return "ESI 1";

    case "esi_2":
      return "ESI 2";

    case "esi_3":
      return "ESI 3";

    case "esi_4":
      return "ESI 4";

    case "esi_5":
      return "ESI 5";

    default:
      return null;
  }
}

function getRecordHealthcareLocation(
  record: CasualtyRecord,
  ): HealthcareDocumenterLocationFilter | null {
    const encounter =
      record.latest_facility_encounter;

    if (!encounter) {
      return null;
    }

  const discharged =
    encounter.discharged_home === true ||
    Boolean(encounter.hospital_discharged_at) ||
    encounter.disposition === "discharged_home";

  if (discharged) {
    return "Discharged";
  }

  const currentlyInIcu =
    Boolean(encounter.icu_admitted_at) &&
    !encounter.icu_discharged_at;

  if (currentlyInIcu) {
    return "ICU";
  }

  const admittedToHospital =
    encounter.admitted_to_hospital === true ||
    Boolean(encounter.hospital_admitted_at);

  if (admittedToHospital) {
    return "Ward";
  }

  const currentlyInEd =
    Boolean(encounter.ed_admitted_at) &&
    !encounter.ed_departed_at;

  if (currentlyInEd) {
    return "Emergency Department";
  }

  return null;
}

function isAdminRecordsRole(role: string | null): boolean {
  return (
    role === "super_admin" ||
    role === "admin" ||
    role === "administrator"
  );
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

function IncidentRecordCard({
  incident,
  casualtyCount,
  onCloseIncident,
  onIncidentInformation,
  onCasualtySummary,
  onManageReports,
  onExportReport,
  isClosing,
  isExporting,
}: {
  incident: Incident;
  casualtyCount: number;
  onCloseIncident: () => void;
  onIncidentInformation: () => void;
  onCasualtySummary: () => void;
  onManageReports: () => void;
  onExportReport: () => void;
  isClosing: boolean;
  isExporting: boolean;
}) {
  const isClosed = Boolean(incident.ended_at) || incident.status === "closed";
  const statusStyle = isClosed
    ? {
        backgroundColor: COLORS.paleGray,
        color: COLORS.gray,
      }
    : {
        backgroundColor: COLORS.paleGreen,
        color: COLORS.green,
      };

  return (
    <View style={styles.incidentRecordCard}>
      <View style={styles.recordTopRow}>
        <View style={styles.incidentAvatar}>
          <Ionicons
            name="warning-outline"
            size={20}
            color={COLORS.maroon}
          />
        </View>

        <View style={styles.recordMain}>
          <Text style={styles.recordName} numberOfLines={2}>
            {incident.incident_name}
          </Text>
          <Text style={styles.recordMeta} numberOfLines={1}>
            {incident.disaster_type} {"\u00B7"} {incident.incident_code}
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
            {isClosed ? "CLOSED" : "ACTIVE"}
          </Text>
        </View>
      </View>

      <View style={styles.incidentInfoGrid}>
        <View style={styles.incidentInfoItem}>
          <Text style={styles.incidentInfoLabel}>Unit / Location</Text>
          <Text style={styles.incidentInfoValue} numberOfLines={2}>
            {getIncidentLocation(incident)}
          </Text>
        </View>

        <View style={styles.incidentInfoItem}>
          <Text style={styles.incidentInfoLabel}>Sync Status</Text>
          <Text style={styles.incidentInfoValue}>Synced</Text>
        </View>

        <View style={styles.incidentInfoItem}>
          <Text style={styles.incidentInfoLabel}>Started</Text>
          <Text style={styles.incidentInfoValue}>
            {formatDateTime(incident.started_at)}
          </Text>
        </View>

        <View style={styles.incidentInfoItem}>
          <Text style={styles.incidentInfoLabel}>Casualties</Text>
          <Text style={styles.incidentInfoValue}>{casualtyCount}</Text>
        </View>
      </View>

      {isClosed ? (
        <View style={styles.closedTimeBanner}>
          <Ionicons
            name="time-outline"
            size={15}
            color={COLORS.red}
          />
          <Text style={styles.closedTimeText}>
            Closed {formatDateTime(incident.ended_at)}
          </Text>
        </View>
      ) : null}

      <View style={styles.incidentActionGrid}>
        {!isClosed ? (
          <Pressable
            disabled={isClosing}
            onPress={onCloseIncident}
            style={({ pressed }) => [
              styles.incidentActionButton,
              styles.incidentDangerAction,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={16}
              color={COLORS.red}
            />
            <Text style={styles.incidentDangerActionText}>
              {isClosing ? "Closing..." : "Close Incident"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onIncidentInformation}
          style={({ pressed }) => [
            styles.incidentActionButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={COLORS.maroon}
          />
          <Text style={styles.incidentActionText}>
            Incident Information
          </Text>
        </Pressable>

        <Pressable
          onPress={onCasualtySummary}
          style={({ pressed }) => [
            styles.incidentActionButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={COLORS.maroon}
          />
          <Text style={styles.incidentActionText}>
            Casualty Summary
          </Text>
        </Pressable>

        <Pressable
          onPress={onManageReports}
          style={({ pressed }) => [
            styles.incidentActionButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="file-tray-full-outline"
            size={16}
            color={COLORS.maroon}
          />
          <Text style={styles.incidentActionText}>
            Manage Reports
          </Text>
        </Pressable>

        <Pressable
          disabled={isExporting}
          onPress={onExportReport}
          style={({ pressed }) => [
            styles.incidentActionButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="download-outline"
            size={16}
            color={COLORS.maroon}
          />
          <Text style={styles.incidentActionText}>
            {isExporting ? "Exporting..." : "Export Report"}
          </Text>
        </Pressable>
      </View>
    </View>
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
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FilterOption>("All");
  const [activeIncidentFilter, setActiveIncidentFilter] =
    useState<IncidentFilterOption>("All Incidents");
  const [
    activeReviewFilters,
    setActiveReviewFilters,
  ] = useState<FieldResponderReviewFilter[]>([]);
  const [
    activeTriageFilters,
    setActiveTriageFilters,
  ] = useState<FieldResponderTriageFilter[]>(["All"]);

  const [
    activeHealthcareTriageFilters,
    setActiveHealthcareTriageFilters,
  ] = useState<HealthcareDocumenterTriageFilter[]>([
    "All",
  ]);

  const [
  activeHealthcareLocationFilters,
  setActiveHealthcareLocationFilters,
] = useState<HealthcareDocumenterLocationFilter[]>([
  "All",
]);

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

  const useHealthcareDocumenterFilters =
  isHealthcareDocumenterView(
    currentUserRole,
  );
  const useResponderFunctionFilters =
    useFieldResponderFilters || useSaResponderFilters;
  const useSpecialRecordFilters =
  useResponderFunctionFilters ||
  useHealthcareDocumenterFilters;
  const reviewFilterOptions = useSaResponderFilters
    ? saResponderReviewFilters
    : fieldResponderReviewFilters;
  const [filtersExpanded, setFiltersExpanded] =
    useState(false);
  const [closingIncidentId, setClosingIncidentId] =
    useState<string | null>(null);
  const [exportingIncidentId, setExportingIncidentId] =
    useState<string | null>(null);

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

      if (isAdminRecordsRole(user?.role ?? null)) {
        const [incidentData, casualtyData] = await Promise.all([
          getIncidents({
            scope: "all",
          }),
          getCasualties(),
        ]);

        setIncidents(incidentData);
        setRecords(casualtyData);
        return;
      }

      const data = await getCasualties();
      setIncidents([]);
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
            setIncidents([]);
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

        const isAdminView = isAdminRecordsRole(user?.role ?? null);
        const [incidentData, casualtyData] = isAdminView
          ? await Promise.all([
              getIncidents({
                scope: "all",
              }),
              getCasualties(),
            ])
          : [[], await getCasualties()];

        if (isMounted) {
          setIncidents(incidentData);
          setRecords(casualtyData);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error("Failed to initialize casualty records:", error);

        if (isMounted) {
          if (isAuthenticationTokenError(error)) {
            setRecords([]);
            setIncidents([]);
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

  function toggleHealthcareTriageFilter(
  filter: HealthcareDocumenterTriageFilter,
) {
  setActiveHealthcareTriageFilters((current) => {
    if (filter === "All") {
      return ["All"];
    }

    const withoutAll =
      current.filter((item) => item !== "All");

    const next = withoutAll.includes(filter)
      ? withoutAll.filter(
          (item) => item !== filter,
        )
      : [...withoutAll, filter];

    return next.length > 0
      ? next
      : ["All"];
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

      let matchesFilter =
  activeFilter === "All" ||
  status === activeFilter;

if (useHealthcareDocumenterFilters) {
const esiFilter =
  getRecordEsiTriageFilter(record);

const healthcareLocation =
  getRecordHealthcareLocation(record);

const matchesReview =
  activeReviewFilters.length === 0 ||
  getRecordReviewFilters(record).some(
    (filter) =>
      activeReviewFilters.includes(filter),
  );

const matchesEsi =
  activeHealthcareTriageFilters.includes(
    "All",
  ) ||
  (
    esiFilter !== null &&
    activeHealthcareTriageFilters.includes(
      esiFilter,
    )
  );

const matchesHealthcareLocation =
  activeHealthcareLocationFilters.includes(
    "All",
  ) ||
  (
    healthcareLocation !== null &&
    activeHealthcareLocationFilters.includes(
      healthcareLocation,
    )
  );

matchesFilter =
  matchesReview &&
  matchesEsi &&
  matchesHealthcareLocation;
  }

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

  const isAdminRecordsView = isAdminRecordsRole(currentUserRole);

  const casualtyCountByIncidentId = useMemo(() => {
    return records.reduce<Record<string, number>>((counts, record) => {
      const incidentId = record.incident?.id;

      if (incidentId) {
        counts[incidentId] = (counts[incidentId] ?? 0) + 1;
      }

      return counts;
    }, {});
  }, [records]);

  const filteredIncidents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return incidents
      .filter((incident) => {
        const isClosed =
          Boolean(incident.ended_at) || incident.status === "closed";
        const matchesFilter =
          activeIncidentFilter === "All Incidents" ||
          (activeIncidentFilter === "Active Incidents" && !isClosed) ||
          (activeIncidentFilter === "Closed Incidents" && isClosed);
        const searchableText = [
          incident.incident_name,
          incident.incident_code,
          incident.disaster_type,
          getIncidentLocation(incident),
          incident.status,
        ]
          .join(" ")
          .toLowerCase();

        return (
          matchesFilter &&
          (normalizedSearch.length === 0 ||
            searchableText.includes(normalizedSearch))
        );
      })
      .sort(
        (first, second) =>
          new Date(second.started_at).getTime() -
          new Date(first.started_at).getTime(),
      );
  }, [activeIncidentFilter, incidents, searchQuery]);

function toggleHealthcareLocationFilter(
  filter: HealthcareDocumenterLocationFilter,
) {
  setActiveHealthcareLocationFilters(
    (current) => {
      if (filter === "All") {
        return ["All"];
      }

      const withoutAll =
        current.filter(
          (item) => item !== "All",
        );

      const next = withoutAll.includes(filter)
        ? withoutAll.filter(
            (item) => item !== filter,
          )
        : [...withoutAll, filter];

      return next.length > 0
        ? next
        : ["All"];
    },
  );
}

  function handleIncidentInformation(incident: Incident) {
    router.push({
      pathname: "/incidents",
      params: {
        incidentId: incident.id,
        incidentName: incident.incident_name,
      },
    } as never);
  }

  function handleCasualtySummary(incident: Incident) {
    router.push({
      pathname: "/verification-review",
      params: {
        incidentId: incident.id,
        incidentName: incident.incident_name,
      },
    } as never);
  }

  function handleManageReports(incident: Incident) {
    router.push({
      pathname: "/verification-review",
      params: {
        incidentId: incident.id,
        incidentName: incident.incident_name,
      },
    } as never);
  }

  function handleCloseIncidentRecord(incident: Incident) {
    Alert.alert(
      "Close incident",
      `Close ${incident.incident_name}? The closed time will be recorded by the server.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Close",
          style: "destructive",
          onPress: async () => {
            try {
              setClosingIncidentId(incident.id);
              const closed = await closeIncident(incident.id);
              setIncidents((current) =>
                current.map((item) =>
                  item.id === closed.id ? closed : item,
                ),
              );
            } catch (error) {
              Alert.alert(
                "Unable to close incident",
                error instanceof Error
                  ? error.message
                  : "Please try again.",
              );
            } finally {
              setClosingIncidentId(null);
            }
          },
        },
      ],
    );
  }

  async function handleExportIncidentReport(incident: Incident) {
    try {
      setExportingIncidentId(incident.id);
      await generateIncidentSitrep(incident.id);
      const file = await downloadIncidentExport(
        incident.id,
        "sitrep-pdf",
      );
      Alert.alert("Export ready", `Incident report saved: ${file}`);
    } catch (error) {
      Alert.alert(
        "Unable to export report",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setExportingIncidentId(null);
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
          Loading casualty records...
        </Text>
      </View>
    );
  }

  if (isAdminRecordsView) {
    const activeIncidentCount = incidents.filter(
      (incident) =>
        !incident.ended_at && incident.status !== "closed",
    ).length;
    const closedIncidentCount = incidents.filter(
      (incident) =>
        Boolean(incident.ended_at) || incident.status === "closed",
    ).length;

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
              Incident Records
            </Text>

            <Text style={styles.headerSubtitle}>
              {incidents.length} total {"\u00B7"} {activeIncidentCount} active {"\u00B7"}{" "}
              {closedIncidentCount} closed
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
                placeholder="Search incident, unit, or hazard..."
                placeholderTextColor="rgba(255,255,255,0.65)"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.filterSection}>
          <FlatList
            horizontal
            data={incidentFilters}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => {
              const isActive = activeIncidentFilter === item;

              return (
                <Pressable
                  onPress={() => setActiveIncidentFilter(item)}
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
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>
                Unable to load incident records
              </Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
            <Pressable
              onPress={() => {
                void handleRefresh();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          data={filteredIncidents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <IncidentRecordCard
              incident={item}
              casualtyCount={
                casualtyCountByIncidentId[item.id] ?? 0
              }
              onCloseIncident={() => handleCloseIncidentRecord(item)}
              onIncidentInformation={() =>
                handleIncidentInformation(item)
              }
              onCasualtySummary={() => handleCasualtySummary(item)}
              onManageReports={() => handleManageReports(item)}
              onExportReport={() => {
                void handleExportIncidentReport(item);
              }}
              isClosing={closingIncidentId === item.id}
              isExporting={exportingIncidentId === item.id}
            />
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
                name="file-tray-outline"
                size={48}
                color={COLORS.secondaryText}
              />
              <Text style={styles.emptyTitle}>
                No incident records found
              </Text>
              <Text style={styles.emptyDescription}>
                Pull down to refresh or change the selected incident filter.
              </Text>
            </View>
          }
        />
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
        {useSpecialRecordFilters ? (
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
                  {useHealthcareDocumenterFilters
                    ? "Healthcare Facility Documenter"
                    : useSaResponderFilters
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
                  <Text style={styles.filterGroupTitle}>
                    Record Status
                  </Text>
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
                  <Text style={styles.filterGroupTitle}>
                    Triage
                  </Text>

                  {useHealthcareDocumenterFilters
                    ? healthcareDocumenterTriageFilters.map(
                        (item) => (
                          <FilterCheckbox
                            key={item}
                            label={item}
                            selected={activeHealthcareTriageFilters.includes(
                              item,
                            )}
                            onPress={() =>
                              toggleHealthcareTriageFilter(item)
                            }
                          />
                        ),
                      )
                    : fieldResponderTriageFilters.map(
                        (item) => (
                          <FilterCheckbox
                            key={item}
                            label={item}
                            selected={activeTriageFilters.includes(
                              item,
                            )}
                            onPress={() =>
                              toggleTriageFilter(item)
                            }
                          />
                        ),
                      )}
                </View>
                  {useHealthcareDocumenterFilters ? (
  <View
    style={[
      styles.filterGroup,
      styles.hcfdLocationFilterGroup,
    ]}
  >
    <Text style={styles.filterGroupTitle}>
      Patient Location
    </Text>

    {healthcareDocumenterLocationFilters.map(
      (item) => (
        <FilterCheckbox
          key={item}
          label={item}
          selected={activeHealthcareLocationFilters.includes(
            item,
          )}
          onPress={() =>
            toggleHealthcareLocationFilter(item)
          }
        />
      ),
    )}
  </View>
) : null}
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
    flexWrap: "wrap",
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

  hcfdLocationFilterGroup: {
  flexBasis: "100%",
  flexGrow: 0,
  flexShrink: 0,
  width: "100%",
  marginTop: 4,
},

  filterGroupTitle: {
  color: COLORS.secondaryText,
  fontSize: 10,
  fontWeight: "900",
  textTransform: "uppercase",
  marginBottom: 3,
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

  incidentRecordCard: {
    padding: 15,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
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

  incidentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    backgroundColor: COLORS.paleRed,
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

  incidentInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 13,
  },

  incidentInfoItem: {
    width: "48%",
    minHeight: 62,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
    padding: 10,
  },

  incidentInfoLabel: {
    color: COLORS.secondaryText,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  incidentInfoValue: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 5,
  },

  closedTimeBanner: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 11,
    borderRadius: 11,
    paddingHorizontal: 11,
    backgroundColor: COLORS.paleRed,
  },

  closedTimeText: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "800",
  },

  incidentActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 12,
  },

  incidentActionButton: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
  },

  incidentDangerAction: {
    borderColor: "#F4C3C5",
    backgroundColor: COLORS.paleRed,
  },

  incidentActionText: {
    color: COLORS.maroon,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },

  incidentDangerActionText: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
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
