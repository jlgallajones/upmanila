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
  createDmmpStaff,
  deleteDmmpStaff,
  downloadIncidentExport,
  generateIncidentSitrep,
  getCoordinationAssessment,
  getDmmpStaff,
  getDmmpStaffSummary,
  getFacilityTriageSummary,
  getIncidents,
  getIncidentTimeline,
  getOnsiteCareSummary,
  getOnsiteTriageSummary,
  getResponderSafetyReport,
  getSceneClearanceSummary,
  getSurvivorDistributionSummary,
  saveCoordinationAssessment,
  saveResponderSafetyReport,
  type Incident,
  type CoordinationRating,
  type DmmpStaffRecord,
  type DmmpStaffSummary,
  type FacilityTriageSummary,
  type MedicalCoordinationAssessment,
  type OnsiteCareSummary,
  type OnsiteTriageSummary,
  type ResponderSafetyResult,
  type ResponderSafetyStatus,
  type SceneClearanceSummary,
  type SurvivorDistributionFacilityMetric,
  type SurvivorDistributionSummary,
  type OnsiteTriageAccuracyMetric,
  type IncidentResponseTimeline,
  type IncidentSitrep,
  updateDmmpStaff,
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
  blue: "#267ABD",
  red: "#C92D32",
};

const SCREEN_PADDING = 16;

const REFERENCE_MANAGER_ROLES = [
  "super_admin",
  "administrator",
  "encoder",
] as const;

const OPERATION_WRITER_ROLES = [
  "super_admin",
  "administrator",
  "responder",
  "encoder",
  "medical_personnel",
] as const;

const COORDINATION_RATING_OPTIONS: Array<{
  value: CoordinationRating;
  label: string;
}> = [
  {
    value: 1,
    label: "Not Done",
  },
  {
    value: 2,
    label: "Inadequate",
  },
  {
    value: 3,
    label: "Somewhat Adequate",
  },
  {
    value: 4,
    label: "Mostly Adequate",
  },
  {
    value: 5,
    label: "Completely Adequate",
  },
  {
    value: 6,
    label: "N/S",
  },
  {
    value: 7,
    label: "N/D",
  },
];

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

function parseOptionalWholeNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
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
  disasterOccurredAt: string;
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
  disasterOccurredAt: "",
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
  incident: Incident,
): TimelineFormState {
  if (!timeline) {
    return {
      ...initialTimelineForm,
      disasterOccurredAt: formatTimelineInput(incident.started_at),
    };
  }

  return {
    disasterOccurredAt: formatTimelineInput(incident.started_at),
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
    disasterOccurredAt: parseDateTimeInput(form.disasterOccurredAt),
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
    ["disasterOccurredAt", "Disaster occurrence"],
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

function formatOperationAllowed(role: string | null): boolean {
  return (
    role !== null &&
    OPERATION_WRITER_ROLES.includes(
      role as (typeof OPERATION_WRITER_ROLES)[number],
    )
  );
}

type StaffFormState = {
  staffName: string;
  roleName: string;
  wasContacted: "yes" | "no";
  contactedAt: string;
  requiredArrivalAt: string;
  arrivedAt: string;
};

const initialStaffForm: StaffFormState = {
  staffName: "",
  roleName: "",
  wasContacted: "yes",
  contactedAt: "",
  requiredArrivalAt: "",
  arrivedAt: "",
};

type CoordinationFormState = {
  initialActionsRating: CoordinationRating | null;
  sceneCoordinationRating: CoordinationRating | null;
  systemCoordinationRating: CoordinationRating | null;
  communicationsRating: CoordinationRating | null;
  resourceManagementRating: CoordinationRating | null;
  notes: string;
  assessedAt: string;
};

const initialCoordinationForm: CoordinationFormState = {
  initialActionsRating: null,
  sceneCoordinationRating: null,
  systemCoordinationRating: null,
  communicationsRating: null,
  resourceManagementRating: null,
  notes: "",
  assessedAt: "",
};

type ResponderSafetyFormState = {
  safetyActionsEstablished: ResponderSafetyStatus;
  ppeDecisionAt: string;
  responseDeactivatedAt: string;
  deployedResponders: string;
  injuredResponders: string;
  illResponders: string;
  deceasedResponders: string;
};

const initialResponderSafetyForm: ResponderSafetyFormState = {
  safetyActionsEstablished: "unknown",
  ppeDecisionAt: "",
  responseDeactivatedAt: "",
  deployedResponders: "",
  injuredResponders: "",
  illResponders: "",
  deceasedResponders: "",
};

function mapStaffToForm(record: DmmpStaffRecord): StaffFormState {
  return {
    staffName: valueOrEmpty(record.staff_name),
    roleName: valueOrEmpty(record.role_name),
    wasContacted: record.was_contacted ? "yes" : "no",
    contactedAt: formatTimelineInput(record.contacted_at),
    requiredArrivalAt: formatTimelineInput(record.required_arrival_at),
    arrivedAt: formatTimelineInput(record.arrived_at),
  };
}

function mapCoordinationToForm(
  assessment: MedicalCoordinationAssessment | null,
): CoordinationFormState {
  if (!assessment) {
    return {
      ...initialCoordinationForm,
      assessedAt: formatDateTimeForInput(new Date()),
    };
  }

  return {
    initialActionsRating: assessment.initial_actions_rating,
    sceneCoordinationRating: assessment.scene_coordination_rating,
    systemCoordinationRating: assessment.system_coordination_rating,
    communicationsRating: assessment.communications_rating,
    resourceManagementRating: assessment.resource_management_rating,
    notes: valueOrEmpty(assessment.notes),
    assessedAt: formatTimelineInput(assessment.assessed_at),
  };
}

function formatSafetyStatus(
  value: ResponderSafetyStatus | null | undefined,
): string {
  switch (value) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "unknown":
      return "Unknown";
    default:
      return "Not recorded";
  }
}

function mapResponderSafetyToForm(
  result: ResponderSafetyResult | null,
): ResponderSafetyFormState {
  const report = result?.report;

  return {
    safetyActionsEstablished:
      report?.safety_actions_established ?? "unknown",
    ppeDecisionAt: formatTimelineInput(report?.ppe_decision_at),
    responseDeactivatedAt: formatTimelineInput(
      report?.response_deactivated_at ??
        result?.summary.responseDeactivatedAt,
    ),
    deployedResponders:
      report?.deployed_responders !== undefined
        ? String(report.deployed_responders)
        : "",
    injuredResponders:
      report?.injured_responders !== undefined
        ? String(report.injured_responders)
        : "",
    illResponders:
      report?.ill_responders !== undefined
        ? String(report.ill_responders)
        : "",
    deceasedResponders:
      report?.deceased_responders !== undefined
        ? String(report.deceased_responders)
        : "",
  };
}

function getRatingLabel(value: CoordinationRating | null): string {
  if (!value) {
    return "Not rated";
  }

  return (
    COORDINATION_RATING_OPTIONS.find((option) => option.value === value)
      ?.label ?? "Not rated"
  );
}

function formatTriageSystemLabel(value: string | null | undefined): string {
  switch (value) {
    case "urgent_non_urgent":
      return "Urgent/non-urgent";
    case "nato":
      return "NATO";
    case "start":
      return "START";
    case "sieve_sort":
      return "SIEVE/SORT";
    case "sieve":
      return "SIEVE";
    case "sort":
      return "SORT";
    case "smart":
      return "SMART";
    case "rts":
      return "RTS";
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
    case "unknown":
      return "Unknown";
    default:
      return value ?? "Not recorded";
  }
}

function formatTriageSystemCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);

  if (entries.length === 0) {
    return "No triage system recorded.";
  }

  return entries
    .sort(([first], [second]) => first.localeCompare(second))
    .map(
      ([key, count]) => `${formatTriageSystemLabel(key)}: ${count}`,
    )
    .join("\n");
}

function formatTreatmentStrategyLabel(
  value: string | null | undefined,
): string {
  switch (value) {
    case "scoop_and_run":
      return "No (Scoop and Run)";
    case "scooter":
      return "No (SCOOTER)";
    case "stay_and_play":
      return "Yes (Stay and Play)";
    case "play_and_run":
      return "Partly (Play and Run)";
    case "unknown":
      return "Unknown";
    default:
      return value ?? "Not recorded";
  }
}

function formatTreatmentStrategyCounts(
  counts: Record<string, number>,
): string {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);

  if (entries.length === 0) {
    return "No on-site care type recorded.";
  }

  return entries
    .sort(([first], [second]) => first.localeCompare(second))
    .map(
      ([key, count]) => `${formatTreatmentStrategyLabel(key)}: ${count}`,
    )
    .join("\n");
}

