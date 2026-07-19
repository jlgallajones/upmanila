import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  closeIncident,
  createIncident,
  generateIncidentSitrep,
  getIncidents,
  getIncidentTimeline,
  type Incident,
  type IncidentResponseTimeline,
  type IncidentSitrep,
  updateIncidentTimeline,
  type UpdateIncidentTimelinePayload,
} from "../api/incidents";
import { getCurrentUser } from "../auth/session";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  card: "#FFFFFF",
  text: "#17213A",
  secondaryText: "#69758C",
  mutedText: "#9AA6BA",
  border: "#E5E9F0",
  fieldBackground: "#F7F9FC",
  fieldBorder: "#D9E0EA",
  green: "#2E7D4F",
  orange: "#D96D12",
  red: "#C92D32",
};

const SCREEN_PADDING = 16;

const REFERENCE_MANAGER_ROLES = [
  "super_admin",
  "administrator",
  "encoder",
] as const;

const DISASTER_TYPES = [
  "Typhoon",
  "Flood",
  "Fire",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Other",
] as const;

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
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

function formatDateTimeForInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day}/${year} ${hour}:${minute}`;
}

function parseDateTimeInput(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isoDate = new Date(trimmed);

  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  const match =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(
      trimmed,
    );

  if (!match) {
    return trimmed;
  }

  const [, month, day, year, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  return Number.isNaN(date.getTime()) ? trimmed : date.toISOString();
}

function getValidDateTimeInput(value: string): Date | null {
  const parsed = parseDateTimeInput(value);

  if (!parsed) {
    return null;
  }

  const date = new Date(parsed);

  return Number.isNaN(date.getTime()) ? null : date;
}

function valueOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

function formatCountLabel(value: string): string {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(" ");
}

function formatCountMap(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(
    ([, count]) => count > 0,
  );

  if (entries.length === 0) {
    return "None recorded";
  }

  return entries
    .sort(([first], [second]) => first.localeCompare(second))
    .map(
      ([key, count]) => `${formatCountLabel(key)}: ${count}`,
    )
    .join("\n");
}

type TimelineFormState = {
  eventNotificationAt: string;
  dmmpActivated: "yes" | "no" | "unknown";
  dmmpActivationTrigger: string;
  dmmpActivatedAt: string;
  medicalCoordinatorNotifiedAt: string;
  firstEmsOnSceneAt: string;
  triageOrderedAt: string;
  firstSiteTriageAt: string;
  lastSiteTriageAt: string;
  firstTransportFromSceneAt: string;
  lastTransportFromSceneAt: string;
  sceneDemobilizedAt: string;
};

const initialTimelineForm: TimelineFormState = {
  eventNotificationAt: "",
  dmmpActivated: "unknown",
  dmmpActivationTrigger: "",
  dmmpActivatedAt: "",
  medicalCoordinatorNotifiedAt: "",
  firstEmsOnSceneAt: "",
  triageOrderedAt: "",
  firstSiteTriageAt: "",
  lastSiteTriageAt: "",
  firstTransportFromSceneAt: "",
  lastTransportFromSceneAt: "",
  sceneDemobilizedAt: "",
};

function formatTimelineInput(value: string | null | undefined): string {
  return value ? formatDateTimeForInput(new Date(value)) : "";
}

function mapTimelineToForm(
  timeline: IncidentResponseTimeline | null,
): TimelineFormState {
  if (!timeline) {
    return initialTimelineForm;
  }

  return {
    eventNotificationAt: formatTimelineInput(
      timeline.event_notification_at,
    ),
    dmmpActivated:
      timeline.dmmp_activated === null
        ? "unknown"
        : timeline.dmmp_activated
          ? "yes"
          : "no",
    dmmpActivationTrigger: valueOrEmpty(
      timeline.dmmp_activation_trigger,
    ),
    dmmpActivatedAt: formatTimelineInput(timeline.dmmp_activated_at),
    medicalCoordinatorNotifiedAt: formatTimelineInput(
      timeline.medical_coordinator_notified_at,
    ),
    firstEmsOnSceneAt: formatTimelineInput(
      timeline.first_ems_on_scene_at,
    ),
    triageOrderedAt: formatTimelineInput(timeline.triage_ordered_at),
    firstSiteTriageAt: formatTimelineInput(
      timeline.first_site_triage_at,
    ),
    lastSiteTriageAt: formatTimelineInput(
      timeline.last_site_triage_at,
    ),
    firstTransportFromSceneAt: formatTimelineInput(
      timeline.first_transport_from_scene_at,
    ),
    lastTransportFromSceneAt: formatTimelineInput(
      timeline.last_transport_from_scene_at,
    ),
    sceneDemobilizedAt: formatTimelineInput(
      timeline.scene_demobilized_at,
    ),
  };
}

function buildTimelinePayload(
  form: TimelineFormState,
): UpdateIncidentTimelinePayload {
  return {
    eventNotificationAt: parseDateTimeInput(form.eventNotificationAt),
    dmmpActivated:
      form.dmmpActivated === "unknown"
        ? null
        : form.dmmpActivated === "yes",
    dmmpActivationTrigger: form.dmmpActivationTrigger.trim() || null,
    dmmpActivatedAt: parseDateTimeInput(form.dmmpActivatedAt),
    medicalCoordinatorNotifiedAt: parseDateTimeInput(
      form.medicalCoordinatorNotifiedAt,
    ),
    firstEmsOnSceneAt: parseDateTimeInput(form.firstEmsOnSceneAt),
    triageOrderedAt: parseDateTimeInput(form.triageOrderedAt),
    firstSiteTriageAt: parseDateTimeInput(form.firstSiteTriageAt),
    lastSiteTriageAt: parseDateTimeInput(form.lastSiteTriageAt),
    firstTransportFromSceneAt: parseDateTimeInput(
      form.firstTransportFromSceneAt,
    ),
    lastTransportFromSceneAt: parseDateTimeInput(
      form.lastTransportFromSceneAt,
    ),
    sceneDemobilizedAt: parseDateTimeInput(form.sceneDemobilizedAt),
  };
}

function validateTimelineForm(form: TimelineFormState): string | null {
  const dateFields: Array<[keyof TimelineFormState, string]> = [
    ["eventNotificationAt", "Event notification"],
    ["dmmpActivatedAt", "DMMP activation"],
    [
      "medicalCoordinatorNotifiedAt",
      "Medical coordinator notification",
    ],
    ["firstEmsOnSceneAt", "First EMS on scene"],
    ["triageOrderedAt", "Triage ordered"],
    ["firstSiteTriageAt", "First site triage"],
    ["lastSiteTriageAt", "Last site triage"],
    ["firstTransportFromSceneAt", "First transport from scene"],
    ["lastTransportFromSceneAt", "Last transport from scene"],
    ["sceneDemobilizedAt", "Scene demobilized"],
  ];

  for (const [key, label] of dateFields) {
    const value = String(form[key]).trim();

    if (value && !getValidDateTimeInput(value)) {
      return `${label} must use mm/dd/yyyy hh:mm.`;
    }
  }

  const firstTriage = form.firstSiteTriageAt.trim()
    ? getValidDateTimeInput(form.firstSiteTriageAt)
    : null;
  const lastTriage = form.lastSiteTriageAt.trim()
    ? getValidDateTimeInput(form.lastSiteTriageAt)
    : null;
  const firstTransport = form.firstTransportFromSceneAt.trim()
    ? getValidDateTimeInput(form.firstTransportFromSceneAt)
    : null;
  const lastTransport = form.lastTransportFromSceneAt.trim()
    ? getValidDateTimeInput(form.lastTransportFromSceneAt)
    : null;

  if (firstTriage && lastTriage && lastTriage < firstTriage) {
    return "Last site triage cannot be before first site triage.";
  }

  if (
    firstTransport &&
    lastTransport &&
    lastTransport < firstTransport
  ) {
    return "Last transport cannot be before first transport.";
  }

  return null;
}

function formatLocation(incident: Incident): string {
  const parts = [
    incident.barangay,
    incident.municipality,
    incident.province,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : "Location unavailable";
}

function formatRoleAllowed(role: string | null): boolean {
  return (
    role !== null &&
    REFERENCE_MANAGER_ROLES.includes(
      role as (typeof REFERENCE_MANAGER_ROLES)[number],
    )
  );
}

function IncidentCard({
  incident,
  canClose,
  onClose,
  onEditTimeline,
  onGenerateSitrep,
  isGeneratingSitrep,
}: {
  incident: Incident;
  canClose: boolean;
  onClose: () => void;
  onEditTimeline: () => void;
  onGenerateSitrep: () => void;
  isGeneratingSitrep: boolean;
}) {
  return (
    <View style={styles.incidentCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.incidentIcon}>
          <Ionicons
            name="warning-outline"
            size={20}
            color={COLORS.maroon}
          />
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.incidentName} numberOfLines={2}>
            {incident.incident_name}
          </Text>

          <Text style={styles.incidentMeta} numberOfLines={1}>
            {incident.incident_code} - {incident.disaster_type}
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {incident.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.detailRow}>
        <Ionicons
          name="location-outline"
          size={15}
          color={COLORS.secondaryText}
        />
        <Text style={styles.detailText} numberOfLines={1}>
          {formatLocation(incident)}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons
          name="calendar-outline"
          size={15}
          color={COLORS.secondaryText}
        />
        <Text style={styles.detailText}>
          Started {formatDate(incident.started_at)}
        </Text>
      </View>

      <Pressable
        onPress={onEditTimeline}
        style={({ pressed }) => [
          styles.timelineButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="time-outline"
          size={17}
          color={COLORS.maroon}
        />
        <Text style={styles.timelineButtonText}>
          Response Timeline
        </Text>
      </Pressable>

      <Pressable
        disabled={isGeneratingSitrep}
        onPress={onGenerateSitrep}
        style={({ pressed }) => [
          styles.sitrepButton,
          isGeneratingSitrep && styles.disabledButton,
          pressed && styles.pressed,
        ]}
      >
        {isGeneratingSitrep ? (
          <ActivityIndicator
            size="small"
            color={COLORS.green}
          />
        ) : (
          <Ionicons
            name="document-text-outline"
            size={17}
            color={COLORS.green}
          />
        )}
        <Text style={styles.sitrepButtonText}>
          {isGeneratingSitrep ? "Generating..." : "Generate SitRep"}
        </Text>
      </Pressable>

      {canClose ? (
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeIncidentButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="close-circle-outline"
            size={17}
            color={COLORS.red}
          />
          <Text style={styles.closeIncidentText}>
            Close Incident
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [query, setQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null,
  );
  const [currentUserRole, setCurrentUserRole] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [isCreateModalVisible, setIsCreateModalVisible] =
    useState(false);
  const [newIncidentName, setNewIncidentName] = useState("");
  const [newDisasterType, setNewDisasterType] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [
    isTimelineModalVisible,
    setIsTimelineModalVisible,
  ] = useState(false);
  const [selectedTimelineIncident, setSelectedTimelineIncident] =
    useState<Incident | null>(null);
  const [timelineForm, setTimelineForm] =
    useState<TimelineFormState>(initialTimelineForm);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);
  const [sitrep, setSitrep] = useState<IncidentSitrep | null>(null);
  const [isSitrepModalVisible, setIsSitrepModalVisible] =
    useState(false);
  const [generatingSitrepIncidentId, setGeneratingSitrepIncidentId] =
    useState<string | null>(null);

  const canCreateIncident = formatRoleAllowed(currentUserRole);

  const loadIncidents = useCallback(async () => {
    try {
      setErrorMessage(null);

      const [user, data] = await Promise.all([
        getCurrentUser(),
        getIncidents(),
      ]);

      setCurrentUserId(user?.id ?? null);
      setCurrentUserRole(user?.role ?? null);
      setIncidents(data);
    } catch (error) {
      console.error("Unable to load incidents:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load active incidents.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadIncidents();
    }, [loadIncidents]),
  );

  const filteredIncidents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return incidents;
    }

    return incidents.filter((incident) => {
      const searchable = [
        incident.incident_name,
        incident.incident_code,
        incident.disaster_type,
        incident.barangay,
        incident.municipality,
        incident.province,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [incidents, query]);

  async function handleRefresh() {
    try {
      setIsRefreshing(true);
      await loadIncidents();
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCreateIncident() {
    const incidentName = newIncidentName.trim();
    const disasterType = newDisasterType.trim();
    const location = newLocation.trim();

    if (!currentUserId) {
      Alert.alert(
        "Login required",
        "Please log in again before creating an incident.",
      );
      return;
    }

    if (!canCreateIncident) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to create disaster incidents.",
      );
      return;
    }

    if (!incidentName || !disasterType) {
      Alert.alert(
        "Complete incident details",
        "Enter an incident name and disaster type.",
      );
      return;
    }

    try {
      setIsCreating(true);

      const created = await createIncident({
        incidentName,
        disasterType,
        municipality: location || undefined,
      });

      setIncidents((current) => [created, ...current]);
      setNewIncidentName("");
      setNewDisasterType("");
      setNewLocation("");
      setIsCreateModalVisible(false);

      Alert.alert(
        "Incident created",
        "The new disaster incident is now available for casualty records.",
      );
    } catch (error) {
      console.error("Unable to create incident:", error);

      Alert.alert(
        "Unable to create incident",
        error instanceof Error
          ? error.message
          : "Please review the incident details and try again.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleCloseIncident(incident: Incident) {
    Alert.alert(
      "Close incident",
      `Close ${incident.incident_name}? It will no longer appear as an active incident.`,
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
              await closeIncident(incident.id);

              setIncidents((current) =>
                current.filter((item) => item.id !== incident.id),
              );
            } catch (error) {
              console.error("Unable to close incident:", error);

              Alert.alert(
                "Unable to close incident",
                error instanceof Error
                  ? error.message
                  : "Please try again.",
              );
            }
          },
        },
      ],
    );
  }

  async function handleOpenTimeline(incident: Incident) {
    setSelectedTimelineIncident(incident);
    setTimelineForm(initialTimelineForm);
    setIsTimelineModalVisible(true);
    setIsLoadingTimeline(true);

    try {
      const timeline = await getIncidentTimeline(incident.id);

      setTimelineForm(mapTimelineToForm(timeline));
    } catch (error) {
      console.error("Unable to load incident timeline:", error);

      Alert.alert(
        "Unable to load timeline",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingTimeline(false);
    }
  }

  async function handleGenerateSitrep(incident: Incident) {
    if (!canCreateIncident && currentUserRole !== "medical_personnel") {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to generate incident SitReps.",
      );
      return;
    }

    try {
      setGeneratingSitrepIncidentId(incident.id);

      const generated = await generateIncidentSitrep(incident.id);

      setSitrep(generated);
      setIsSitrepModalVisible(true);
    } catch (error) {
      console.error("Unable to generate SitRep:", error);

      Alert.alert(
        "Unable to generate SitRep",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setGeneratingSitrepIncidentId(null);
    }
  }

  function handleCloseSitrepModal() {
    setIsSitrepModalVisible(false);
    setSitrep(null);
  }

  function handleCloseTimelineModal() {
    if (isSavingTimeline) {
      return;
    }

    setIsTimelineModalVisible(false);
    setSelectedTimelineIncident(null);
    setTimelineForm(initialTimelineForm);
  }

  function updateTimelineField<K extends keyof TimelineFormState>(
    key: K,
    value: TimelineFormState[K],
  ) {
    setTimelineForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setTimelineFieldToNow(key: keyof TimelineFormState) {
    updateTimelineField(key, formatDateTimeForInput(new Date()));
  }

  async function handleSaveTimeline() {
    if (!selectedTimelineIncident) {
      return;
    }

    if (!canCreateIncident) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to update incident timelines.",
      );
      return;
    }

    const validationError = validateTimelineForm(timelineForm);

    if (validationError) {
      Alert.alert("Check timeline", validationError);
      return;
    }

    try {
      setIsSavingTimeline(true);

      const saved = await updateIncidentTimeline(
        selectedTimelineIncident.id,
        buildTimelinePayload(timelineForm),
      );

      setTimelineForm(mapTimelineToForm(saved));
      setIsTimelineModalVisible(false);
      setSelectedTimelineIncident(null);

      Alert.alert(
        "Timeline saved",
        "Incident response timeline has been updated.",
      );
    } catch (error) {
      console.error("Unable to save incident timeline:", error);

      Alert.alert(
        "Unable to save timeline",
        error instanceof Error
          ? error.message
          : "Please review the timeline and try again.",
      );
    } finally {
      setIsSavingTimeline(false);
    }
  }

  function renderTimelineDateField(
    label: string,
    key: keyof TimelineFormState,
  ) {
    return (
      <View style={styles.timelineFieldGroup}>
        <View style={styles.timelineLabelRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {canCreateIncident ? (
            <Pressable
              onPress={() => setTimelineFieldToNow(key)}
              style={({ pressed }) => [
                styles.nowButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={COLORS.maroon}
              />
              <Text style={styles.nowButtonText}>Now</Text>
            </Pressable>
          ) : null}
        </View>
        <TextInput
          value={String(timelineForm[key])}
          onChangeText={(value) => updateTimelineField(key, value)}
          style={styles.input}
          placeholder="mm/dd/yyyy hh:mm"
          placeholderTextColor={COLORS.mutedText}
          editable={canCreateIncident}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
        />
        <Text style={styles.centerStateText}>
          Loading active incidents...
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
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={COLORS.white}
              />
            </Pressable>

            {canCreateIncident ? (
              <Pressable
                onPress={() => setIsCreateModalVisible(true)}
                style={({ pressed }) => [
                  styles.headerActionButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={COLORS.white}
                />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.headerTitle}>
            Incident Management
          </Text>
          <Text style={styles.headerSubtitle}>
            {incidents.length} active incidents
          </Text>

          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={18}
              color="rgba(255,255,255,0.72)"
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              placeholder="Search incident, type, or location"
              placeholderTextColor="rgba(255,255,255,0.65)"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </SafeAreaView>

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
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <IncidentCard
            incident={item}
            canClose={canCreateIncident}
            onClose={() => handleCloseIncident(item)}
            onEditTimeline={() => {
              void handleOpenTimeline(item);
            }}
            onGenerateSitrep={() => {
              void handleGenerateSitrep(item);
            }}
            isGeneratingSitrep={
              generatingSitrepIncidentId === item.id
            }
          />
        )}
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
              name="warning-outline"
              size={48}
              color={COLORS.secondaryText}
            />
            <Text style={styles.emptyTitle}>
              No incidents found
            </Text>
            <Text style={styles.emptyText}>
              Pull down to refresh or create a new active incident.
            </Text>
          </View>
        }
      />

      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsCreateModalVisible(false)}
        >
          <Pressable style={styles.createSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                Create Incident
              </Text>
              <Pressable
                onPress={() => setIsCreateModalVisible(false)}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>INCIDENT NAME</Text>
            <TextInput
              value={newIncidentName}
              onChangeText={setNewIncidentName}
              style={styles.input}
              placeholder="e.g. Flood in San Isidro"
              placeholderTextColor={COLORS.mutedText}
            />

            <Text style={styles.fieldLabel}>DISASTER TYPE</Text>
            <View style={styles.typeGrid}>
              {DISASTER_TYPES.map((type) => {
                const selected = newDisasterType === type;

                return (
                  <Pressable
                    key={type}
                    onPress={() => setNewDisasterType(type)}
                    style={({ pressed }) => [
                      styles.typeChip,
                      selected && styles.typeChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        selected && styles.typeChipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>LOCATION</Text>
            <TextInput
              value={newLocation}
              onChangeText={setNewLocation}
              style={styles.input}
              placeholder="Municipality or city"
              placeholderTextColor={COLORS.mutedText}
            />

            <Pressable
              disabled={isCreating}
              onPress={() => {
                void handleCreateIncident();
              }}
              style={({ pressed }) => [
                styles.createButton,
                isCreating && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.createButtonText}>
                {isCreating ? "Creating..." : "Create Incident"}
              </Text>
              {isCreating ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={19}
                  color={COLORS.white}
                />
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isTimelineModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseTimelineModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseTimelineModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>
                  Response Timeline
                </Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedTimelineIncident?.incident_name ??
                    "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseTimelineModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingTimeline ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading timeline...
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                {renderTimelineDateField(
                  "EVENT NOTIFICATION",
                  "eventNotificationAt",
                )}

                <Text style={styles.fieldLabel}>DMMP ACTIVATED</Text>
                <View style={styles.timelineOptionRow}>
                  {(["unknown", "yes", "no"] as const).map(
                    (option) => {
                      const selected =
                        timelineForm.dmmpActivated === option;

                      return (
                        <Pressable
                          key={option}
                          disabled={!canCreateIncident}
                          onPress={() =>
                            updateTimelineField(
                              "dmmpActivated",
                              option,
                            )
                          }
                          style={({ pressed }) => [
                            styles.timelineOptionChip,
                            selected &&
                              styles.timelineOptionChipActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.timelineOptionText,
                              selected &&
                                styles.timelineOptionTextActive,
                            ]}
                          >
                            {option === "unknown"
                              ? "Unknown"
                              : option === "yes"
                                ? "Yes"
                                : "No"}
                          </Text>
                        </Pressable>
                      );
                    },
                  )}
                </View>

                <Text style={styles.fieldLabel}>
                  ACTIVATION TRIGGER
                </Text>
                <TextInput
                  value={timelineForm.dmmpActivationTrigger}
                  onChangeText={(value) =>
                    updateTimelineField(
                      "dmmpActivationTrigger",
                      value,
                    )
                  }
                  style={styles.input}
                  placeholder="e.g. mass casualty declaration"
                  placeholderTextColor={COLORS.mutedText}
                  editable={canCreateIncident}
                />

                {renderTimelineDateField(
                  "DMMP ACTIVATION",
                  "dmmpActivatedAt",
                )}
                {renderTimelineDateField(
                  "MEDICAL COORDINATOR NOTIFIED",
                  "medicalCoordinatorNotifiedAt",
                )}
                {renderTimelineDateField(
                  "FIRST EMS ON SCENE",
                  "firstEmsOnSceneAt",
                )}
                {renderTimelineDateField(
                  "TRIAGE ORDERED",
                  "triageOrderedAt",
                )}
                {renderTimelineDateField(
                  "FIRST SITE TRIAGE",
                  "firstSiteTriageAt",
                )}
                {renderTimelineDateField(
                  "LAST SITE TRIAGE",
                  "lastSiteTriageAt",
                )}
                {renderTimelineDateField(
                  "FIRST TRANSPORT FROM SCENE",
                  "firstTransportFromSceneAt",
                )}
                {renderTimelineDateField(
                  "LAST TRANSPORT FROM SCENE",
                  "lastTransportFromSceneAt",
                )}
                {renderTimelineDateField(
                  "SCENE DEMOBILIZED",
                  "sceneDemobilizedAt",
                )}

                <View style={styles.timelineActions}>
                  <Pressable
                    onPress={handleCloseTimelineModal}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Cancel
                    </Text>
                  </Pressable>

                  {canCreateIncident ? (
                    <Pressable
                      disabled={isSavingTimeline}
                      onPress={() => {
                        void handleSaveTimeline();
                      }}
                      style={({ pressed }) => [
                        styles.createButton,
                        styles.timelineSaveButton,
                        isSavingTimeline && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.createButtonText}>
                        {isSavingTimeline
                          ? "Saving..."
                          : "Save Timeline"}
                      </Text>
                      {isSavingTimeline ? (
                        <ActivityIndicator
                          size="small"
                          color={COLORS.white}
                        />
                      ) : (
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={19}
                          color={COLORS.white}
                        />
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isSitrepModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSitrepModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseSitrepModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>
                  Generated SitRep
                </Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {sitrep?.report_number ?? "Situation report"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseSitrepModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {sitrep ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                <View style={styles.sitrepSummaryBlock}>
                  <Text style={styles.sitrepReportNumber}>
                    {sitrep.report_number}
                  </Text>
                  <Text style={styles.sitrepSummaryText}>
                    {sitrep.summary}
                  </Text>
                  <Text style={styles.sitrepMetaText}>
                    Generated {formatDateTime(sitrep.generated_at)}
                  </Text>
                </View>

                <View style={styles.sitrepMetricGrid}>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {sitrep.generated_payload.casualtySummary.total}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Casualties
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {
                        sitrep.generated_payload.triageSummary
                          .totalAssessments
                      }
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Triage
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {
                        sitrep.generated_payload.transportSummary
                          .totalRecords
                      }
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Transport
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>CASUALTY STATUS</Text>
                <Text style={styles.sitrepSectionText}>
                  {formatCountMap(
                    sitrep.generated_payload.casualtySummary.byStatus,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>SEVERITY</Text>
                <Text style={styles.sitrepSectionText}>
                  {formatCountMap(
                    sitrep.generated_payload.casualtySummary
                      .bySeverity,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>LATEST TRIAGE</Text>
                <Text style={styles.sitrepSectionText}>
                  {formatCountMap(
                    sitrep.generated_payload.triageSummary
                      .latestByCategory,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>TRANSPORT MODES</Text>
                <Text style={styles.sitrepSectionText}>
                  {formatCountMap(
                    sitrep.generated_payload.transportSummary.modes,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>EMS UNITS</Text>
                <Text style={styles.sitrepSectionText}>
                  {formatCountMap(
                    sitrep.generated_payload.transportSummary
                      .emsUnits,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>
                  RECEIVING FACILITIES
                </Text>
                <Text style={styles.sitrepSectionText}>
                  {formatCountMap(
                    sitrep.generated_payload.facilitySummary
                      .receivingFacilities,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>
                  EVACUATION CENTERS
                </Text>
                <Text style={styles.sitrepSectionText}>
                  {formatCountMap(
                    sitrep.generated_payload.facilitySummary
                      .evacuationCenters,
                  )}
                </Text>

                <Pressable
                  onPress={handleCloseSitrepModal}
                  style={({ pressed }) => [
                    styles.createButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.createButtonText}>Done</Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={19}
                    color={COLORS.white}
                  />
                </Pressable>
              </ScrollView>
            ) : null}
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
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
    paddingBottom: 18,
    backgroundColor: COLORS.maroon,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  headerActionButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    marginTop: 6,
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SCREEN_PADDING,
    marginTop: 12,
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
    paddingTop: 14,
    paddingBottom: 28,
    gap: 11,
  },
  incidentCard: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 14,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    elevation: 2,
    shadowColor: "#728099",
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  incidentIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    backgroundColor: "#FFF2F2",
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  incidentName: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  incidentMeta: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 5,
  },
  statusBadge: {
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginLeft: 8,
    backgroundColor: "#EAF7EF",
  },
  statusText: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: "900",
  },
  cardDivider: {
    height: 1,
    marginTop: 13,
    marginBottom: 11,
    backgroundColor: COLORS.border,
  },
  detailRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 11,
    marginLeft: 7,
  },
  closeIncidentButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#F4C3C5",
    marginTop: 10,
    backgroundColor: "#FFF4F4",
    gap: 7,
  },
  closeIncidentText: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "800",
  },
  timelineButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E7D4D5",
    marginTop: 10,
    backgroundColor: "#FFF8F8",
    gap: 7,
  },
  timelineButtonText: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "800",
  },
  sitrepButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#D6E7DE",
    marginTop: 9,
    backgroundColor: "#F4FBF7",
    gap: 7,
  },
  sitrepButtonText: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "800",
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
  createSheet: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.white,
  },
  timelineSheet: {
    maxHeight: "88%",
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.white,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#D7DDE8",
    marginBottom: 14,
  },
  sheetHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetTitleGroup: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  sheetSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.fieldBackground,
  },
  fieldLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    backgroundColor: COLORS.fieldBackground,
    color: COLORS.text,
    fontSize: 14,
  },
  timelineLoading: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  timelineLoadingText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  timelineScrollContent: {
    paddingBottom: 6,
  },
  timelineFieldGroup: {
    marginTop: 2,
  },
  timelineLabelRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  nowButton: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#FFF2F2",
    gap: 5,
  },
  nowButtonText: {
    color: COLORS.maroon,
    fontSize: 11,
    fontWeight: "900",
  },
  timelineOptionRow: {
    flexDirection: "row",
    gap: 8,
  },
  timelineOptionChip: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.fieldBackground,
  },
  timelineOptionChipActive: {
    borderColor: COLORS.maroon,
    backgroundColor: "#FFF2F2",
  },
  timelineOptionText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "800",
  },
  timelineOptionTextActive: {
    color: COLORS.maroon,
  },
  sitrepSummaryBlock: {
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.fieldBackground,
  },
  sitrepReportNumber: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 7,
  },
  sitrepSummaryText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  sitrepMetaText: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 9,
  },
  sitrepMetricGrid: {
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },
  sitrepMetric: {
    flex: 1,
    minHeight: 70,
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
  },
  sitrepMetricValue: {
    color: COLORS.maroon,
    fontSize: 22,
    fontWeight: "900",
  },
  sitrepMetricLabel: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  sitrepSectionText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.fieldBackground,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#F4F5F8",
  },
  typeChipActive: {
    backgroundColor: COLORS.maroon,
  },
  typeChipText: {
    color: "#35415B",
    fontSize: 12,
    fontWeight: "700",
  },
  typeChipTextActive: {
    color: COLORS.white,
  },
  createButton: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    marginTop: 18,
    backgroundColor: COLORS.maroon,
    gap: 8,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
  timelineActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 51,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.white,
  },
  secondaryButtonText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "900",
  },
  timelineSaveButton: {
    flex: 1.4,
    marginTop: 0,
  },
  disabledButton: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.76,
  },
});