function formatFacilityLevelLabel(value: string): string {
  switch (value) {
    case "primary":
      return "Primary";
    case "secondary":
      return "Secondary";
    case "tertiary":
      return "Tertiary";
    case "specialized":
      return "Specialized";
    default:
      return value;
  }
}

function IncidentCard({
  incident,
  canClose,
  onClose,
  onEditTimeline,
  onManageStaff,
  onEditCoordination,
  onEditResponderSafety,
  onViewOnsiteTriage,
  onViewFacilityTriage,
  onViewOnsiteCare,
  onViewSceneClearance,
  onViewDistribution,
  onGenerateSitrep,
  isGeneratingSitrep,
}: {
  incident: Incident;
  canClose: boolean;
  onClose: () => void;
  onEditTimeline: () => void;
  onManageStaff: () => void;
  onEditCoordination: () => void;
  onEditResponderSafety: () => void;
  onViewOnsiteTriage: () => void;
  onViewFacilityTriage: () => void;
  onViewOnsiteCare: () => void;
  onViewSceneClearance: () => void;
  onViewDistribution: () => void;
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

      <View style={styles.operationActionRow}>
        <Pressable
          onPress={onManageStaff}
          style={({ pressed }) => [
            styles.operationActionButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={COLORS.blue}
          />
          <Text style={styles.operationActionText}>DMMP Staff</Text>
        </Pressable>

        <Pressable
          onPress={onEditCoordination}
          style={({ pressed }) => [
            styles.operationActionButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="clipboard-outline"
            size={16}
            color={COLORS.orange}
          />
          <Text style={styles.operationActionText}>
            Coordination
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onEditResponderSafety}
        style={({ pressed }) => [
          styles.triageButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={17}
          color={COLORS.maroon}
        />
        <Text style={styles.timelineButtonText}>
          Responder Safety
        </Text>
      </Pressable>

      <Pressable
        onPress={onViewOnsiteTriage}
        style={({ pressed }) => [
          styles.triageButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="medkit-outline"
          size={17}
          color={COLORS.maroon}
        />
        <Text style={styles.timelineButtonText}>On-site Triage</Text>
      </Pressable>

      <Pressable
        onPress={onViewFacilityTriage}
        style={({ pressed }) => [
          styles.triageButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="pulse-outline"
          size={17}
          color={COLORS.maroon}
        />
        <Text style={styles.timelineButtonText}>Facility Triage</Text>
      </Pressable>

      <Pressable
        onPress={onViewOnsiteCare}
        style={({ pressed }) => [
          styles.triageButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="bandage-outline"
          size={17}
          color={COLORS.maroon}
        />
        <Text style={styles.timelineButtonText}>On-site Care</Text>
      </Pressable>

      <Pressable
        onPress={onViewSceneClearance}
        style={({ pressed }) => [
          styles.triageButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="car-outline"
          size={17}
          color={COLORS.maroon}
        />
        <Text style={styles.timelineButtonText}>
          Scene Clearance
        </Text>
      </Pressable>

      <Pressable
        onPress={onViewDistribution}
        style={({ pressed }) => [
          styles.triageButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="business-outline"
          size={17}
          color={COLORS.maroon}
        />
        <Text style={styles.timelineButtonText}>
          Distribution
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
  const [isStaffModalVisible, setIsStaffModalVisible] =
    useState(false);
  const [selectedStaffIncident, setSelectedStaffIncident] =
    useState<Incident | null>(null);
  const [staffRecords, setStaffRecords] = useState<
    DmmpStaffRecord[]
  >([]);
  const [staffSummary, setStaffSummary] =
    useState<DmmpStaffSummary | null>(null);
  const [staffForm, setStaffForm] =
    useState<StaffFormState>(initialStaffForm);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(
    null,
  );
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [deletingStaffId, setDeletingStaffId] = useState<
    string | null
  >(null);
  const [
    isCoordinationModalVisible,
    setIsCoordinationModalVisible,
  ] = useState(false);
  const [
    selectedCoordinationIncident,
    setSelectedCoordinationIncident,
  ] = useState<Incident | null>(null);
  const [coordinationForm, setCoordinationForm] =
    useState<CoordinationFormState>(initialCoordinationForm);
  const [isLoadingCoordination, setIsLoadingCoordination] =
    useState(false);
  const [isSavingCoordination, setIsSavingCoordination] =
    useState(false);
  const [
    isResponderSafetyModalVisible,
    setIsResponderSafetyModalVisible,
  ] = useState(false);
  const [
    selectedResponderSafetyIncident,
    setSelectedResponderSafetyIncident,
  ] = useState<Incident | null>(null);
  const [responderSafetyForm, setResponderSafetyForm] =
    useState<ResponderSafetyFormState>(initialResponderSafetyForm);
  const [responderSafetySummary, setResponderSafetySummary] =
    useState<ResponderSafetyResult["summary"] | null>(null);
  const [isLoadingResponderSafety, setIsLoadingResponderSafety] =
    useState(false);
  const [isSavingResponderSafety, setIsSavingResponderSafety] =
    useState(false);
  const [isOnsiteTriageModalVisible, setIsOnsiteTriageModalVisible] =
    useState(false);
  const [selectedOnsiteTriageIncident, setSelectedOnsiteTriageIncident] =
    useState<Incident | null>(null);
  const [onsiteTriageSummary, setOnsiteTriageSummary] =
    useState<OnsiteTriageSummary | null>(null);
  const [isLoadingOnsiteTriage, setIsLoadingOnsiteTriage] =
    useState(false);
  const [
    isFacilityTriageModalVisible,
    setIsFacilityTriageModalVisible,
  ] = useState(false);
  const [
    selectedFacilityTriageIncident,
    setSelectedFacilityTriageIncident,
  ] = useState<Incident | null>(null);
  const [facilityTriageSummary, setFacilityTriageSummary] =
    useState<FacilityTriageSummary | null>(null);
  const [isLoadingFacilityTriage, setIsLoadingFacilityTriage] =
    useState(false);
  const [isOnsiteCareModalVisible, setIsOnsiteCareModalVisible] =
    useState(false);
  const [selectedOnsiteCareIncident, setSelectedOnsiteCareIncident] =
    useState<Incident | null>(null);
  const [onsiteCareSummary, setOnsiteCareSummary] =
    useState<OnsiteCareSummary | null>(null);
  const [isLoadingOnsiteCare, setIsLoadingOnsiteCare] =
    useState(false);
  const [
    isSceneClearanceModalVisible,
    setIsSceneClearanceModalVisible,
  ] = useState(false);
  const [
    selectedSceneClearanceIncident,
    setSelectedSceneClearanceIncident,
  ] = useState<Incident | null>(null);
  const [sceneClearanceSummary, setSceneClearanceSummary] =
    useState<SceneClearanceSummary | null>(null);
  const [isLoadingSceneClearance, setIsLoadingSceneClearance] =
    useState(false);
  const [
    isDistributionModalVisible,
    setIsDistributionModalVisible,
  ] = useState(false);
  const [
    selectedDistributionIncident,
    setSelectedDistributionIncident,
  ] = useState<Incident | null>(null);
  const [distributionSummary, setDistributionSummary] =
    useState<SurvivorDistributionSummary | null>(null);
  const [isLoadingDistribution, setIsLoadingDistribution] =
    useState(false);
  const [sitrep, setSitrep] = useState<IncidentSitrep | null>(null);
  const [isSitrepModalVisible, setIsSitrepModalVisible] =
    useState(false);
  const [generatingSitrepIncidentId, setGeneratingSitrepIncidentId] =
    useState<string | null>(null);
  const [exportingKind, setExportingKind] = useState<string | null>(
    null,
  );

  const canCreateIncident = formatRoleAllowed(currentUserRole);
  const canUpdateOperations = formatOperationAllowed(currentUserRole);

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

      setTimelineForm(mapTimelineToForm(timeline, incident));
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

  async function handleDownloadExport(
    kind: "sitrep-pdf" | "sitrep-csv" | "casualties-csv",
  ) {
    if (!sitrep) {
      return;
    }

    try {
      setExportingKind(kind);

      const uri = await downloadIncidentExport(
        sitrep.incident_id,
        kind,
      );

      Alert.alert("Export saved", uri);
    } catch (error) {
      console.error("Unable to download export:", error);

      Alert.alert(
        "Unable to export",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setExportingKind(null);
    }
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

    if (!canUpdateOperations) {
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

      const disasterOccurredAt = parseDateTimeInput(
        timelineForm.disasterOccurredAt,
      );

      if (disasterOccurredAt) {
        setIncidents((current) =>
          current.map((incident) =>
            incident.id === selectedTimelineIncident.id
              ? {
                  ...incident,
                  started_at: disasterOccurredAt,
                }
              : incident,
          ),
        );
      }

      setTimelineForm(mapTimelineToForm(saved, selectedTimelineIncident));
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

  async function refreshStaffData(incidentId: string) {
    const [records, summary] = await Promise.all([
      getDmmpStaff(incidentId),
      getDmmpStaffSummary(incidentId),
    ]);

    setStaffRecords(records);
    setStaffSummary(summary);
  }

  async function handleOpenStaff(incident: Incident) {
    setSelectedStaffIncident(incident);
    setStaffRecords([]);
    setStaffSummary(null);
    setStaffForm(initialStaffForm);
    setEditingStaffId(null);
    setIsStaffModalVisible(true);
    setIsLoadingStaff(true);

    try {
      await refreshStaffData(incident.id);
    } catch (error) {
      console.error("Unable to load DMMP staff:", error);

      Alert.alert(
        "Unable to load staff call-down",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingStaff(false);
    }
  }

  function handleCloseStaffModal() {
    if (isSavingStaff) {
      return;
    }

    setIsStaffModalVisible(false);
    setSelectedStaffIncident(null);
    setStaffRecords([]);
    setStaffSummary(null);
    setStaffForm(initialStaffForm);
    setEditingStaffId(null);
  }

  function updateStaffField<K extends keyof StaffFormState>(
    key: K,
    value: StaffFormState[K],
  ) {
    setStaffForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setStaffFieldToNow(key: keyof StaffFormState) {
    updateStaffField(key, formatDateTimeForInput(new Date()));
  }

  function validateStaffForm(form: StaffFormState): string | null {
    const dateFields: Array<[keyof StaffFormState, string]> = [
      ["contactedAt", "Contacted time"],
      ["requiredArrivalAt", "Required arrival time"],
      ["arrivedAt", "Arrived time"],
    ];

    for (const [key, label] of dateFields) {
      const value = String(form[key]).trim();

      if (value && !getValidDateTimeInput(value)) {
        return `${label} must use mm/dd/yyyy hh:mm.`;
      }
    }

    return null;
  }

  async function handleSaveStaff() {
    if (!selectedStaffIncident) {
      return;
    }

    if (!canUpdateOperations) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to update DMMP staff records.",
      );
      return;
    }

    const validationError = validateStaffForm(staffForm);

    if (validationError) {
      Alert.alert("Check staff record", validationError);
      return;
    }

    try {
      setIsSavingStaff(true);

      const payload = {
        staffName: staffForm.staffName.trim() || null,
        roleName: staffForm.roleName.trim() || null,
        wasContacted: staffForm.wasContacted === "yes",
        contactedAt: parseDateTimeInput(staffForm.contactedAt),
        requiredArrivalAt: parseDateTimeInput(
          staffForm.requiredArrivalAt,
        ),
        arrivedAt: parseDateTimeInput(staffForm.arrivedAt),
      };

      if (editingStaffId) {
        await updateDmmpStaff(editingStaffId, payload);
      } else {
        await createDmmpStaff(selectedStaffIncident.id, payload);
      }

      setStaffForm(initialStaffForm);
      setEditingStaffId(null);
      await refreshStaffData(selectedStaffIncident.id);
    } catch (error) {
      console.error("Unable to save DMMP staff:", error);

      Alert.alert(
        "Unable to save staff record",
        error instanceof Error
          ? error.message
          : "Please review the staff record and try again.",
      );
    } finally {
      setIsSavingStaff(false);
    }
  }

  function handleEditStaff(record: DmmpStaffRecord) {
    setEditingStaffId(record.id);
    setStaffForm(mapStaffToForm(record));
  }

  function handleCancelStaffEdit() {
    setEditingStaffId(null);
    setStaffForm(initialStaffForm);
  }

  function handleDeleteStaff(record: DmmpStaffRecord) {
    if (!selectedStaffIncident) {
      return;
    }

    Alert.alert(
      "Delete staff record",
      `Remove ${record.staff_name ?? "this staff record"} from the call-down list?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingStaffId(record.id);
              await deleteDmmpStaff(record.id);
              await refreshStaffData(selectedStaffIncident.id);

              if (editingStaffId === record.id) {
                handleCancelStaffEdit();
              }
            } catch (error) {
              console.error("Unable to delete DMMP staff:", error);

              Alert.alert(
                "Unable to delete staff record",
                error instanceof Error
                  ? error.message
                  : "Please try again.",
              );
            } finally {
              setDeletingStaffId(null);
            }
          },
        },
      ],
    );
  }

  async function handleOpenCoordination(incident: Incident) {
    setSelectedCoordinationIncident(incident);
    setCoordinationForm(initialCoordinationForm);
    setIsCoordinationModalVisible(true);
    setIsLoadingCoordination(true);

    try {
      const assessment = await getCoordinationAssessment(incident.id);

      setCoordinationForm(mapCoordinationToForm(assessment));
    } catch (error) {
      console.error("Unable to load coordination assessment:", error);

      Alert.alert(
        "Unable to load coordination assessment",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingCoordination(false);
    }
  }

  function handleCloseCoordinationModal() {
    if (isSavingCoordination) {
      return;
    }

    setIsCoordinationModalVisible(false);
    setSelectedCoordinationIncident(null);
    setCoordinationForm(initialCoordinationForm);
  }

  function updateCoordinationField<K extends keyof CoordinationFormState>(
    key: K,
    value: CoordinationFormState[K],
  ) {
    setCoordinationForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSaveCoordination() {
    if (!selectedCoordinationIncident) {
      return;
    }

    if (!canUpdateOperations) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to update coordination ratings.",
      );
      return;
    }

    const assessedAt = coordinationForm.assessedAt.trim();

    if (assessedAt && !getValidDateTimeInput(assessedAt)) {
      Alert.alert(
        "Check assessment time",
        "Assessment time must use mm/dd/yyyy hh:mm.",
      );
      return;
    }

    try {
      setIsSavingCoordination(true);

      const saved = await saveCoordinationAssessment(
        selectedCoordinationIncident.id,
        {
          initialActionsRating:
            coordinationForm.initialActionsRating,
          sceneCoordinationRating:
            coordinationForm.sceneCoordinationRating,
          systemCoordinationRating:
            coordinationForm.systemCoordinationRating,
          communicationsRating:
            coordinationForm.communicationsRating,
          resourceManagementRating:
            coordinationForm.resourceManagementRating,
          notes: coordinationForm.notes.trim() || null,
          assessedAt: parseDateTimeInput(coordinationForm.assessedAt),
        },
      );

      setCoordinationForm(mapCoordinationToForm(saved));
      setIsCoordinationModalVisible(false);
      setSelectedCoordinationIncident(null);

      Alert.alert(
        "Coordination saved",
        "Medical operations coordination ratings have been updated.",
      );
    } catch (error) {
      console.error("Unable to save coordination assessment:", error);

      Alert.alert(
        "Unable to save coordination",
        error instanceof Error
          ? error.message
          : "Please review the ratings and try again.",
      );
    } finally {
      setIsSavingCoordination(false);
    }
  }

  async function handleOpenResponderSafety(incident: Incident) {
    setSelectedResponderSafetyIncident(incident);
    setResponderSafetyForm(initialResponderSafetyForm);
    setResponderSafetySummary(null);
    setIsResponderSafetyModalVisible(true);
    setIsLoadingResponderSafety(true);

    try {
      const result = await getResponderSafetyReport(incident.id);

      setResponderSafetyForm(mapResponderSafetyToForm(result));
      setResponderSafetySummary(result.summary);
    } catch (error) {
      console.error("Unable to load responder safety:", error);

      Alert.alert(
        "Unable to load responder safety",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingResponderSafety(false);
    }
  }

  function handleCloseResponderSafetyModal() {
    if (isSavingResponderSafety) {
      return;
    }

    setIsResponderSafetyModalVisible(false);
    setSelectedResponderSafetyIncident(null);
    setResponderSafetyForm(initialResponderSafetyForm);
    setResponderSafetySummary(null);
  }

  function updateResponderSafetyField<
    K extends keyof ResponderSafetyFormState,
  >(key: K, value: ResponderSafetyFormState[K]) {
    setResponderSafetyForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setResponderSafetyFieldToNow(
    key: keyof Pick<
      ResponderSafetyFormState,
      "ppeDecisionAt" | "responseDeactivatedAt"
    >,
  ) {
    updateResponderSafetyField(
      key,
      formatDateTimeForInput(new Date()),
    );
  }

  function validateResponderSafetyForm(
    form: ResponderSafetyFormState,
  ): string | null {
    const dateFields: Array<
      [keyof ResponderSafetyFormState, string]
    > = [
      ["ppeDecisionAt", "PPE decision time"],
      ["responseDeactivatedAt", "Response deactivation time"],
    ];

    for (const [key, label] of dateFields) {
      const value = String(form[key]).trim();

      if (value && !getValidDateTimeInput(value)) {
        return `${label} must use mm/dd/yyyy hh:mm.`;
      }
    }

    const countFields: Array<
      [keyof ResponderSafetyFormState, string]
    > = [
      ["deployedResponders", "Deployed responders"],
      ["injuredResponders", "Injured responders"],
      ["illResponders", "Ill responders"],
      ["deceasedResponders", "Deceased responders"],
    ];

    for (const [key, label] of countFields) {
      const value = String(form[key]).trim();

      if (value && parseOptionalWholeNumber(value) === null) {
        return `${label} must be a non-negative whole number.`;
      }
    }

    const deployedResponders =
      parseOptionalWholeNumber(form.deployedResponders) ?? 0;
    const affectedResponders =
      (parseOptionalWholeNumber(form.injuredResponders) ?? 0) +
      (parseOptionalWholeNumber(form.illResponders) ?? 0) +
      (parseOptionalWholeNumber(form.deceasedResponders) ?? 0);

    if (
      deployedResponders > 0 &&
      affectedResponders > deployedResponders
    ) {
      return "Injured, ill, and deceased responders cannot exceed deployed responders.";
    }

    return null;
  }

  async function handleSaveResponderSafety() {
    if (!selectedResponderSafetyIncident) {
      return;
    }

    if (!canUpdateOperations) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to update responder safety records.",
      );
      return;
    }

    const validationError = validateResponderSafetyForm(
      responderSafetyForm,
    );

    if (validationError) {
      Alert.alert("Check responder safety", validationError);
      return;
    }

    try {
      setIsSavingResponderSafety(true);

      const result = await saveResponderSafetyReport(
        selectedResponderSafetyIncident.id,
        {
          safetyActionsEstablished:
            responderSafetyForm.safetyActionsEstablished,
          ppeDecisionAt: parseDateTimeInput(
            responderSafetyForm.ppeDecisionAt,
          ),
          responseDeactivatedAt: parseDateTimeInput(
            responderSafetyForm.responseDeactivatedAt,
          ),
          deployedResponders:
            parseOptionalWholeNumber(
              responderSafetyForm.deployedResponders,
            ) ?? 0,
          injuredResponders:
            parseOptionalWholeNumber(
              responderSafetyForm.injuredResponders,
            ) ?? 0,
          illResponders:
            parseOptionalWholeNumber(
              responderSafetyForm.illResponders,
            ) ?? 0,
          deceasedResponders:
            parseOptionalWholeNumber(
              responderSafetyForm.deceasedResponders,
            ) ?? 0,
        },
      );

      setResponderSafetyForm(mapResponderSafetyToForm(result));
      setResponderSafetySummary(result.summary);

      Alert.alert(
        "Responder safety saved",
        "Responder safety and health metrics have been updated.",
      );
    } catch (error) {
      console.error("Unable to save responder safety:", error);

      Alert.alert(
        "Unable to save responder safety",
        error instanceof Error
          ? error.message
          : "Please review the responder safety report and try again.",
      );
    } finally {
      setIsSavingResponderSafety(false);
    }
  }

  async function handleOpenOnsiteTriage(incident: Incident) {
    setSelectedOnsiteTriageIncident(incident);
    setOnsiteTriageSummary(null);
    setIsOnsiteTriageModalVisible(true);
    setIsLoadingOnsiteTriage(true);

    try {
      const summary = await getOnsiteTriageSummary(incident.id);

      setOnsiteTriageSummary(summary);
    } catch (error) {
      console.error("Unable to load on-site triage summary:", error);

      Alert.alert(
        "Unable to load on-site triage",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingOnsiteTriage(false);
    }
  }

  function handleCloseOnsiteTriageModal() {
    setIsOnsiteTriageModalVisible(false);
    setSelectedOnsiteTriageIncident(null);
    setOnsiteTriageSummary(null);
  }

  async function handleOpenFacilityTriage(incident: Incident) {
    setSelectedFacilityTriageIncident(incident);
    setFacilityTriageSummary(null);
    setIsFacilityTriageModalVisible(true);
    setIsLoadingFacilityTriage(true);

    try {
      const summary = await getFacilityTriageSummary(incident.id);

      setFacilityTriageSummary(summary);
    } catch (error) {
      console.error("Unable to load facility triage summary:", error);

      Alert.alert(
        "Unable to load facility triage",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingFacilityTriage(false);
    }
  }

  function handleCloseFacilityTriageModal() {
    setIsFacilityTriageModalVisible(false);
    setSelectedFacilityTriageIncident(null);
    setFacilityTriageSummary(null);
  }

  async function handleOpenOnsiteCare(incident: Incident) {
    setSelectedOnsiteCareIncident(incident);
    setOnsiteCareSummary(null);
    setIsOnsiteCareModalVisible(true);
    setIsLoadingOnsiteCare(true);

    try {
      const summary = await getOnsiteCareSummary(incident.id);

      setOnsiteCareSummary(summary);
    } catch (error) {
      console.error("Unable to load on-site care summary:", error);

      Alert.alert(
        "Unable to load on-site care",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingOnsiteCare(false);
    }
  }

  function handleCloseOnsiteCareModal() {
    setIsOnsiteCareModalVisible(false);
    setSelectedOnsiteCareIncident(null);
    setOnsiteCareSummary(null);
  }

  async function handleOpenSceneClearance(incident: Incident) {
    setSelectedSceneClearanceIncident(incident);
    setSceneClearanceSummary(null);
    setIsSceneClearanceModalVisible(true);
    setIsLoadingSceneClearance(true);

    try {
      const summary = await getSceneClearanceSummary(incident.id);

      setSceneClearanceSummary(summary);
    } catch (error) {
      console.error("Unable to load scene clearance summary:", error);

      Alert.alert(
        "Unable to load scene clearance",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingSceneClearance(false);
    }
  }

  function handleCloseSceneClearanceModal() {
    setIsSceneClearanceModalVisible(false);
    setSelectedSceneClearanceIncident(null);
    setSceneClearanceSummary(null);
  }

  async function handleOpenDistribution(incident: Incident) {
    setSelectedDistributionIncident(incident);
    setDistributionSummary(null);
    setIsDistributionModalVisible(true);
    setIsLoadingDistribution(true);

    try {
      const summary = await getSurvivorDistributionSummary(incident.id);

      setDistributionSummary(summary);
    } catch (error) {
      console.error("Unable to load survivor distribution:", error);

      Alert.alert(
        "Unable to load distribution",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsLoadingDistribution(false);
    }
  }

  function handleCloseDistributionModal() {
    setIsDistributionModalVisible(false);
    setSelectedDistributionIncident(null);
    setDistributionSummary(null);
  }

  function renderTimelineDateField(
    label: string,
    key: keyof TimelineFormState,
  ) {
    return (
      <View style={styles.timelineFieldGroup}>
        <View style={styles.timelineLabelRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {canUpdateOperations ? (
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
          editable={canUpdateOperations}
        />
      </View>
    );
  }

  function renderStaffDateField(
    label: string,
    key: keyof StaffFormState,
  ) {
    return (
      <View style={styles.timelineFieldGroup}>
        <View style={styles.timelineLabelRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {canUpdateOperations ? (
            <Pressable
              onPress={() => setStaffFieldToNow(key)}
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
          value={String(staffForm[key])}
          onChangeText={(value) => updateStaffField(key, value)}
          style={styles.input}
          placeholder="mm/dd/yyyy hh:mm"
          placeholderTextColor={COLORS.mutedText}
          editable={canUpdateOperations}
        />
      </View>
    );
  }

  function renderCoordinationRatingField(
    label: string,
    key: keyof Pick<
      CoordinationFormState,
      | "initialActionsRating"
      | "sceneCoordinationRating"
      | "systemCoordinationRating"
      | "communicationsRating"
      | "resourceManagementRating"
    >,
  ) {
    const currentValue = coordinationForm[key];

    return (
      <View style={styles.coordinationFieldGroup}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.ratingGrid}>
          {COORDINATION_RATING_OPTIONS.map((option) => {
            const selected = currentValue === option.value;

            return (
              <Pressable
                key={option.value}
                disabled={!canUpdateOperations}
                onPress={() =>
                  updateCoordinationField(
                    key,
                    selected ? null : option.value,
                  )
                }
                style={({ pressed }) => [
                  styles.ratingChip,
                  selected && styles.ratingChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.ratingChipValue,
                    selected && styles.ratingChipValueActive,
                  ]}
                >
                  {option.value}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.ratingChipText,
                    selected && styles.ratingChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderResponderSafetyDateField(
    label: string,
    key: keyof Pick<
      ResponderSafetyFormState,
      "ppeDecisionAt" | "responseDeactivatedAt"
    >,
  ) {
    return (
      <View style={styles.timelineFieldGroup}>
        <View style={styles.timelineLabelRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {canUpdateOperations ? (
            <Pressable
              onPress={() => setResponderSafetyFieldToNow(key)}
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
          value={responderSafetyForm[key]}
          onChangeText={(value) =>
            updateResponderSafetyField(key, value)
          }
          style={styles.input}
          placeholder="mm/dd/yyyy hh:mm"
          placeholderTextColor={COLORS.mutedText}
          editable={canUpdateOperations}
        />
      </View>
    );
  }

  function renderResponderSafetyStatusField() {
    const options: ResponderSafetyStatus[] = [
      "yes",
      "no",
      "unknown",
    ];

    return (
      <View style={styles.timelineFieldGroup}>
        <Text style={styles.fieldLabel}>
          RESPONDER SAFETY ACTIONS ESTABLISHED
        </Text>
        <View style={styles.timelineOptionRow}>
          {options.map((option) => {
            const selected =
              responderSafetyForm.safetyActionsEstablished === option;

            return (
              <Pressable
                key={option}
                disabled={!canUpdateOperations}
                onPress={() =>
                  updateResponderSafetyField(
                    "safetyActionsEstablished",
                    option,
                  )
                }
                style={({ pressed }) => [
                  styles.timelineOptionChip,
                  selected && styles.timelineOptionChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.timelineOptionText,
                    selected && styles.timelineOptionTextActive,
                  ]}
                >
                  {formatSafetyStatus(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderTriageIntervalSection(
    title: string,
    rows: Array<{
      minutes: number;
      count: number;
      totalSurvivors: number;
      percentage: number;
    }>,
  ) {
    return (
      <View style={styles.triageIntervalSection}>
        <Text style={styles.fieldLabel}>{title}</Text>
        <View style={styles.triageIntervalHeader}>
          <Text style={styles.triageIntervalHeaderText}>Interval</Text>
          <Text style={styles.triageIntervalHeaderText}>Count</Text>
          <Text style={styles.triageIntervalHeaderText}>%</Text>
        </View>

        {rows.map((row) => (
          <View key={row.minutes} style={styles.triageIntervalRow}>
            <Text style={styles.triageIntervalText}>
              {row.minutes === 60 ? "1 hour" : `${row.minutes} min`}
            </Text>
            <Text style={styles.triageIntervalText}>
              {row.count}/{row.totalSurvivors}
            </Text>
            <Text style={styles.triageIntervalValue}>
              {row.percentage}%
            </Text>
          </View>
        ))}
      </View>
    );
  }

  function renderTriageAccuracyRow(
    title: string,
    metric: OnsiteTriageAccuracyMetric,
  ) {
    return (
      <View style={styles.triageAccuracyRow}>
        <View style={styles.triageAccuracyTextGroup}>
          <Text style={styles.triageAccuracyTitle}>{title}</Text>
          <Text style={styles.triageAccuracyDescription}>
            {metric.label}
          </Text>
        </View>
        <Text style={styles.triageAccuracyValue}>
          {metric.numerator}/{metric.denominator} -{" "}
          {metric.percentage}%
        </Text>
      </View>
    );
  }

  function renderAmbulanceIntervalSection(
    title: string,
    rows: Array<{
      minutes: number;
      count: number;
    }>,
  ) {
    return (
      <View style={styles.triageIntervalSection}>
        <Text style={styles.fieldLabel}>{title}</Text>
        <View style={styles.triageIntervalHeader}>
          <Text style={styles.triageIntervalHeaderText}>Interval</Text>
          <Text style={styles.triageIntervalHeaderText}>Count</Text>
        </View>

        {rows.map((row) => (
          <View key={row.minutes} style={styles.triageIntervalRow}>
            <Text style={styles.triageIntervalText}>
              {row.minutes === 60 ? "1 hour" : `${row.minutes} min`}
            </Text>
            <Text style={styles.triageIntervalValue}>
              {row.count}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  function renderDistributionMetricRow(
    metric: SurvivorDistributionFacilityMetric,
  ) {
    return (
      <View
        key={`${metric.level}-${metric.transportUse}`}
        style={styles.triageAccuracyRow}
      >
        <View style={styles.triageAccuracyTextGroup}>
          <Text style={styles.triageAccuracyTitle}>
            {formatFacilityLevelLabel(metric.level)} -{" "}
            {metric.transportUse === "ems" ? "EMS" : "No EMS"}
          </Text>
          <Text style={styles.triageAccuracyDescription}>
            Facility arrivals by transport use
          </Text>
        </View>
        <Text style={styles.triageAccuracyValue}>
          {metric.numerator}/{metric.denominator} -{" "}
          {metric.percentage}%
        </Text>
      </View>
    );
  }

  function renderDistributionRatioRow(
    title: string,
    description: string,
    metric: { numerator: number; denominator: number; percentage: number },
  ) {
    return (
      <View style={styles.triageAccuracyRow}>
        <View style={styles.triageAccuracyTextGroup}>
          <Text style={styles.triageAccuracyTitle}>{title}</Text>
          <Text style={styles.triageAccuracyDescription}>
            {description}
          </Text>
        </View>
        <Text style={styles.triageAccuracyValue}>
          {metric.numerator}/{metric.denominator} -{" "}
          {metric.percentage}%
        </Text>
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
            onManageStaff={() => {
              void handleOpenStaff(item);
            }}
            onEditCoordination={() => {
              void handleOpenCoordination(item);
            }}
            onEditResponderSafety={() => {
              void handleOpenResponderSafety(item);
            }}
            onViewOnsiteTriage={() => {
              void handleOpenOnsiteTriage(item);
            }}
            onViewFacilityTriage={() => {
              void handleOpenFacilityTriage(item);
            }}
            onViewOnsiteCare={() => {
              void handleOpenOnsiteCare(item);
            }}
            onViewSceneClearance={() => {
              void handleOpenSceneClearance(item);
            }}
            onViewDistribution={() => {
              void handleOpenDistribution(item);
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
                  "DISASTER OCCURRENCE",
                  "disasterOccurredAt",
                )}
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
                          disabled={!canUpdateOperations}
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
                  editable={canUpdateOperations}
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

                  {canUpdateOperations ? (
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
        visible={isStaffModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseStaffModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseStaffModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>
                  DMMP Staff Call-down
                </Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedStaffIncident?.incident_name ?? "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseStaffModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingStaff ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading staff call-down...
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                <View style={styles.sitrepMetricGrid}>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {staffSummary?.reportingPercentage ?? 0}%
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Within Standard
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {staffSummary?.totalContacted ?? 0}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Contacted
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {staffSummary?.totalArrived ?? 0}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Arrived
                    </Text>
                  </View>
                </View>

                <Text style={styles.staffFormulaText}>
                  {staffSummary
                    ? `${staffSummary.totalArrivedWithinStandard} within standard / ${staffSummary.totalContacted} contacted`
                    : "No staff call-down records yet"}
                </Text>

                <Text style={styles.fieldLabel}>STAFF NAME</Text>
                <TextInput
                  value={staffForm.staffName}
                  onChangeText={(value) =>
                    updateStaffField("staffName", value)
                  }
                  style={styles.input}
                  placeholder="Name or identifier"
                  placeholderTextColor={COLORS.mutedText}
                  editable={canUpdateOperations}
                />

                <Text style={styles.fieldLabel}>ROLE</Text>
                <TextInput
                  value={staffForm.roleName}
                  onChangeText={(value) =>
                    updateStaffField("roleName", value)
                  }
                  style={styles.input}
                  placeholder="e.g. EMS lead, nurse, logistics"
                  placeholderTextColor={COLORS.mutedText}
                  editable={canUpdateOperations}
                />

                <Text style={styles.fieldLabel}>CONTACTED</Text>
                <View style={styles.timelineOptionRow}>
                  {(["yes", "no"] as const).map((option) => {
                    const selected = staffForm.wasContacted === option;

                    return (
                      <Pressable
                        key={option}
                        disabled={!canUpdateOperations}
                        onPress={() =>
                          updateStaffField("wasContacted", option)
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
                          {option === "yes" ? "Yes" : "No"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {renderStaffDateField("CONTACTED AT", "contactedAt")}
                {renderStaffDateField(
                  "REQUIRED ARRIVAL",
                  "requiredArrivalAt",
                )}
                {renderStaffDateField("ARRIVED AT", "arrivedAt")}

                {canUpdateOperations ? (
                  <View style={styles.timelineActions}>
                    {editingStaffId ? (
                      <Pressable
                        onPress={handleCancelStaffEdit}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.secondaryButtonText}>
                          Clear
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      disabled={isSavingStaff}
                      onPress={() => {
                        void handleSaveStaff();
                      }}
                      style={({ pressed }) => [
                        styles.createButton,
                        styles.timelineSaveButton,
                        isSavingStaff && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.createButtonText}>
                        {isSavingStaff
                          ? "Saving..."
                          : editingStaffId
                            ? "Update Staff"
                            : "Add Staff"}
                      </Text>
                      {isSavingStaff ? (
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
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>CALL-DOWN LIST</Text>
                {staffRecords.length === 0 ? (
                  <Text style={styles.sitrepSectionText}>
                    No DMMP staff records have been entered.
                  </Text>
                ) : (
                  staffRecords.map((record) => (
                    <View
                      key={record.id}
                      style={styles.staffRecordCard}
                    >
                      <View style={styles.staffRecordHeader}>
                        <View style={styles.cardMain}>
                          <Text style={styles.staffRecordName}>
                            {record.staff_name ?? "Unnamed staff"}
                          </Text>
                          <Text style={styles.staffRecordMeta}>
                            {record.role_name ?? "Role not set"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.staffStatusPill,
                            record.arrived_within_standard === true
                              ? styles.staffStatusPillGood
                              : record.arrived_at
                                ? styles.staffStatusPillLate
                                : null,
                          ]}
                        >
                          <Text style={styles.staffStatusPillText}>
                            {record.arrived_within_standard === true
                              ? "On time"
                              : record.arrived_at
                                ? "Arrived"
                                : record.was_contacted
                                  ? "Contacted"
                                  : "Pending"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.staffRecordTimes}>
                        Contacted {formatDateTime(record.contacted_at)}
                        {"\n"}Required{" "}
                        {formatDateTime(record.required_arrival_at)}
                        {"\n"}Arrived{" "}
                        {formatDateTime(record.arrived_at)}
                      </Text>

                      {canUpdateOperations ? (
                        <View style={styles.staffRecordActions}>
                          <Pressable
                            onPress={() => handleEditStaff(record)}
                            style={({ pressed }) => [
                              styles.smallActionButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Ionicons
                              name="create-outline"
                              size={15}
                              color={COLORS.blue}
                            />
                            <Text style={styles.smallActionText}>
                              Edit
                            </Text>
                          </Pressable>
                          <Pressable
                            disabled={deletingStaffId === record.id}
                            onPress={() => handleDeleteStaff(record)}
                            style={({ pressed }) => [
                              styles.smallActionButton,
                              styles.smallDeleteButton,
                              deletingStaffId === record.id &&
                                styles.disabledButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            {deletingStaffId === record.id ? (
                              <ActivityIndicator
                                size="small"
                                color={COLORS.red}
                              />
                            ) : (
                              <Ionicons
                                name="trash-outline"
                                size={15}
                                color={COLORS.red}
                              />
                            )}
                            <Text
                              style={[
                                styles.smallActionText,
                                {
                                  color: COLORS.red,
                                },
                              ]}
                            >
                              Delete
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isCoordinationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCoordinationModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseCoordinationModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>
                  Coordination Assessment
                </Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedCoordinationIncident?.incident_name ??
                    "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseCoordinationModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingCoordination ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading coordination ratings...
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                {renderCoordinationRatingField(
                  "ON-SCENE INITIAL ACTIONS",
                  "initialActionsRating",
                )}
                {renderCoordinationRatingField(
                  "ON-SCENE MEDICAL CONTROL AND COORDINATION",
                  "sceneCoordinationRating",
                )}
                {renderCoordinationRatingField(
                  "SYSTEM-LEVEL MEDICAL COORDINATION",
                  "systemCoordinationRating",
                )}
                {renderCoordinationRatingField(
                  "MEDICAL COMMUNICATIONS AND INFORMATION MANAGEMENT",
                  "communicationsRating",
                )}
                {renderCoordinationRatingField(
                  "MEDICAL RESOURCE MANAGEMENT",
                  "resourceManagementRating",
                )}

                <Text style={styles.fieldLabel}>ASSESSMENT SUMMARY</Text>
                <Text style={styles.sitrepSectionText}>
                  Initial actions:{" "}
                  {getRatingLabel(
                    coordinationForm.initialActionsRating,
                  )}
                  {"\n"}Scene coordination:{" "}
                  {getRatingLabel(
                    coordinationForm.sceneCoordinationRating,
                  )}
                  {"\n"}System coordination:{" "}
                  {getRatingLabel(
                    coordinationForm.systemCoordinationRating,
                  )}
                  {"\n"}Communications:{" "}
                  {getRatingLabel(
                    coordinationForm.communicationsRating,
                  )}
                  {"\n"}Resource management:{" "}
                  {getRatingLabel(
                    coordinationForm.resourceManagementRating,
                  )}
                </Text>

                <View style={styles.timelineFieldGroup}>
                  <View style={styles.timelineLabelRow}>
                    <Text style={styles.fieldLabel}>ASSESSED AT</Text>
                    {canUpdateOperations ? (
                      <Pressable
                        onPress={() =>
                          updateCoordinationField(
                            "assessedAt",
                            formatDateTimeForInput(new Date()),
                          )
                        }
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
                    value={coordinationForm.assessedAt}
                    onChangeText={(value) =>
                      updateCoordinationField("assessedAt", value)
                    }
                    style={styles.input}
                    placeholder="mm/dd/yyyy hh:mm"
                    placeholderTextColor={COLORS.mutedText}
                    editable={canUpdateOperations}
                  />
                </View>

                <Text style={styles.fieldLabel}>NOTES</Text>
                <TextInput
                  value={coordinationForm.notes}
                  onChangeText={(value) =>
                    updateCoordinationField("notes", value)
                  }
                  style={[styles.input, styles.notesInput]}
                  placeholder="Optional coordination notes"
                  placeholderTextColor={COLORS.mutedText}
                  editable={canUpdateOperations}
                  multiline
                />

                <View style={styles.timelineActions}>
                  <Pressable
                    onPress={handleCloseCoordinationModal}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Cancel
                    </Text>
                  </Pressable>

                  {canUpdateOperations ? (
                    <Pressable
                      disabled={isSavingCoordination}
                      onPress={() => {
                        void handleSaveCoordination();
                      }}
                      style={({ pressed }) => [
                        styles.createButton,
                        styles.timelineSaveButton,
                        isSavingCoordination && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.createButtonText}>
                        {isSavingCoordination
                          ? "Saving..."
                          : "Save Ratings"}
                      </Text>
                      {isSavingCoordination ? (
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
        visible={isResponderSafetyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseResponderSafetyModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseResponderSafetyModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>Responder Safety</Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedResponderSafetyIncident?.incident_name ??
                    "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseResponderSafetyModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingResponderSafety ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading responder safety...
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                <View style={styles.sitrepMetricGrid}>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {responderSafetySummary?.killedPercentage ?? 0}%
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Killed
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {responderSafetySummary
                        ?.illOrInjuredPercentage ?? 0}
                      %
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Ill/Injured
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {responderSafetySummary?.deployedResponders ??
                        0}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Deployed
                    </Text>
                  </View>
                </View>

                {renderResponderSafetyStatusField()}

                {renderResponderSafetyDateField(
                  "PPE DECISION TIME",
                  "ppeDecisionAt",
                )}

                {renderResponderSafetyDateField(
                  "LAST HEALTHCARE FACILITY RESPONSE DEACTIVATION",
                  "responseDeactivatedAt",
                )}

                <Text style={styles.fieldLabel}>
                  ACUTE RESPONSE PHASE
                </Text>
                <Text style={styles.sitrepSectionText}>
                  DMMP activation:{" "}
                  {formatDateTime(
                    responderSafetySummary?.dmmpActivatedAt,
                  )}
                  {"\n"}Response deactivation:{" "}
                  {formatDateTime(
                    responderSafetySummary?.responseDeactivatedAt,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>
                  DEPLOYED RESPONDERS
                </Text>
                <TextInput
                  value={responderSafetyForm.deployedResponders}
                  onChangeText={(value) =>
                    updateResponderSafetyField(
                      "deployedResponders",
                      value,
                    )
                  }
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="number-pad"
                  editable={canUpdateOperations}
                />

                <Text style={styles.fieldLabel}>
                  INJURED RESPONDERS
                </Text>
                <TextInput
                  value={responderSafetyForm.injuredResponders}
                  onChangeText={(value) =>
                    updateResponderSafetyField(
                      "injuredResponders",
                      value,
                    )
                  }
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="number-pad"
                  editable={canUpdateOperations}
                />

                <Text style={styles.fieldLabel}>ILL RESPONDERS</Text>
                <TextInput
                  value={responderSafetyForm.illResponders}
                  onChangeText={(value) =>
                    updateResponderSafetyField(
                      "illResponders",
                      value,
                    )
                  }
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="number-pad"
                  editable={canUpdateOperations}
                />

                <Text style={styles.fieldLabel}>
                  DECEASED RESPONDERS
                </Text>
                <TextInput
                  value={responderSafetyForm.deceasedResponders}
                  onChangeText={(value) =>
                    updateResponderSafetyField(
                      "deceasedResponders",
                      value,
                    )
                  }
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="number-pad"
                  editable={canUpdateOperations}
                />

                <Text style={styles.staffFormulaText}>
                  Killed:{" "}
                  {responderSafetySummary?.deceasedResponders ?? 0} /{" "}
                  {responderSafetySummary?.deployedResponders ?? 0}
                  {"\n"}Ill/Injured:{" "}
                  {responderSafetySummary?.illOrInjuredResponders ??
                    0}{" "}
                  / {responderSafetySummary?.deployedResponders ?? 0}
                </Text>

                <View style={styles.timelineActions}>
                  <Pressable
                    onPress={handleCloseResponderSafetyModal}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Cancel
                    </Text>
                  </Pressable>

                  {canUpdateOperations ? (
                    <Pressable
                      disabled={isSavingResponderSafety}
                      onPress={() => {
                        void handleSaveResponderSafety();
                      }}
                      style={({ pressed }) => [
                        styles.createButton,
                        styles.timelineSaveButton,
                        isSavingResponderSafety &&
                          styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.createButtonText}>
                        {isSavingResponderSafety
                          ? "Saving..."
                          : "Save Safety"}
                      </Text>
                      {isSavingResponderSafety ? (
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
        visible={isOnsiteTriageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseOnsiteTriageModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseOnsiteTriageModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>On-site Triage</Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedOnsiteTriageIncident?.incident_name ??
                    "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseOnsiteTriageModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingOnsiteTriage ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading on-site triage...
                </Text>
              </View>
            ) : onsiteTriageSummary ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                <View style={styles.sitrepMetricGrid}>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {onsiteTriageSummary.totalSurvivors}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Survivors
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {onsiteTriageSummary.onSiteTriagedTotal}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      On-site Triaged
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {
                        onsiteTriageSummary.categories.immediate[
                          onsiteTriageSummary.categories.immediate.length - 1
                        ]?.percentage ?? 0
                      }
                      %
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      T1 by 1 hour
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>
                  TYPE OF FIRST TRIAGE USED
                </Text>
                <Text style={styles.sitrepSectionText}>
                  Primary:{" "}
                  {formatTriageSystemLabel(
                    onsiteTriageSummary.triageSystemUsed,
                  )}
                  {"\n"}
                  {formatTriageSystemCounts(
                    onsiteTriageSummary.firstTriageSystemCounts,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>TRIAGE TIMES</Text>
                <Text style={styles.sitrepSectionText}>
                  Response initiation:{" "}
                  {formatDateTime(
                    onsiteTriageSummary.responseInitiatedAt,
                  )}
                  {"\n"}Triage ordered:{" "}
                  {formatDateTime(onsiteTriageSummary.triageOrderedAt)}
                  {"\n"}First on-site triage:{" "}
                  {formatDateTime(
                    onsiteTriageSummary.firstSiteTriageAt,
                  )}
                  {"\n"}Last on-site triage:{" "}
                  {formatDateTime(onsiteTriageSummary.lastSiteTriageAt)}
                </Text>

                {renderTriageIntervalSection(
                  "T1 IMMEDIATE TRIAGED BY INTERVAL",
                  onsiteTriageSummary.categories.immediate,
                )}
                {renderTriageIntervalSection(
                  "T2 DELAYED TRIAGED BY INTERVAL",
                  onsiteTriageSummary.categories.delayed,
                )}

                <Text style={styles.fieldLabel}>TRIAGE ACCURACY</Text>
                <View style={styles.triageAccuracyList}>
                  {renderTriageAccuracyRow(
                    "UNDERTRIAGED T1",
                    onsiteTriageSummary.accuracy.undertriagedT1,
                  )}
                  {renderTriageAccuracyRow(
                    "UNDERTRIAGED T2",
                    onsiteTriageSummary.accuracy.undertriagedT2,
                  )}
                  {renderTriageAccuracyRow(
                    "OVERTRIAGED T2",
                    onsiteTriageSummary.accuracy.overtriagedT2,
                  )}
                  {renderTriageAccuracyRow(
                    "OVERTRIAGED T3",
                    onsiteTriageSummary.accuracy.overtriagedT3,
                  )}
                </View>

                <Pressable
                  onPress={handleCloseOnsiteTriageModal}
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

      <Modal
        visible={isFacilityTriageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseFacilityTriageModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseFacilityTriageModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>Facility Triage</Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedFacilityTriageIncident?.incident_name ??
                    "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseFacilityTriageModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingFacilityTriage ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading facility triage...
                </Text>
              </View>
            ) : facilityTriageSummary ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                <View style={styles.sitrepMetricGrid}>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {facilityTriageSummary.totalSurvivors}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Survivors
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {facilityTriageSummary.facilityTriagedTotal}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Facility Triaged
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {formatTriageSystemLabel(
                        facilityTriageSummary.triageSystemUsed,
                      )}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Primary System
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>
                  TRIAGE SYSTEM USED AT HEALTHCARE FACILITY
                </Text>
                <Text style={styles.sitrepSectionText}>
                  {formatTriageSystemCounts(
                    facilityTriageSummary.firstTriageSystemCounts,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>FACILITY TRIAGE TIMES</Text>
                <Text style={styles.sitrepSectionText}>
                  First facility triage:{" "}
                  {formatDateTime(
                    facilityTriageSummary.firstFacilityTriageAt,
                  )}
                  {"\n"}Last facility triage:{" "}
                  {formatDateTime(
                    facilityTriageSummary.lastFacilityTriageAt,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>
                  FACILITY TRIAGE ACCURACY
                </Text>
                <View style={styles.triageAccuracyList}>
                  {renderTriageAccuracyRow(
                    "UNDERTRIAGED T1",
                    facilityTriageSummary.accuracy.undertriagedT1,
                  )}
                  {renderTriageAccuracyRow(
                    "UNDERTRIAGED T2",
                    facilityTriageSummary.accuracy.undertriagedT2,
                  )}
                  {renderTriageAccuracyRow(
                    "OVERTRIAGED T2",
                    facilityTriageSummary.accuracy.overtriagedT2,
                  )}
                  {renderTriageAccuracyRow(
                    "OVERTRIAGED T3",
                    facilityTriageSummary.accuracy.overtriagedT3,
                  )}
                </View>

                <Pressable
                  onPress={handleCloseFacilityTriageModal}
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

      <Modal
        visible={isOnsiteCareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseOnsiteCareModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseOnsiteCareModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>On-site Care</Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedOnsiteCareIncident?.incident_name ??
                    "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseOnsiteCareModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingOnsiteCare ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading on-site care...
                </Text>
              </View>
            ) : onsiteCareSummary ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                <View style={styles.sitrepMetricGrid}>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {onsiteCareSummary.totalSurvivors}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Survivors
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {onsiteCareSummary.treatmentRecordedTotal}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Care Records
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {onsiteCareSummary.stabilizedT1Total}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Stabilized T1
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>
                  ON-SITE STABILIZATION / TREATMENT
                </Text>
                <Text style={styles.sitrepSectionText}>
                  {formatTreatmentStrategyCounts(
                    onsiteCareSummary.treatmentStrategyCounts,
                  )}
                </Text>

                <Text style={styles.fieldLabel}>CARE TIMES</Text>
                <Text style={styles.sitrepSectionText}>
                  Response initiation:{" "}
                  {formatDateTime(onsiteCareSummary.responseInitiatedAt)}
                </Text>

                {renderTriageIntervalSection(
                  "T1 IMMEDIATE STABILIZED BY INTERVAL",
                  onsiteCareSummary.categories.immediate,
                )}
                {renderTriageIntervalSection(
                  "T2 DELAYED STABILIZED BY INTERVAL",
                  onsiteCareSummary.categories.delayed,
                )}

                <Pressable
                  onPress={handleCloseOnsiteCareModal}
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

      <Modal
        visible={isSceneClearanceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSceneClearanceModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseSceneClearanceModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>
                  Scene Clearance
                </Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedSceneClearanceIncident?.incident_name ??
                    "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseSceneClearanceModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingSceneClearance ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading scene clearance...
                </Text>
              </View>
            ) : sceneClearanceSummary ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                <View style={styles.sitrepMetricGrid}>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {sceneClearanceSummary.totalSurvivors}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Survivors
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {sceneClearanceSummary.emsTransportedTotal}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      EMS Transported
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {
                        sceneClearanceSummary.transported.immediate[
                          sceneClearanceSummary.transported.immediate.length - 1
                        ]?.percentage ?? 0
                      }
                      %
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      T1 by 1 hour
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>
                  CLEARANCE TIMES
                </Text>
                <Text style={styles.sitrepSectionText}>
                  First EMS vehicle on scene:{" "}
                  {formatDateTime(
                    sceneClearanceSummary.firstEmsVehicleOnSceneAt,
                  )}
                  {"\n"}First EMS transport from scene:{" "}
                  {formatDateTime(
                    sceneClearanceSummary.firstTransportFromSceneAt,
                  )}
                  {"\n"}Last EMS transport from scene:{" "}
                  {formatDateTime(
                    sceneClearanceSummary.lastTransportFromSceneAt,
                  )}
                  {"\n"}Response initiation:{" "}
                  {formatDateTime(
                    sceneClearanceSummary.responseInitiatedAt,
                  )}
                </Text>

                {renderTriageIntervalSection(
                  "T1 IMMEDIATE TRANSPORTED BY INTERVAL",
                  sceneClearanceSummary.transported.immediate,
                )}
                {renderTriageIntervalSection(
                  "T2 DELAYED TRANSPORTED BY INTERVAL",
                  sceneClearanceSummary.transported.delayed,
                )}
                {renderAmbulanceIntervalSection(
                  "BLS AMBULANCES ARRIVED BY INTERVAL",
                  sceneClearanceSummary.ambulances.bls,
                )}
                {renderAmbulanceIntervalSection(
                  "ALS AMBULANCES ARRIVED BY INTERVAL",
                  sceneClearanceSummary.ambulances.als,
                )}

                <Pressable
                  onPress={handleCloseSceneClearanceModal}
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

      <Modal
        visible={isDistributionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDistributionModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseDistributionModal}
        >
          <Pressable style={styles.timelineSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>Distribution</Text>
                <Text
                  style={styles.sheetSubtitle}
                  numberOfLines={1}
                >
                  {selectedDistributionIncident?.incident_name ??
                    "Incident"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseDistributionModal}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {isLoadingDistribution ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.maroon}
                />
                <Text style={styles.timelineLoadingText}>
                  Loading distribution...
                </Text>
              </View>
            ) : distributionSummary ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollContent}
              >
                <View style={styles.sitrepMetricGrid}>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {distributionSummary.totalSurvivors}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Survivors
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {distributionSummary.totalFacilityArrivals}
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Facility Arrivals
                    </Text>
                  </View>
                  <View style={styles.sitrepMetric}>
                    <Text style={styles.sitrepMetricValue}>
                      {
                        distributionSummary.edArrivalsByInterval[
                          distributionSummary.edArrivalsByInterval.length - 1
                        ]?.percentage ?? 0
                      }
                      %
                    </Text>
                    <Text style={styles.sitrepMetricLabel}>
                      Arrivals by 1 hr
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>
                  FACILITY ARRIVALS BY LEVEL
                </Text>
                <View style={styles.triageAccuracyList}>
                  {(
                    [
                      "primary",
                      "secondary",
                      "tertiary",
                      "specialized",
                    ] as const
                  ).flatMap((level) => [
                    renderDistributionMetricRow(
                      distributionSummary.facilityLevels[level].nonEms,
                    ),
                    renderDistributionMetricRow(
                      distributionSummary.facilityLevels[level].ems,
                    ),
                  ])}
                </View>

                <Text style={styles.fieldLabel}>ED ARRIVALS</Text>
                <Text style={styles.sitrepSectionText}>
                  Response initiation:{" "}
                  {formatDateTime(
                    distributionSummary.responseInitiatedAt,
                  )}
                </Text>

                {renderTriageIntervalSection(
                  "ED ARRIVALS BY INTERVAL",
                  distributionSummary.edArrivalsByInterval.map(
                    (row) => ({
                      minutes: row.minutes,
                      count: row.count,
                      totalSurvivors: row.totalArrivals,
                      percentage: row.percentage,
                    }),
                  ),
                )}

                <Text style={styles.fieldLabel}>
                  INTERHOSPITAL TRANSFER
                </Text>
                <View style={styles.triageAccuracyList}>
                  {renderDistributionRatioRow(
                    "Transferred out of hospital",
                    "Survivors transferred out / survivors initially arrived at a recorded hospital",
                    distributionSummary.interhospitalTransfer,
                  )}
                </View>

                <Pressable
                  onPress={handleCloseDistributionModal}
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

                <View style={styles.exportActions}>
                  <Pressable
                    disabled={exportingKind !== null}
                    onPress={() => {
                      void handleDownloadExport("sitrep-pdf");
                    }}
                    style={({ pressed }) => [
                      styles.exportButton,
                      exportingKind === "sitrep-pdf" &&
                        styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {exportingKind === "sitrep-pdf" ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.maroon}
                      />
                    ) : (
                      <Ionicons
                        name="document-outline"
                        size={16}
                        color={COLORS.maroon}
                      />
                    )}
                    <Text style={styles.exportButtonText}>PDF</Text>
                  </Pressable>

                  <Pressable
                    disabled={exportingKind !== null}
                    onPress={() => {
                      void handleDownloadExport("sitrep-csv");
                    }}
                    style={({ pressed }) => [
                      styles.exportButton,
                      exportingKind === "sitrep-csv" &&
                        styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {exportingKind === "sitrep-csv" ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.green}
                      />
                    ) : (
                      <Ionicons
                        name="grid-outline"
                        size={16}
                        color={COLORS.green}
                      />
                    )}
                    <Text
                      style={[
                        styles.exportButtonText,
                        {
                          color: COLORS.green,
                        },
                      ]}
                    >
                      SitRep CSV
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={exportingKind !== null}
                    onPress={() => {
                      void handleDownloadExport("casualties-csv");
                    }}
                    style={({ pressed }) => [
                      styles.exportButton,
                      exportingKind === "casualties-csv" &&
                        styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {exportingKind === "casualties-csv" ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.blue}
                      />
                    ) : (
                      <Ionicons
                        name="people-outline"
                        size={16}
                        color={COLORS.blue}
                      />
                    )}
                    <Text
                      style={[
                        styles.exportButtonText,
                        {
                          color: COLORS.blue,
                        },
                      ]}
                    >
                      Records CSV
                    </Text>
                  </Pressable>
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
  operationActionRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 9,
  },
  operationActionButton: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    gap: 6,
  },
  operationActionText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "800",
  },
  triageButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E7D4D5",
    marginTop: 9,
    backgroundColor: "#FFF8F8",
    gap: 7,
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
  staffFormulaText: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 9,
    marginBottom: 4,
  },
  staffRecordCard: {
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginBottom: 9,
  },
  staffRecordHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  staffRecordName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },
  staffRecordMeta: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 3,
    fontWeight: "700",
  },
  staffStatusPill: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#F1F4F8",
  },
  staffStatusPillGood: {
    backgroundColor: "#EAF7EF",
  },
  staffStatusPillLate: {
    backgroundColor: "#FFF3E8",
  },
  staffStatusPillText: {
    color: COLORS.secondaryText,
    fontSize: 9,
    fontWeight: "900",
  },
  staffRecordTimes: {
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
  staffRecordActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  smallActionButton: {
    flex: 1,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.fieldBackground,
    gap: 5,
  },
  smallDeleteButton: {
    borderColor: "#F4C3C5",
    backgroundColor: "#FFF4F4",
  },
  smallActionText: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: "900",
  },
  coordinationFieldGroup: {
    marginTop: 2,
  },
  ratingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ratingChip: {
    width: "31.5%",
    minHeight: 58,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    paddingHorizontal: 8,
    backgroundColor: COLORS.fieldBackground,
  },
  ratingChipActive: {
    borderColor: COLORS.maroon,
    backgroundColor: "#FFF2F2",
  },
  ratingChipValue: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontWeight: "900",
  },
  ratingChipValueActive: {
    color: COLORS.maroon,
  },
  ratingChipText: {
    color: COLORS.secondaryText,
    fontSize: 9,
    fontWeight: "800",
    marginTop: 3,
  },
  ratingChipTextActive: {
    color: COLORS.maroon,
  },
  notesInput: {
    minHeight: 90,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  triageIntervalSection: {
    marginTop: 4,
  },
  triageIntervalHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.fieldBackground,
  },
  triageIntervalHeaderText: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  triageIntervalRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  triageIntervalText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  triageIntervalValue: {
    flex: 1,
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  triageAccuracyList: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },
  triageAccuracyRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 10,
  },
  triageAccuracyTextGroup: {
    flex: 1,
  },
  triageAccuracyTitle: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "900",
  },
  triageAccuracyDescription: {
    color: COLORS.secondaryText,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  triageAccuracyValue: {
    minWidth: 74,
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
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
  exportActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  exportButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    gap: 5,
  },
  exportButtonText: {
    color: COLORS.maroon,
    fontSize: 11,
    fontWeight: "900",
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
