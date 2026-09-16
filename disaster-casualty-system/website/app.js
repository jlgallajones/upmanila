const FALLBACK_API_BASE_URL = "/api";

let realtimeClient = null;
let dashboardRealtimeChannel = null;
let dashboardRealtimeRefreshTimer = null;
let dashboardRealtimeRefreshInFlight = false;
let dashboardRealtimeRefreshQueued = false;
let analyticsLiveRefreshTimer = null;
let analyticsLiveRefreshInFlight = false;
let auditLogsLiveRefreshTimer = null;
let auditLogsLiveRefreshInFlight = false;

function getDefaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return FALLBACK_API_BASE_URL;
  }

  const configuredApiBaseUrl = String(
    window.DCMS_CONFIG?.apiBaseUrl || "",
  ).trim();

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl;
  }

  return FALLBACK_API_BASE_URL;
}

function getDashboardRealtimeConfig() {
  if (typeof window === "undefined") {
    return {
      supabaseUrl: "",
      supabasePublishableKey: "",
    };
  }

  return {
    supabaseUrl: String(
      window.DCMS_CONFIG?.supabaseUrl || "",
    ).trim(),
    supabasePublishableKey: String(
      window.DCMS_CONFIG?.supabasePublishableKey || "",
    ).trim(),
  };
}

function hasDashboardRealtimeConfig() {
  const config = getDashboardRealtimeConfig();
  return Boolean(config.supabaseUrl && config.supabasePublishableKey);
}

function isInvalidStoredApiBaseUrl(value) {
  if (!value) return true;

  if (
    value.includes("localhost") &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return true;
  }

  if (
    value.includes(".netlify.app:5000") ||
    value.includes(".netlify.app/api")
  ) {
    return true;
  }

  return false;
}

function getInitialApiBaseUrl() {
  const stored = localStorage.getItem("dcms.admin.apiBaseUrl");
  const defaultUrl = getDefaultApiBaseUrl();

  if (!isInvalidStoredApiBaseUrl(stored)) {
    return stored;
  }

  localStorage.setItem("dcms.admin.apiBaseUrl", defaultUrl);
  return defaultUrl;
}

const state = {
  apiBaseUrl: getInitialApiBaseUrl(),
  user: readJson("dcms.admin.user"),
  accessToken: localStorage.getItem("dcms.admin.accessToken"),
  sidebarCollapsed: localStorage.getItem("dcms.admin.sidebarCollapsed") === "true",
  activeView: localStorage.getItem("dcms.admin.activeView") || "home",
  incidentSearchQuery: "",
  incidentDateFilter: "",
  incidentStatusFilter: "all",
  casualtyRecordIncidentFocus: "all",
  casualtyRecordVerificationFilter: "all",
  casualtyRecordAccountTypeFilter: "all",
  casualtyRecordSortOrder: "desc",
  casualtyRecordDateFilter: "",
  verificationReviewIncidentFilter: "all",
  matchCasingIncidentFilter: "all",
  selectedMatchCasingRecordIds: [],
  matchCasingPickerRole: null,
  matchCasingAttachments: {},
  matchCasingAttachmentsLoading: false,
  incidents: [],
  allIncidents: [],
  expandedIncidentId: null,
  analyticsIncidentId: null,
  activeIncidentSectionModal: null,
  incidentManagementDetails: {},
  loadingIncidentManagementId: null,
  casualties: [],
  caseLinks: [],
  healthcareFacilities: [],
  callDownStaff: [],
  unitUsers: [],
  auditLogs: [],
  auditLogDateFilter: "",
  formDrafts: [],
  draftToResume: null,
  dashboard: null,
  recentActivity: [],
  bulkImportPreviews: {},
};

const dashboardRealtimeTables = [
  "casualties",
  "casualty_incidents",
  "casualty_triage_assessments",
  "casualty_transport_records",
  "casualty_treatments",
  "casualty_status_history",
  "casualty_verification_history",
  "casualty_case_links",
  "casualty_outcomes",
  "facility_encounters",
  "clinical_procedures",
  "icu_encounters",
  "incidents",
  "incident_response_timelines",
  "dmmp_staff_call_downs",
  "medical_coordination_assessments",
  "responder_safety_reports",
  "responder_safety_responses",
  "continuity_of_care_assessments",
  "facility_resource_snapshots",
  "ems_vehicle_arrivals",
  "evacuation_centers",
  "healthcare_facilities",
  "call_down_staff",
  "audit_logs",
  "users",
  "sitreps",
];

const hazardTypes = [
  "Volcanic Eruption",
  "Earthquake",
  "Tsunami",
  "Landslide",
  "Lahar / Volcanic Mudflow",
  "Sink Hole",
  "Geologic - Other",
  "Infectious Diseases",
  "Infestation",
  "Poisoning",
  "Biological - Other",
  "Typhoon",
  "Storm Surge",
  "LPA / ALPA",
  "Tropical Depression",
  "Monsoon Rain",
  "Flooding",
  "Flash Flood",
  "Lightning",
  "Drought",
  "Meteorological / Hydrological - Other",
  "Bombing",
  "Armed Conflict",
  "War",
  "Mass Gathering",
  "Ambush Incident",
  "Terrorist Activities",
  "Hostage Taking",
  "Coup d'etat",
  "Repatriation",
  "Civil Unrest",
  "Mass Shooting",
  "Societal - Other",
  "Fire",
  "Explosion",
  "Maritime Accident",
  "Air Accident",
  "Land Transportation Accident",
  "Trash Slide",
  "Technological - Other",
  "Other",
];

const facilityLevels = [
  "primary",
  "secondary",
  "tertiary",
  "specialized",
  "unknown",
];

const unitAccountRoles = [
  "field_responder",
  "sa_responder",
  "documenter",
];

const editableUnitAccountRoles = [
  "responder",
  "medical_personnel",
  ...unitAccountRoles,
];

const superAdminViews = [
  ["home", "Summary"],
  ["registration", "Account Registration"],
  ["drafts", "Drafts"],
  ["incident-management", "Incident Management"],
  ["incident-analytics", "Incident Analytics"],
  ["history", "Incident History"],
  ["logs", "Action Logs"],
];

const adminViews = [
  ["home", "Homepage"],
  ["call-down-list", "Call Down List"],
  ["incident-management", "Incident Management"],
  ["incident-analytics", "Incident Analytics"],
  ["incidents", "Official Incidents"],
  ["facilities", "Healthcare Facilities"],
  ["users", "Accounts"],
  ["records", "Casualty Records"],
  ["match-casing", "Match Casing"],
  ["matched-cases", "Matched Cases"],
  ["drafts", "Drafts"],
  ["verification", "Verification Review"],
  ["logs", "Action Logs"],
];

const superAdminNavGroups = [
  {
    id: "overview",
    label: "Overview",
    icon: "O",
    views: [["home", "Summary"]],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "AD",
    views: [
      ["registration", "Account Registration"],
      ["drafts", "Drafts"],
    ],
  },
  {
    id: "incidents",
    label: "Incidents",
    icon: "IN",
    views: [
      ["incident-management", "Incident Management"],
      ["incident-analytics", "Incident Analytics"],
      ["history", "Incident History"],
    ],
  },
  {
    id: "reports",
    label: "Reports & Logs",
    icon: "RL",
    views: [["logs", "Action Logs"]],
  },
];

const adminNavGroups = [
  {
    id: "overview",
    label: "Overview",
    icon: "O",
    views: [["home", "Homepage"]],
  },
  {
    id: "incidents",
    label: "Incidents",
    icon: "IN",
    views: [
      ["call-down-list", "Call Down List"],
      ["incident-management", "Incident Management"],
      ["incident-analytics", "Incident Analytics"],
      ["incidents", "Official Incidents"],
    ],
  },
  {
    id: "casualties",
    label: "Casualties",
    icon: "CA",
    views: [
      ["records", "Casualty Records"],
      ["verification", "Verification Review"],
      ["match-casing", "Match Casing"],
      ["matched-cases", "Matched Cases"],
    ],
  },
  {
    id: "resources",
    label: "Resources",
    icon: "RS",
    views: [["facilities", "Healthcare Facilities"]],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "AD",
    views: [
      ["users", "Accounts"],
      ["drafts", "Drafts"],
    ],
  },
  {
    id: "reports",
    label: "Reports & Logs",
    icon: "RL",
    views: [["logs", "Action Logs"]],
  },
];

const matchCasingRequiredRoleSlots = [
  "field_responder",
  "sa_responder",
  "documenter",
];

function getViewsForRole(role) {
  return role === "super_admin" ? superAdminViews : adminViews;
}

function getNavGroupsForRole(role) {
  return role === "super_admin" ? superAdminNavGroups : adminNavGroups;
}

function isViewAllowedForRole(view, role) {
  return getViewsForRole(role).some(([id]) => id === view);
}

function getStoredActiveViewForRole(role) {
  const stored = localStorage.getItem("dcms.admin.activeView");
  return isViewAllowedForRole(stored, role) ? stored : "home";
}

function setActiveView(view) {
  const nextView = isViewAllowedForRole(view, state.user?.role)
    ? view
    : "home";

  state.activeView = nextView;
  localStorage.setItem("dcms.admin.activeView", nextView);
  updateSidebarActiveState();
}

if (state.user) {
  state.activeView = getStoredActiveViewForRole(state.user.role);
}

function getNavInitials(label) {
  const words = String(label)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function saveSession(data) {
  state.user = data.user;
  state.accessToken = data.accessToken;
  localStorage.setItem("dcms.admin.user", JSON.stringify(data.user));
  localStorage.setItem("dcms.admin.accessToken", data.accessToken || "");
}

function saveCurrentUser(user) {
  state.user = user;
  localStorage.setItem("dcms.admin.user", JSON.stringify(user));
}

function clearSession() {
  void stopDashboardRealtime();
  stopAnalyticsLiveRefresh();
  
  state.user = null;
  state.accessToken = null;
  state.activeView = "home";
  localStorage.removeItem("dcms.admin.user");
  localStorage.removeItem("dcms.admin.accessToken");
  localStorage.removeItem("dcms.admin.activeView");
}

function roleLabel(role) {
  const labels = {
    responder: "Legacy Responder",
    field_responder: "Field Responder",
    sa_responder: "AMP Responder",
    documenter: "Healthcare Facility Documenter",
    medical_personnel: "Legacy Medical Personnel",
  };

  if (labels[role]) {
    return labels[role];
  }

  return (role || "unknown")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isSuperAdmin() {
  return state.user?.role === "super_admin";
}

function isAdminRole() {
  return ["super_admin", "admin", "administrator", "encoder"].includes(
    state.user?.role,
  );
}

function isUnitScopedAdmin() {
  return ["admin", "administrator"].includes(state.user?.role);
}

function filterUnitUsersForCurrentAdmin(users) {
  if (!isUnitScopedAdmin()) return users;

  return users.filter((user) => user.created_by === state.user?.id);
}

function getCurrentAdminEncoderIds(unitUsers) {
  const ids = new Set();

  if (state.user?.id) {
    ids.add(state.user.id);
  }

  for (const user of unitUsers) {
    if (user?.id) {
      ids.add(user.id);
    }
  }

  return ids;
}

function filterIncidentsForCurrentAdmin(incidents) {
  if (!isUnitScopedAdmin()) return incidents;

  return incidents.filter((incident) => incident?.created_by === state.user?.id);
}

function filterCasualtiesForCurrentAdmin(casualties, encoderIds) {
  if (!isUnitScopedAdmin()) return casualties;

  return casualties.filter((record) => encoderIds.has(record?.encoder?.id));
}

function filterRecentActivityForCurrentAdmin(activity, encoderIds, casualtyIds) {
  if (!isUnitScopedAdmin()) return activity;

  return activity.filter(
    (item) =>
      encoderIds.has(item?.encoder?.id) ||
      casualtyIds.has(item?.id),
  );
}

function filterIncidentsBySearchAndDate(incidents) {
  const query = state.incidentSearchQuery.trim().toLowerCase();
  const date = state.incidentDateFilter.trim();
  const status = state.incidentStatusFilter || "all";

  if (!query && !date && status === "all") {
    return incidents;
  }

  return incidents.filter((incident) => {
    const searchable = [
      incident.incident_name,
      incident.incident_code,
      incident.disaster_type,
      incident.description,
      incident.barangay,
      incident.municipality,
      incident.province,
      incident.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const incidentDate = formatDateFilterValue(
      incident.started_at || incident.created_at,
    );

    return (
      (!query || searchable.includes(query)) &&
      (!date || incidentDate === date) &&
      (status === "all" || incident.status === status)
    );
  });
}

function recomputeAdminDashboardSummary() {
  if (!isUnitScopedAdmin()) return;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  state.dashboard = {
    ...(state.dashboard || {}),
    activeIncidents: state.incidents.filter(
      (incident) => incident.status === "active",
    ).length,
    encodedToday: state.casualties.filter((record) => {
      const createdAt = new Date(record.created_at || record.reported_at);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfToday;
    }).length,
    verifiedRecords: state.casualties.filter(
      (record) => record.verification_status === "verified",
    ).length,
    pendingRecords: state.casualties.filter((record) =>
      ["draft", "submitted", "under_review"].includes(
        record.verification_status,
      ),
    ).length,
  };
}

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${state.apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    logUiError(`Request failed before response: ${path}`, error);
    throw new Error(
      getErrorMessage(
        error,
        "Unable to reach the server. Please check your connection and try again.",
      ),
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    let detail = null;

    if (contentType.includes("application/json")) {
      const body = await response.json();
      message = body.message || message;
      detail = body;
    }

    logUiError(`API request failed: ${path}`, {
      status: response.status,
      detail,
      message,
    });

    if (response.status === 401) {
      clearSession();
      render();
    }

    throw new Error(getUserFriendlyMessage(message));
  }

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.blob();
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateFilterValue(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimelineTime(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimelineDate(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function fullCasualtyName(casualty) {
  if (!casualty) return "Unknown casualty";

  const name = [
    casualty.first_name,
    casualty.middle_name,
    casualty.last_name,
    casualty.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || casualty.id_number || "Unknown casualty";
}

function encoderUnitName(encoder) {
  const parts = [
    encoder?.assigned_municipality,
    encoder?.assigned_barangay,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Unassigned unit";
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function casualtySortLabel(item) {
  const name = fullCasualtyName(item?.casualty);

  return name === "Unknown casualty"
    ? item?.casualty?.id_number || name
    : name;
}

function compareVerificationRecords(first, second) {
  return (
    compareText(encoderUnitName(first?.encoder), encoderUnitName(second?.encoder)) ||
    compareText(first?.incident?.incident_name || "Unknown incident", second?.incident?.incident_name || "Unknown incident") ||
    compareText(casualtySortLabel(first), casualtySortLabel(second))
  );
}

function casualtyRecordDateValue(record) {
  return record?.reported_at || record?.created_at || record?.updated_at || null;
}

function casualtyRecordTimestamp(record) {
  const date = new Date(casualtyRecordDateValue(record) || "");
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function compareCasualtyRecordsByLatest(first, second) {
  return casualtyRecordTimestamp(second) - casualtyRecordTimestamp(first);
}

function renderSidebarNavButton([id, label]) {
  return `
    <button class="nav-button ${state.activeView === id ? "active" : ""}" data-view="${id}" title="${escapeHtml(label)}">
      <span class="nav-glyph">
        ${escapeHtml(getNavInitials(label))}
      </span>

      <span>
        ${escapeHtml(label)}
      </span>
    </button>
  `;
}

function renderSidebarNavGroup(group) {
  const isActiveGroup = group.views.some(([id]) => id === state.activeView);
  const viewCountLabel = `${group.views.length} ${group.views.length === 1 ? "menu" : "menus"}`;

  return `
    <details class="nav-group ${isActiveGroup ? "active" : ""}" data-nav-group="${escapeHtml(group.id)}" ${isActiveGroup ? "open" : ""}>
      <summary class="nav-group-summary ${isActiveGroup ? "active" : ""}" title="${escapeHtml(group.label)}">
        <span class="nav-glyph">${escapeHtml(group.icon || getNavInitials(group.label))}</span>
        <span class="nav-group-label">${escapeHtml(group.label)}</span>
        <span class="nav-group-count">${escapeHtml(viewCountLabel)}</span>
        <span class="nav-group-chevron">&rsaquo;</span>
      </summary>

      <div class="nav-group-items">
        ${group.views.map(renderSidebarNavButton).join("")}
      </div>
    </details>
  `;
}

function renderSidebarNavigation() {
  return getNavGroupsForRole(state.user?.role)
    .map(renderSidebarNavGroup)
    .join("");
}

function updateSidebarActiveState() {
  document.querySelectorAll(".nav-button").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === state.activeView);
  });

  document.querySelectorAll(".nav-group").forEach((group) => {
    const isActiveGroup = Array.from(group.querySelectorAll(".nav-button")).some(
      (button) => button.dataset.view === state.activeView,
    );
    group.classList.toggle("active", isActiveGroup);
    group.querySelector(".nav-group-summary")?.classList.toggle("active", isActiveGroup);

    if (isActiveGroup && !state.sidebarCollapsed) {
      group.open = true;
    }
  });
}

function compareCasualtyRecordsBySubmittedTime(first, second) {
  const firstTimestamp = casualtyRecordTimestamp(first);
  const secondTimestamp = casualtyRecordTimestamp(second);
  const timestampDifference =
    state.casualtyRecordSortOrder === "asc"
      ? firstTimestamp - secondTimestamp
      : secondTimestamp - firstTimestamp;

  return (
    timestampDifference ||
    compareText(casualtySortLabel(first), casualtySortLabel(second))
  );
}

function filterCasualtyRecordsForTable(records) {
  const incidentFocus = state.casualtyRecordIncidentFocus;
  const verificationStatus = state.casualtyRecordVerificationFilter;
  const accountType = state.casualtyRecordAccountTypeFilter;
  const date = state.casualtyRecordDateFilter.trim();

  return records.filter((record) => {
    const matchesIncident =
      !incidentFocus ||
      incidentFocus === "all" ||
      record.incident?.id === incidentFocus;
    const matchesStatus =
      verificationStatus === "all" ||
      record.verification_status === verificationStatus;
    const matchesAccountType =
      accountType === "all" || matchCasingRoleBucket(record) === accountType;
    const matchesDate =
      !date ||
      formatDateFilterValue(casualtyRecordDateValue(record)) === date;

    return matchesIncident && matchesStatus && matchesAccountType && matchesDate;
  });
}

function verificationReviewIncidentId(record) {
  return record?.incident?.id || "unknown-incident";
}

function verificationReviewIncidentName(record) {
  return record?.incident?.incident_name || "Unknown incident";
}

function getVerificationReviewIncidentOptions(records) {
  const incidents = new Map();

  for (const record of records) {
    incidents.set(
      verificationReviewIncidentId(record),
      verificationReviewIncidentName(record),
    );
  }

  return Array.from(incidents.entries()).sort((first, second) =>
    compareText(first[1], second[1]),
  );
}

function filterVerificationReviewItems(records) {
  const incidentId = state.verificationReviewIncidentFilter;

  if (!incidentId || incidentId === "all") {
    return records;
  }

  return records.filter(
    (record) => verificationReviewIncidentId(record) === incidentId,
  );
}

function formatLocation(...parts) {
  return parts.filter(Boolean).join(", ") || "Not recorded";
}

function verificationPillClass(status) {
  switch (status) {
    case "verified":
      return "green";
    case "rejected":
      return "red";
    case "under_review":
    case "submitted":
    default:
      return "orange";
  }
}

function isRecentlyOnline(user) {
  if (!user?.last_seen_at) return false;

  const lastSeen = new Date(user.last_seen_at).getTime();

  if (Number.isNaN(lastSeen)) return false;

  return Date.now() - lastSeen <= 10 * 60 * 1000;
}

function toIsoFromLocal(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toNullableIsoFromLocal(value) {
  return toIsoFromLocal(value) ?? null;
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function nullableFormText(form, name) {
  const value = formValue(form, name);
  return value || null;
}

function nullableTextValue(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function nullableFormNumber(form, name) {
  const value = formValue(form, name);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableFormBoolean(form, name) {
  const value = formValue(form, name);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function pickFulfilled(result, fallback = null) {
  return result.status === "fulfilled" ? result.value : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function qs(selector) {
  return document.querySelector(selector);
}

function formValue(form, name) {
  return form.elements[name]?.value?.trim() ?? "";
}

function numberOrUndefined(value) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function sanitizeFileName(value) {
  return String(value || "download")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-|-$/g, "");
}

function getUserFriendlyMessage(
  message,
  fallback = "Something went wrong. Please try again.",
) {
  const rawMessage = String(message || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();

  if (!rawMessage) return fallback;

  if (
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("timeout")
  ) {
    return "Unable to reach the server. Please check your connection and try again.";
  }

  if (
    normalizedMessage.includes("only create responder or documenter accounts") ||
    normalizedMessage.includes("only assign responder or documenter")
  ) {
    return "The dashboard is reaching an older API version that does not support separated FR/AMP/HCFD roles yet. Restart or redeploy the API after applying the role-separation update.";
  }

  if (
    normalizedMessage.includes("jwt") ||
    normalizedMessage.includes("invalid or expired") ||
    normalizedMessage.includes("authentication token") ||
    normalizedMessage.includes("unauthorized")
  ) {
    return "Your session has expired. Please sign in again.";
  }

  if (
    normalizedMessage.includes("duplicate key") ||
    normalizedMessage.includes("already exists")
  ) {
    return "A matching record already exists. Please review the entry and try again.";
  }

  if (
    normalizedMessage.includes("supabase") ||
    normalizedMessage.includes("violates") ||
    normalizedMessage.includes("foreign key") ||
    normalizedMessage.includes("null value") ||
    normalizedMessage.includes("database") ||
    normalizedMessage.includes("syntaxerror") ||
    normalizedMessage.includes("request failed with status 500")
  ) {
    return fallback;
  }

  return rawMessage;
}

function getErrorMessage(
  error,
  fallback = "Something went wrong. Please try again.",
) {
  return getUserFriendlyMessage(
    error instanceof Error ? error.message : error,
    fallback,
  );
}

function logUiError(context, error) {
  console.error(`[DCMS UI] ${context}`, error);
}

async function downloadApiFile(path, fileName) {
  const blob = await apiRequest(path);
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = sanitizeFileName(fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

function renderDataExportPanel(title, subtitle, actions) {
  return `
    <section class="panel export-panel">
      <div class="panel-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p class="panel-subtitle">${escapeHtml(subtitle)}</p>
        </div>
      </div>
      <div class="button-row">
        ${actions
          .map(
            (action) => `
              <button
                class="${escapeHtml(action.className || "ghost-button")}"
                type="button"
                data-export-download="${escapeHtml(action.path)}"
                data-export-file="${escapeHtml(action.fileName)}"
              >
                ${escapeHtml(action.label)}
              </button>
            `,
          )
          .join("")}
      </div>
      <div id="exportMessage" class="status-message" hidden></div>
    </section>
  `;
}

function setMessage(id, message, type = "") {
  const element = document.getElementById(id);
  if (!element) return;
  const normalizedType = type || (message ? "loading" : "");
  const displayMessage =
    normalizedType === "error"
      ? getUserFriendlyMessage(message)
      : message;

  element.className = `status-message ${normalizedType}`;
  element.textContent = displayMessage;
  element.hidden = !displayMessage;
}

function showDashboardToast(message, type = "success") {
  document.querySelector(".dashboard-toast")?.remove();
  const displayMessage =
    type === "error" ? getUserFriendlyMessage(message) : message;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="dashboard-toast ${escapeHtml(type)}" role="status">
        ${escapeHtml(displayMessage)}
      </div>
    `,
  );

  window.setTimeout(() => {
    document.querySelector(".dashboard-toast")?.remove();
  }, type === "error" ? 8000 : 6000);
}

function showDashboardConfirm({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  requireText = "",
  inputLabel = "",
  inputPlaceholder = "",
}) {
  document.querySelector(".dashboard-dialog-backdrop")?.remove();

  return new Promise((resolve) => {
    const requiredText = String(requireText || "");
    const needsTypedConfirmation = Boolean(requiredText);

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div class="dashboard-dialog-backdrop" data-dashboard-dialog>
          <section class="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboardConfirmTitle">
            <div>
              <span class="eyebrow">${danger ? "Destructive Action" : "Confirmation"}</span>
              <h2 id="dashboardConfirmTitle">${escapeHtml(title)}</h2>
              <p>${escapeHtml(message)}</p>
            </div>
            ${
              needsTypedConfirmation
                ? `
                  <label class="dashboard-dialog-field">
                    <span>${escapeHtml(inputLabel || `Type ${requiredText} to continue`)}</span>
                    <input
                      type="text"
                      data-dashboard-confirm-input
                      autocomplete="off"
                      placeholder="${escapeHtml(inputPlaceholder || requiredText)}"
                    />
                  </label>
                `
                : ""
            }
            <div class="dashboard-dialog-actions">
              <button class="ghost-button" type="button" data-dashboard-confirm="false">
                ${escapeHtml(cancelLabel)}
              </button>
              <button class="${danger ? "danger-button" : "primary-button"}" type="button" data-dashboard-confirm="true" ${needsTypedConfirmation ? "disabled" : ""}>
                ${escapeHtml(confirmLabel)}
              </button>
            </div>
          </section>
        </div>
      `,
    );

    const close = (result) => {
      document.querySelector(".dashboard-dialog-backdrop")?.remove();
      resolve(result);
    };

    const input = document.querySelector("[data-dashboard-confirm-input]");
    const confirmButton = document.querySelector('[data-dashboard-confirm="true"]');

    if (input && confirmButton) {
      input.addEventListener("input", () => {
        confirmButton.disabled = input.value.trim() !== requiredText;
      });
      input.focus();
    }

    document
      .querySelectorAll("[data-dashboard-confirm]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          close(button.dataset.dashboardConfirm === "true");
        });
      });

    document
      .querySelector("[data-dashboard-dialog]")
      ?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) {
          close(false);
        }
      });
  });
}

function showDashboardNotice({
  title,
  message,
  eyebrow = "Notice",
  confirmLabel = "Done",
}) {
  document.querySelector(".dashboard-dialog-backdrop")?.remove();

  return new Promise((resolve) => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div class="dashboard-dialog-backdrop" data-dashboard-dialog>
          <section class="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboardNoticeTitle">
            <div>
              <span class="eyebrow">${escapeHtml(eyebrow)}</span>
              <h2 id="dashboardNoticeTitle">${escapeHtml(title)}</h2>
              <p>${escapeHtml(message)}</p>
            </div>
            <div class="dashboard-dialog-actions">
              <button class="primary-button" type="button" data-dashboard-notice-close>
                ${escapeHtml(confirmLabel)}
              </button>
            </div>
          </section>
        </div>
      `,
    );

    const close = () => {
      document.querySelector(".dashboard-dialog-backdrop")?.remove();
      resolve();
    };

    document
      .querySelector("[data-dashboard-notice-close]")
      ?.addEventListener("click", close);

    document
      .querySelector("[data-dashboard-dialog]")
      ?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      });
  });
}

function showDashboardTextPrompt({
  title,
  message,
  label,
  placeholder = "",
  confirmLabel = "Submit",
  cancelLabel = "Cancel",
  required = false,
  requiredMessage = "This field is required.",
  multiline = true,
  inputType = "text",
}) {
  document.querySelector(".dashboard-dialog-backdrop")?.remove();

  return new Promise((resolve) => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div class="dashboard-dialog-backdrop" data-dashboard-dialog>
          <section class="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboardPromptTitle">
            <div>
              <span class="eyebrow">Required Details</span>
              <h2 id="dashboardPromptTitle">${escapeHtml(title)}</h2>
              <p>${escapeHtml(message)}</p>
            </div>
            <label class="dashboard-dialog-field">
              <span>${escapeHtml(label)}</span>
              ${
                multiline
                  ? `<textarea data-dashboard-prompt-input placeholder="${escapeHtml(placeholder)}"></textarea>`
                  : `<input type="${escapeHtml(inputType)}" data-dashboard-prompt-input placeholder="${escapeHtml(placeholder)}" />`
              }
            </label>
            <p class="dashboard-dialog-error" data-dashboard-prompt-error hidden>${escapeHtml(requiredMessage)}</p>
            <div class="dashboard-dialog-actions">
              <button class="ghost-button" type="button" data-dashboard-prompt="cancel">
                ${escapeHtml(cancelLabel)}
              </button>
              <button class="primary-button" type="button" data-dashboard-prompt="submit">
                ${escapeHtml(confirmLabel)}
              </button>
            </div>
          </section>
        </div>
      `,
    );

    const close = (result) => {
      document.querySelector(".dashboard-dialog-backdrop")?.remove();
      resolve(result);
    };

    const input = document.querySelector("[data-dashboard-prompt-input]");
    const error = document.querySelector("[data-dashboard-prompt-error]");
    input?.focus();

    document
      .querySelector('[data-dashboard-prompt="cancel"]')
      ?.addEventListener("click", () => close(null));

    document
      .querySelector('[data-dashboard-prompt="submit"]')
      ?.addEventListener("click", () => {
        const value = input?.value.trim() || "";

        if (required && !value) {
          if (error) error.hidden = false;
          input?.focus();
          return;
        }

        close(value);
      });

    document
      .querySelector("[data-dashboard-dialog]")
      ?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) {
          close(null);
        }
      });
  });
}

const resetCountLabels = [
  ["incidents", "incidents"],
  ["casualty_incidents", "casualty records"],
  ["casualties", "casualty identities"],
  ["attachments", "attachment records"],
  ["attachment_files", "attachment files"],
  ["sitreps", "SitReps"],
  ["responder_safety_responses", "responder safety responses"],
  ["responder_safety_reports", "responder safety reports"],
  ["medical_coordination_assessments", "medical coordination entries"],
  ["continuity_of_care_assessments", "continuity of care entries"],
  ["facility_resource_snapshots", "hospital resource snapshots"],
  ["dmmp_staff_call_downs", "DMMP staff call-downs"],
  ["incident_response_timelines", "incident timeline entries"],
  ["evacuation_centers", "evacuation centers"],
  ["casualty_triage_assessments", "triage assessments"],
  ["casualty_transport_records", "transport records"],
  ["casualty_treatments", "treatment records"],
  ["facility_encounters", "facility encounters"],
  ["casualty_outcomes", "casualty outcomes"],
  ["casualty_status_history", "status history entries"],
  ["casualty_verification_history", "verification history entries"],
  ["casualty_notifications", "casualty notifications"],
  ["incident_notifications", "incident notifications"],
];

function getResetCountLines(counts = {}) {
  return resetCountLabels
    .map(([key, label]) => [label, Number(counts[key] || 0)])
    .filter(([, value]) => value > 0)
    .map(([label, value]) => `${value} ${label}`);
}

function getResetTotalCount(counts = {}) {
  return resetCountLabels.reduce(
    (total, [key]) => total + Number(counts[key] || 0),
    0,
  );
}

function getResetPreviewMessage(previewData, isSuperAdmin) {
  const counts = previewData?.counts || {};
  const lines = getResetCountLines(counts);
  const scope = isSuperAdmin
    ? "SYSTEM-WIDE RESET: this will clear operational records and incidents across every admin account."
    : "ADMIN-SCOPED RESET: this will clear operational records and incidents connected to your admin account and its created users.";
  const countSummary =
    lines.length > 0
      ? `Affected data: ${lines.slice(0, 8).join(", ")}${
          lines.length > 8 ? ", and more related entries" : ""
        }.`
      : "Affected data: no operational records were found for this scope.";

  return `${scope} ${countSummary} Accounts will be kept. Attachment database records and stored attachment files are included.`;
}

function getResetCompletionMessage(resetData) {
  const counts = resetData?.counts || {};
  const lines = getResetCountLines(counts);
  const total = getResetTotalCount(counts);
  const scope =
    resetData?.scope === "system" ? "System-wide reset" : "Admin-scoped reset";

  if (lines.length === 0) {
    return `${scope} completed. No operational records were deleted. Accounts were kept.`;
  }

  return `${scope} completed. Deleted ${total} total entries: ${lines
    .slice(0, 8)
    .join(", ")}${
    lines.length > 8 ? ", and more related entries" : ""
  }. Accounts were kept.`;
}

async function loadSharedData() {
  if (!state.accessToken) return;

  const [
    dashboard,
    incidents,
    allIncidents,
    casualties,
    caseLinks,
    healthcareFacilities,
    callDownStaff,
    unitUsers,
    auditLogs,
    formDrafts,
    recent,
  ] =
    await Promise.allSettled([
      apiRequest("/dashboard/summary"),
      apiRequest("/incidents"),
      apiRequest("/incidents?scope=all"),
      apiRequest("/casualties"),
      apiRequest("/casualties/case-links"),
      apiRequest("/healthcare-facilities"),
      apiRequest("/call-down-staff"),
      apiRequest("/auth/unit-users"),
      apiRequest("/audit-logs?limit=100"),
      apiRequest("/drafts"),
      apiRequest("/dashboard/recent-activity?limit=12"),
    ]);

  if (dashboard.status === "fulfilled") {
    state.dashboard = dashboard.value.data;
  }

  let loadedIncidents = state.incidents;
  let loadedAllIncidents = state.allIncidents;
  let loadedCasualties = state.casualties;
  let loadedCaseLinks = state.caseLinks;
  let loadedHealthcareFacilities = state.healthcareFacilities;
  let loadedCallDownStaff = state.callDownStaff;
  let loadedUnitUsers = state.unitUsers;
  let loadedAuditLogs = state.auditLogs;
  let loadedFormDrafts = state.formDrafts;
  let loadedRecentActivity = state.recentActivity;

  if (incidents.status === "fulfilled") {
    loadedIncidents = incidents.value.data || [];
  }

  if (allIncidents.status === "fulfilled") {
    loadedAllIncidents = allIncidents.value.data || [];
  } else {
    loadedAllIncidents = loadedIncidents;
  }

  if (casualties.status === "fulfilled") {
    loadedCasualties = casualties.value.data || [];
  }

  if (caseLinks.status === "fulfilled") {
    loadedCaseLinks = caseLinks.value.data || [];
  }

  if (healthcareFacilities.status === "fulfilled") {
    loadedHealthcareFacilities = healthcareFacilities.value.data || [];
  }

  if (callDownStaff.status === "fulfilled") {
    loadedCallDownStaff = callDownStaff.value.data || [];
  }

  if (unitUsers.status === "fulfilled") {
    loadedUnitUsers = unitUsers.value.data || [];
  }

  if (auditLogs.status === "fulfilled") {
    loadedAuditLogs = auditLogs.value.data || [];
  }

  if (formDrafts.status === "fulfilled") {
    loadedFormDrafts = formDrafts.value.data || [];
  }

  if (recent.status === "fulfilled") {
    loadedRecentActivity = recent.value.data || [];
  }

  loadedUnitUsers = filterUnitUsersForCurrentAdmin(loadedUnitUsers);

  const adminEncoderIds = getCurrentAdminEncoderIds(loadedUnitUsers);
  loadedIncidents = filterIncidentsForCurrentAdmin(loadedIncidents);
  loadedAllIncidents = filterIncidentsForCurrentAdmin(loadedAllIncidents);
  loadedCasualties = filterCasualtiesForCurrentAdmin(
    loadedCasualties,
    adminEncoderIds,
  );

  const visibleCasualtyIds = new Set(
    loadedCasualties.map((record) => record.id).filter(Boolean),
  );
  loadedRecentActivity = filterRecentActivityForCurrentAdmin(
    loadedRecentActivity,
    adminEncoderIds,
    visibleCasualtyIds,
  );

  state.incidents = loadedIncidents;
  state.allIncidents = loadedAllIncidents.length
    ? loadedAllIncidents
    : loadedIncidents;
  state.casualties = loadedCasualties;
  state.caseLinks = loadedCaseLinks;
  state.healthcareFacilities = loadedHealthcareFacilities;
  state.callDownStaff = loadedCallDownStaff;
  state.unitUsers = loadedUnitUsers;
  state.auditLogs = loadedAuditLogs;
  state.formDrafts = loadedFormDrafts;
  state.recentActivity = loadedRecentActivity;

  recomputeAdminDashboardSummary();
}

async function getRealtimeClient() {
  if (realtimeClient) {
    return realtimeClient;
  }

  const realtimeConfig = getDashboardRealtimeConfig();

  if (
    !realtimeConfig.supabaseUrl ||
    !realtimeConfig.supabasePublishableKey
  ) {
    throw new Error("Supabase Realtime config is missing.");
  }

  const { createClient } = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
  );

  realtimeClient = createClient(
    realtimeConfig.supabaseUrl,
    realtimeConfig.supabasePublishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  return realtimeClient;
}

function getRealtimeDetailIncidentIds() {
  const selectedAnalyticsIncidentId =
    state.activeView === "incident-analytics"
      ? getSelectedAnalyticsIncidentId()
      : null;

  return Array.from(
    new Set(
      [
        state.expandedIncidentId,
        state.analyticsIncidentId,
        selectedAnalyticsIncidentId,
        state.activeIncidentSectionModal?.incidentId,
      ].filter(Boolean),
    ),
  );
}

function isEditingIncidentSection() {
  return Boolean(state.activeIncidentSectionModal?.editMode);
}

function queueDashboardRealtimeRefresh(payload) {
  console.log(
    "[DCMS Realtime] Dashboard change:",
    payload.table,
    payload.eventType,
    payload.new?.id ||
      payload.old?.id ||
      "unknown",
  );

  window.clearTimeout(dashboardRealtimeRefreshTimer);
  dashboardRealtimeRefreshTimer = window.setTimeout(() => {
    void handleDashboardRealtimeChange();
  }, 450);
}

async function handleDashboardRealtimeChange() {
  if (dashboardRealtimeRefreshInFlight) {
    dashboardRealtimeRefreshQueued = true;
    return;
  }

  dashboardRealtimeRefreshInFlight = true;

  try {
    const detailIncidentIdsBeforeLoad = getRealtimeDetailIncidentIds();

    await loadSharedData();

    const detailIncidentIds = Array.from(
      new Set([
        ...detailIncidentIdsBeforeLoad,
        ...getRealtimeDetailIncidentIds(),
      ]),
    );

    state.incidentManagementDetails = {};

    if (!isEditingIncidentSection()) {
      await Promise.all(
        detailIncidentIds.map((incidentId) =>
          loadIncidentManagementDetails(incidentId, { renderLoading: false }),
        ),
      );

      renderCurrentView();
      bindView();
    }
  } catch (error) {
    console.error(
      "[DCMS Realtime] Unable to sync dashboard data:",
      error,
    );
  } finally {
    dashboardRealtimeRefreshInFlight = false;

    if (dashboardRealtimeRefreshQueued) {
      dashboardRealtimeRefreshQueued = false;
      queueDashboardRealtimeRefresh({
        table: "queued",
        eventType: "REFRESH",
        new: null,
        old: null,
      });
    }
  }
}

function getAuditLogsSignature(logs = state.auditLogs) {
  return (logs || [])
    .map((log) => `${log.id}:${log.created_at}`)
    .join("|");
}

async function refreshAuditLogsLive() {
  if (
    state.activeView !== "logs" ||
    !state.accessToken ||
    auditLogsLiveRefreshInFlight
  ) {
    return;
  }

  auditLogsLiveRefreshInFlight = true;

  try {
    const previousSignature = getAuditLogsSignature();
    const response = await apiRequest("/audit-logs?limit=100");
    const nextLogs = response.data || [];
    const nextSignature = getAuditLogsSignature(nextLogs);

    if (nextSignature !== previousSignature) {
      state.auditLogs = nextLogs;
      renderCurrentView();
      bindView();
    }
  } catch (error) {
    console.error(
      "[DCMS Audit Logs] Unable to refresh logs:",
      error,
    );
  } finally {
    auditLogsLiveRefreshInFlight = false;
  }
}

function syncAuditLogsLiveRefresh() {
  window.clearInterval(auditLogsLiveRefreshTimer);
  auditLogsLiveRefreshTimer = null;

  if (
    state.activeView !== "logs" ||
    !state.accessToken
  ) {
    return;
  }

  auditLogsLiveRefreshTimer = window.setInterval(() => {
    void refreshAuditLogsLive();
  }, 3500);
}

async function startDashboardRealtime() {
  if (
    !state.accessToken ||
    dashboardRealtimeChannel ||
    !hasDashboardRealtimeConfig()
  ) {
    return;
  }

  try {
    const client =
      await getRealtimeClient();

    /*
     * Use the user's existing authenticated token
     * for Realtime authorization.
     */
    await client.realtime.setAuth(
      state.accessToken,
    );

    dashboardRealtimeChannel = dashboardRealtimeTables
      .reduce((channel, table) => channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        (payload) => {
          queueDashboardRealtimeRefresh({ ...payload, table });
        },
      ), client.channel("dcms-dashboard"))
      .subscribe((status, error) => {
        console.log(
          "[DCMS Realtime]",
          status,
        );

        if (error) {
          console.error(
            "[DCMS Realtime] Subscription error:",
            error,
          );
        }
      });
  } catch (error) {
    console.error(
      "[DCMS Realtime] Unable to start:",
      error,
    );
  }
}

async function stopDashboardRealtime() {
  if (
    !realtimeClient ||
    !dashboardRealtimeChannel
  ) {
    return;
  }

  await realtimeClient.removeChannel(
    dashboardRealtimeChannel,
  );

  dashboardRealtimeChannel = null;
  window.clearTimeout(dashboardRealtimeRefreshTimer);
  dashboardRealtimeRefreshTimer = null;
  dashboardRealtimeRefreshInFlight = false;
  dashboardRealtimeRefreshQueued = false;
  window.clearInterval(auditLogsLiveRefreshTimer);
  auditLogsLiveRefreshTimer = null;
  auditLogsLiveRefreshInFlight = false;
}

function render() {
  const app = document.getElementById("app");

  if (!state.user || !state.accessToken) {
    app.innerHTML = renderLogin();
    bindLogin();
    return;
  }

  app.innerHTML = renderDashboardShell();
  bindShell();

  void startDashboardRealtime();
  void loadSharedData()
    .then(() => {
      renderCurrentView();
      bindView();
    })
    .catch((error) => {
      renderCurrentView(error.message);
      bindView();
    });
}

function renderLogin() {
  return `
    <main class="login-shell">
      <section class="landing-pane">
        <div class="landing-content">
          <div class="logo-strip">
            <img class="seal-logo" src="./assets/UP-Logo.svg" alt="University of the Philippines logo" />
            <img class="seal-logo" src="./assets/UPM DRRMH Logo.png" alt="UPM DRRMH logo" />
            <img class="partner-logo" src="./assets/DOST Logo.png" alt="DOST logo" />
            <img class="partner-logo" src="./assets/DOST PCHRD Logo.png" alt="DOST PCHRD logo" />
          </div>

          <div class="institution-row">
            <span></span>
            <div>
              <strong>Republic of the Philippines</strong>
              <small>University of the Philippines</small>
            </div>
            <span></span>
          </div>

          <div class="emblem-lockup" aria-hidden="true">
            <div class="pulse-ring">
              <div class="shield-mark">
                <div class="shield-cross">+</div>
              </div>
            </div>
            <div class="acronym-badge">DCMS</div>
          </div>

          <div class="landing-title">
            <h1>Disaster Casualty<br />Management System</h1>
            <p>Emergency Response Information Platform</p>
          </div>
        </div>
      </section>

      <section class="login-pane">
        <form id="loginForm" class="login-card">
          <span class="eyebrow">Administrator Portal</span>
          <h2>Sign in to DCMS</h2>
          <p>Use an active super admin or admin account to manage official incidents, facilities, SitReps, and system oversight.</p>

          <div class="form-grid">
            <label class="field">
              <span>Email</span>
              <input name="email" type="email" autocomplete="email" required />
            </label>
            <label class="field">
              <span>Password</span>
              <input name="password" type="password" autocomplete="current-password" required />
            </label>
            <button class="primary-button" type="submit">Login</button>
          </div>
          <div id="loginMessage" class="status-message" hidden></div>
        </form>
      </section>
    </main>
  `;
}

function bindLogin() {
  qs("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("loginMessage", "Signing in...");

    try {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formValue(form, "email"),
          password: form.elements.password.value,
        }),
      });

      if (!["super_admin", "admin", "administrator", "encoder"].includes(response.data.user.role)) {
        throw new Error("This desktop dashboard is only available to admin accounts.");
      }

      saveSession(response.data);
      setActiveView("home");
      render();
    } catch (error) {
      setMessage("loginMessage", error.message, "error");
    }
  });
}

function renderDashboardShell() {
  return `
    <div class="app-shell ${state.sidebarCollapsed ? "sidebar-collapsed" : ""}">
      <aside class="sidebar">
        <div class="sidebar-title">
          <div class="sidebar-mark">DC</div>
          <div class="sidebar-brand-text">
            <strong>DCMS Admin</strong>
            <span>${isSuperAdmin() ? "Super Admin Portal" : "Admin Portal"}</span>
          </div>
          <button
            id="sidebarToggle"
            class="sidebar-toggle"
            type="button"
            aria-label="${state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}"
            title="${state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}"
          >
            ${state.sidebarCollapsed ? "&gt;" : "&lt;"}
          </button>
        </div>

        <div class="nav-section-label">Workspace</div>
        <nav class="nav-list">
          ${renderSidebarNavigation()}
        </nav>

        <div class="sidebar-footer">
          <button class="user-chip" type="button" id="profileButton" title="Open profile">
            <div class="user-avatar">${escapeHtml(state.user.full_name?.slice(0, 1) || "A")}</div>
            <div class="user-chip-text">
            <strong>${escapeHtml(state.user.full_name)}</strong>
            <span>${roleLabel(state.user.role)}</span>
            </div>
          </button>
          <button id="logoutButton" class="danger-button">Logout</button>
        </div>
      </aside>

      <main class="main">
        <div id="viewRoot"></div>
      </main>
    </div>
  `;
}

function bindShell() {
  qs("#sidebarToggle").addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem(
      "dcms.admin.sidebarCollapsed",
      String(state.sidebarCollapsed),
    );
    applySidebarCollapsedState();
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.view);
      updateSidebarActiveState();
      renderCurrentView();
      bindView();
    });
  });

  qs("#profileButton")?.addEventListener("click", () => {
    openProfileModal();
  });

  qs("#logoutButton").addEventListener("click", async () => {
    const confirmed = await showDashboardConfirm({
      title: "Log out?",
      message:
        "You will return to the login screen and need to sign in again to continue.",
      confirmLabel: "Logout",
      cancelLabel: "Stay signed in",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    clearSession();
    render();
  });
}

function renderProfileModal() {
  const user = state.user || {};
  const isSystemReset = user.role === "super_admin";
  const resetCopy = isSystemReset
    ? "System-wide reset clears operational records and incidents across every admin account."
    : "Admin-scoped reset clears operational records and incidents connected to your admin account and users you created.";
  const resetScopeLabel = isSystemReset
    ? "System-wide reset"
    : "Admin-scoped reset";

  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="record-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Account Profile</span>
            <h2 id="profileModalTitle">${escapeHtml(user.full_name || "Profile")}</h2>
            <p>${escapeHtml(user.email || "")} · ${escapeHtml(roleLabel(user.role))}</p>
          </div>
          <button class="icon-button" type="button" data-close-modal aria-label="Close profile">&times;</button>
        </div>

        <div class="modal-body">
          <form id="profileForm" class="form-grid">
            <div class="form-grid two">
              <label class="field">
                <span>Full name</span>
                <input name="fullName" required value="${escapeHtml(user.full_name || "")}" />
              </label>
              <label class="field">
                <span>Email</span>
                <input name="email" type="email" required value="${escapeHtml(user.email || "")}" />
              </label>
            </div>

            <div class="form-grid two">
              <label class="field">
                <span>Phone number</span>
                <input name="phoneNumber" value="${escapeHtml(user.phone_number || "")}" />
              </label>
              <label class="field">
                <span>New password</span>
                <input name="password" type="password" minlength="6" placeholder="Leave blank to keep current password" />
              </label>
            </div>

            <div class="form-grid two">
              <label class="field">
                <span>Assigned municipality</span>
                <input name="assignedMunicipality" value="${escapeHtml(user.assigned_municipality || "")}" />
              </label>
              <label class="field">
                <span>Assigned barangay</span>
                <input name="assignedBarangay" value="${escapeHtml(user.assigned_barangay || "")}" />
              </label>
            </div>

            <label class="field">
              <span>Confirm new password</span>
              <input name="confirmPassword" type="password" minlength="6" placeholder="Repeat new password" />
            </label>

            <div id="profileMessage" class="status-message" hidden></div>
          </form>

          <section class="record-section profile-reset-panel ${isSystemReset ? "system-reset" : "admin-reset"}">
            <div class="reset-panel-heading">
              <h3>Reset Records</h3>
              <span class="reset-scope-badge">${escapeHtml(resetScopeLabel)}</span>
            </div>
            <p class="panel-subtitle">${escapeHtml(resetCopy)}</p>
            <ul class="reset-safety-list">
              <li>Accounts and login access are kept.</li>
              <li>Record counts are shown before reset.</li>
              <li>Attachment records and stored files are removed with related casualty records.</li>
              <li>Typed confirmation and current password are required.</li>
            </ul>
            <button class="danger-button" type="button" id="resetOperationalDataButton">
              Reset records and incidents
            </button>
          </section>
        </div>

        <div class="modal-footer">
          <button class="ghost-button" type="button" data-close-modal>Cancel</button>
          <button class="primary-button" type="submit" form="profileForm">Save profile</button>
        </div>
      </section>
    </div>
  `;
}

function openProfileModal() {
  closeRecordModal();

  document.body.insertAdjacentHTML(
    "beforeend",
    renderProfileModal(),
  );

  document
    .querySelectorAll("[data-close-modal]")
    .forEach((element) => {
      element.addEventListener("click", (event) => {
        if (
          event.target === element ||
          element.matches("button")
        ) {
          closeRecordModal();
        }
      });
    });

  bindProfileModalActions();
}

function bindProfileModalActions() {
  const form = qs("#profileForm");
  const resetButton = qs("#resetOperationalDataButton");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const password = form.elements.password.value;
      const confirmPassword = form.elements.confirmPassword.value;

      if (password && password !== confirmPassword) {
        setMessage(
          "profileMessage",
          "New password and confirmation do not match.",
          "error",
        );
        return;
      }

      try {
        const response = await apiRequest("/auth/me", {
          method: "PATCH",
          body: JSON.stringify({
            fullName: form.elements.fullName.value,
            email: form.elements.email.value,
            phoneNumber: form.elements.phoneNumber.value,
            assignedMunicipality:
              form.elements.assignedMunicipality.value,
            assignedBarangay: form.elements.assignedBarangay.value,
            ...(password ? { password } : {}),
          }),
        });

        saveCurrentUser(response.data);
        closeRecordModal();
        renderDashboardShellIntoExisting();
        showDashboardToast("Profile updated successfully.", "success");
      } catch (error) {
        setMessage(
          "profileMessage",
          error instanceof Error
            ? error.message
            : "Unable to update profile.",
          "error",
        );
      }
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", async () => {
      const isSuperAdmin = state.user?.role === "super_admin";
      let previewData = null;

      try {
        resetButton.disabled = true;
        resetButton.textContent = "Checking records...";

        const preview = await apiRequest("/auth/reset-operational-data/preview");
        previewData = preview.data || {};
      } catch (error) {
        resetButton.disabled = false;
        resetButton.textContent = "Reset records and incidents";
        const message =
          error instanceof Error
            ? error.message
            : "Unable to preview reset records.";
        setMessage("profileMessage", message, "error");
        showDashboardToast(message, "error");
        return;
      }

      resetButton.disabled = false;
      resetButton.textContent = "Reset records and incidents";

      const confirmed = await showDashboardConfirm({
        title: isSuperAdmin
          ? "Reset all system records?"
          : "Reset your admin-unit records?",
        message: getResetPreviewMessage(previewData, isSuperAdmin),
        confirmLabel: "Continue",
        cancelLabel: "Keep records",
        danger: true,
        requireText: "RESET RECORDS",
        inputLabel: "Type RESET RECORDS to confirm",
      });

      if (!confirmed) {
        return;
      }

      const currentPassword = await showDashboardTextPrompt({
        title: "Confirm password",
        message:
          "Enter your current account password before deleting operational records.",
        label: "Current password",
        placeholder: "Current password",
        confirmLabel: "Reset records",
        cancelLabel: "Cancel reset",
        required: true,
        requiredMessage: "Current password is required.",
        multiline: false,
        inputType: "password",
      });

      if (!currentPassword) {
        return;
      }

      try {
        resetButton.disabled = true;
        resetButton.textContent = "Resetting...";

        const response = await apiRequest("/auth/reset-operational-data", {
          method: "POST",
          body: JSON.stringify({
            confirmation: "RESET RECORDS",
            currentPassword,
          }),
        });

        await loadSharedData();
        closeRecordModal();
        renderDashboardShellIntoExisting();
        const summary = getResetCompletionMessage(response.data);
        showDashboardToast(summary, "success");
        await showDashboardNotice({
          title: "Reset complete",
          message: summary,
          eyebrow: "Reset Summary",
          confirmLabel: "Done",
        });
      } catch (error) {
        resetButton.disabled = false;
        resetButton.textContent = "Reset records and incidents";
        const message =
          error instanceof Error
            ? error.message
            : "Unable to reset records.";
        setMessage(
          "profileMessage",
          message,
          "error",
        );
        showDashboardToast(message, "error");
      }
    });
  }
}

function applySidebarCollapsedState() {
  const shell = document.querySelector(".app-shell");
  const toggle = qs("#sidebarToggle");
  if (!shell || !toggle) return;

  shell.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  const label = state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  toggle.setAttribute("aria-label", label);
  toggle.setAttribute("title", label);
  toggle.innerHTML = state.sidebarCollapsed ? "&gt;" : "&lt;";
}

function renderCurrentView(errorMessage = "") {
  const root = qs("#viewRoot");
  if (!root) return;

  const title = isSuperAdmin()
    ? {
        home: "Super Admin Summary",
        registration: "Account Registration",
        "incident-management": "Incident Management",
        "incident-analytics": "Incident Analytics",
        history: "Reported Incident History",
        logs: "Action Logs",
      }[state.activeView]
    : {
        home: "Admin Homepage",
        "call-down-list": "Call Down List",
        "incident-management": "Incident Management",
        "incident-analytics": "Incident Analytics",
        incidents: "Official Incidents",
        facilities: "Healthcare Facilities",
        users: "Accounts",
        records: "Casualty Records",
        "match-casing": "Match Casing",
        "matched-cases": "Matched Cases",
        drafts: "Drafts",
        verification: "Verification Review",
        logs: "Action Logs",
      }[state.activeView];

  root.innerHTML = `

    ${errorMessage ? `<div class="status-message error">${escapeHtml(errorMessage)}</div>` : ""}
    ${isSuperAdmin() ? renderSuperAdminView() : renderAdminView()}
  `;
}

function bindView() {
  const refreshButton = qs("#refreshButton");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await loadSharedData();
      renderCurrentView();
      bindView();
    });
  }

  bindCreateIncidentForm();
  bindCreateEvacuationForm();
  bindCreateFacilityForm();
  bindHealthcareFacilityActions();
  bindCallDownStaffActions();
  bindRegisterAdminForm();
  bindRegisterUnitUserForm();
  bindAccountActions();
  bindIncidentManagementActions();
  bindIncidentAnalyticsActions();
  bindIncidentHistoryActions();
  bindCasualtyRecordIncidents();
  bindOpenCasualtyRecord();
  bindMatchCasingActions();
  bindDraftActions();
  bindVerificationReviewActions();
  bindDeleteCasualtyActions();
  bindVerificationReviewFilters();
  bindScopeLinks();
  bindIncidentSearchFilters();
  bindAuditLogsFilters();
  bindCasualtyRecordFilters();
  bindPasswordVisibilityToggles();
  bindBulkImportActions();
  bindExportDownloadActions();
  syncAnalyticsLiveRefresh();
  syncAuditLogsLiveRefresh();
}

function bindExportDownloadActions() {
  document.querySelectorAll("[data-export-download]").forEach((button) => {
    if (button.dataset.exportBound === "true") return;
    button.dataset.exportBound = "true";

    button.addEventListener("click", async () => {
      const path = button.dataset.exportDownload;
      const fileName = button.dataset.exportFile || "dcms-export.csv";

      if (!path) return;

      try {
        button.disabled = true;
        setMessage("exportMessage", "Preparing export...");
        await downloadApiFile(path, fileName);
        setMessage("exportMessage", "Export downloaded.", "success");
        showDashboardToast("Export downloaded.", "success");
      } catch (error) {
        logUiError("Unable to download export", error);
        const message = getErrorMessage(error, "Unable to download export.");
        setMessage("exportMessage", message, "error");
        showDashboardToast(message, "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindScopeLinks() {
  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewLink || "home");
      renderDashboardShellIntoExisting();
    });
  });
}

function renderIncidentSearchFilters(resultCount, totalCount) {
  const statusOptions = [
    ["all", "All statuses"],
    ["active", "Active"],
    ["closed", "Closed"],
    ["draft", "Draft"],
    ["archived", "Archived"],
  ];

  return `
    <div class="form-grid three" style="margin-top:16px">
      <label class="field">
        <span>Search incidents</span>
        <input
          id="incidentSearchInput"
          value="${escapeHtml(state.incidentSearchQuery)}"
          placeholder="Search incident, hazard, location, or status"
          autocomplete="off"
        />
      </label>
      <label class="field">
        <span>Filter by date</span>
        <input
          id="incidentDateFilterInput"
          type="date"
          value="${escapeHtml(state.incidentDateFilter)}"
        />
      </label>
      <label class="field">
        <span>Filter by status</span>
        <select id="incidentStatusFilterInput">
          ${statusOptions
            .map(
              ([value, label]) =>
                `<option value="${escapeHtml(value)}" ${
                  state.incidentStatusFilter === value ? "selected" : ""
                }>${escapeHtml(label)}</option>`,
            )
            .join("")}
        </select>
      </label>
    </div>
    <p class="panel-subtitle" style="margin-top:10px">
      Showing ${resultCount} of ${totalCount} incidents.
    </p>
  `;
}

function bindIncidentSearchFilters() {
  const searchInput = qs("#incidentSearchInput");
  const dateInput = qs("#incidentDateFilterInput");
  const statusInput = qs("#incidentStatusFilterInput");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.incidentSearchQuery = searchInput.value;
      renderCurrentView();
      bindView();
      qs("#incidentSearchInput")?.focus();
    });
  }

  if (dateInput) {
    dateInput.addEventListener("input", () => {
      state.incidentDateFilter = dateInput.value;
      renderCurrentView();
      bindView();
    });
  }

  if (statusInput) {
    statusInput.addEventListener("change", () => {
      state.incidentStatusFilter = statusInput.value || "all";
      renderCurrentView();
      bindView();
    });
  }
}

function renderCasualtyRecordFilters(resultCount, totalCount) {
  const statusOptions = [
    ["all", "All verification statuses"],
    ["submitted", "Submitted"],
    ["verified", "Verified"],
    ["rejected", "Rejected"],
  ];
  const accountTypeOptions = [
    ["all", "All account types"],
    ["field_responder", "Field Responder"],
    ["sa_responder", "AMP Responder"],
    ["documenter", "HCFD"],
    ["responder", "Legacy Responder"],
  ];
  const sortOptions = [
    ["desc", "Newest submitted first"],
    ["asc", "Oldest submitted first"],
  ];
  const sortLabel =
    state.casualtyRecordSortOrder === "asc"
      ? "oldest to newest"
      : "newest to oldest";

  return `
    <div class="form-grid two" style="margin-top:16px">
      <label class="field">
        <span>Filter by verification</span>
        <select id="casualtyRecordVerificationFilter">
          ${statusOptions
            .map(
              ([value, label]) =>
                `<option value="${escapeHtml(value)}" ${state.casualtyRecordVerificationFilter === value ? "selected" : ""}>${escapeHtml(label)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label class="field">
        <span>Filter by account type</span>
        <select id="casualtyRecordAccountTypeFilter">
          ${accountTypeOptions
            .map(
              ([value, label]) =>
                `<option value="${escapeHtml(value)}" ${state.casualtyRecordAccountTypeFilter === value ? "selected" : ""}>${escapeHtml(label)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label class="field">
        <span>Sort by time submitted</span>
        <select id="casualtyRecordSortOrder">
          ${sortOptions
            .map(
              ([value, label]) =>
                `<option value="${escapeHtml(value)}" ${state.casualtyRecordSortOrder === value ? "selected" : ""}>${escapeHtml(label)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label class="field">
        <span>Filter by reported date</span>
        <input
          id="casualtyRecordDateFilter"
          type="date"
          value="${escapeHtml(state.casualtyRecordDateFilter)}"
        />
      </label>
    </div>
    <div class="button-row" style="margin-top:12px">
      <button class="primary-button" type="button" data-apply-casualty-record-filters>
        Filter Records
      </button>
      <button class="ghost-button" type="button" data-clear-casualty-record-filters>
        Clear Filters
      </button>
    </div>
    <p class="panel-subtitle" style="margin-top:10px">
      Showing ${resultCount} of ${totalCount} casualty records, sorted ${sortLabel} by submitted time.
    </p>
  `;
}

function bindCasualtyRecordFilters() {
  const statusInput = qs("#casualtyRecordVerificationFilter");
  const accountTypeInput = qs("#casualtyRecordAccountTypeFilter");
  const sortOrderInput = qs("#casualtyRecordSortOrder");
  const dateInput = qs("#casualtyRecordDateFilter");
  const applyButton = qs("[data-apply-casualty-record-filters]");
  const clearButton = qs("[data-clear-casualty-record-filters]");

  if (applyButton) {
    applyButton.addEventListener("click", () => {
      state.casualtyRecordVerificationFilter = statusInput?.value || "all";
      state.casualtyRecordAccountTypeFilter = accountTypeInput?.value || "all";
      state.casualtyRecordSortOrder = sortOrderInput?.value || "desc";
      state.casualtyRecordDateFilter = dateInput?.value || "";
      renderCurrentView();
      bindView();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      state.casualtyRecordVerificationFilter = "all";
      state.casualtyRecordAccountTypeFilter = "all";
      state.casualtyRecordSortOrder = "desc";
      state.casualtyRecordDateFilter = "";
      renderCurrentView();
      bindView();
    });
  }
}

function renderVerificationReviewFilters(filteredCount, totalCount, options) {
  return `
    <div class="form-grid two" style="margin-top:16px">
      <label class="field">
        <span>Filter by incident</span>
        <select id="verificationReviewIncidentFilter">
          <option value="all" ${state.verificationReviewIncidentFilter === "all" ? "selected" : ""}>All incidents</option>
          ${options
            .map(
              ([id, name]) => `
                <option value="${escapeHtml(id)}" ${state.verificationReviewIncidentFilter === id ? "selected" : ""}>
                  ${escapeHtml(name)}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
    </div>
    <p class="panel-subtitle" style="margin-top:10px">
      Showing ${filteredCount} of ${totalCount} pending verification items, sorted latest to past.
    </p>
  `;
}

function bindVerificationReviewFilters() {
  const incidentInput = qs("#verificationReviewIncidentFilter");

  if (!incidentInput) return;

  incidentInput.addEventListener("change", () => {
    state.verificationReviewIncidentFilter = incidentInput.value;
    renderCurrentView();
    bindView();
  });
}

function getAnalyticsIncidents() {
  return state.allIncidents.length ? state.allIncidents : state.incidents;
}

function getSelectedAnalyticsIncident() {
  const incidents = getAnalyticsIncidents();

  return (
    incidents.find((incident) => incident.id === state.analyticsIncidentId) ||
    incidents.find((incident) => incident.status === "active") ||
    incidents[0] ||
    null
  );
}

function getSelectedAnalyticsIncidentId() {
  return getSelectedAnalyticsIncident()?.id ?? "";
}

function stopAnalyticsLiveRefresh() {
  if (!analyticsLiveRefreshTimer) return;

  window.clearInterval(analyticsLiveRefreshTimer);
  analyticsLiveRefreshTimer = null;
  analyticsLiveRefreshInFlight = false;
}

function syncAnalyticsLiveRefresh() {
  if (
    state.activeView !== "incident-analytics" ||
    !state.accessToken
  ) {
    stopAnalyticsLiveRefresh();
    return;
  }

  if (analyticsLiveRefreshTimer) return;

  analyticsLiveRefreshTimer = window.setInterval(() => {
    void refreshActiveAnalytics();
  }, 5000);
}

async function refreshActiveAnalytics() {
  if (
    state.activeView !== "incident-analytics" ||
    analyticsLiveRefreshInFlight ||
    isEditingIncidentSection()
  ) {
    return;
  }

  const incidentId = getSelectedAnalyticsIncidentId();
  if (!incidentId) return;

  analyticsLiveRefreshInFlight = true;

  try {
    await loadSharedData();
    delete state.incidentManagementDetails[incidentId];
    await loadIncidentManagementDetails(incidentId, { renderLoading: false });

    if (state.activeView === "incident-analytics") {
      renderCurrentView();
      bindView();
    }
  } catch (error) {
    console.error(
      "[DCMS Realtime] Unable to refresh incident analytics:",
      error,
    );
  } finally {
    analyticsLiveRefreshInFlight = false;
  }
}

function bindIncidentAnalyticsActions() {
  if (state.activeView !== "incident-analytics") return;

  const selectedIncident = getSelectedAnalyticsIncident();
  const selectedIncidentId = selectedIncident?.id ?? "";
  const select = qs("#analyticsIncidentSelect");

  if (selectedIncidentId && state.analyticsIncidentId !== selectedIncidentId) {
    state.analyticsIncidentId = selectedIncidentId;
  }

  if (select) {
    select.addEventListener("change", async () => {
      state.analyticsIncidentId = select.value;

      if (!state.incidentManagementDetails[select.value]) {
        await loadIncidentManagementDetails(select.value);
      } else {
        renderCurrentView();
        bindView();
      }
    });
  }

  document.querySelectorAll("[data-load-analytics]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.loadAnalytics;
      if (!incidentId) return;

      delete state.incidentManagementDetails[incidentId];
      await loadIncidentManagementDetails(incidentId);
      renderCurrentView();
      bindView();
    });
  });

  bindResponderSafetyViewActions();

  if (
    selectedIncidentId &&
    !state.incidentManagementDetails[selectedIncidentId] &&
    state.loadingIncidentManagementId !== selectedIncidentId
  ) {
    void loadIncidentManagementDetails(selectedIncidentId).then(() => {
      renderCurrentView();
      bindView();
    });
  }
}

function bindIncidentHistoryActions() {
  document.querySelectorAll("[data-view-incident-records]").forEach((button) => {
    if (button.dataset.viewRecordsBound === "true") return;
    button.dataset.viewRecordsBound = "true";

    button.addEventListener("click", () => {
      const incidentId = button.dataset.viewIncidentRecords;
      if (!incidentId) return;

      state.casualtyRecordIncidentFocus = incidentId;
      setActiveView("records");
      renderCurrentView();
      bindView();
    });
  });

  document.querySelectorAll("[data-view-incident-analytics]").forEach((button) => {
    if (button.dataset.viewAnalyticsBound === "true") return;
    button.dataset.viewAnalyticsBound = "true";

    button.addEventListener("click", () => {
      const incidentId = button.dataset.viewIncidentAnalytics;
      if (!incidentId) return;

      state.analyticsIncidentId = incidentId;
      setActiveView("incident-analytics");
      renderCurrentView();
      bindView();
    });
  });
}

function renderDashboardShellIntoExisting() {
  const app = document.getElementById("app");
  app.innerHTML = renderDashboardShell();
  bindShell();
  renderCurrentView();
  bindView();
}

function renderSuperAdminView() {
  switch (state.activeView) {
    case "registration":
      return renderRegistrationShell();
    case "incident-management":
      return renderIncidentManagement();
    case "incident-analytics":
      return renderIncidentAnalytics();
    case "history":
      return renderIncidentHistory();
    case "logs":
      return renderActionLogsShell();
    case "home":
    default:
      return renderSuperAdminHome();
  }
}

function renderAdminView() {
  switch (state.activeView) {
    case "call-down-list":
      return renderCallDownList();
    case "incident-management":
      return renderIncidentManagement();
    case "incident-analytics":
      return renderIncidentAnalytics();
    case "incidents":
      return renderIncidentCreator();
    case "facilities":
      return renderFacilityCreator();
    case "users":
      return renderAdminUnitRegistration();
    case "records":
      return renderAdminCasualtyRecords();
    case "match-casing":
      return renderMatchCasing();
    case "matched-cases":
      return renderMatchedCaseRecords();
    case "drafts":
      return renderDrafts();
    case "verification":
      return renderAdminVerificationReview();
    case "logs":
      return renderAdminActionLogs();
    case "home":
    default:
      return `
        <div class="grid three">
          ${renderMetric("Active incidents", state.dashboard?.activeIncidents ?? 0, "emphasis")}
          ${renderMetric("Pending review", state.dashboard?.pendingRecords ?? 0)}
          ${renderMetric("Verified records", state.dashboard?.verifiedRecords ?? 0)}
        </div>
        <div style="margin-top:18px">${renderOngoingIncidentSummary()}</div>
        <div class="grid two" style="margin-top:18px">
          ${renderAdminScopeCard()}
          ${renderRecentActivity()}
        </div>
        <div class="grid two" style="margin-top:18px">
          ${renderIncidentCreator(true)}
          ${renderAdminCasualtyRecords(true)}
        </div>
      `;
  }
}

function renderMetric(label, value, extraClass = "", caption) {
  return `
    <section class="panel metric ${extraClass}">
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
      <small>${caption || (extraClass ? "Current active system count" : "Updated from mobile records")}</small>
    </section>
  `;
}

function renderSuperAdminHome() {
  return `
    <div class="grid three">
      ${renderMetric("Active incidents", state.dashboard?.activeIncidents ?? 0, "emphasis")}
      ${renderMetric("Encoded today", state.dashboard?.encodedToday ?? 0)}
      ${renderMetric("Pending review", state.dashboard?.pendingRecords ?? 0)}
    </div>
    <div style="margin-top:16px">
      ${renderDataExportPanel(
        "System exports",
        "Download scoped operational datasets. System backup is available only to super admin accounts.",
        [
          {
            label: "Export responders/documenters CSV",
            path: "/exports/responders-documenters.csv",
            fileName: "dcms-responders-documenters.csv",
          },
          {
            label: "Export healthcare facilities CSV",
            path: "/exports/healthcare-facilities.csv",
            fileName: "dcms-healthcare-facilities.csv",
          },
          {
            label: "Download system backup JSON",
            path: "/exports/system-backup.json",
            fileName: "dcms-system-backup.json",
            className: "secondary-button",
          },
        ],
      )}
    </div>
    <div class="grid two" style="margin-top:16px">
      ${renderIncidentSummaryTable()}
      ${renderRecentActivity()}
    </div>
  `;
}

function countRecordsByIncident() {
  const counts = new Map();

  for (const record of state.casualties) {
    const incidentId = record.incident?.id;
    if (!incidentId) continue;

    counts.set(incidentId, (counts.get(incidentId) || 0) + 1);
  }

  return counts;
}

function countByField(rows, getValue) {
  return rows.reduce((counts, row) => {
    const value = getValue(row) || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function renderAnalyticsBars(counts) {
  const entries = Object.entries(counts).sort(
    ([firstLabel, firstCount], [secondLabel, secondCount]) =>
      Number(secondCount) - Number(firstCount) ||
      compareText(firstLabel, secondLabel),
  );
  const max = Math.max(1, ...entries.map(([, count]) => Number(count)));

  return `
    <div class="analytics-bars">
      ${
        entries
          .map(([label, count]) => {
            const width = Math.max(6, (Number(count) / max) * 100);
            return `
              <div class="analytics-bar-row">
                <span>${escapeHtml(roleLabel(label))}</span>
                <div><i style="width:${width}%"></i></div>
                <strong>${escapeHtml(count)}</strong>
              </div>
            `;
          })
          .join("") || `<div class="empty-state">No analytics data available yet.</div>`
      }
    </div>
  `;
}

function formatMinutes(value) {
  if (value === null || value === undefined) return "Not recorded";
  const numeric = Number(value);

  if (Number.isNaN(numeric)) return "Not recorded";
  if (numeric > 0 && numeric < 1) return "<1 minute";

  const rounded = Math.round(numeric);
  const hours = Math.floor(Math.abs(rounded) / 60);
  const minutes = Math.abs(rounded) % 60;
  const sign = rounded < 0 ? "-" : "";
  const parts = [];

  if (hours) parts.push(`${hours} hr`);
  if (minutes || !parts.length) parts.push(`${minutes} min`);

  return `${sign}${parts.join(" ")}`;
}

function formatPercentageLabel(value) {
  const numeric = Number(value || 0);

  return `${numeric % 1 === 0 ? numeric.toFixed(0) : numeric.toFixed(1)}%`;
}

function analyticsIncidentOptions(incidents, selectedId) {
  return incidents
    .map(
      (incident) =>
        `<option value="${escapeHtml(incident.id)}" ${incident.id === selectedId ? "selected" : ""}>${escapeHtml(incident.incident_name)}</option>`,
    )
    .join("");
}

function renderTimelineVisual(analytics) {
  const rawItems = analytics?.timelineVisuals || [];

  const items = rawItems
    .slice()
    .sort((first, second) => {
      const firstTime = first.at
        ? new Date(first.at).getTime()
        : null;

      const secondTime = second.at
        ? new Date(second.at).getTime()
        : null;

      // Both have no recorded time
      if (firstTime === null && secondTime === null) {
        return 0;
      }

      // No recorded time goes to the bottom
      if (firstTime === null) {
        return 1;
      }

      if (secondTime === null) {
        return -1;
      }

      // Earliest -> latest
      return firstTime - secondTime;
    });

  return `
    <section class="panel analytics-wide">
      <div class="panel-header">
        <div>
          <h2>Incident Timeline</h2>
          <p class="panel-subtitle">
            Key milestones extracted from incident, triage, transport,
            HCFD, and responder safety records.
          </p>
        </div>
      </div>

      <div class="table-wrap">
        <table class="incident-timeline-table">

          <thead>
            <tr>
              <th>Time</th>
              <th>Timeline Event</th>
              <th>Date</th>
              
              <th>From DMMP</th>
            </tr>
          </thead>

          <tbody>
            ${
              items.length
                ? items
                    .map(
                      (item) => `
                        <tr class="${
                          item.at
                            ? "timeline-recorded"
                            : "timeline-not-recorded"
                        }">

                          <!-- TIME -->
                          <td class="timeline-time-cell">
                            ${formatTimelineTime(item.at)}
                          </td>

                          <!-- TITLE -->
                          <td class="timeline-event-cell">
                            <div class="timeline-title-cell">

                              <span
                                class="timeline-status-dot ${
                                  item.at ? "complete" : ""
                                }"
                              ></span>

                              <strong>
                                ${escapeHtml(item.label)}
                              </strong>

                            </div>
                          </td>

                          <!-- DATE -->
                          <td class="timeline-date-cell">
                            ${formatTimelineDate(item.at)}
                          </td>



                          <!-- FROM DMMP -->
                          <td>
                            ${escapeHtml(
                              formatMinutes(
                                item.elapsedSinceActivationMinutes
                              )
                            )}
                          </td>

                        </tr>
                      `,
                    )
                    .join("")
                : `
                  <tr>
                    <td colspan="5">
                      <div class="empty-state">
                        No timeline values available yet.
                      </div>
                    </td>
                  </tr>
                `
            }
          </tbody>

        </table>
      </div>
    </section>
  `;
}

function renderPlainTextAnalytics(analytics) {
  const arrival =
    analytics?.durationMetrics?.medianOnsetToFacilityArrivalByCategory || {};
  const stays =
    analytics?.durationMetrics?.healthcareFacilityLengthOfStayMinutes || {};

  return `
    <section class="panel analytics-wide">
      <div class="panel-header">
        <div>
          <h2>Key Performance Indicators</h2>
          <p class="panel-subtitle">Duration metrics derived from facility arrival and HCFD encounter timestamps.</p>
        </div>
      </div>
      ${renderKeyValueSection([
        ["Median incident onset to healthcare facility arrival - Immediate", formatMinutes(arrival.immediate)],
        ["Median incident onset to healthcare facility arrival - Delayed", formatMinutes(arrival.delayed)],
        ["Median incident onset to healthcare facility arrival - Minor", formatMinutes(arrival.minimal)],
        ["Median incident onset to healthcare facility arrival - Expectant", formatMinutes(arrival.expectant)],
        ["Average LOS of immediate victims at healthcare facility", formatMinutes(stays.immediate?.averageMinutes)],
        ["Median LOS of immediate victims at healthcare facility", formatMinutes(stays.immediate?.medianMinutes)],
        ["Average LOS of delayed victims at healthcare facility", formatMinutes(stays.delayed?.averageMinutes)],
        ["Median LOS of delayed victims at healthcare facility", formatMinutes(stays.delayed?.medianMinutes)],
      ])}
    </section>
  `;
}

function normalizeIntervalLabel(row) {
  return row.label || (row.minutes === 60 ? "1 hour" : `${row.minutes} minutes`);
}

function analyticsBarClass(label, colorKey) {
  const key = String(colorKey || label || "").toLowerCase();

  if (["immediate", "red", "critical", "t1"].includes(key)) {
    return "triage-immediate";
  }

  if (["delayed", "yellow", "urgent", "t2"].includes(key)) {
    return "triage-delayed";
  }

  if (["minor", "minimal", "green", "non-urgent", "t3"].includes(key)) {
    return "triage-minor";
  }

  if (["expectant", "black", "dead", "deceased", "t4"].includes(key)) {
    return "triage-expectant";
  }

  if (key === "safe") {
    return "status-safe";
  }

  if (key === "unsafe") {
    return "status-unsafe";
  }

  return "default";
}

function analyticsColorValue(label, colorKey, index = 0) {
  const key = String(colorKey || label || "").toLowerCase();
  const strategyColors = {
    "scoop and run": "#7b1113",
    scooter: "#267abd",
    "stay and play": "#2e7d4f",
    "1+3": "#f0b429",
    "play and run": "#d96d12",
    unknown: "#69758c",
  };
  const fallbackColors = [
    "#7b1113",
    "#267abd",
    "#2e7d4f",
    "#f0b429",
    "#d96d12",
    "#8b5cf6",
    "#64748b",
  ];

  if (["immediate", "red", "critical", "t1"].includes(key)) {
    return "#c92d32";
  }

  if (["delayed", "yellow", "urgent", "t2"].includes(key)) {
    return "#f0b429";
  }

  if (["minor", "minimal", "green", "non-urgent", "t3"].includes(key)) {
    return "#2e7d4f";
  }

  if (["expectant", "black", "dead", "deceased", "t4"].includes(key)) {
    return "#1f2937";
  }

  if (key === "safe") {
    return "#267abd";
  }

  if (key === "unsafe") {
    return "#d96d12";
  }

  if (key === "all" || key === "all victims") {
    return "#267abd";
  }

  return strategyColors[key] || fallbackColors[index % fallbackColors.length];
}

function renderAnalyticsLegend() {
  const items = [
    ["Immediate / Critical", "triage-immediate"],
    ["Delayed / Urgent", "triage-delayed"],
    ["Minor / Non-urgent", "triage-minor"],
    ["Expectant / Dead", "triage-expectant"],
    ["Safe responders", "status-safe"],
    ["Unsafe responders", "status-unsafe"],
    ["Other values", "default"],
  ];

  return `
    <section class="panel analytics-legend">
      <div>
        <h2>Graph legend</h2>
        <p class="panel-subtitle">Colors follow triage category and responder safety meaning where applicable.</p>
      </div>
      <div class="analytics-legend-items">
        ${items
          .map(
            ([label, className]) => `
              <span><i class="${className}"></i>${escapeHtml(label)}</span>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAnalyticsPieChart(rows, options = {}) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);

  if (total <= 0) {
    return `<div class="empty-state">No pie chart data available yet.</div>`;
  }

  let cursor = 0;
  const segments = [];
  const labels = [];

  rows.forEach((row, index) => {
    const value = Math.max(0, row.value);
    const start = cursor;
    const size = (value / total) * 100;
    cursor += size;
    const middle = start + size / 2;
    const radians = (middle / 100) * Math.PI * 2 - Math.PI / 2;
    const distance = 33;
    const x = 50 + Math.cos(radians) * distance;
    const y = 50 + Math.sin(radians) * distance;
    const percentage =
      total > 0 ? Math.round((value / total) * 1000) / 10 : 0;

    segments.push(
      `${analyticsColorValue(row.label, options.colorKey, index)} ${start}% ${cursor}%`,
    );

    if (percentage >= 5) {
      labels.push(`
        <span
          class="analytics-pie-label"
          style="left:${x}%; top:${y}%"
        >
          ${percentage % 1 === 0 ? percentage.toFixed(0) : percentage}%
        </span>
      `);
    }
  });

  return `
    <div class="analytics-pie-wrap">
      <div
        class="analytics-pie"
        style="background: conic-gradient(${segments.join(", ")})"
        role="img"
        aria-label="Pie chart showing ${escapeHtml(String(total))} total records"
      >
        ${labels.join("")}
      </div>
      <div class="analytics-pie-legend">
        ${rows
          .map((row, index) => {
            const percentage = total > 0 ? Math.round((row.value / total) * 1000) / 10 : 0;
            const fallbackDetail = `${row.value} (${formatPercentageLabel(percentage)})`;
            const detail =
              row.detail && row.detail !== String(row.value)
                ? row.detail
                : fallbackDetail;

            return `
              <div class="analytics-pie-legend-row">
                <i style="background:${analyticsColorValue(row.label, options.colorKey, index)}"></i>
                <span>${escapeHtml(roleLabel(row.label))}</span>
                <strong>${escapeHtml(detail)}</strong>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function compactAxisLabel(label) {
  const normalized = String(label || "");

  if (normalized.endsWith(" minutes")) {
    return `${normalized.replace(" minutes", "")}m`;
  }

  if (normalized === "1 hour") {
    return "1h";
  }

  if (normalized.endsWith(" hours")) {
    return `${normalized.replace(" hours", "")}h`;
  }

  return roleLabel(normalized);
}

function renderAnalyticsAxisBarChart(rows, options = {}) {
  if (!rows.length) {
    return `<div class="empty-state">No bar chart data available yet.</div>`;
  }

  const ticks = [100, 75, 50, 25, 0];

  return `
    <div class="analytics-axis-chart">
      <div class="analytics-axis-y-title">Percentage</div>
      <div class="analytics-axis-body">
        <div class="analytics-axis-ticks">
          ${ticks.map((tick) => `<span>${tick}%</span>`).join("")}
        </div>
        <div class="analytics-axis-plot">
          <div class="analytics-axis-bars-row">
            ${rows
              .map((row) => {
                const value = Math.max(0, Math.min(100, row.value));
                const colorClass = analyticsBarClass(
                  row.label,
                  options.colorKey,
                );

                return `
                  <div class="analytics-axis-bar-item">
                    <div
                      class="analytics-axis-bar ${colorClass}"
                      style="height:${value}%"
                    >
                      <span>${escapeHtml(row.detail)}</span>
                    </div>
                    <small>${escapeHtml(compactAxisLabel(row.label))}</small>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      </div>
      <div class="analytics-axis-x-title">${escapeHtml(options.xAxisLabel || "Minutes")}</div>
    </div>
  `;
}

function renderAnalyticsSection(title, subtitle, content) {
  return `
    <section class="analytics-section">
      <div class="analytics-section-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
        </div>
      </div>
      ${content}
    </section>
  `;
}

function renderAnalyticsLineChart(title, series, options = {}) {
  const allowedIntervalMinutes = new Set([15, 30, 60, 120, 180]);
  const normalizedSeries = (series || [])
    .map((item, index) => ({
      key: item.key || item.label || `series-${index}`,
      label: item.label || item.key || `Series ${index + 1}`,
      data: Array.isArray(item.data)
        ? item.data.filter((row) =>
            allowedIntervalMinutes.has(Number(row.minutes)),
          )
        : [],
    }))
    .filter((item) => item.data.length);
  const hasKnownDenominator = normalizedSeries.some((item) =>
    item.data.some((row) => Number(row.total || 0) > 0),
  );
  const hasActivationReference = normalizedSeries.some((item) =>
    item.data.some((row) => row.cutoffAt),
  );

  if (!normalizedSeries.length || !hasKnownDenominator || !hasActivationReference) {
    return `
      <section class="panel analytics-graph-card">
        <div class="panel-header">
          <div>
            <h2>${escapeHtml(title)}</h2>
            ${options.note ? `<p class="panel-subtitle">${escapeHtml(options.note)}</p>` : ""}
          </div>
        </div>
        <div class="empty-state">${hasKnownDenominator ? "DMMP activation time is not recorded yet." : "No line graph data available yet."}</div>
      </section>
    `;
  }

  const width = 640;
  const height = 300;
  const padding = { top: 24, right: 30, bottom: 48, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const yTicks = [100, 75, 50, 25, 0];
  const labels = normalizedSeries[0].data.map((row) =>
    compactAxisLabel(normalizeIntervalLabel(row)),
  );
  const pointX = (index) =>
    padding.left +
    (labels.length <= 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);
  const pointY = (percentage) =>
    padding.top + ((100 - Math.max(0, Math.min(100, percentage))) / 100) * plotHeight;
  const lineMarkup = normalizedSeries
    .map((item, seriesIndex) => {
      const color = analyticsColorValue(item.label, item.key, seriesIndex);
      const points = item.data.map((row, pointIndex) => {
        const percentage = Number(row.percentage || 0);

        return {
          x: pointX(pointIndex),
          y: pointY(percentage),
          percentage,
          count: Number(row.count || 0),
          total: Number(row.total || 0),
          label: normalizeIntervalLabel(row),
        };
      });
      const pointString = points
        .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(" ");

      return `
        <polyline points="${pointString}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${points
          .map(
            (point) => `
              <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="5.5" fill="#fff" stroke="${color}" stroke-width="3">
                <title>${escapeHtml(`${item.label} at ${point.label}: ${formatPercentageLabel(point.percentage)} (${point.count}/${point.total})`)}</title>
              </circle>
            `,
          )
          .join("")}
      `;
    })
    .join("");

  return `
    <section class="panel analytics-graph-card analytics-line-card">
      <div class="panel-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${options.note ? `<p class="panel-subtitle">${escapeHtml(options.note)}</p>` : ""}
        </div>
      </div>
      <div class="analytics-line-chart">
        <div class="analytics-line-frame">
          <svg class="analytics-line-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)} line graph">
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="analytics-line-axis"></line>
            <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="analytics-line-axis"></line>
            ${yTicks
              .map((tick) => {
                const y = pointY(tick);

                return `
                  <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="analytics-line-grid"></line>
                  <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="analytics-line-tick">${tick}%</text>
                `;
              })
              .join("")}
            ${labels
              .map((label, index) => {
                const x = pointX(index);

                return `
                  <line x1="${x}" y1="${height - padding.bottom}" x2="${x}" y2="${height - padding.bottom + 7}" class="analytics-line-axis"></line>
                  <text x="${x}" y="${height - padding.bottom + 27}" text-anchor="middle" class="analytics-line-tick">${escapeHtml(label)}</text>
                `;
              })
              .join("")}
            <text x="18" y="${padding.top + plotHeight / 2}" text-anchor="middle" class="analytics-line-axis-label" transform="rotate(-90 18 ${padding.top + plotHeight / 2})">Cumulative percentage</text>
            <text x="${padding.left + plotWidth / 2}" y="${height - 8}" text-anchor="middle" class="analytics-line-axis-label">${escapeHtml(options.xAxisLabel || "Minutes after DMMP activation")}</text>
            ${lineMarkup}
          </svg>
        </div>
        <div class="analytics-line-legend">
          ${normalizedSeries
            .map((item, index) => `
              <span><i style="background:${analyticsColorValue(item.label, item.key, index)}"></i>${escapeHtml(roleLabel(item.label))}</span>
            `)
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function getAnalyticsLineGraphs(analytics) {
  const lineGraphs = analytics?.lineGraphs;
  const graphs = analytics?.barGraphs || {};

  return lineGraphs || {
    primaryTriageByActivation: [
      { key: "immediate", label: "Immediate", data: graphs.immediatePrimaryTriageByActivation || [] },
      { key: "delayed", label: "Delayed", data: graphs.delayedPrimaryTriageByActivation || [] },
    ],
    stabilizationByActivation: [
      { key: "immediate", label: "Immediate", data: graphs.immediateStabilizedByActivation || [] },
      { key: "delayed", label: "Delayed", data: graphs.delayedStabilizedByActivation || [] },
    ],
    departedAndArrivedByActivation: [
      { key: "immediate", label: "Immediate", data: graphs.immediateDepartedAndArrivedByActivation || [] },
      { key: "delayed", label: "Delayed", data: graphs.delayedDepartedAndArrivedByActivation || [] },
    ],
    facilityArrivalByActivation: [
      { key: "all", label: "All victims", data: graphs.facilityArrivalByActivation || [] },
    ],
  };
}

function renderAnalyticsGraphSection(title, data, options = {}) {
  const rows = Array.isArray(data)
    ? data.map((row) => ({
        label: normalizeIntervalLabel(row),
        value: Number(options.chart === "pie" ? row.count ?? row.percentage ?? 0 : row.percentage ?? row.count ?? 0),
        detail:
          row.percentage !== undefined
            ? `${row.percentage}% (${row.count}/${row.total})`
            : String(row.count ?? 0),
      }))
    : Object.entries(data || {}).map(([label, value]) => {
      if (value && typeof value === "object") {
          return {
            label,
            value: Number(options.chart === "pie" ? value.count ?? value.percentage ?? 0 : value.percentage ?? value.count ?? 0),
            detail:
              value.percentage !== undefined
                ? `${value.percentage}% (${value.count}/${value.total})`
                : String(value.count ?? 0),
          };
        }

        return {
          label,
          value: Number(value || 0),
          detail: String(value || 0),
        };
      });
  const max = Math.max(
    options.percent ? 100 : 1,
    ...rows.map((row) => row.value),
  );
  const graphBody =
    options.chart === "pie"
      ? renderAnalyticsPieChart(rows, options)
      : options.percent
        ? renderAnalyticsAxisBarChart(rows, options)
      : `
        <div class="analytics-bars">
          ${
            rows
              .map((row) => {
                const width = Math.max(4, (row.value / max) * 100);
                const colorClass = analyticsBarClass(row.label, options.colorKey);
                return `
                  <div class="analytics-bar-row">
                    <span>${escapeHtml(roleLabel(row.label))}</span>
                    <div><i class="${colorClass}" style="width:${width}%"></i></div>
                    <strong>${escapeHtml(row.detail)}</strong>
                  </div>
                `;
              })
              .join("") || `<div class="empty-state">No graph data available yet.</div>`
          }
        </div>
      `;

  return `
    <section class="panel analytics-graph-card">
      <div class="panel-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${options.note ? `<p class="panel-subtitle">${escapeHtml(options.note)}</p>` : ""}
        </div>
      </div>
      ${graphBody}
    </section>
  `;
}

function renderTertiaryTriageSystemCharts(graphs) {
  const systems = [
    ["esi", "Victims Using ESI Tertiary Triage"],
    ["metts", "Victims Using METTS Tertiary Triage"],
    ["ed_triage", "Victims Using ED Triage"],
  ];
  const charts = graphs.tertiaryTriageBySystem || {};

  return systems
    .map(([key, title]) => {
      const chart = charts[key] || {};
      const data = Number(chart.total || 0) > 0 ? chart.counts : {};

      return renderAnalyticsGraphSection(title, data, { chart: "pie" });
    })
    .join("");
}

function renderAnalyticsGraphGrid(analytics, incidentId) {
  const graphs = analytics?.barGraphs || {};
  const lineGraphs = getAnalyticsLineGraphs(analytics);
  const cumulativeNote = "Cumulative after disaster plan activation: 15 minutes, 30 minutes, 1 hour, 2 hours, and 3 hours.";

  return `
    ${renderAnalyticsSection(
      "Triage & Patient Distribution",
      "Primary triage, secondary triage, and ED-care distribution with count and percentage labels.",
      `<div class="analytics-graph-grid">
        ${renderAnalyticsGraphSection("Immediate, Delayed, Minor, and Expectant Victims Using Primary Triage", graphs.primaryTriageByCategory, { chart: "pie" })}
        ${renderAnalyticsGraphSection("Immediate, Delayed, Minor, and Expectant Victims Using Secondary Triage", graphs.secondaryTriageByCategory, { chart: "pie" })}
        ${renderAnalyticsGraphSection("Victims Seeking ED Care According to Triage Category", graphs.edCareByTriageCategory, { chart: "pie" })}
        ${renderTertiaryTriageSystemCharts(graphs)}
      </div>`,
    )}
    ${renderAnalyticsSection(
      "Treatment / Stabilization & Responder Safety",
      "Stabilization strategies and responder safety responses for the selected incident.",
      `<div class="analytics-graph-grid">
        ${renderAnalyticsGraphSection("Victims Stabilized Using Each Evacuation Strategy", graphs.stabilizationStrategies, { chart: "pie" })}
        ${renderAnalyticsGraphSection("Safe and Unsafe Responders", graphs.responderSafety, { chart: "pie", viewResponders: true, incidentId })}
      </div>`,
    )}
    ${renderAnalyticsSection(
      "Time-to-Action / Cumulative Progress",
      cumulativeNote,
      `<div class="analytics-graph-grid">
        ${renderAnalyticsLineChart("Immediate and Delayed Victims Primary Triaged", lineGraphs.primaryTriageByActivation, { note: cumulativeNote })}
        ${renderAnalyticsLineChart("Immediate and Delayed Victims Stabilized in the Stabilization Area", lineGraphs.stabilizationByActivation, { note: cumulativeNote })}
        ${renderAnalyticsLineChart("Immediate and Delayed Victims Departed Scene and Arrived at a Healthcare Facility", lineGraphs.departedAndArrivedByActivation, { note: cumulativeNote })}
        ${renderAnalyticsLineChart("Victims Arriving at a Healthcare Facility", lineGraphs.facilityArrivalByActivation, { note: cumulativeNote })}
      </div>`,
    )}
  `;
}

function renderResponderSafetyRow(item) {
  const responder = item.responder || {};
  const name = responder.full_name || "Unknown responder";
  const roleAndFunction = [roleLabel(item.responder_role), roleLabel(item.responder_function)]
    .filter(Boolean)
    .join(" - ");
  const isSafe = item.safety_status === "yes";

  return `
    <tr>
      <td>
        <strong>${escapeHtml(name)}</strong>
        <div class="table-subtext">${escapeHtml(responder.email || "")}</div>
      </td>
      <td>${escapeHtml(roleAndFunction || "Not recorded")}</td>
      <td>
        <span class="pill ${isSafe ? "green" : "red"}">${isSafe ? "Safe" : "Unsafe"}</span>
      </td>
      <td>${escapeHtml(formatDate(item.recorded_at))}</td>
      <td>
        <select data-responder-safety-select="${escapeHtml(item.id)}">
          <option value="yes" ${isSafe ? "selected" : ""}>Safe</option>
          <option value="no" ${!isSafe ? "selected" : ""}>Unsafe</option>
        </select>
      </td>
    </tr>
  `;
}

function renderResponderSafetyModal(incidentId, responders) {
  const rows = responders.length
    ? responders.map(renderResponderSafetyRow).join("")
    : `<tr><td colspan="5"><div class="empty-state">No responder safety responses recorded for this incident yet.</div></td></tr>`;

  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="record-modal" role="dialog" aria-modal="true" aria-labelledby="responderSafetyModalTitle">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Incident Analytics</span>
            <h2 id="responderSafetyModalTitle">Responders</h2>
            <p>Review and update each responder's safety status for this incident.</p>
          </div>
          <button class="icon-button" type="button" data-close-modal aria-label="Close responders list">&times;</button>
        </div>
        <div class="modal-body">
          <div id="responderSafetyModalMessage" class="status-message" hidden></div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Responder</th>
                <th>Role / Function</th>
                <th>Current status</th>
                <th>Recorded</th>
                <th>Update status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="modal-footer">
          <div class="modal-footer-spacer"></div>
          <button class="ghost-button" type="button" data-close-modal>Close</button>
        </div>
      </section>
    </div>
  `;
}

async function openResponderSafetyModal(incidentId) {
  if (!incidentId) return;

  closeRecordModal();
  document.body.insertAdjacentHTML(
    "beforeend",
    renderResponderSafetyModal(incidentId, []),
  );
  bindResponderSafetyModalCloseActions();
  setMessage("responderSafetyModalMessage", "Loading responders...");

  try {
    const result = await apiRequest(
      `/incidents/${encodeURIComponent(incidentId)}/responder-safety-responses`,
    );
    const responders = result?.data ?? [];

    if (!qs(".modal-backdrop")) return;

    document.querySelector(".modal-backdrop")?.replaceWith(
      document
        .createRange()
        .createContextualFragment(
          renderResponderSafetyModal(incidentId, responders),
        ),
    );
    bindResponderSafetyModalCloseActions();
    bindResponderSafetySelects(incidentId);
  } catch (error) {
    setMessage(
      "responderSafetyModalMessage",
      error.message || "Unable to load responders.",
      "error",
    );
  }
}

function bindResponderSafetyModalCloseActions() {
  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    if (element.dataset.closeBound === "true") return;
    element.dataset.closeBound = "true";

    element.addEventListener("click", (event) => {
      if (event.target === element || element.matches("button")) {
        closeRecordModal();
      }
    });
  });
}

function bindResponderSafetySelects(incidentId) {
  document.querySelectorAll("[data-responder-safety-select]").forEach((select) => {
    select.addEventListener("change", async () => {
      const responseId = select.dataset.responderSafetySelect;
      const safetyStatus = select.value;
      const row = select.closest("tr");
      select.disabled = true;

      try {
        await apiRequest(
          `/incidents/${encodeURIComponent(incidentId)}/responder-safety-responses/${encodeURIComponent(responseId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ safetyStatus }),
          },
        );

        if (row) {
          const statusPill = row.querySelector(".pill");
          if (statusPill) {
            const isSafe = safetyStatus === "yes";
            statusPill.textContent = isSafe ? "Safe" : "Unsafe";
            statusPill.classList.toggle("green", isSafe);
            statusPill.classList.toggle("red", !isSafe);
          }
        }

        setMessage("responderSafetyModalMessage", "Status updated.", "success");

        delete state.incidentManagementDetails[incidentId];
      } catch (error) {
        setMessage(
          "responderSafetyModalMessage",
          error.message || "Unable to update responder status.",
          "error",
        );
      } finally {
        select.disabled = false;
      }
    });
  });
}

function bindResponderSafetyViewActions() {
  document.querySelectorAll("[data-view-responders]").forEach((button) => {
    if (button.dataset.viewResponsersBound === "true") return;
    button.dataset.viewResponsersBound = "true";

    button.addEventListener("click", () => {
      openResponderSafetyModal(button.dataset.viewResponders);
    });
  });
}

function renderIncidentAnalytics() {
  const incidents = getAnalyticsIncidents();
  const selectedIncident = getSelectedAnalyticsIncident();
  const selectedIncidentId = selectedIncident?.id ?? "";
  const details = selectedIncidentId
    ? state.incidentManagementDetails[selectedIncidentId]
    : null;
  const isLoading = state.loadingIncidentManagementId === selectedIncidentId;
  const analytics = details?.analytics?.data;
  const casualtyCounts = countRecordsByIncident();
  const selectedIncidentRecords = state.casualties.filter(
    (record) => record.incident?.id === selectedIncidentId,
  );
  const totalCasualties =
    analytics?.casualtyRecords ??
    analytics?.totalVictims ??
    selectedIncidentRecords.length;
  const verifiedRecords =
    analytics?.verifiedRecords ??
    selectedIncidentRecords.filter(
    (record) => record.verification_status === "verified",
  ).length;
  const pendingRecords =
    analytics?.pendingReview ??
    selectedIncidentRecords.filter((record) =>
      ["submitted", "under_review"].includes(record.verification_status),
    ).length;
  const incidentDateSource =
  details?.timeline?.data?.disaster_occurred_at ||
  selectedIncident?.started_at ||
  selectedIncident?.created_at ||
  null;

const incidentDateObject = incidentDateSource
  ? new Date(incidentDateSource)
  : null;

const incidentDateLabel =
  incidentDateObject &&
  !Number.isNaN(incidentDateObject.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(incidentDateObject)
    : "Not recorded";

const incidentLocation = selectedIncident
  ? formatLocation(
      selectedIncident.description,
      selectedIncident.barangay,
      selectedIncident.municipality,
      selectedIncident.province,
    )
  : "Not recorded";

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Incident Analytics</h2>
          <p class="panel-subtitle">Read-only timeline, duration, and graph summaries for one incident.</p>
        </div>
        <button class="ghost-button" type="button" data-load-analytics="${escapeHtml(selectedIncidentId)}" ${!selectedIncidentId || isLoading ? "disabled" : ""}>
          ${isLoading ? "Loading..." : "Refresh Analytics"}
        </button>
      </div>
      <label class="field">
        <span>Select incident</span>
        <select id="analyticsIncidentSelect">
          ${analyticsIncidentOptions(incidents, selectedIncidentId)}
        </select>
      </label>
    </section>
    <section class="panel analytics-incident-summary">

  <!-- INCIDENT INFORMATION -->
  <div class="analytics-incident-details">

    <div class="analytics-incident-detail">
      <span>Incident Name</span>
      <strong>
        ${escapeHtml(
          selectedIncident?.incident_name || "Not recorded"
        )}
      </strong>
    </div>

    <div class="analytics-incident-detail">
      <span>Date of Incident</span>
      <strong>${escapeHtml(incidentDateLabel)}</strong>
    </div>

    <div class="analytics-incident-detail">
      <span>Location</span>
      <strong>${escapeHtml(incidentLocation)}</strong>
    </div>

  </div>


  <!-- SMALL SUMMARY BOXES -->
  <div class="analytics-compact-stats">

    <div class="analytics-compact-stat">
      <span>Selected Incident</span>

      <strong>
        ${selectedIncident ? 1 : 0}
      </strong>

      <small>
        ${
          selectedIncident
            ? `Status: ${escapeHtml(roleLabel(selectedIncident.status))}`
            : "No incident selected"
        }
      </small>
    </div>


    <div class="analytics-compact-stat">
      <span>Casualty Records</span>
      <strong>${totalCasualties}</strong>
      <small>For selected incident</small>
    </div>


    <div class="analytics-compact-stat">
      <span>Verified Records</span>
      <strong>${verifiedRecords}</strong>
      <small>For selected incident</small>
    </div>


    <div class="analytics-compact-stat">
      <span>Pending Review</span>
      <strong>${pendingRecords}</strong>
      <small>For selected incident</small>
    </div>

  </div>

</section>
    ${
      !selectedIncident
        ? `<section class="panel" style="margin-top:18px"><div class="empty-state">No incidents available for analytics.</div></section>`
        : isLoading || !analytics
          ? `<section class="panel" style="margin-top:18px"><div class="empty-state">${isLoading ? "Loading analytics..." : "Analytics data is not loaded yet."}</div></section>`
          : `
            <div style="margin-top:18px">${renderTimelineVisual(analytics)}</div>
            <div style="margin-top:18px">${renderPlainTextAnalytics(analytics)}</div>
            <div style="margin-top:18px">${renderAnalyticsGraphGrid(analytics, selectedIncidentId)}</div>
          `
    }
  `;
}

function getOngoingIncidents() {
  return state.incidents
    .filter((incident) => incident.status === "active")
    .slice(0, 6);
}

function renderOngoingIncidentSummary() {
  const ongoingIncidents = getOngoingIncidents();

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Ongoing incident summary</h2>
          <p class="panel-subtitle">Quick information cards for active incidents available to mobile responders.</p>
        </div>
      </div>
      <div class="incident-card-grid">
        ${
          ongoingIncidents
            .map((incident) => {
              const casualtiesReported = state.recentActivity.filter(
                (item) => item.incident?.id === incident.id,
              ).length;
              const location = [
                incident.barangay,
                incident.municipality,
                incident.province,
              ]
                .filter(Boolean)
                .join(", ");

              return `
                <article class="incident-info-card">
                  <div class="incident-info-top">
                    <span class="pill green">Ongoing</span>
                    <strong>${escapeHtml(incident.incident_code)}</strong>
                  </div>
                  <h3>${escapeHtml(incident.incident_name)}</h3>
                  <dl>
                    <div><dt>Location</dt><dd>${escapeHtml(location || "Not specified")}</dd></div>
                    <div><dt>Time started</dt><dd>${formatDate(incident.started_at)}</dd></div>
                    <div><dt>Casualties reported</dt><dd>${casualtiesReported}</dd></div>
                    <div><dt>Status</dt><dd>Ongoing</dd></div>
                  </dl>
                </article>
              `;
            })
            .join("") || `<div class="empty-state">No ongoing incidents.</div>`
        }
      </div>
    </section>
  `;
}

function renderAdminScopeCard() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Admin unit scope</h2>
          <p class="panel-subtitle">Requested admin tools for managing users, records, reviews, and audit trails.</p>
        </div>
      </div>
      <div class="scope-list">
        <button class="scope-item" data-view-link="users"><strong>Accounts</strong><span>Register and manage FR, AMP, and HCFD accounts in this unit.</span></button>
        <button class="scope-item" data-view-link="incident-analytics"><strong>Reported incident history</strong><span>Review incident analytics for records created within this unit.</span></button>
        <button class="scope-item" data-view-link="records"><strong>Casualty records</strong><span>See a summary of all casualty entries.</span></button>
        <button class="scope-item" data-view-link="match-casing"><strong>Match Casing</strong><span>Build complete FR, AMP, and HCFD matched cases.</span></button>
        <button class="scope-item" data-view-link="matched-cases"><strong>Matched Cases</strong><span>Review completed matched casualty case records.</span></button>
        <button class="scope-item" data-view-link="logs"><strong>Action logs</strong><span>Audit actions by users this admin created.</span></button>
        <button class="scope-item" data-view-link="verification"><strong>Verification review</strong><span>Review casualty entries from assigned responders.</span></button>
      </div>
    </section>
  `;
}

function renderIncidentSummaryTable() {
  const rows = state.incidents.map((incident) => {
    const activityCount = state.recentActivity.filter(
      (item) => item.incident?.id === incident.id,
    ).length;
    return `
      <tr>
        <td><strong>${escapeHtml(incident.incident_name)}</strong><br><span class="panel-subtitle">${escapeHtml(incident.incident_code)}</span></td>
        <td>${escapeHtml(incident.disaster_type)}</td>
        <td><span class="pill green">${escapeHtml(incident.status)}</span></td>
        <td>${activityCount}</td>
        <td>${formatDate(incident.started_at)}</td>
      </tr>
    `;
  });

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Entries per incident</h2>
          <p class="panel-subtitle">Uses current incident list and recent casualty activity.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Incident</th><th>Hazard</th><th>Status</th><th>Recent entries</th><th>Started</th></tr></thead>
          <tbody>${rows.join("") || `<tr><td colspan="5"><div class="empty-state">No incidents found.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPasswordField({
  name = "password",
  label = "Password",
  placeholder = "",
  autocomplete = "new-password",
  required = false,
  minlength = 6,
} = {}) {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <div class="password-input-wrap">
        <input
          name="${escapeHtml(name)}"
          type="password"
          ${required ? "required" : ""}
          ${minlength ? `minlength="${escapeHtml(minlength)}"` : ""}
          autocomplete="${escapeHtml(autocomplete)}"
          ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ""}
        />
        <button
          class="password-toggle"
          type="button"
          data-toggle-password
          aria-label="Show password"
        >
          Show
        </button>
      </div>
    </label>
  `;
}

function bindPasswordVisibilityToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    if (button.dataset.passwordToggleBound === "true") return;
    button.dataset.passwordToggleBound = "true";

    button.addEventListener("click", () => {
      const wrapper = button.closest(".password-input-wrap");
      const input = wrapper?.querySelector("input");

      if (!input) {
        return;
      }

      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      button.textContent = shouldShow ? "Hide" : "Show";
      button.setAttribute(
        "aria-label",
        shouldShow ? "Hide password" : "Show password",
      );
    });
  });
}

const bulkImportConfigs = {
  adminAccounts: {
    endpoint: "/auth/bulk-register-admins",
    fileName: "admin-accounts-template.csv",
    messageId: "adminBulkImportMessage",
    headers: [
      "fullName",
      "email",
      "password",
      "role",
      "phoneNumber",
      "assignedMunicipality",
      "assignedBarangay",
    ],
    sampleRows: [
      [
        "Juan Dela Cruz",
        "admin@example.com",
        "Temporary123",
        "administrator",
        "09171234567",
        "Manila",
        "Ermita",
      ],
    ],
  },
  unitAccounts: {
    endpoint: "/auth/bulk-register-unit-users",
    fileName: "unit-accounts-template.csv",
    messageId: "unitBulkImportMessage",
    headers: [
      "fullName",
      "email",
      "password",
      "role",
      "phoneNumber",
      "assignedMunicipality",
      "assignedBarangay",
    ],
    sampleRows: [
      [
        "Field Responder One",
        "fr@example.com",
        "Temporary123",
        "field_responder",
        "09171234567",
        state.user?.assigned_municipality || "Manila",
        state.user?.assigned_barangay || "Ermita",
      ],
      [
        "Advanced Medical Responder One",
        "amp@example.com",
        "Temporary123",
        "sa_responder",
        "09171234568",
        state.user?.assigned_municipality || "Manila",
        state.user?.assigned_barangay || "Ermita",
      ],
      [
        "HCFD One",
        "hcfd@example.com",
        "Temporary123",
        "documenter",
        "09171234569",
        state.user?.assigned_municipality || "Manila",
        state.user?.assigned_barangay || "Ermita",
      ],
    ],
  },
  healthcareFacilities: {
    endpoint: "/healthcare-facilities/bulk",
    fileName: "healthcare-facilities-template.csv",
    messageId: "facilityBulkImportMessage",
    headers: [
      "facilityName",
      "facilityLevel",
      "address",
      "barangay",
      "municipality",
      "province",
      "contactPerson",
      "contactNumber",
      "latitude",
      "longitude",
    ],
    sampleRows: [
      [
        "Sample General Hospital",
        "tertiary",
        "123 Hospital Road",
        "Ermita",
        "Manila",
        "Metro Manila",
        "Maria Santos",
        "09171234567",
        "",
        "",
      ],
    ],
  },
  evacuationCenters: {
    endpoint: "/evacuation-centers/bulk",
    fileName: "evacuation-centers-template.csv",
    messageId: "evacuationBulkImportMessage",
    headers: [
      "incidentId",
      "incidentCode",
      "incidentName",
      "centerName",
      "capacity",
      "address",
      "barangay",
      "municipality",
      "province",
      "contactPerson",
      "contactNumber",
      "latitude",
      "longitude",
    ],
    sampleRows: [
      [
        state.incidents[0]?.id || "",
        state.incidents[0]?.incident_code || "",
        state.incidents[0]?.incident_name || "Incident Name",
        "Sample Evacuation Center",
        "150",
        "Covered Court",
        "Ermita",
        "Manila",
        "Metro Manila",
        "Juan Santos",
        "09171234567",
        "",
        "",
      ],
    ],
  },
};

function renderBulkImportPanel(type, title, subtitle) {
  const config = bulkImportConfigs[type];

  return `
    <section class="bulk-import-panel">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p class="panel-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="bulk-import-actions">
        <button class="ghost-button mini" type="button" data-download-template="${escapeHtml(type)}">
          Download CSV template
        </button>
        <label class="secondary-button mini bulk-file-button">
          Upload Excel/CSV
          <input type="file" accept=".csv,.xlsx,.xls" data-bulk-import="${escapeHtml(type)}" hidden />
        </label>
      </div>
      <div id="${escapeHtml(config.messageId)}" class="status-message" hidden></div>
      <div id="${escapeHtml(type)}BulkPreview" class="bulk-preview-slot">
        ${renderBulkImportPreview(type)}
      </div>
    </section>
  `;
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function normalizeImportKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeCompositeImportKey(values) {
  return values.map(normalizeImportKey).join("|");
}

function isImportEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidLatitude(value) {
  return (
    value === undefined ||
    (Number.isFinite(value) && value >= -90 && value <= 90)
  );
}

function isValidLongitude(value) {
  return (
    value === undefined ||
    (Number.isFinite(value) && value >= -180 && value <= 180)
  );
}

function isValidWholeNumber(value) {
  return (
    value === undefined ||
    (Number.isInteger(value) && value >= 0)
  );
}

function getImportIncident(row) {
  const incidentId = normalizeImportKey(row.incidentId);
  const incidentCode = normalizeImportKey(row.incidentCode);
  const incidentName = normalizeImportKey(row.incidentName);

  return state.allIncidents.find((incident) => {
    return (
      (incidentId && normalizeImportKey(incident.id) === incidentId) ||
      (incidentCode && normalizeImportKey(incident.incident_code) === incidentCode) ||
      (incidentName && normalizeImportKey(incident.incident_name) === incidentName)
    );
  });
}

async function getExistingBulkImportKeys(type) {
  if (type === "adminAccounts") {
    try {
      const response = await apiRequest("/auth/accounts");
      return new Set(
        (response.data || [])
          .map((account) => normalizeImportKey(account.email))
          .filter(Boolean),
      );
    } catch {
      return new Set();
    }
  }

  if (type === "unitAccounts") {
    return new Set(
      state.unitUsers
        .map((account) => normalizeImportKey(account.email))
        .filter(Boolean),
    );
  }

  if (type === "healthcareFacilities") {
    return new Set(
      state.healthcareFacilities
        .map((facility) =>
          normalizeCompositeImportKey([
            facility.facility_name,
            facility.municipality,
            facility.province,
          ]),
        )
        .filter((key) => key !== "||"),
    );
  }

  if (type === "evacuationCenters") {
    try {
      const response = await apiRequest("/evacuation-centers");
      return new Set(
        (response.data || [])
          .map((center) =>
            normalizeCompositeImportKey([
              center.incident_id,
              center.center_name,
            ]),
          )
          .filter((key) => key !== "|"),
      );
    } catch {
      return new Set();
    }
  }

  return new Set();
}

function getBulkImportRowKey(type, row) {
  if (type === "adminAccounts" || type === "unitAccounts") {
    return normalizeImportKey(row.email);
  }

  if (type === "healthcareFacilities") {
    return normalizeCompositeImportKey([
      row.facilityName,
      row.municipality,
      row.province,
    ]);
  }

  if (type === "evacuationCenters") {
    const incident = getImportIncident(row);
    const incidentKey =
      incident?.id ||
      row.incidentId ||
      row.incidentCode ||
      row.incidentName;

    return normalizeCompositeImportKey([incidentKey, row.centerName]);
  }

  return "";
}

function validateBulkImportRow(type, row) {
  const reasons = [];

  if (type === "adminAccounts") {
    if (!row.fullName) reasons.push("fullName is required.");
    if (!row.email) reasons.push("email is required.");
    if (row.email && !isImportEmail(row.email)) reasons.push("email is invalid.");
    if (!row.password) reasons.push("password is required.");
    if (row.password && row.password.length < 6) {
      reasons.push("password must be at least 6 characters.");
    }
    if (!["administrator", "super_admin"].includes(row.role)) {
      reasons.push("role must be administrator or super_admin.");
    }
  } else if (type === "unitAccounts") {
    if (!row.fullName) reasons.push("fullName is required.");
    if (!row.email) reasons.push("email is required.");
    if (row.email && !isImportEmail(row.email)) reasons.push("email is invalid.");
    if (!row.password) reasons.push("password is required.");
    if (row.password && row.password.length < 6) {
      reasons.push("password must be at least 6 characters.");
    }
    if (!unitAccountRoles.includes(row.role)) {
      reasons.push("role must be field_responder, sa_responder, or documenter.");
    }
    if (!row.phoneNumber) reasons.push("phoneNumber is required.");
    if (!row.assignedMunicipality) {
      reasons.push("assignedMunicipality is required.");
    }
    if (!row.assignedBarangay) reasons.push("assignedBarangay is required.");
  } else if (type === "healthcareFacilities") {
    if (!row.facilityName) reasons.push("facilityName is required.");
    if (
      row.facilityLevel &&
      !["primary", "secondary", "tertiary", "specialized", "unknown"].includes(
        row.facilityLevel,
      )
    ) {
      reasons.push("facilityLevel is invalid.");
    }
    if (!isValidLatitude(row.latitude)) reasons.push("latitude must be from -90 to 90.");
    if (!isValidLongitude(row.longitude)) reasons.push("longitude must be from -180 to 180.");
  } else if (type === "evacuationCenters") {
    if (!row.incidentId && !row.incidentCode && !row.incidentName) {
      reasons.push("incidentId, incidentCode, or incidentName is required.");
    }
    if ((row.incidentId || row.incidentCode || row.incidentName) && !getImportIncident(row)) {
      reasons.push("incident could not be found in visible incidents.");
    }
    if (!row.centerName) reasons.push("centerName is required.");
    if (!isValidWholeNumber(row.capacity)) {
      reasons.push("capacity must be a whole number greater than or equal to 0.");
    }
    if (!isValidLatitude(row.latitude)) reasons.push("latitude must be from -90 to 90.");
    if (!isValidLongitude(row.longitude)) reasons.push("longitude must be from -180 to 180.");
  }

  return reasons;
}

async function buildBulkImportPreview(type, rows, fileName) {
  const existingKeys = await getExistingBulkImportKeys(type);
  const seenKeys = new Map();
  const items = rows.map((row, index) => {
    const rowNumber = index + 2;
    const reasons = validateBulkImportRow(type, row);
    const key = getBulkImportRowKey(type, row);

    if (key && key.replace(/\|/g, "")) {
      if (seenKeys.has(key)) {
        reasons.push(`duplicate of row ${seenKeys.get(key)} in this file.`);
      } else {
        seenKeys.set(key, rowNumber);
      }

      if (existingKeys.has(key)) {
        reasons.push("duplicate of an existing record.");
      }
    }

    const status = reasons.length > 0
      ? reasons.some((reason) => reason.includes("duplicate"))
        ? "duplicate"
        : "invalid"
      : "valid";

    return {
      rowNumber,
      row,
      status,
      reasons,
    };
  });
  const validRows = items.filter((item) => item.status === "valid");
  const duplicateRows = items.filter((item) => item.status === "duplicate");
  const invalidRows = items.filter((item) => item.status === "invalid");

  return {
    type,
    fileName,
    rows,
    items,
    validRows,
    duplicateRows,
    invalidRows,
    failedRows: [...duplicateRows, ...invalidRows],
    imported: false,
    importSummary: null,
  };
}

function getBulkPreviewStatusClass(status) {
  if (status === "valid") return "green";
  if (status === "duplicate") return "orange";
  return "red";
}

function getBulkPreviewStatusLabel(status) {
  if (status === "valid") return "Valid";
  if (status === "duplicate") return "Duplicate";
  return "Invalid";
}

function getBulkPreviewPrimaryValue(type, row) {
  if (type === "adminAccounts" || type === "unitAccounts") {
    return row.email || row.fullName || "Blank row";
  }

  if (type === "healthcareFacilities") {
    return row.facilityName || "Unnamed facility";
  }

  if (type === "evacuationCenters") {
    return row.centerName || "Unnamed evacuation center";
  }

  return "Import row";
}

function renderBulkImportPreview(type) {
  const preview = state.bulkImportPreviews[type];

  if (!preview) {
    return "";
  }

  const rows = preview.items.slice(0, 12).map((item) => `
    <tr>
      <td>${escapeHtml(item.rowNumber)}</td>
      <td><span class="pill ${getBulkPreviewStatusClass(item.status)}">${escapeHtml(getBulkPreviewStatusLabel(item.status))}</span></td>
      <td><strong>${escapeHtml(getBulkPreviewPrimaryValue(type, item.row))}</strong></td>
      <td>${escapeHtml(item.reasons.join(" ") || "Ready to import.")}</td>
    </tr>
  `).join("");
  const hiddenCount = Math.max(preview.items.length - 12, 0);
  const failedCount = preview.failedRows.length;

  return `
    <div class="bulk-preview-card">
      <div class="bulk-preview-header">
        <div>
          <h4>${escapeHtml(preview.fileName || "Import preview")}</h4>
          <p>
            ${preview.validRows.length} valid, ${preview.duplicateRows.length} duplicate, ${preview.invalidRows.length} invalid.
            ${preview.imported && preview.importSummary ? escapeHtml(renderBulkImportSummary(preview.importSummary)) : ""}
          </p>
        </div>
        <div class="bulk-preview-actions">
          ${
            failedCount
              ? `<button class="ghost-button mini" type="button" data-download-bulk-failed="${escapeHtml(type)}">Download correction CSV</button>`
              : ""
          }
          <button class="ghost-button mini" type="button" data-cancel-bulk-preview="${escapeHtml(type)}">Cancel</button>
          ${
            preview.imported
              ? ""
              : `<button class="primary-button mini" type="button" data-confirm-bulk-import="${escapeHtml(type)}" ${preview.validRows.length ? "" : "disabled"}>
                  Import ${escapeHtml(String(preview.validRows.length))} valid row${preview.validRows.length === 1 ? "" : "s"}
                </button>`
          }
        </div>
      </div>
      <div class="table-wrap">
        <table class="bulk-preview-table">
          <thead>
            <tr>
              <th>Row</th>
              <th>Status</th>
              <th>Record</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${
              hiddenCount
                ? `<tr><td colspan="4"><div class="empty-state">${escapeHtml(String(hiddenCount))} more rows hidden from preview. Download the correction file for all blocked rows.</div></td></tr>`
                : ""
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function downloadBulkImportCorrectionFile(type) {
  const config = bulkImportConfigs[type];
  const preview = state.bulkImportPreviews[type];

  if (!config || !preview || preview.failedRows.length === 0) {
    return;
  }

  const csv = [
    [...config.headers, "rowNumber", "status", "reason"].map(csvEscape).join(","),
    ...preview.failedRows.map((item) =>
      [
        ...config.headers.map((header) => item.row[header] ?? ""),
        item.rowNumber,
        getBulkPreviewStatusLabel(item.status),
        item.reasons.join(" "),
      ].map(csvEscape).join(","),
    ),
  ].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = sanitizeFileName(`${type}-corrections.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

function downloadCsvTemplate(type) {
  const config = bulkImportConfigs[type];
  if (!config) return;

  const csv = [
    config.headers.map(csvEscape).join(","),
    ...config.sampleRows.map((row) => row.map(csvEscape).join(",")),
  ].join("\r\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = config.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);

  const headers = (rows.shift() || []).map((header) =>
    String(header).trim(),
  );

  return rows
    .filter((item) =>
      item.some((cell) => String(cell ?? "").trim().length > 0),
    )
    .map((item) =>
      Object.fromEntries(
        headers.map((header, index) => [
          header,
          item[index] ?? "",
        ]),
      ),
    );
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const bulkHeaderAliases = {
  fullname: "fullName",
  name: "fullName",
  email: "email",
  password: "password",
  temporarypassword: "password",
  role: "role",
  phonenumber: "phoneNumber",
  contactnumber: "contactNumber",
  assignedmunicipality: "assignedMunicipality",
  assignedbarangay: "assignedBarangay",
  facilityname: "facilityName",
  facilitylevel: "facilityLevel",
  level: "facilityLevel",
  address: "address",
  barangay: "barangay",
  municipality: "municipality",
  province: "province",
  contactperson: "contactPerson",
  latitude: "latitude",
  longitude: "longitude",
  incidentid: "incidentId",
  incidentcode: "incidentCode",
  incidentname: "incidentName",
  centername: "centerName",
  evacuationcenter: "centerName",
  evacuationcentername: "centerName",
  capacity: "capacity",
};

function normalizeBulkRows(rows) {
  return rows.map((row) => {
    const normalized = {};

    for (const [key, rawValue] of Object.entries(row)) {
      const mappedKey = bulkHeaderAliases[normalizeHeader(key)];

      if (!mappedKey) {
        continue;
      }

      const value =
        rawValue === null || rawValue === undefined
          ? ""
          : String(rawValue).trim();

      if (mappedKey === "role") {
        const normalizedRole = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");

        if (
          normalizedRole.includes("healthcare") ||
          normalizedRole.includes("hcfd") ||
          normalizedRole.includes("documenter")
        ) {
          normalized[mappedKey] = "documenter";
        } else if (
          normalizedRole.includes("advanced medical responder") ||
          normalizedRole.includes("stabilization") ||
          normalizedRole === "sa_responder"
        ) {
          normalized[mappedKey] = "sa_responder";
        } else if (
          normalizedRole.includes("field") ||
          normalizedRole === "fr" ||
          normalizedRole === "field_responder"
        ) {
          normalized[mappedKey] = "field_responder";
        } else if (normalizedRole.includes("responder")) {
          normalized[mappedKey] = "field_responder";
        } else if (normalizedRole === "super_admin") {
          normalized[mappedKey] = "super_admin";
        } else if (
          normalizedRole === "admin" ||
          normalizedRole === "administrator"
        ) {
          normalized[mappedKey] = "administrator";
        } else {
          normalized[mappedKey] = value;
        }
      } else if (mappedKey === "facilityLevel") {
        normalized[mappedKey] = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
      } else if (["capacity"].includes(mappedKey)) {
        normalized[mappedKey] = value ? Number(value) : undefined;
      } else if (["latitude", "longitude"].includes(mappedKey)) {
        normalized[mappedKey] = value ? Number(value) : undefined;
      } else {
        normalized[mappedKey] = value;
      }
    }

    return normalized;
  });
}

async function loadSheetJs() {
  if (window.XLSX) {
    return window.XLSX;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Unable to load Excel parser."));
    document.head.appendChild(script);
  });

  return window.XLSX;
}

async function parseBulkImportFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return normalizeBulkRows(parseCsv(await file.text()));
  }

  const XLSX = await loadSheetJs();
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
  });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, {
    defval: "",
  });

  return normalizeBulkRows(rows);
}

function renderBulkImportSummary(data) {
  const results = data?.results || [];
  const failed = results
    .filter((result) => !result.success && !result.skipped)
    .slice(0, 5)
    .map((result) => `Row ${result.rowNumber}: ${result.message}`)
    .join(" | ");

  return [
    `Created: ${data?.created ?? 0}`,
    `Skipped: ${data?.skipped ?? 0}`,
    `Failed: ${data?.failed ?? 0}`,
    failed,
  ]
    .filter(Boolean)
    .join(". ");
}

function bulkImportTypeLabel(type) {
  const labels = {
    adminAccounts: "admin accounts",
    unitAccounts: "FR, SAR, and HCFD accounts",
    healthcareFacilities: "healthcare facilities",
    evacuationCenters: "evacuation centers",
  };

  return labels[type] || "records";
}

function bulkImportSuccessMessage(type, data) {
  const created = Number(data?.created ?? 0);
  const skipped = Number(data?.skipped ?? 0);
  const failed = Number(data?.failed ?? 0);
  const total = data?.results?.length ?? created + skipped + failed;

  return [
    `The ${bulkImportTypeLabel(type)} upload has finished.`,
    `Rows processed: ${total}.`,
    `Created: ${created}.`,
    `Skipped: ${skipped}.`,
    `Failed: ${failed}.`,
  ].join(" ");
}

function getBulkImportCompletionMessageType(data, preview) {
  const created = Number(data?.created ?? 0);
  const skipped = Number(data?.skipped ?? 0);
  const failed = Number(data?.failed ?? 0);
  const previewIssues = Number(preview?.failedRows?.length ?? 0);

  if (created > 0 && (skipped > 0 || failed > 0 || previewIssues > 0)) {
    return "warning";
  }

  if (created === 0 && (skipped > 0 || failed > 0 || previewIssues > 0)) {
    return "warning";
  }

  return "success";
}

function bindBulkImportActions() {
  document.querySelectorAll("[data-download-template]").forEach((button) => {
    if (button.dataset.templateBound === "true") return;
    button.dataset.templateBound = "true";

    button.addEventListener("click", () => {
      downloadCsvTemplate(button.dataset.downloadTemplate);
    });
  });

  document.querySelectorAll("[data-cancel-bulk-preview]").forEach((button) => {
    if (button.dataset.cancelBound === "true") return;
    button.dataset.cancelBound = "true";

    button.addEventListener("click", () => {
      const type = button.dataset.cancelBulkPreview;
      const config = bulkImportConfigs[type];

      if (!config) return;

      delete state.bulkImportPreviews[type];
      renderCurrentView();
      bindView();
      setMessage(config.messageId, "Bulk import cancelled.", "success");
    });
  });

  document.querySelectorAll("[data-download-bulk-failed]").forEach((button) => {
    if (button.dataset.failedBound === "true") return;
    button.dataset.failedBound = "true";

    button.addEventListener("click", () => {
      downloadBulkImportCorrectionFile(button.dataset.downloadBulkFailed);
    });
  });

  document.querySelectorAll("[data-confirm-bulk-import]").forEach((button) => {
    if (button.dataset.confirmBound === "true") return;
    button.dataset.confirmBound = "true";

    button.addEventListener("click", async () => {
      const type = button.dataset.confirmBulkImport;
      const config = bulkImportConfigs[type];
      const preview = state.bulkImportPreviews[type];

      if (!config || !preview || preview.validRows.length === 0) {
        return;
      }

      const confirmed = await showDashboardConfirm({
        title: "Import valid rows?",
        message: `This will save ${preview.validRows.length} valid row${preview.validRows.length === 1 ? "" : "s"}. Duplicate and invalid rows will not be saved.`,
        confirmLabel: "Import rows",
        cancelLabel: "Review again",
      });

      if (!confirmed) {
        return;
      }

      try {
        button.disabled = true;
        button.textContent = "Importing...";
        setMessage(config.messageId, `Importing ${preview.validRows.length} valid rows...`);

        const response = await apiRequest(config.endpoint, {
          method: "POST",
          body: JSON.stringify({
            rows: preview.validRows.map((item) => item.row),
          }),
        });
        const apiResults = response.data?.results || [];
        const apiFailedRows = apiResults
          .filter((result) => !result.success)
          .map((result, index) => {
            const validIndex = Math.max(Number(result.rowNumber || index + 2) - 2, 0);
            const validItem = preview.validRows[validIndex] || preview.validRows[index];

            return {
              ...(validItem || {
                rowNumber: result.rowNumber || index + 2,
                row: {},
              }),
              status: result.skipped ? "duplicate" : "invalid",
              reasons: [result.message || "Import failed."],
            };
          });

        state.bulkImportPreviews[type] = {
          ...preview,
          imported: true,
          importSummary: response.data,
          failedRows: [
            ...preview.failedRows,
            ...apiFailedRows,
          ],
        };

        await loadSharedData();
        renderCurrentView();
        bindView();
        setMessage(
          config.messageId,
          renderBulkImportSummary(response.data),
          getBulkImportCompletionMessageType(
            response.data,
            state.bulkImportPreviews[type],
          ),
        );
        showDashboardToast(
          getBulkImportCompletionMessageType(
            response.data,
            state.bulkImportPreviews[type],
          ) === "warning"
            ? "Bulk upload completed with warnings."
            : "Bulk upload completed.",
          "success",
        );
        await showDashboardNotice({
          eyebrow: "Bulk Upload",
          title: "Successful upload",
          message: bulkImportSuccessMessage(type, response.data),
          confirmLabel: "Done",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to import file.";

        setMessage(config.messageId, message, "error");
        button.disabled = false;
        button.textContent = `Import ${preview.validRows.length} valid row${preview.validRows.length === 1 ? "" : "s"}`;
      }
    });
  });

  document.querySelectorAll("[data-bulk-import]").forEach((input) => {
    if (input.dataset.importBound === "true") return;
    input.dataset.importBound = "true";

    input.addEventListener("change", async () => {
      const type = input.dataset.bulkImport;
      const config = bulkImportConfigs[type];
      const file = input.files?.[0];

      if (!config || !file) {
        return;
      }

      setMessage(config.messageId, "Reading import file...");

      try {
        const rows = await parseBulkImportFile(file);

        if (rows.length === 0) {
          throw new Error("The selected file has no import rows.");
        }

        state.bulkImportPreviews[type] = await buildBulkImportPreview(
          type,
          rows,
          file.name,
        );
        renderCurrentView();
        bindView();
        setMessage(
          config.messageId,
          `Preview ready. ${state.bulkImportPreviews[type].validRows.length} row${state.bulkImportPreviews[type].validRows.length === 1 ? "" : "s"} can be imported.`,
          state.bulkImportPreviews[type].failedRows.length
            ? "error"
            : "success",
        );
      } catch (error) {
        setMessage(
          config.messageId,
          error instanceof Error
            ? error.message
            : "Unable to import file.",
          "error",
        );
      } finally {
        input.value = "";
      }
    });
  });
}

function renderRegistrationShell() {
  return `
    <section class="panel">
      <h2>Account registration</h2>
      <p class="panel-subtitle">Create command accounts with Supabase Auth login and a matching DCMS user profile.</p>
      <form id="registerAdminForm" class="form-grid" style="margin-top:14px">
        <div class="form-grid two">
          <label class="field"><span>Full name</span><input name="fullName" required placeholder="Account holder full name" /></label>
          <label class="field"><span>Email</span><input name="email" type="email" required placeholder="user@example.com" /></label>
          ${renderPasswordField({
            label: "Temporary password",
            required: true,
          })}
          <label class="field"><span>Role</span><select name="role"><option value="administrator">Administrator</option><option value="super_admin">Super Admin</option></select></label>
          <label class="field"><span>Phone number</span><input name="phoneNumber" /></label>
          <label class="field"><span>Assigned municipality</span><input name="assignedMunicipality" /></label>
        </div>
        <label class="field"><span>Assigned barangay</span><input name="assignedBarangay" /></label>
        <div class="button-row">
          <button class="primary-button" type="submit">Create account</button>
          <button class="ghost-button" type="button" data-save-draft="account">Save draft</button>
          <button class="ghost-button" type="button" data-view-link="drafts">Open drafts</button>
        </div>
        <div id="registrationMessage" class="status-message" hidden></div>
      </form>
      ${renderBulkImportPanel(
        "adminAccounts",
        "Upload Super Admin / Admin Accounts",
        "Upload a CSV or Excel file to create administrator or super admin accounts in one batch.",
      )}
    </section>
  `;
}

function bindRegisterAdminForm() {
  const form = qs("#registerAdminForm");
  if (!form) return;

  applyPendingDraftToForm(form, "account", "registrationMessage");

  qs('[data-save-draft="account"]')?.addEventListener("click", async () => {
    try {
      await saveFormDraft({
        form,
        formType: "account",
        payload: getAccountDraftPayload(form),
        messageId: "registrationMessage",
      });
      clearFormAfterDraftSave(form);
      setMessage(
        "registrationMessage",
        "Draft saved. Temporary passwords are not stored in drafts.",
        "success",
      );
      await showDashboardNotice({
        eyebrow: "Draft saved",
        title: "Saved as draft",
        message:
          "This account form was saved in Drafts. The form has been cleared so you can start a new entry.",
        confirmLabel: "Done",
      });
    } catch (error) {
      setMessage("registrationMessage", getErrorMessage(error), "error");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("registrationMessage", "Creating account...");

    try {
      await apiRequest("/auth/register-admin", {
        method: "POST",
        body: JSON.stringify({
          fullName: formValue(form, "fullName"),
          email: formValue(form, "email"),
          password: form.elements.password.value,
          role: formValue(form, "role"),
          phoneNumber: formValue(form, "phoneNumber"),
          assignedMunicipality: formValue(form, "assignedMunicipality"),
          assignedBarangay: formValue(form, "assignedBarangay"),
        }),
      });

      await deleteSubmittedFormDraft(form);
      form.reset();
      setMessage("registrationMessage", "Account created. The user can now log in with the temporary password.", "success");
    } catch (error) {
      setMessage("registrationMessage", error.message, "error");
    }
  });
}

function renderAdminUnitRegistration() {
  return `
    <section class="panel">
      <h2>Create account within admin unit scope</h2>
      <p class="panel-subtitle">Create Field Responder, SAR Responder, and HCFD accounts tied to this admin unit.</p>
    </section>
    <section class="panel" style="margin-top:16px">
      <form id="unitUserForm" class="form-grid">
        <div class="form-grid two">
          <label class="field"><span>Full name</span><input name="fullName" required placeholder="Responder full name" /></label>
          <label class="field"><span>Email</span><input name="email" type="email" required placeholder="responder@example.com" /></label>
          ${renderPasswordField({
            label: "Temporary password",
            required: true,
          })}
          <label class="field">
            <span>Account role</span>
            <select name="role">
              ${unitAccountRoles
                .map(
                  (role) =>
                    `<option value="${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label class="field"><span>Assigned municipality</span><input name="assignedMunicipality" value="${escapeHtml(state.user.assigned_municipality || "")}" placeholder="Current admin unit" /></label>
          <label class="field"><span>Assigned barangay</span><input name="assignedBarangay" value="${escapeHtml(state.user.assigned_barangay || "")}" /></label>
          <label class="field"><span>Phone number</span><input name="phoneNumber" /></label>
        </div>
        <div class="button-row">
          <button class="primary-button" type="submit">Create unit user</button>
          <button class="ghost-button" type="button" data-save-draft="account">Save draft</button>
          <button class="ghost-button" type="button" data-view-link="drafts">Open drafts</button>
        </div>
        <div id="unitUserMessage" class="status-message" hidden></div>
      </form>
      ${renderBulkImportPanel(
        "unitAccounts",
        "Upload Responder/Documenter Accounts",
        "Upload a CSV or Excel file to create multiple FR, SAR, and HCFD accounts.",
      )}
      <div style="margin-top:12px">
        <button
          class="ghost-button mini"
          type="button"
          data-export-download="/exports/responders-documenters.csv"
          data-export-file="dcms-responders-documenters.csv"
        >
          Export FR/SAR/HCFD CSV
        </button>
      </div>
    </section>
    <div style="margin-top:16px">${renderAdminAccountList()}</div>
  `;
}

function renderAdminAccountList() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Accounts created by this admin</h2>
          <p class="panel-subtitle">FR, SAR, HCFD, and legacy responder accounts that can access the mobile app.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Account status</th>
              <th>Online</th>
              <th>Date created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.unitUsers
                .map((user) => {
                  const online = isRecentlyOnline(user);

                  return `
                    <tr>
                      <td><strong>${escapeHtml(user.full_name)}</strong><br><span class="panel-subtitle">${escapeHtml(user.email)}</span></td>
                      <td>${escapeHtml(roleLabel(user.role))}</td>
                      <td><span class="pill ${user.is_active ? "green" : "red"}">${user.is_active ? "Active" : "Inactive"}</span></td>
                      <td><span class="pill ${online ? "green" : ""}">${online ? "Online" : "Offline"}</span><br><span class="panel-subtitle">${user.last_seen_at ? `Last seen ${formatDate(user.last_seen_at)}` : "No login recorded"}</span></td>
                      <td>${formatDate(user.created_at)}</td>
                      <td><button class="ghost-button mini" type="button" data-edit-account="${escapeHtml(user.id)}">Edit account</button></td>
                    </tr>
                  `;
                })
                .join("") || `<tr><td colspan="6"><div class="empty-state">No FR, SAR, or HCFD accounts created yet.</div></td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div id="accountMessage" class="status-message" hidden></div>
    </section>
  `;
}

function bindRegisterUnitUserForm() {
  const form = qs("#unitUserForm");
  if (!form) return;

  applyPendingDraftToForm(form, "account", "unitUserMessage");

  qs('[data-save-draft="account"]')?.addEventListener("click", async () => {
    try {
      await saveFormDraft({
        form,
        formType: "account",
        payload: getAccountDraftPayload(form),
        messageId: "unitUserMessage",
      });
      clearFormAfterDraftSave(form);
      setMessage(
        "unitUserMessage",
        "Draft saved. Temporary passwords are not stored in drafts.",
        "success",
      );
      await showDashboardNotice({
        eyebrow: "Draft saved",
        title: "Saved as draft",
        message:
          "This account form was saved in Drafts. The form has been cleared so you can start a new entry.",
        confirmLabel: "Done",
      });
    } catch (error) {
      setMessage("unitUserMessage", getErrorMessage(error), "error");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("unitUserMessage", "Creating unit user...");

    try {
      await apiRequest("/auth/register-unit-user", {
        method: "POST",
        body: JSON.stringify({
          fullName: formValue(form, "fullName"),
          email: formValue(form, "email"),
          password: form.elements.password.value,
          role: formValue(form, "role"),
          phoneNumber: formValue(form, "phoneNumber"),
          assignedMunicipality: formValue(form, "assignedMunicipality"),
          assignedBarangay: formValue(form, "assignedBarangay"),
        }),
      });

      const municipality = formValue(form, "assignedMunicipality");
      const barangay = formValue(form, "assignedBarangay");

      await deleteSubmittedFormDraft(form);
      form.reset();
      form.elements.assignedMunicipality.value = municipality;
      form.elements.assignedBarangay.value = barangay;
      await loadSharedData();
      renderCurrentView();
      bindView();
      setMessage(
        "unitUserMessage",
        "Unit user created. They can now log in using the temporary password.",
        "success",
      );
    } catch (error) {
      setMessage("unitUserMessage", getErrorMessage(error), "error");
    }
  });
}

function renderAccountEditModal(user) {
  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="record-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="accountModalTitle">
        <form id="accountEditForm">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Account Management</span>
              <h2 id="accountModalTitle">Edit account</h2>
              <p>${escapeHtml(user.full_name)} - ${escapeHtml(user.email)}</p>
            </div>
            <button class="icon-button" type="button" data-close-modal aria-label="Close account editor">&times;</button>
          </div>

          <div class="modal-body">
            <div class="form-grid two">
              <label class="field"><span>Full name</span><input name="fullName" required value="${escapeHtml(user.full_name || "")}" /></label>
              <label class="field"><span>Email</span><input name="email" type="email" required value="${escapeHtml(user.email || "")}" /></label>
              <label class="field">
                <span>Role</span>
                <select name="role">
                  ${editableUnitAccountRoles
                    .map(
                      (role) =>
                        `<option value="${escapeHtml(role)}" ${user.role === role ? "selected" : ""}>${escapeHtml(roleLabel(role))}</option>`,
                    )
                    .join("")}
                </select>
              </label>
              <label class="field">
                <span>Account status</span>
                <select name="isActive">
                  <option value="true" ${user.is_active ? "selected" : ""}>Active</option>
                  <option value="false" ${!user.is_active ? "selected" : ""}>Inactive</option>
                </select>
              </label>
              <label class="field"><span>Phone number</span><input name="phoneNumber" value="${escapeHtml(user.phone_number || "")}" /></label>
              <label class="field"><span>New password</span><input name="password" type="password" minlength="6" placeholder="Leave blank to keep current password" /></label>
              <label class="field"><span>Assigned municipality</span><input name="assignedMunicipality" value="${escapeHtml(user.assigned_municipality || "")}" /></label>
              <label class="field"><span>Assigned barangay</span><input name="assignedBarangay" value="${escapeHtml(user.assigned_barangay || "")}" /></label>
            </div>
            <div class="account-status-strip">
              <span class="pill ${user.is_active ? "green" : "red"}">${user.is_active ? "Active" : "Inactive"}</span>
              <span class="pill ${isRecentlyOnline(user) ? "green" : ""}">${isRecentlyOnline(user) ? "Online" : "Offline"}</span>
              <span>Created ${formatDate(user.created_at)}</span>
              <span>${user.last_seen_at ? `Last seen ${formatDate(user.last_seen_at)}` : "No login recorded"}</span>
            </div>
            <div id="accountEditMessage" class="status-message" hidden></div>
          </div>

          <div class="modal-footer">
            <button class="danger-button" type="button" data-delete-account="${escapeHtml(user.id)}">Delete account</button>
            <div class="modal-footer-spacer"></div>
            <button class="ghost-button" type="button" data-close-modal>Cancel</button>
            <button class="primary-button" type="submit">Save account</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function openAccountEditModal(userId) {
  const user = state.unitUsers.find((item) => item.id === userId);

  if (!user) {
    setMessage("accountMessage", "Account could not be found.", "error");
    return;
  }

  closeRecordModal();
  document.body.insertAdjacentHTML("beforeend", renderAccountEditModal(user));

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target === element || element.matches("button")) {
        closeRecordModal();
      }
    });
  });

  bindAccountEditForm(user.id);
  bindAccountDeleteAction(user.id);
}

function bindAccountActions() {
  document.querySelectorAll("[data-edit-account]").forEach((button) => {
    if (button.dataset.editBound === "true") return;
    button.dataset.editBound = "true";

    button.addEventListener("click", () => {
      openAccountEditModal(button.dataset.editAccount);
    });
  });
}

function bindAccountEditForm(userId) {
  const form = qs("#accountEditForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("accountEditMessage", "Saving account...");

    const password = form.elements.password.value;

    try {
      await apiRequest(`/auth/unit-users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: formValue(form, "fullName"),
          email: formValue(form, "email"),
          role: formValue(form, "role"),
          isActive: formValue(form, "isActive") === "true",
          phoneNumber: formValue(form, "phoneNumber"),
          assignedMunicipality: formValue(form, "assignedMunicipality"),
          assignedBarangay: formValue(form, "assignedBarangay"),
          ...(password ? { password } : {}),
        }),
      });

      await loadSharedData();
      closeRecordModal();
      renderCurrentView();
      bindView();
      setMessage("accountMessage", "Account updated successfully.", "success");
    } catch (error) {
      setMessage("accountEditMessage", error.message, "error");
    }
  });
}

function bindAccountDeleteAction(userId) {
  const button = document.querySelector("[data-delete-account]");
  if (!button) return;

  button.addEventListener("click", async () => {
    const user = state.unitUsers.find((item) => item.id === userId);
    const label = user ? `${user.full_name} (${user.email})` : "this account";
    const confirmed = await showDashboardConfirm({
      title: "Delete account?",
      message: `Delete ${label}? This removes their login access. If records already reference this profile, it will be kept as inactive for history.`,
      confirmLabel: "Delete account",
      cancelLabel: "Keep account",
      danger: true,
    });

    if (!confirmed) return;

    setMessage("accountEditMessage", "Deleting account...");
    button.disabled = true;

    try {
      const response = await apiRequest(`/auth/unit-users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });

      await loadSharedData();
      closeRecordModal();
      renderCurrentView();
      bindView();
      setMessage(
        "accountMessage",
        response.message || "Account deleted successfully.",
        "success",
      );
      showDashboardToast(
        response.message || "Account deleted successfully.",
        "success",
      );
    } catch (error) {
      button.disabled = false;
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete account.";
      setMessage("accountEditMessage", message, "error");
      showDashboardToast(message, "error");
    }
  });
}

function renderAdminCasualtyRecords(compact = false) {
  const byIncident = new Map();
  const filteredCasualties = filterCasualtyRecordsForTable(state.casualties);
  const focusedIncident =
    state.casualtyRecordIncidentFocus &&
    state.casualtyRecordIncidentFocus !== "all"
      ? getIncidentById(state.casualtyRecordIncidentFocus)
      : null;

  for (const item of filteredCasualties) {
    const incidentId =
      item.incident?.id || "unknown-incident";

    const incidentName =
      item.incident?.incident_name || "Unknown incident";

    const current = byIncident.get(incidentId) || {
      incidentId,
      incidentName,
      total: 0,
      pending: 0,
      verified: 0,
      latestReportedAt: 0,
      records: [],
    };

    current.total += 1;
    current.records.push(item);
    current.latestReportedAt = Math.max(
      current.latestReportedAt,
      casualtyRecordTimestamp(item),
    );

    if (item.verification_status === "verified") {
      current.verified += 1;
    } else {
      current.pending += 1;
    }

    byIncident.set(incidentId, current);
  }

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Casualty Records</h2>
          <p class="panel-subtitle">
            ${
              focusedIncident
                ? `Showing casualty records for ${escapeHtml(focusedIncident.incident_name)}.`
                : "Select an incident to view casualty records submitted for that incident."
            }
          </p>
        </div>
        ${
          focusedIncident
            ? `<button class="ghost-button mini" type="button" data-clear-records-incident-focus>Show all incidents</button>`
            : ""
        }
      </div>

      ${compact ? "" : renderCasualtyRecordFilters(filteredCasualties.length, state.casualties.length)}

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Incident</th>
              <th>Total</th>
              <th>Pending</th>
              <th>Verified</th>
            </tr>
          </thead>

          <tbody>
            ${
              Array.from(byIncident.values())
                .sort(
                  (first, second) => {
                    const timestampDifference =
                      state.casualtyRecordSortOrder === "asc"
                        ? first.latestReportedAt - second.latestReportedAt
                        : second.latestReportedAt - first.latestReportedAt;

                    return (
                      timestampDifference ||
                      compareText(first.incidentName, second.incidentName)
                    );
                  },
                )
                .map((group) => {
                  const incidentKey = escapeHtml(
                    group.incidentId,
                  );

                  return `
                    <tr>
                      <td>
                        <button
                          class="record-link records-incident-button"
                          type="button"
                          data-records-incident="${incidentKey}"
                          aria-expanded="false"
                        >
                          <span
                            data-records-incident-arrow="${incidentKey}"
                          >
                            ▶
                          </span>

                          ${escapeHtml(group.incidentName)}
                        </button>
                      </td>

                      <td>${group.total}</td>

                      <td>
                        <span class="pill orange">
                          ${group.pending}
                        </span>
                      </td>

                      <td>
                        <span class="pill green">
                          ${group.verified}
                        </span>
                      </td>
                    </tr>

                    ${
                      compact
                        ? ""
                        : `
                          <tr
                            data-records-incident-details="${incidentKey}"
                            hidden
                          >
                            <td colspan="4">
                              <div class="incident-casualty-list">
                                <div class="incident-casualty-list-header">
                                  <div>
                                    <strong>
                                      ${escapeHtml(group.incidentName)}
                                    </strong>

                                    <span class="panel-subtitle">
                                      ${group.total} casualty record${
                                            group.total === 1 ? "" : "s"
                                          }
                                    </span>
                                  </div>
                                </div>

                                <div class="table-wrap">
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Casualty</th>
                                        <th>ID Number</th>
                                        <th>Status</th>
                                        <th>Verification</th>
                                        <th>Encoded By</th>
                                        <th>Reported</th>
                                        <th></th>
                                      </tr>
                                    </thead>

                                    <tbody>
                                      ${group.records
                                        .slice()
                                        .sort(compareCasualtyRecordsBySubmittedTime)
                                        .map(
                                          (item) => `
                                            <tr
                                              class="clickable-row"
                                              data-open-casualty="${escapeHtml(
                                                item.id,
                                              )}"
                                            >
                                              <td>
                                                <strong>
                                                  ${escapeHtml(
                                                    fullCasualtyName(
                                                      item.casualty,
                                                    ),
                                                  )}
                                                </strong>
                                              </td>

                                              <td>
                                                ${escapeHtml(
                                                  item.casualty
                                                    ?.id_number ||
                                                    "No ID number",
                                                )}
                                              </td>

                                              <td>
                                                ${escapeHtml(
                                                  roleLabel(
                                                    item.current_status,
                                                  ),
                                                )}
                                              </td>

                                              <td>
                                                <span
                                                  class="pill ${verificationPillClass(
                                                    item.verification_status,
                                                  )}"
                                                >
                                                  ${escapeHtml(
                                                    roleLabel(
                                                      item.verification_status,
                                                    ),
                                                  )}
                                                </span>
                                              </td>

                                              <td>
                                                ${escapeHtml(
                                                  item.encoder
                                                    ?.full_name ||
                                                    "Not recorded",
                                                )}
                                              </td>

                                              <td>
                                                ${formatDate(
                                                  casualtyRecordDateValue(item),
                                                )}
                                              </td>

                                              <td>
                                                <button
                                                  class="ghost-button mini"
                                                  type="button"
                                                  data-open-casualty="${escapeHtml(
                                                    item.id,
                                                  )}"
                                                >
                                                  Open Record
                                                </button>
                                              </td>
                                            </tr>
                                          `,
                                        )
                                        .join("")}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        `
                    }
                  `;
                })
                .join("") ||
              `
                <tr>
                  <td colspan="4">
                    <div class="empty-state">
                      ${state.casualties.length === 0 ? "No casualty records available yet." : "No casualty records match the current filters."}
                    </div>
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function bindCasualtyRecordIncidents() {
  const clearFocusButton = qs("[data-clear-records-incident-focus]");
  if (clearFocusButton) {
    clearFocusButton.addEventListener("click", () => {
      state.casualtyRecordIncidentFocus = "all";
      renderCurrentView();
      bindView();
    });
  }

  document
    .querySelectorAll("[data-records-incident]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const incidentId =
          button.dataset.recordsIncident;

        if (!incidentId) {
          return;
        }

        const detailRow = document.querySelector(
          `[data-records-incident-details="${CSS.escape(
            incidentId,
          )}"]`,
        );

        if (!detailRow) {
          return;
        }

        const willOpen = detailRow.hidden;

        detailRow.hidden = !willOpen;

        button.setAttribute(
          "aria-expanded",
          String(willOpen),
        );

        const arrow = document.querySelector(
          `[data-records-incident-arrow="${CSS.escape(
            incidentId,
          )}"]`,
        );

        if (arrow) {
          arrow.textContent = willOpen ? "▼" : "▶";
        }
      });
    });
}

function matchCasingRoleBucket(record) {
  const role = record?.encoder?.role;

  if (role === "field_responder") return "field_responder";
  if (role === "sa_responder") return "sa_responder";
  if (role === "documenter" || role === "medical_personnel") {
    return "documenter";
  }

  return "responder";
}

function matchCasingRoleLabel(role) {
  switch (role) {
    case "field_responder":
      return "Field Responder";
    case "sa_responder":
      return "SAR";
    case "documenter":
      return "HCFD";
    case "responder":
      return "Legacy Responder";
    default:
      return roleLabel(role);
  }
}

function isMatchCasingRoleEligible(role) {
  return ["field_responder", "sa_responder", "documenter"].includes(role);
}

function getMatchCasingRecordById(recordId) {
  return state.casualties.find((record) => record.id === recordId) || null;
}

function getSelectedMatchCasingRecords() {
  return state.selectedMatchCasingRecordIds
    .map((recordId) => getMatchCasingRecordById(recordId))
    .filter(Boolean);
}

function getSelectedMatchCasingRecordsByRole() {
  return getSelectedMatchCasingRecords().reduce((recordsByRole, record) => {
    const role = matchCasingRoleBucket(record);
    if (isMatchCasingRoleEligible(role)) {
      recordsByRole[role] = record;
    }

    return recordsByRole;
  }, {});
}

function getMatchCasingSelectedIncidentId() {
  return (
    getSelectedMatchCasingRecords()
      .map((record) => record?.incident?.id)
      .find(Boolean) || null
  );
}

function setMatchCasingRoleSelection(role, recordId) {
  const record = getMatchCasingRecordById(recordId);
  if (!record) return;

  const recordRole = matchCasingRoleBucket(record);
  if (recordRole !== role) {
    showMatchCasingWarning(
      `Select a ${matchCasingRoleLabel(role)} record for this slot.`,
    );
    return;
  }

  const selectedIncidentId = getMatchCasingSelectedIncidentId();
  if (selectedIncidentId && record?.incident?.id !== selectedIncidentId) {
    showMatchCasingWarning(
      "Selected records must belong to the same incident.",
    );
    return;
  }

  const selectedRecords = getSelectedMatchCasingRecords();
  state.selectedMatchCasingRecordIds = [
    ...selectedRecords
      .filter((selectedRecord) => matchCasingRoleBucket(selectedRecord) !== role)
      .map((selectedRecord) => selectedRecord.id),
    recordId,
  ];
  state.matchCasingPickerRole = null;
  renderCurrentView();
  bindView();
}

function removeMatchCasingRoleSelection(role) {
  state.selectedMatchCasingRecordIds = getSelectedMatchCasingRecords()
    .filter((record) => matchCasingRoleBucket(record) !== role)
    .map((record) => record.id);
  renderCurrentView();
  bindView();
}

function getMatchCasingCandidateRecords(role) {
  const linkByRecordId = getCaseLinksByRecordId();
  const selectedRecordIds = new Set(state.selectedMatchCasingRecordIds);
  const selectedIncidentId = getMatchCasingSelectedIncidentId();

  return getMatchCasingFilteredRecords().filter((record) => {
    if (matchCasingRoleBucket(record) !== role) return false;
    if (linkByRecordId.has(record.id)) return false;
    if (selectedRecordIds.has(record.id)) return false;
    if (selectedIncidentId && record?.incident?.id !== selectedIncidentId) {
      return false;
    }

    return true;
  });
}

function showMatchCasingWarning(message) {
  setMessage("matchCasingMessage", message, "error");
  showDashboardToast(message, "error");
}

function toggleMatchCasingRecordSelection(recordId) {
  const record = getMatchCasingRecordById(recordId);
  if (!record) return;

  const selectedIds = new Set(state.selectedMatchCasingRecordIds);

  if (selectedIds.has(recordId)) {
    selectedIds.delete(recordId);
    state.selectedMatchCasingRecordIds = [...selectedIds];
    renderCurrentView();
    bindView();
    return;
  }

  const role = matchCasingRoleBucket(record);
  if (!isMatchCasingRoleEligible(role)) {
    showMatchCasingWarning(
      "Only Field Responder, SAR, and HCFD records can be matched.",
    );
    return;
  }

  const selectedRecords = getSelectedMatchCasingRecords();
  if (selectedRecords.length >= 3) {
    showMatchCasingWarning(
      "You can only select up to 3 records for one matched case.",
    );
    return;
  }

  const matchingRole = selectedRecords.find(
    (selectedRecord) => matchCasingRoleBucket(selectedRecord) === role,
  );
  if (matchingRole) {
    showMatchCasingWarning(
      `You have already selected a ${matchCasingRoleLabel(role)} record for this matched case.`,
    );
    return;
  }

  const selectedIncidentId = selectedRecords[0]?.incident?.id;
  if (selectedIncidentId && record?.incident?.id !== selectedIncidentId) {
    showMatchCasingWarning(
      "Selected records must belong to the same incident.",
    );
    return;
  }

  selectedIds.add(recordId);
  state.selectedMatchCasingRecordIds = [...selectedIds];
  renderCurrentView();
  bindView();
}

function getCaseLinksByRecordId() {
  return new Map(
    (state.caseLinks || []).map((link) => [
      link.casualty_incident_id,
      link,
    ]),
  );
}

function getCaseLinksByCaseId() {
  return (state.caseLinks || []).reduce((groups, link) => {
    if (!groups.has(link.case_id)) {
      groups.set(link.case_id, []);
    }

    groups.get(link.case_id).push(link);
    return groups;
  }, new Map());
}

function getMatchCasingIncidentOptions() {
  const options = new Map();

  state.casualties.forEach((record) => {
    const incidentId = record?.incident?.id;
    if (!incidentId) return;

    options.set(
      incidentId,
      record?.incident?.incident_name || "Unknown incident",
    );
  });

  return [...options.entries()].sort((first, second) =>
    compareText(first[1], second[1]),
  );
}

function getMatchCasingFilteredRecords() {
  const incidentFilter = state.matchCasingIncidentFilter;

  return [...state.casualties]
    .filter((record) => {
      if (incidentFilter === "all") return true;
      return record?.incident?.id === incidentFilter;
    })
    .sort(
      (first, second) =>
        compareText(
          first?.incident?.incident_name,
          second?.incident?.incident_name,
        ) ||
        compareText(
          matchCasingRoleLabel(matchCasingRoleBucket(first)),
          matchCasingRoleLabel(matchCasingRoleBucket(second)),
        ) ||
        new Date(second?.reported_at || second?.created_at || 0).getTime() -
          new Date(first?.reported_at || first?.created_at || 0).getTime(),
    );
}

function renderMatchCasingPhotoPreview(record) {
  const attachments = state.matchCasingAttachments[record.id];
  const imageAttachment = (attachments || []).find(isImageAttachment);

  if (imageAttachment?.signed_url) {
    const fileName =
      imageAttachment.file_name || "Casualty photo attachment";

    return `
      <button
        class="attachment-card"
        type="button"
        data-open-attachment-preview
        data-attachment-url="${escapeHtml(imageAttachment.signed_url)}"
        data-attachment-name="${escapeHtml(fileName)}"
        data-attachment-mime="${escapeHtml(imageAttachment.mime_type || "image/jpeg")}"
      >
        <span class="attachment-preview">
          <img src="${escapeHtml(imageAttachment.signed_url)}" alt="${escapeHtml(fileName)}" loading="lazy" />
        </span>
        <span class="attachment-meta">
          <strong>${escapeHtml(fileName)}</strong>
          <small>Photo clue for matching</small>
        </span>
      </button>
    `;
  }

  return `
    <div class="empty-state" style="padding:14px">
      ${attachments ? "No casualty photo attached." : "Loading photo clues..."}
    </div>
  `;
}

function renderMatchCasingRecordCard(record, options = {}) {
  const link = getCaseLinksByRecordId().get(record.id);
  const role = matchCasingRoleBucket(record);
  const selected = state.selectedMatchCasingRecordIds.includes(record.id);
  const eligible = isMatchCasingRoleEligible(role);
  const incidentName = record?.incident?.incident_name || "Unknown incident";
  const triage =
    record?.latest_triage_assessment?.calculated_category ||
    record?.latest_triage_assessment?.triage_category ||
    record?.latest_triage_assessment?.responder_category ||
    "unknown";
  const facility =
    record?.healthcare_facility?.facility_name ||
    record?.hospital_name ||
    record?.current_location ||
    "No facility or location recorded";

  return `
    <article
      class="incident-section-card match-casing-card ${options.selectable ? "selectable" : ""} ${selected ? "selected" : ""} ${options.selectable && !eligible ? "disabled" : ""}"
      style="gap:12px"
      ${
        options.selectable
          ? `data-match-casing-card="${escapeHtml(record.id)}" role="button" tabindex="0" aria-pressed="${selected ? "true" : "false"}"`
          : ""
      }
    >
      <div class="section-card-header">
        <div>
          <h3>${escapeHtml(matchCasingRoleLabel(role))}</h3>
          <p class="panel-subtitle">${escapeHtml(incidentName)}</p>
        </div>
        ${
          options.selectable
            ? `<span class="pill ${selected ? "green" : eligible ? "blue" : "orange"}">${selected ? "Selected" : eligible ? "Click card to select" : "Not eligible"}</span>`
            : link
              ? `<span class="pill green">Matched</span>`
              : `<span class="pill orange">Unmatched</span>`
        }
      </div>

      ${renderMatchCasingPhotoPreview(record)}

      <div class="summary-facts">
        <div><span>Victim Code</span><strong>${escapeHtml(record?.casualty?.id_number || "Not recorded")}</strong></div>
        <div><span>Name</span><strong>${escapeHtml(fullCasualtyName(record?.casualty))}</strong></div>
        <div><span>Triage</span><strong>${escapeHtml(roleLabel(triage))}</strong></div>
        <div><span>Facility / Location</span><strong>${escapeHtml(facility)}</strong></div>
        <div><span>Encoded By</span><strong>${escapeHtml(record?.encoder?.full_name || "Unknown")}</strong></div>
        <div><span>Recorded</span><strong>${escapeHtml(formatDate(record?.reported_at || record?.created_at))}</strong></div>
      </div>

      <div class="button-row">
        <button class="ghost-button mini" type="button" data-open-casualty="${escapeHtml(record.id)}">View record</button>
        ${
          link && !options.hideUnmatch
            ? `<button class="danger-button mini" type="button" data-unmatch-case-record="${escapeHtml(record.id)}">Unmatch</button>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderMatchCasingSelectedRecordSummary(record) {
  const triage =
    record?.latest_triage_assessment?.calculated_category ||
    record?.latest_triage_assessment?.triage_category ||
    record?.latest_triage_assessment?.responder_category ||
    "unknown";

  return `
    <div class="match-casing-selected-record">
      <div>
        <span>Victim Code</span>
        <strong>${escapeHtml(record?.casualty?.id_number || "Not recorded")}</strong>
      </div>
      <div>
        <span>Name</span>
        <strong>${escapeHtml(fullCasualtyName(record?.casualty))}</strong>
      </div>
      <div>
        <span>Incident</span>
        <strong>${escapeHtml(record?.incident?.incident_name || "Unknown incident")}</strong>
      </div>
      <div>
        <span>Triage</span>
        <strong>${escapeHtml(roleLabel(triage))}</strong>
      </div>
      <div>
        <span>Encoded By</span>
        <strong>${escapeHtml(record?.encoder?.full_name || "Unknown")}</strong>
      </div>
    </div>
  `;
}

function renderMatchCasingSlot(role) {
  const selectedByRole = getSelectedMatchCasingRecordsByRole();
  const selectedRecord = selectedByRole[role];
  const candidateCount = getMatchCasingCandidateRecords(role).length;
  const slotLabel = matchCasingRoleLabel(role);

  return `
    <article class="match-casing-slot ${selectedRecord ? "filled" : ""}">
      <div class="match-casing-slot-header">
        <div>
          <h3>${escapeHtml(slotLabel)}</h3>
          <p>${candidateCount} available record${candidateCount === 1 ? "" : "s"}</p>
        </div>
        ${selectedRecord ? `<span class="pill green">Selected</span>` : `<span class="pill blue">Required</span>`}
      </div>

      ${
        selectedRecord
          ? `
            ${renderMatchCasingSelectedRecordSummary(selectedRecord)}
            <div class="button-row">
              <button class="ghost-button mini" type="button" data-open-match-picker="${escapeHtml(role)}">Replace</button>
              <button class="danger-button mini" type="button" data-remove-match-slot="${escapeHtml(role)}">Remove</button>
              <button class="ghost-button mini" type="button" data-open-casualty="${escapeHtml(selectedRecord.id)}">View record</button>
            </div>
          `
          : `
            <button
              class="match-casing-slot-add"
              type="button"
              data-open-match-picker="${escapeHtml(role)}"
              ${candidateCount === 0 ? "disabled" : ""}
            >
              <span>+</span>
              <strong>Add ${escapeHtml(slotLabel)} Record</strong>
            </button>
          `
      }
    </article>
  `;
}

function renderMatchCasingPickerModal() {
  const role = state.matchCasingPickerRole;
  if (!role) return "";

  const records = getMatchCasingCandidateRecords(role);
  const slotLabel = matchCasingRoleLabel(role);

  return `
    <div class="modal-backdrop">
      <section class="record-modal incident-section-modal">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Select ${escapeHtml(slotLabel)}</span>
            <h2>${escapeHtml(slotLabel)} Records</h2>
            <p>Choose one record for this role slot. Already selected and already matched records are hidden.</p>
          </div>
          <button class="icon-button" type="button" data-close-match-picker aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="grid two">
            ${
              records
                .map(
                  (record) => `
                    <article class="incident-section-card match-casing-card selectable" data-pick-match-card="${escapeHtml(record.id)}" data-pick-match-role="${escapeHtml(role)}" role="button" tabindex="0">
                      <div class="section-card-header">
                        <div>
                          <h3>${escapeHtml(slotLabel)}</h3>
                          <p class="panel-subtitle">${escapeHtml(record?.incident?.incident_name || "Unknown incident")}</p>
                        </div>
                        <span class="pill blue">Available</span>
                      </div>

                      ${renderMatchCasingPhotoPreview(record)}
                      ${renderMatchCasingSelectedRecordSummary(record)}

                      <div class="button-row">
                        <button class="primary-button mini" type="button" data-pick-match-record="${escapeHtml(record.id)}" data-pick-match-role="${escapeHtml(role)}">Use this record</button>
                        <button class="ghost-button mini" type="button" data-open-casualty="${escapeHtml(record.id)}">View record</button>
                      </div>
                    </article>
                  `,
                )
                .join("") ||
              `<div class="empty-state">No available ${escapeHtml(slotLabel)} records for this incident filter.</div>`
            }
          </div>
        </div>
      </section>
    </div>
  `;
}

function getFilteredCaseGroups() {
  return [...getCaseLinksByCaseId().entries()]
    .map(([caseId, links]) => ({
      caseId,
      links: links.filter((link) => {
        if (state.matchCasingIncidentFilter === "all") return true;
        return link.incident_id === state.matchCasingIncidentFilter;
      }),
    }))
    .filter((group) => group.links.length > 0);
}

function renderMatchedCaseGroup({ caseId, links }) {
  const linkedRecords = links
    .map((link) => ({
      link,
      record: state.casualties.find(
        (item) => item.id === link.casualty_incident_id,
      ),
    }))
    .filter((item) => item.record);

  return `
    <section class="incident-management-item">
      <div class="incident-management-toggle">
        <div>
          <span class="eyebrow">Matched Case</span>
          <h3>${escapeHtml(caseId.slice(0, 8).toUpperCase())}</h3>
          <p>${linkedRecords.length} linked role record${linkedRecords.length === 1 ? "" : "s"}</p>
        </div>
        <div class="incident-management-meta">
          ${linkedRecords
            .map(({ link }) => `<strong>${escapeHtml(matchCasingRoleLabel(link.role))}</strong>`)
            .join("")}
        </div>
      </div>
      <div class="incident-management-body">
        <div class="grid three">
          ${linkedRecords
            .map(({ record }) =>
              renderMatchCasingRecordCard(record, {
                selectable: false,
                hideUnmatch: true,
              }),
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderMatchCasing() {
  const incidentOptions = getMatchCasingIncidentOptions();
  const records = getMatchCasingFilteredRecords();
  const linkByRecordId = getCaseLinksByRecordId();
  const selectedRecordIds = new Set(state.selectedMatchCasingRecordIds);
  const availableRecords = records.filter((record) => {
    const role = matchCasingRoleBucket(record);
    return (
      isMatchCasingRoleEligible(role) &&
      !linkByRecordId.has(record.id) &&
      !selectedRecordIds.has(record.id)
    );
  });
  const selectedCount = state.selectedMatchCasingRecordIds.length;
  const canMatch = selectedCount === matchCasingRequiredRoleSlots.length;

  return `
    <div class="topbar">
      <div>
        <span class="eyebrow">Admin Review</span>
        <h1>Match Casing</h1>
        <p>Complete the Field Responder, SAR, and HCFD slots before matching one casualty case.</p>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Candidate filters</h2>
          <p class="panel-subtitle">Only unmatched FR, SAR, and HCFD records are available for new case matching.</p>
        </div>
        <span class="pill blue">${availableRecords.length} available</span>
      </div>

      <div class="form-grid two">
        <label class="field">
          <span>Incident</span>
          <select id="matchCasingIncidentFilter">
            <option value="all" ${state.matchCasingIncidentFilter === "all" ? "selected" : ""}>All incidents</option>
            ${incidentOptions
              .map(
                ([id, name]) =>
                  `<option value="${escapeHtml(id)}" ${state.matchCasingIncidentFilter === id ? "selected" : ""}>${escapeHtml(name)}</option>`,
              )
            .join("")}
          </select>
        </label>
        <div class="button-row" style="align-self:end; justify-content:flex-end">
          <button class="ghost-button" type="button" data-view-link="matched-cases">View matched cases</button>
        </div>
      </div>

      <div id="matchCasingMessage" class="status-message" hidden></div>
    </section>

    <section class="panel" style="margin-top:16px">
      <div class="panel-header">
        <div>
          <h2>Build matched case</h2>
          <p class="panel-subtitle">Fill all 3 role boxes. A case cannot be matched until Field Responder, SAR, and HCFD are complete.</p>
        </div>
        <span class="pill ${canMatch ? "green" : "orange"}">${selectedCount} / 3 filled</span>
      </div>

      <div class="match-casing-slots">
        ${matchCasingRequiredRoleSlots.map(renderMatchCasingSlot).join("")}
      </div>

      <div class="match-casing-submit-row">
        <button
          class="primary-button"
          type="button"
          data-create-match-case
          ${canMatch ? "" : "disabled"}
        >
          Match selected records
        </button>
        <button class="ghost-button" type="button" data-clear-match-selection>Clear selection</button>
      </div>
    </section>

    ${renderMatchCasingPickerModal()}
  `;
}

function renderMatchedCaseRecords() {
  const incidentOptions = getMatchCasingIncidentOptions();
  const caseGroups = getFilteredCaseGroups();

  return `
    <div class="topbar">
      <div>
        <span class="eyebrow">Admin Review</span>
        <h1>Matched Case Records</h1>
        <p>Review completed FR, SAR, and HCFD case matches. Submitted matches are locked.</p>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Matched case filters</h2>
          <p class="panel-subtitle">Filter completed matched cases by incident.</p>
        </div>
        <span class="pill green">${caseGroups.length} matched case${caseGroups.length === 1 ? "" : "s"}</span>
      </div>

      <div class="form-grid two">
        <label class="field">
          <span>Incident</span>
          <select id="matchCasingIncidentFilter">
            <option value="all" ${state.matchCasingIncidentFilter === "all" ? "selected" : ""}>All incidents</option>
            ${incidentOptions
              .map(
                ([id, name]) =>
                  `<option value="${escapeHtml(id)}" ${state.matchCasingIncidentFilter === id ? "selected" : ""}>${escapeHtml(name)}</option>`,
              )
              .join("")}
          </select>
        </label>
        <div class="button-row" style="align-self:end; justify-content:flex-end">
          <button class="ghost-button" type="button" data-view-link="match-casing">Create match</button>
        </div>
      </div>
    </section>

    <section class="panel" style="margin-top:16px">
      <div class="panel-header">
        <div>
          <h2>Completed matched cases</h2>
          <p class="panel-subtitle">These links are permanent. Records remain separate in the database but are grouped for review.</p>
        </div>
      </div>

      <div class="grid">
        ${caseGroups.map(renderMatchedCaseGroup).join("") || `<div class="empty-state">No matched casualty cases yet.</div>`}
      </div>
    </section>
  `;
}

async function ensureMatchCasingAttachmentPreviews(records) {
  if (state.matchCasingAttachmentsLoading) return;

  const missingRecords = records.filter(
    (record) => !state.matchCasingAttachments[record.id],
  );

  if (missingRecords.length === 0) return;

  state.matchCasingAttachmentsLoading = true;

  try {
    const results = await Promise.allSettled(
      missingRecords.map((record) =>
        apiRequest(
          `/attachments?casualtyIncidentId=${encodeURIComponent(record.id)}`,
        ),
      ),
    );

    missingRecords.forEach((record, index) => {
      const result = results[index];
      state.matchCasingAttachments[record.id] =
        result.status === "fulfilled" ? result.value.data || [] : [];
    });

    if (["match-casing", "matched-cases"].includes(state.activeView)) {
      renderCurrentView();
      bindView();
    }
  } finally {
    state.matchCasingAttachmentsLoading = false;
  }
}

function bindMatchCasingActions() {
  if (!["match-casing", "matched-cases"].includes(state.activeView)) return;

  const records = getMatchCasingFilteredRecords();
  void ensureMatchCasingAttachmentPreviews(records);

  const incidentFilter = qs("#matchCasingIncidentFilter");
  if (incidentFilter) {
    incidentFilter.addEventListener("change", () => {
      state.matchCasingIncidentFilter = incidentFilter.value;
      if (state.activeView === "match-casing") {
        state.selectedMatchCasingRecordIds = [];
        state.matchCasingPickerRole = null;
      }
      renderCurrentView();
      bindView();
    });
  }

  document.querySelectorAll("[data-open-match-picker]").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.openMatchPicker;
      if (!role || !isMatchCasingRoleEligible(role)) return;

      state.matchCasingPickerRole = role;
      renderCurrentView();
      bindView();
    });
  });

  qs("[data-close-match-picker]")?.addEventListener("click", () => {
    state.matchCasingPickerRole = null;
    renderCurrentView();
    bindView();
  });

  document.querySelectorAll("[data-remove-match-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.removeMatchSlot;
      if (!role || !isMatchCasingRoleEligible(role)) return;

      removeMatchCasingRoleSelection(role);
    });
  });

  document.querySelectorAll("[data-pick-match-record]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const role = button.dataset.pickMatchRole;
      const recordId = button.dataset.pickMatchRecord;
      if (!role || !recordId) return;

      setMatchCasingRoleSelection(role, recordId);
    });
  });

  document.querySelectorAll("[data-pick-match-card]").forEach((card) => {
    const pickRecord = (event) => {
      const target = event.target;
      if (
        target?.closest &&
        target.closest("button, a, input, label, select")
      ) {
        return;
      }

      const role = card.dataset.pickMatchRole;
      const recordId = card.dataset.pickMatchCard;
      if (!role || !recordId) return;

      setMatchCasingRoleSelection(role, recordId);
    };

    card.addEventListener("click", pickRecord);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      pickRecord(event);
    });
  });

  document
    .querySelectorAll("[data-match-casing-card]")
    .forEach((card) => {
      const toggleCard = (event) => {
        const target = event.target;
        if (
          target?.closest &&
          target.closest("button, a, input, label, select")
        ) {
          return;
        }

        const recordId = card.dataset.matchCasingCard;
        if (!recordId) return;

        toggleMatchCasingRecordSelection(recordId);
      };

      card.addEventListener("click", toggleCard);
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        toggleCard(event);
      });
    });

  qs("[data-clear-match-selection]")?.addEventListener("click", () => {
    state.selectedMatchCasingRecordIds = [];
    state.matchCasingPickerRole = null;
    renderCurrentView();
    bindView();
  });

  qs("[data-create-match-case]")?.addEventListener("click", async () => {
    const selectedRecords = getSelectedMatchCasingRecords();
    const selectedRoles = selectedRecords.map(matchCasingRoleBucket);

    if (selectedRecords.length !== matchCasingRequiredRoleSlots.length) {
      showMatchCasingWarning(
        "Complete Field Responder, SAR, and HCFD before matching.",
      );
      return;
    }

    if (selectedRoles.some((role) => !isMatchCasingRoleEligible(role))) {
      showMatchCasingWarning(
        "Only Field Responder, SAR, and HCFD records can be matched.",
      );
      return;
    }

    if (new Set(selectedRoles).size !== selectedRoles.length) {
      showMatchCasingWarning(
        "Each matched case can only include one record per role.",
      );
      return;
    }

    const missingRole = matchCasingRequiredRoleSlots.find(
      (role) => !selectedRoles.includes(role),
    );
    if (missingRole) {
      showMatchCasingWarning(
        `Add a ${matchCasingRoleLabel(missingRole)} record before matching.`,
      );
      return;
    }

    const selectedIncidentIds = new Set(
      selectedRecords.map((record) => record?.incident?.id).filter(Boolean),
    );
    if (selectedIncidentIds.size > 1) {
      showMatchCasingWarning(
        "Selected records must belong to the same incident.",
      );
      return;
    }

    setMessage("matchCasingMessage", "Matching selected records...");

    try {
      await apiRequest("/casualties/case-links", {
        method: "POST",
        body: JSON.stringify({
          casualtyIncidentIds: state.selectedMatchCasingRecordIds,
        }),
      });

      state.selectedMatchCasingRecordIds = [];
      state.matchCasingPickerRole = null;
      await loadSharedData();
      state.activeView = "matched-cases";
      localStorage.setItem("dcms.admin.activeView", state.activeView);
      renderCurrentView();
      bindView();
      showDashboardToast(
        "Complete matched case was created and locked.",
        "success",
      );
    } catch (error) {
      setMessage("matchCasingMessage", getErrorMessage(error), "error");
    }
  });

  document.querySelectorAll("[data-unmatch-case-record]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const recordId = button.dataset.unmatchCaseRecord;
      if (!recordId) return;

      const confirmed = await showDashboardConfirm({
        title: "Unmatch casualty record?",
        message:
          "This removes the selected role record from its matched case. The casualty record itself will not be deleted.",
        confirmLabel: "Unmatch record",
        cancelLabel: "Keep matched",
        tone: "danger",
      });

      if (!confirmed) return;

      try {
        await apiRequest(
          `/casualties/${encodeURIComponent(recordId)}/case-link`,
          { method: "DELETE" },
        );
        await loadSharedData();
        renderCurrentView();
        bindView();
        showDashboardToast("Record removed from matched case.", "success");
      } catch (error) {
        showDashboardToast(getErrorMessage(error), "error");
      }
    });
  });

  bindAttachmentPreviewActions();
}

function renderAdminVerificationReview() {
  const allReviewItems = state.casualties
    .filter((item) =>
      ["submitted", "under_review"].includes(item.verification_status),
    )
    .sort(compareCasualtyRecordsByLatest);
  const incidentOptions = getVerificationReviewIncidentOptions(allReviewItems);
  const reviewItems = filterVerificationReviewItems(allReviewItems);

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Verification review</h2>
          <p class="panel-subtitle">Casualty entries awaiting review from responder accounts in this admin unit.</p>
        </div>
      </div>
      ${renderVerificationReviewFilters(
        reviewItems.length,
        allReviewItems.length,
        incidentOptions,
      )}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Unit</th><th>Incident</th><th>Casualty</th><th>Status</th><th>Verification</th><th>Reported</th><th>Actions</th></tr></thead>
          <tbody>
            ${
              reviewItems
                .map(
                  (item) => `
                    <tr class="clickable-row" data-open-casualty="${escapeHtml(item.id)}">
                      <td>${escapeHtml(encoderUnitName(item.encoder))}</td>
                      <td>${escapeHtml(item.incident?.incident_name || "Unknown incident")}</td>
                      <td>
                        <button class="record-link" type="button" data-open-casualty="${escapeHtml(item.id)}">
                          ${escapeHtml(fullCasualtyName(item.casualty))}
                        </button>
                        <br><span class="panel-subtitle">${escapeHtml(item.casualty?.id_number || "No ID number")}</span>
                      </td>
                      <td>${escapeHtml(item.current_status)}</td>
                      <td><span class="pill ${verificationPillClass(item.verification_status)}">${escapeHtml(roleLabel(item.verification_status))}</span></td>
                      <td>${formatDate(casualtyRecordDateValue(item))}</td>
                      <td>
                        <div class="table-actions">
                          <button class="ghost-button mini" data-open-casualty="${escapeHtml(item.id)}">Open record</button>
                          <button class="ghost-button mini" data-review-action="under_review" data-casualty-id="${escapeHtml(item.id)}">Review</button>
                          <button class="secondary-button mini" data-review-action="verified" data-casualty-id="${escapeHtml(item.id)}">Approve</button>
                          <button class="danger-button mini" data-review-action="rejected" data-casualty-id="${escapeHtml(item.id)}">Reject</button>
                          <button class="danger-button mini" data-delete-casualty="${escapeHtml(item.id)}">Delete</button>
                        </div>
                      </td>
                    </tr>
                  `,
                )
                .join("") || `<tr><td colspan="7"><div class="empty-state">${allReviewItems.length === 0 ? "No pending verification items." : "No pending verification items match the selected incident."}</div></td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div id="verificationMessage" class="status-message" hidden></div>
    </section>
  `;
}

function detailItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value ?? "Not recorded")}</strong>
    </div>
  `;
}

function isImageAttachment(attachment) {
  return String(attachment?.mime_type || "")
    .toLowerCase()
    .startsWith("image/");
}

function renderAttachmentCard(attachment, index) {
  const fileName =
    attachment?.file_name || `Attachment ${index + 1}`;
  const signedUrl = attachment?.signed_url || "";
  const mimeType = attachment?.mime_type || "";
  const uploadedAt = formatDate(attachment?.created_at);
  const uploader =
    attachment?.uploader?.full_name ||
    attachment?.uploader?.email ||
    "Unknown uploader";
  const isImage = isImageAttachment(attachment);

  return `
    <button
      class="attachment-card"
      type="button"
      data-open-attachment-preview
      data-attachment-url="${escapeHtml(signedUrl)}"
      data-attachment-name="${escapeHtml(fileName)}"
      data-attachment-mime="${escapeHtml(mimeType)}"
      ${signedUrl ? "" : "disabled"}
    >
      <span class="attachment-preview">
        ${
          isImage && signedUrl
            ? `<img src="${escapeHtml(signedUrl)}" alt="${escapeHtml(fileName)}" loading="lazy" />`
            : `<span class="attachment-file-icon">${escapeHtml((attachment?.file_type || "file").toUpperCase())}</span>`
        }
      </span>
      <span class="attachment-meta">
        <strong>${escapeHtml(fileName)}</strong>
        <small>${escapeHtml(uploadedAt)} · ${escapeHtml(uploader)}</small>
      </span>
    </button>
  `;
}

function renderAttachmentSection(recordDetails) {
  const attachments = recordDetails?.attachments || [];

  return `
    <section class="record-section">
      <h3>Attachments</h3>
      ${
        attachments.length > 0
          ? `
            <div class="attachment-grid">
              ${attachments
                .map((attachment, index) =>
                  renderAttachmentCard(attachment, index),
                )
                .join("")}
            </div>
          `
          : `
            <div class="empty-state">
              No attachments uploaded for this casualty record.
            </div>
          `
      }
    </section>
  `;
}

function openAttachmentPreview(url, fileName, mimeType) {
  if (!url) {
    return;
  }

  document
    .querySelector(".attachment-preview-backdrop")
    ?.remove();

  const isImage = String(mimeType || "")
    .toLowerCase()
    .startsWith("image/");

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="attachment-preview-backdrop" data-close-attachment-preview>
        <section class="attachment-preview-modal" role="dialog" aria-modal="true" aria-labelledby="attachmentPreviewTitle">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Attachment Preview</span>
              <h2 id="attachmentPreviewTitle">${escapeHtml(fileName || "Attachment")}</h2>
            </div>
            <button class="icon-button" type="button" data-close-attachment-preview aria-label="Close attachment preview">&times;</button>
          </div>

          <div class="attachment-preview-body">
            ${
              isImage
                ? `<img class="attachment-preview-image" src="${escapeHtml(url)}" alt="${escapeHtml(fileName || "Attachment")}" />`
                : `<iframe class="attachment-preview-frame" src="${escapeHtml(url)}" title="${escapeHtml(fileName || "Attachment")}"></iframe>`
            }
          </div>

          <div class="modal-footer">
            <a class="secondary-button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
              Open full size
            </a>
            <button class="ghost-button" type="button" data-close-attachment-preview>Close</button>
          </div>
        </section>
      </div>
    `,
  );

  document
    .querySelectorAll("[data-close-attachment-preview]")
    .forEach((element) => {
      element.addEventListener("click", (event) => {
        if (
          event.target === element ||
          element.matches("button")
        ) {
          document
            .querySelector(".attachment-preview-backdrop")
            ?.remove();
        }
      });
    });
}

function bindAttachmentPreviewActions() {
  document
    .querySelectorAll("[data-open-attachment-preview]")
    .forEach((button) => {
      if (button.dataset.previewBound === "true") return;
      button.dataset.previewBound = "true";

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openAttachmentPreview(
          button.dataset.attachmentUrl,
          button.dataset.attachmentName,
          button.dataset.attachmentMime,
        );
      });
    });
}

function extractRecordSectionValue(
  text,
  sectionTitle,
  label,
) {
  if (!text) {
    return null;
  }

  const lines = String(text).split(/\r?\n/);

  const targetSection =
    `[${sectionTitle}]`.toLowerCase();

  const targetLabel =
    `${label}:`.toLowerCase();

  let insideSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (
      line.startsWith("[") &&
      line.endsWith("]")
    ) {
      insideSection =
        line.toLowerCase() === targetSection;

      continue;
    }

    if (
      insideSection &&
      line.toLowerCase().startsWith(targetLabel)
    ) {
      const value = line
        .slice(label.length + 1)
        .trim();

      return value || null;
    }
  }

  return null;
}

function extractRecordBaseText(text) {
  if (!text) {
    return null;
  }

  const lines = String(text).split(/\r?\n/);
  const baseLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (
      line.startsWith("[") &&
      line.endsWith("]")
    ) {
      break;
    }

    if (line) {
      baseLines.push(line);
    }
  }

  return baseLines.join("\n").trim() || null;
}

function getCasualtyVictimCode(
  item,
  recordDetails,
) {
  const possibleNotes = [
    item?.remarks,
    item?.latest_triage_assessment?.notes,
    ...(recordDetails?.triageHistory || [])
      .map((record) => record.notes),
  ].filter(Boolean);

  for (const text of possibleNotes) {
    const saVictimCode =
      extractRecordSectionValue(
        text,
        "Advanced Medical Responder Details",
        "Victim code",
      ) ||
      extractRecordSectionValue(
        text,
        "SA Responder Details",
        "Victim code",
      );

    if (saVictimCode) {
      return saVictimCode;
    }

    const fieldResponderVictimCode =
      extractRecordSectionValue(
        text,
        "Field Responder Codes",
        "Victim code",
      );

    if (fieldResponderVictimCode) {
      return fieldResponderVictimCode;
    }
  }

  return null;
}

function formatPatientIdentified(casualty) {
  switch (casualty?.identification_status) {
    case "identified":
      return "Yes";

    case "unidentified":
      return "No";

    case "partially_identified":
      return "Partially identified";

    default:
      return "Not recorded";
  }
}

function formatTriageRecordValue(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";

  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }

  const text = String(value);

  if (/^esi_\d+$/i.test(text)) {
    return text.replace(/esi_/i, "ESI ");
  }

  return roleLabel(text);
}

const assessmentAnswerLabels = {
  airwayrisk: "Actual or potential airway risk?",
  breathingafterairwaymanagement: "Breathing after airway management?",
  breathingafterrescuebreaths: "Breathing after 5 rescue breaths?",
  breathingrisk: "Actual or potential breathing risk?",
  canwalk: "Can walk?",
  canwalkornovisibleinjuries: "Can walk or no visible injuries?",
  capillaryrefill: "Capillary refill",
  catastrophichemorrhage: "Catastrophic hemorrhage?",
  circulationrisk: "Actual or potential circulation risk?",
  delayedsurgerypermitted: "Surgery can be delayed safely?",
  disabilityrisk: "Actual or potential disability risk?",
  exposurerisk: "Actual or potential exposure risk?",
  finaltriage: "Final triage",
  followssimplecommands: "Mental status",
  gcs: "Glasgow Coma Scale",
  heartrate: "Heart rate",
  injury: "Injury",
  lifesavingsurgeryhighsurvival: "Life-saving surgery, high survival chance?",
  lowsurvivalcomplextreatment: "Complex treatment with low survival chance?",
  mentalstatus: "Mental status",
  minorselfcare: "Minor injuries, can self-care?",
  palpablepulseafterairwaymanagement:
    "Palpable pulse after airway management?",
  pulse: "Pulse",
  radialpulse: "Radial pulse",
  respirations: "Respirations",
  respiratoryrate: "Respiratory rate",
  savecategory: "SAVE category",
  specialpopulation: "Special population",
  spontaneousbreathing: "Spontaneous breathing?",
  suckingchestwound: "Sucking chest wound?",
  systolicbp: "Systolic BP",
};

function formatAssessmentAnswerLabel(key) {
  const raw = String(key || "").trim();
  const normalized = raw
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  if (assessmentAnswerLabels[normalized]) {
    return assessmentAnswerLabels[normalized];
  }

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map((part) => {
      const upperPart = part.toUpperCase();

      if (["BP", "CBG", "GCS", "PR", "RR", "SPO2"].includes(upperPart)) {
        return upperPart;
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function renderTriageAssessmentAnswers(answers) {
  if (!answers || typeof answers !== "object") {
    return `
      <div class="empty-state">
        No assessment answers recorded.
      </div>
    `;
  }

  const entries = Object.entries(answers);

  if (!entries.length) {
    return `
      <div class="empty-state">
        No assessment answers recorded.
      </div>
    `;
  }

  return `
    <div class="casualty-detail-grid">
      ${entries
        .map(([key, value]) =>
          detailItem(
            formatAssessmentAnswerLabel(key),
            formatTriageRecordValue(value),
          ),
        )
        .join("")}
    </div>
  `;
}

function renderTriageHistoryContent(records) {
  return records.length
    ? records
        .map(
          (record, index) => `
            <div
              style="
                margin-top:14px;
                padding:16px;
                border:1px solid #e2e7ef;
                border-radius:12px;
              "
            >
              <div class="casualty-detail-grid">
                ${detailItem(
                  "Assessment",
                  `Triage ${index + 1}`,
                )}

                ${detailItem(
                  "Triage system",
                  String(
                    record.triage_system || "Not recorded",
                  ).toUpperCase(),
                )}

                ${detailItem(
                  "Triage category",
                  roleLabel(record.triage_category),
                )}

                ${detailItem(
                  "Triage time",
                  formatDate(record.triaged_at),
                )}

                ${detailItem(
                  "Location",
                  record.location,
                )}

                ${detailItem(
                  "Performed by",
                  record.triaged_by_user?.full_name,
                )}

                ${detailItem(
                  "Account role",
                  roleLabel(
                    record.triaged_by_user?.role,
                  ),
                )}

                ${detailItem(
                  "Notes",
                  record.notes || "No notes",
                )}
              </div>

              <div style="margin-top:14px">
                <strong>Assessment Answers</strong>

                <div style="margin-top:10px">
                  ${renderTriageAssessmentAnswers(
                    record.assessment_answers,
                  )}
                </div>
              </div>
            </div>
          `,
        )
        .join("")
    : `
      <div class="empty-state" style="margin-top:12px">
        No record yet.
      </div>
    `;
}

function renderTriageHistoryGroup(
  title,
  subtitle,
  records,
) {
  return `
    <section class="record-section">
      <h3>${escapeHtml(title)}</h3>

      <p class="panel-subtitle">
        ${escapeHtml(subtitle)}
      </p>

      ${renderTriageHistoryContent(records)}
    </section>
  `;
}

function renderFieldResponderTriageContent(records) {
  return records.length
    ? records
        .map((record, index) => {
          const victimCode =
            extractRecordSectionValue(
              record.notes,
              "Field Responder Codes",
              "Victim code",
            );

          const userCode =
            extractRecordSectionValue(
              record.notes,
              "Field Responder Codes",
              "User code",
            );

          const triageNotes =
            extractRecordBaseText(record.notes);

          return `
            <div
              style="
                margin-top:14px;
                padding:16px;
                border:1px solid #e2e7ef;
                border-radius:12px;
              "
            >
              <div class="casualty-detail-grid">
                ${detailItem(
                  "Assessment",
                  `Triage ${index + 1}`,
                )}

                ${detailItem(
                  "Victim Code",
                  victimCode,
                )}

                ${detailItem(
                  "User Code",
                  userCode,
                )}

                ${detailItem(
                  "Triage System",
                  String(
                    record.triage_system ||
                      "Not recorded",
                  ).toUpperCase(),
                )}

                ${detailItem(
                  "Triage Category",
                  roleLabel(record.triage_category),
                )}

                ${detailItem(
                  "Triage Time",
                  formatDate(record.triaged_at),
                )}

                ${detailItem(
                  "Location",
                  record.location,
                )}

                ${detailItem(
                  "Performed By",
                  record.triaged_by_user?.full_name,
                )}

                ${detailItem(
                  "Account Role",
                  roleLabel(
                    record.triaged_by_user?.role,
                  ),
                )}

                ${detailItem(
                  "Triage Notes",
                  triageNotes || "No notes",
                )}
              </div>

              <div style="margin-top:14px">
                <strong>
                  Assessment Answers
                </strong>

                <div style="margin-top:10px">
                  ${renderTriageAssessmentAnswers(
                    record.assessment_answers,
                  )}
                </div>
              </div>
            </div>
          `;
        })
        .join("")
    : `
      <div
        class="empty-state"
        style="margin-top:12px"
      >
        No Field Responder triage record yet.
      </div>
    `;
}

function renderSaTransportHistoryContent(records) {
  const saRecords = (records || []).filter((record) =>
    String(record.notes || "")
      .toLowerCase()
      .includes("[sa transport / release]"),
  );

  return saRecords.length
    ? saRecords
        .map((record, index) => {
          const patientFor =
            extractRecordSectionValue(
              record.notes,
              "SA Transport / Release",
              "Patient for",
            );

          const normalizedPatientFor =
            String(patientFor || "").toLowerCase();

          const isRelease =
            normalizedPatientFor === "release";

          const isTransfer =
            normalizedPatientFor ===
            "referral or transfer to health facility";

          const conditionBeforeRelease =
            extractRecordSectionValue(
              record.notes,
              "SA Transport / Release",
              "Condition before release",
            );

          const conditionBeforeTransfer =
            extractRecordSectionValue(
              record.notes,
              "SA Transport / Release",
              "Condition before transfer",
            );

          const usedEmsVehicle =
            extractRecordSectionValue(
              record.notes,
              "SA Transport / Release",
              "Used EMS vehicle",
            );

          return `
            <div
              style="
                margin-top:14px;
                padding:16px;
                border:1px solid #e2e7ef;
                border-radius:12px;
              "
            >
              ${
                saRecords.length > 1
                  ? `
                    <div style="margin-bottom:12px">
                      <strong>
                        Transport / Release ${index + 1}
                      </strong>
                    </div>
                  `
                  : ""
              }

              <div class="casualty-detail-grid">
                ${detailItem(
                  "Patient For",
                  patientFor,
                )}

                ${
                  isRelease
                    ? `
                      ${detailItem(
                        "Condition Before Release",
                        conditionBeforeRelease,
                      )}

                      ${
                        String(
                          conditionBeforeRelease || "",
                        ).toLowerCase() === "dead"
                          ? detailItem(
                              "Medical Contact",
                              extractRecordSectionValue(
                                record.notes,
                                "SA Transport / Release",
                                "Medical contact if dead",
                              ),
                            )
                          : ""
                      }

                      ${detailItem(
                        "Departed Scene Time",
                        formatDate(
                          record.departed_scene_at,
                        ),
                      )}

                      ${detailItem(
                        "Release of Liability Accepted",
                        extractRecordSectionValue(
                          record.notes,
                          "SA Transport / Release",
                          "Release of liability accepted",
                        ),
                      )}
                    `
                    : ""
                }

                ${
                  isTransfer
                    ? `
                      ${detailItem(
                        "Condition Before Transfer",
                        conditionBeforeTransfer,
                      )}

                      ${
                        String(
                          conditionBeforeTransfer || "",
                        ).toLowerCase() === "dead"
                          ? detailItem(
                              "Medical Contact",
                              extractRecordSectionValue(
                                record.notes,
                                "SA Transport / Release",
                                "Medical contact if dead before transfer",
                              ),
                            )
                          : ""
                      }

                      ${detailItem(
                        "Precaution",
                        extractRecordSectionValue(
                          record.notes,
                          "SA Transport / Release",
                          "Precaution",
                        ),
                      )}

                      ${detailItem(
                        "Receiving Facility",
                        record.receiving_facility
                          ?.facility_name ||
                          extractRecordSectionValue(
                            record.notes,
                            "SA Transport / Release",
                            "Receiving facility",
                          ),
                      )}

                      ${detailItem(
                        "Used EMS Vehicle",
                        usedEmsVehicle,
                      )}

                      ${
                        String(
                          usedEmsVehicle || "",
                        ).toLowerCase() === "yes"
                          ? `
                            ${detailItem(
                              "Type of EMS Vehicle",
                              extractRecordSectionValue(
                                record.notes,
                                "SA Transport / Release",
                                "Type of EMS vehicle",
                              ),
                            )}

                            ${detailItem(
                              "Vehicle Make / Model / Plate",
                              extractRecordSectionValue(
                                record.notes,
                                "SA Transport / Release",
                                "Vehicle make/model/plate",
                              ),
                            )}
                          `
                          : ""
                      }

                      ${detailItem(
                        "Departed Scene Time",
                        formatDate(
                          record.departed_scene_at,
                        ),
                      )}

                      ${detailItem(
                        "Arrived Facility Time",
                        formatDate(
                          record.arrived_facility_at,
                        ),
                      )}
                    `
                    : ""
                }

                ${detailItem(
                  "Transport / Release Notes",
                  extractRecordBaseText(record.notes) ||
                    "No transport / release notes",
                )}
              </div>
            </div>
          `;
        })
        .join("")
    : `
      <div
        class="empty-state"
        style="margin-top:12px"
      >
        No SAR transport or release record yet.
      </div>
    `;
}

function renderSaTreatmentHistoryContent(
  records,
  item,
) {
  const saRecords = (records || []).filter(
    (record) => {
      const treatmentDetails =
        record.treatment_details;

      const hasHealthcareDetails =
        treatmentDetails &&
        typeof treatmentDetails === "object" &&
        !Array.isArray(treatmentDetails) &&
        Object.keys(treatmentDetails).length > 0;

      return !hasHealthcareDetails;
    },
  );

  return saRecords.length
    ? saRecords
        .map((record, index) => {
          const fillPatientCareReport =
            extractRecordSectionValue(
              record.notes,
              "Patient Care Report",
              "Fill in Patient Care Report",
            );

          const stabilizedTime =
            record.stabilized_at
              ? formatDate(record.stabilized_at)
              : extractRecordSectionValue(
                  record.notes,
                  "Patient Care Report",
                  "Stabilized time",
                );

          const treatmentNotes =
            extractRecordBaseText(record.notes);

          return `
            <div
              style="
                margin-top:14px;
                padding:16px;
                border:1px solid #e2e7ef;
                border-radius:12px;
              "
            >
              ${
                saRecords.length > 1
                  ? `
                    <div style="margin-bottom:12px">
                      <strong>
                        Treatment ${index + 1}
                      </strong>
                    </div>
                  `
                  : ""
              }

              <div class="casualty-detail-grid">
                ${detailItem(
                  "Treatment",
                  roleLabel(
                    record.treatment_strategy,
                  ),
                )}

                ${detailItem(
                  "Stabilized Time",
                  stabilizedTime,
                )}

                ${detailItem(
                  "Fill in Patient Care Report?",
                  fillPatientCareReport,
                )}

                ${detailItem(
                  "Visible Injury",
                  item.visible_injury,
                )}

                ${detailItem(
                  "Medical Condition",
                  item.medical_condition,
                )}

                ${detailItem(
                  "Assistance Provided",
                  item.assistance_provided,
                )}

                ${detailItem(
                  "Treatment Notes",
                  treatmentNotes ||
                    "No treatment notes",
                )}

                ${detailItem(
                  "Performed By",
                  record.performed_by_user
                    ?.full_name,
                )}
              </div>
            </div>
          `;
        })
        .join("")
    : `
      <div
        class="empty-state"
        style="margin-top:12px"
      >
        No SAR treatment record yet.
      </div>
    `;
}

function renderMatchedCaseSummary(recordDetails) {
  const matchedRecords = recordDetails?.matchedRecords || [];
  const currentRecordId = recordDetails?.casualty?.id;

  if (matchedRecords.length <= 1) {
    return "";
  }

  return `
    <section class="record-section">
      <div class="section-card-header">
        <div>
          <h3>Matched Case</h3>
          <p class="panel-subtitle">These separate role records were linked by admin Match Casing.</p>
        </div>
        <span class="pill green">${matchedRecords.length} linked records</span>
      </div>

      <div class="grid three">
        ${matchedRecords
          .map((record) => {
            const role = matchCasingRoleBucket(record);
            const triage =
              record?.latest_triage_assessment?.calculated_category ||
              record?.latest_triage_assessment?.triage_category ||
              record?.latest_triage_assessment?.responder_category ||
              "unknown";
            const isCurrent = record.id === currentRecordId;

            return `
              <article class="incident-section-card">
                <div class="section-card-header">
                  <div>
                    <h3>${escapeHtml(matchCasingRoleLabel(role))}</h3>
                    <p class="panel-subtitle">${escapeHtml(record?.encoder?.full_name || "Unknown encoder")}</p>
                  </div>
                  <span class="pill ${isCurrent ? "blue" : "green"}">${isCurrent ? "Current" : "Matched"}</span>
                </div>

                <div class="summary-facts">
                  <div><span>Victim Code</span><strong>${escapeHtml(record?.casualty?.id_number || "Not recorded")}</strong></div>
                  <div><span>Name</span><strong>${escapeHtml(fullCasualtyName(record?.casualty))}</strong></div>
                  <div><span>Triage</span><strong>${escapeHtml(roleLabel(triage))}</strong></div>
                  <div><span>Recorded</span><strong>${escapeHtml(formatDate(record?.reported_at || record?.created_at))}</strong></div>
                </div>

                <div class="button-row">
                  ${
                    isCurrent
                      ? `<button class="ghost-button mini" type="button" disabled>Opened record</button>`
                      : `<button class="ghost-button mini" type="button" data-open-casualty="${escapeHtml(record.id)}">Open matched record</button>`
                  }
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderCasualtyRecordModal(
  item,
  recordDetails = null,
) {
  const casualty = item.casualty || {};
  const incident = item.incident || {};
  const evacuationCenter = item.evacuation_center || {};
  const healthcareFacility = item.healthcare_facility || {};
  const encoder = item.encoder || {};
  const matchedRecordDetails =
    recordDetails?.matchedRecordDetails?.length
      ? recordDetails.matchedRecordDetails
      : [recordDetails].filter(Boolean);
  const findMatchedDetails = (role) =>
    matchedRecordDetails.find(
      (details) => matchCasingRoleBucket(details?.casualty) === role,
    ) || null;
  const fieldRecordDetails =
    findMatchedDetails("field_responder") ||
    (matchCasingRoleBucket(item) === "responder"
      ? recordDetails
      : null);
  const saRecordDetails =
    findMatchedDetails("sa_responder") || null;
  const healthcareRecordDetails =
    findMatchedDetails("documenter") || null;
  const fieldItem = fieldRecordDetails?.casualty || {};
  const saItem = saRecordDetails?.casualty || {};
  const healthcareItem = healthcareRecordDetails?.casualty || {};
  const fieldCasualty = fieldItem.casualty || {};
  const saCasualty = saItem.casualty || {};
  const healthcareCasualty = healthcareItem.casualty || {};

  const fieldResponderTriage =
    (fieldRecordDetails?.triageHistory || []).filter(
      (record) => record.triage_stage === "on_site",
    );

  const saResponderTriage =
    (saRecordDetails?.triageHistory || []).filter(
      (record) => record.triage_stage === "reassessment",
    );

  const healthcareFacilityTriage =
    (healthcareRecordDetails?.triageHistory || []).filter(
      (record) =>
        record.triage_stage === "facility_arrival",
    );

    const healthcareDocumenterTreatment =
  (healthcareRecordDetails?.treatmentHistory || []).find(
    (record) => {
      const details = record?.treatment_details;

      return (
        details &&
        typeof details === "object" &&
        !Array.isArray(details) &&
        Object.prototype.hasOwnProperty.call(
          details,
          "dispositionUponHospitalArrival",
        )
      );
    },
  ) || null;

const healthcareDocumenterDetails =
  healthcareDocumenterTreatment?.treatment_details ||
  {};

const healthcareFacilityEncounter =
  healthcareItem.latest_facility_encounter || {};

    const victimCode =
  getCasualtyVictimCode(
    saItem,
    saRecordDetails,
  );

const healthcareAdmittedUnit =
  healthcareDocumenterDetails.admittedToUnit || null;

const healthcareIsIcu =
  healthcareAdmittedUnit === "ICU";

const healthcareIsWard =
  healthcareAdmittedUnit === "Ward";

const healthcareIsOtherUnit =
  healthcareAdmittedUnit === "Other Unit";

const newborn =
  extractRecordSectionValue(
    saItem.remarks,
    "Advanced Medical Responder Details",
    "Newborn",
  ) ||
  extractRecordSectionValue(
    saItem.remarks,
    "SA Responder Details",
    "Newborn",
  );

const pregnant =
  extractRecordSectionValue(
    saItem.remarks,
    "Advanced Medical Responder Details",
    "Pregnant",
  ) ||
  extractRecordSectionValue(
    saItem.remarks,
    "SA Responder Details",
    "Pregnant",
  );

const religion =
  extractRecordSectionValue(
    saItem.remarks,
    "Advanced Medical Responder Details",
    "Religion",
  ) ||
  extractRecordSectionValue(
    saItem.remarks,
    "SA Responder Details",
    "Religion",
  );

  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="record-modal" role="dialog" aria-modal="true" aria-labelledby="recordModalTitle">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Casualty Verification Record</span>
            <h2 id="recordModalTitle">${escapeHtml(fullCasualtyName(casualty))}</h2>
            <p>${escapeHtml(casualty.id_number || "No ID number")} - ${escapeHtml(incident.incident_name || "Unknown incident")}</p>
          </div>
          <button class="icon-button" type="button" data-close-modal aria-label="Close casualty record">&times;</button>
        </div>

        <div class="modal-status-row">
          <span class="pill ${verificationPillClass(item.verification_status)}">${escapeHtml(roleLabel(item.verification_status))}</span>
          <span class="pill blue">${escapeHtml(roleLabel(item.current_status))}</span>
          <span class="pill">${escapeHtml(roleLabel(item.severity))}</span>
        </div>

        <div class="modal-body">

          ${renderMatchedCaseSummary(recordDetails)}

          <section class="record-section">
            <h3>Field Responder</h3>

            <p class="panel-subtitle">
              Complete Field Responder casualty record
            </p>


            <!-- SAFETY -->
            <div style="margin-top:18px">
              <h4 style="margin:0 0 10px">
                Safety
              </h4>

              <div class="casualty-detail-grid">
                ${detailItem(
                  "Are You Safe?",
                  extractRecordSectionValue(
                    fieldItem.remarks,
                    "Responder Safety",
                    "Are you safe",
                  ),
                )}

                ${detailItem(
                  "Time of PPE Use",
                  extractRecordSectionValue(
                    fieldItem.remarks,
                    "Responder Safety",
                    "Time of PPE Use",
                  ),
                )}
              </div>
            </div>


            <!-- TRIAGE -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 4px">
                Triage
              </h4>

              <p class="panel-subtitle">
                Primary / on-site triage assessment
              </p>

              ${renderFieldResponderTriageContent(
                fieldResponderTriage,
              )}
            </div>


            <!-- STATUS -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Status
              </h4>

              <div class="casualty-detail-grid">
                ${detailItem(
                  "Notes",
                  extractRecordBaseText(fieldItem.remarks) ||
                    "No notes",
                )}

                ${detailItem(
                  "Victim Code Marking",
                  fieldResponderTriage.length
                    ? "Confirmed before submission"
                    : "Not recorded",
                )}
              </div>
            </div>
          </section>

          <section class="record-section">
            <h3>Advanced Medical Responder</h3>

            <p class="panel-subtitle">
              Complete Advanced Medical Responder casualty record
            </p>


            <!-- SAFETY -->
            <div style="margin-top:18px">
              <h4 style="margin:0 0 10px">
                Safety
              </h4>

              <div class="casualty-detail-grid">
                ${detailItem(
                  "Are You Safe?",
                  extractRecordSectionValue(
                    saItem.remarks,
                    "Responder Safety",
                    "Are you safe",
                  ),
                )}

                ${detailItem(
                  "Time of PPE Use",
                  extractRecordSectionValue(
                    saItem.remarks,
                    "Responder Safety",
                    "Time of PPE Use",
                  ),
                )}
              </div>
            </div>


            <!-- INTRODUCTION -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Introduction
              </h4>

              <div class="casualty-detail-grid">
                ${detailItem(
                  "Witness Present",
                  extractRecordSectionValue(
                    saItem.remarks,
                    "Advanced Medical Responder Details",
                    "Witness present",
                  ) ||
                    extractRecordSectionValue(
                      saItem.remarks,
                      "SA Responder Details",
                      "Witness present",
                    ),
                )}

                ${detailItem(
                  "Other Witness",
                  extractRecordSectionValue(
                    saItem.remarks,
                    "Advanced Medical Responder Details",
                    "Witness other",
                  ) ||
                    extractRecordSectionValue(
                      saItem.remarks,
                      "SA Responder Details",
                      "Witness other",
                    ),
                )}

                ${detailItem(
                  "Witness Response",
                  extractRecordSectionValue(
                    saItem.remarks,
                    "Advanced Medical Responder Details",
                    "Witness response",
                  ) ||
                    extractRecordSectionValue(
                      saItem.remarks,
                      "SA Responder Details",
                      "Witness response",
                    ),
                )}

                ${detailItem(
                  "CPR Type",
                  extractRecordSectionValue(
                    saItem.remarks,
                    "Advanced Medical Responder Details",
                    "CPR type",
                  ) ||
                    extractRecordSectionValue(
                      saItem.remarks,
                      "SA Responder Details",
                      "CPR type",
                    ),
                )}
                )}
              </div>
            </div>


            <!-- PERSONAL INFORMATION -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Personal Information
              </h4>

              <div class="casualty-detail-grid">
                ${detailItem("Victim Code", victimCode)}

                ${detailItem(
                  "Patient Identified",
                  formatPatientIdentified(saCasualty),
                )}

                ${detailItem(
                  "ID Number",
                  saCasualty.id_number,
                )}

                ${detailItem(
                  "Age",
                  saCasualty.estimated_age,
                )}

                ${detailItem(
                  "First Name",
                  saCasualty.first_name,
                )}

                ${detailItem(
                  "Middle Name",
                  saCasualty.middle_name,
                )}

                ${detailItem(
                  "Last Name",
                  saCasualty.last_name,
                )}

                ${detailItem(
                  "Sex",
                  saCasualty.sex,
                )}

                ${detailItem(
                  "Date of Birth",
                  saCasualty.date_of_birth,
                )}

                ${detailItem("Newborn", newborn)}
                ${detailItem("Pregnant", pregnant)}
                ${detailItem("Religion", religion)}

                ${detailItem(
                  "Contact Number",
                  saCasualty.contact_number,
                )}
              </div>
            </div>


            <!-- ADDRESS -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Address
              </h4>

              <div class="casualty-detail-grid">
                ${detailItem(
                  "House / Street",
                  saCasualty.house_street,
                )}

                ${detailItem(
                  "Barangay",
                  saCasualty.barangay,
                )}

                ${detailItem(
                  "Municipality / City",
                  saCasualty.municipality,
                )}

                ${detailItem(
                  "Province",
                  saCasualty.province,
                )}

                ${detailItem(
                  "Region",
                  saCasualty.region,
                )}
              </div>
            </div>


            <!-- TRIAGE -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 4px">
                Triage
              </h4>

              <p class="panel-subtitle">
                Secondary / reassessment triage
              </p>

              ${renderTriageHistoryContent(
                saResponderTriage,
              )}
            </div>


            <!-- TREATMENT -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Treatment
              </h4>

              ${renderSaTreatmentHistoryContent(
                saRecordDetails?.treatmentHistory || [],
                saItem,
              )}
            </div>
            


            <!-- TRANSPORT / RELEASE -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Transport / Release
              </h4>

              ${renderSaTransportHistoryContent(
                saRecordDetails?.transportHistory || [],
              )}
            </div>


            <!-- REMARKS -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Remarks
              </h4>

              <div class="casualty-detail-grid">
                ${detailItem(
                  "Remarks",
                  extractRecordBaseText(saItem.remarks) ||
                    "No remarks",
                )}
              </div>
            </div>
          </section>


          <section class="record-section">
            <h3>Healthcare Facility Documenter</h3>

            <p class="panel-subtitle">
              Complete healthcare facility casualty documentation
            </p>


            <!-- PATIENT INFORMATION -->
            <div
                style="
                  margin-top:20px;
                  padding-top:16px;
                  border-top:1px solid #e2e7ef;
                "
              >
                <h4 style="margin:0 0 10px">
                  Patient Information
                </h4>

                <div class="casualty-detail-grid">

                  ${detailItem(
                    "First Name",
                    healthcareCasualty.first_name,
                  )}

                  ${detailItem(
                    "Middle Name",
                    healthcareCasualty.middle_name,
                  )}

                  ${detailItem(
                    "Last Name",
                    healthcareCasualty.last_name,
                  )}

                  ${detailItem(
                    "Sex",
                    healthcareCasualty.sex,
                  )}

                  ${detailItem(
                    "Date of Birth",
                    healthcareCasualty.date_of_birth,
                  )}

                </div>
              </div>


            <!-- TRIAGE -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 4px">
                Triage
              </h4>

              <p class="panel-subtitle">
                Tertiary / facility-arrival triage
              </p>

              ${renderTriageHistoryContent(
                healthcareFacilityTriage,
              )}
            </div>
            <!-- MANAGEMENT -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Management
              </h4>

              <div class="casualty-detail-grid">

                ${detailItem(
                  "Resuscitation Room Used?",
                  formatTriageRecordValue(
                    healthcareDocumenterDetails
                      .resuscitationRoomUsed,
                  ),
                )}

                ${
                  healthcareDocumenterDetails
                    .resuscitationRoomUsed === true
                    ? detailItem(
                        "Time of Resuscitation Room Use",
                        formatDate(
                          healthcareFacilityEncounter
                            .ed_resuscitation_started_at,
                        ),
                      )
                    : ""
                }


                ${detailItem(
                  "Surgical Intervention?",
                  formatTriageRecordValue(
                    healthcareDocumenterDetails
                      .surgicalInterventionRequired,
                  ),
                )}

                ${
                  healthcareDocumenterDetails
                    .surgicalInterventionRequired === true
                    ? `
                      ${detailItem(
                        "Surgical Intervention Start Time",
                        formatDate(
                          healthcareFacilityEncounter
                            .surgical_intervention_started_at,
                        ),
                      )}

                      ${detailItem(
                        "Surgical Intervention End Time",
                        formatDate(
                          healthcareFacilityEncounter
                            .surgical_intervention_ended_at,
                        ),
                      )}

                      ${detailItem(
                        "Operating Room Used?",
                        formatTriageRecordValue(
                          healthcareDocumenterDetails
                            .operatingRoomUsed,
                        ),
                      )}

                      ${
                        healthcareDocumenterDetails
                          .operatingRoomUsed === true
                          ? `
                            ${detailItem(
                              "Number of Operating Rooms",
                              healthcareDocumenterDetails
                                .numberOfOperatingRooms,
                            )}

                            ${detailItem(
                              "Operating Room Use Time",
                              formatDate(
                                healthcareFacilityEncounter
                                  .operating_room_started_at,
                              ),
                            )}
                          `
                          : ""
                      }
                    `
                    : ""
                }


                ${detailItem(
                  "X-Ray Used?",
                  formatTriageRecordValue(
                    healthcareFacilityEncounter.xray_required,
                  ),
                )}

                ${
                  healthcareFacilityEncounter.xray_required === true
                    ? detailItem(
                        "Time of X-Ray Use",
                        formatDate(
                          healthcareFacilityEncounter
                            .xray_performed_at,
                        ),
                      )
                    : ""
                }


                ${detailItem(
                  "Ultrasound Used?",
                  formatTriageRecordValue(
                    healthcareFacilityEncounter
                      .ultrasound_required,
                  ),
                )}

                ${
                  healthcareFacilityEncounter
                    .ultrasound_required === true
                    ? detailItem(
                        "Time of Ultrasound Use",
                        formatDate(
                          healthcareFacilityEncounter
                            .ultrasound_performed_at,
                        ),
                      )
                    : ""
                }


                ${detailItem(
                  "CT Scan Used?",
                  formatTriageRecordValue(
                    healthcareFacilityEncounter.ct_required,
                  ),
                )}

                ${
                  healthcareFacilityEncounter.ct_required === true
                    ? detailItem(
                        "Time of CT Scan Use",
                        formatDate(
                          healthcareFacilityEncounter
                            .ct_performed_at,
                        ),
                      )
                    : ""
                }


                ${detailItem(
                  "Admitted to Unit",
                  healthcareAdmittedUnit,
                )}


                ${
                  healthcareIsIcu
                    ? `
                      ${detailItem(
                        "ICU Admission Time",
                        formatDate(
                          healthcareFacilityEncounter
                            .icu_admitted_at,
                        ),
                      )}

                      ${detailItem(
                        "Mechanical Ventilation Used?",
                        formatTriageRecordValue(
                          healthcareFacilityEncounter
                            .mechanical_ventilation_required,
                        ),
                      )}

                      ${
                        healthcareFacilityEncounter
                          .mechanical_ventilation_required === true
                          ? `
                            ${detailItem(
                              "Ventilation Start Time",
                              formatDate(
                                healthcareFacilityEncounter
                                  .ventilation_started_at,
                              ),
                            )}

                            ${detailItem(
                              "Ventilation End Time",
                              formatDate(
                                healthcareFacilityEncounter
                                  .ventilation_ended_at,
                              ),
                            )}
                          `
                          : ""
                      }

                      ${detailItem(
                        "Alternative ICU Used?",
                        formatTriageRecordValue(
                          healthcareFacilityEncounter
                            .alternative_icu_used,
                        ),
                      )}
                    `
                    : ""
                }


                ${
                  healthcareIsWard
                    ? detailItem(
                        "Ward Admission Time",
                        formatDate(
                          healthcareDocumenterDetails
                            .unitAdmissionTime,
                        ),
                      )
                    : ""
                }


                ${
                  healthcareIsOtherUnit
                    ? `
                      ${detailItem(
                        "Other Unit",
                        healthcareDocumenterDetails
                          .otherAdmittedUnit,
                      )}

                      ${detailItem(
                        "Admission Time",
                        formatDate(
                          healthcareDocumenterDetails
                            .unitAdmissionTime,
                        ),
                      )}
                    `
                    : ""
                }

                            </div>
            </div>


            <!-- DISPOSITION -->
            <div
              style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e2e7ef;
              "
            >
              <h4 style="margin:0 0 10px">
                Disposition
              </h4>

              <div class="casualty-detail-grid">

                ${
                  healthcareIsIcu
                    ? `
                      ${detailItem(
                        "Transferred to Ward",
                        formatTriageRecordValue(
                          healthcareDocumenterDetails
                            .transferredToWard,
                        ),
                      )}

                      ${
                        healthcareDocumenterDetails
                          .transferredToWard === true
                          ? detailItem(
                              "Time of Transfer to Ward",
                              formatDate(
                                healthcareFacilityEncounter
                                  .icu_discharged_at,
                              ),
                            )
                          : ""
                      }

                      ${detailItem(
                        "Discharged from Hospital",
                        formatTriageRecordValue(
                          healthcareFacilityEncounter
                            .discharged_home,
                        ),
                      )}

                      ${
                        healthcareFacilityEncounter
                          .discharged_home === true
                          ? detailItem(
                              "Time of Discharge",
                              formatDate(
                                healthcareFacilityEncounter
                                  .hospital_discharged_at,
                              ),
                            )
                          : ""
                      }
                    `
                    : ""
                }


                ${
                  (
                    healthcareIsWard ||
                    healthcareIsOtherUnit
                  )
                    ? `
                      ${detailItem(
                        "Active Care?",
                        formatTriageRecordValue(
                          healthcareDocumenterDetails
                            .inActiveCare,
                        ),
                      )}

                      ${
                        healthcareDocumenterDetails
                          .inActiveCare === false
                          ? `
                            ${detailItem(
                              "Discharged from Hospital",
                              formatTriageRecordValue(
                                healthcareFacilityEncounter
                                  .discharged_home,
                              ),
                            )}

                            ${
                              healthcareFacilityEncounter
                                .discharged_home === true
                                ? detailItem(
                                    "Time of Discharge",
                                    formatDate(
                                      healthcareFacilityEncounter
                                        .hospital_discharged_at,
                                    ),
                                  )
                                : ""
                            }
                          `
                          : ""
                      }
                    `
                    : ""
                }


                ${
                  healthcareAdmittedUnit === "Not Admitted"
                    ? `
                      ${detailItem(
                        "Discharged from Hospital",
                        formatTriageRecordValue(
                          healthcareFacilityEncounter
                            .discharged_home,
                        ),
                      )}

                      ${
                        healthcareFacilityEncounter
                          .discharged_home === true
                          ? detailItem(
                              "Time of Discharge",
                              formatDate(
                                healthcareFacilityEncounter
                                  .hospital_discharged_at,
                              ),
                            )
                          : ""
                      }
                    `
                    : ""
                }


                ${
                  healthcareAdmittedUnit === "Unknown" ||
                  !healthcareAdmittedUnit
                    ? `
                      ${detailItem(
                        "Active Care?",
                        formatTriageRecordValue(
                          healthcareDocumenterDetails
                            .inActiveCare,
                        ),
                      )}

                      ${detailItem(
                        "Discharged from Hospital",
                        formatTriageRecordValue(
                          healthcareFacilityEncounter
                            .discharged_home,
                        ),
                      )}
                    `
                    : ""
                }

              </div>
            </div>


          </section>
          
          <section class="record-section">
            <h3>Record History</h3>

            <div class="casualty-detail-grid">
              ${detailItem(
                "Status updates",
                recordDetails?.statusHistory?.length ?? 0,
              )}

              ${detailItem(
                "Triage assessments",
                recordDetails?.triageHistory?.length ?? 0,
              )}

              ${detailItem(
                "Transport records",
                recordDetails?.transportHistory?.length ?? 0,
              )}

              ${detailItem(
                "Verification actions",
                recordDetails?.verificationHistory?.length ?? 0,
              )}

              ${detailItem(
                "Attachments",
                recordDetails?.attachments?.length ?? 0,
              )}
            </div>
          </section>

          ${renderAttachmentSection(recordDetails)}
        </div>
      </section>
    </div>
  `;
}

function closeRecordModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

async function loadSingleCasualtyRecordDetails(casualtyId) {
  const encodedId = encodeURIComponent(casualtyId);

  const existingRecord = state.casualties.find(
    (record) => record.id === casualtyId,
  );

  const [
  casualtyResult,
  statusHistoryResult,
  triageHistoryResult,
  treatmentHistoryResult,
  transportHistoryResult,
  verificationHistoryResult,
  attachmentResult,
] = await Promise.allSettled([
    apiRequest(`/casualties/${encodedId}`),
    apiRequest(`/casualties/${encodedId}/status-history`),
    apiRequest(`/casualties/${encodedId}/triage-history`),
    apiRequest(`/casualties/${encodedId}/treatment-history`),
    apiRequest(`/casualties/${encodedId}/transport-history`),
    apiRequest(`/casualties/${encodedId}/verification-history`),
    apiRequest(`/attachments?casualtyIncidentId=${encodedId}`),
  ]);

  const casualty =
    casualtyResult.status === "fulfilled"
      ? casualtyResult.value.data
      : existingRecord;

  if (!casualty) {
    throw new Error("Casualty record could not be found.");
  }

  return {
    casualty,

    statusHistory:
      statusHistoryResult.status === "fulfilled"
        ? statusHistoryResult.value.data || []
        : [],

    triageHistory:
      triageHistoryResult.status === "fulfilled"
        ? triageHistoryResult.value.data || []
        : [],

    treatmentHistory:
  treatmentHistoryResult.status === "fulfilled"
    ? treatmentHistoryResult.value.data || []
    : [],

transportHistory:
      transportHistoryResult.status === "fulfilled"
        ? transportHistoryResult.value.data || []
        : [],

    verificationHistory:
      verificationHistoryResult.status === "fulfilled"
        ? verificationHistoryResult.value.data || []
        : [],

    attachments:
      attachmentResult.status === "fulfilled"
        ? attachmentResult.value.data || []
        : [],
  };
}

async function loadCasualtyRecordDetails(casualtyId) {
  const primaryDetails = await loadSingleCasualtyRecordDetails(casualtyId);
  const currentCaseLink = (state.caseLinks || []).find(
    (link) => link.casualty_incident_id === casualtyId,
  );

  if (!currentCaseLink) {
    return {
      ...primaryDetails,
      matchedRecords: [primaryDetails.casualty],
      matchedRecordDetails: [primaryDetails],
    };
  }

  const matchedIds = (state.caseLinks || [])
    .filter((link) => link.case_id === currentCaseLink.case_id)
    .map((link) => link.casualty_incident_id)
    .filter(Boolean);

  const otherIds = matchedIds.filter((id) => id !== casualtyId);
  const otherDetails = await Promise.all(
    otherIds.map((id) => loadSingleCasualtyRecordDetails(id)),
  );
  const matchedRecordDetails = [
    primaryDetails,
    ...otherDetails,
  ].sort((first, second) =>
    compareText(
      matchCasingRoleLabel(matchCasingRoleBucket(first.casualty)),
      matchCasingRoleLabel(matchCasingRoleBucket(second.casualty)),
    ),
  );

  return {
    ...primaryDetails,
    matchedRecords: matchedRecordDetails.map((details) => details.casualty),
    matchedRecordDetails,
  };
}

async function openCasualtyRecordModal(casualtyId) {
  if (!casualtyId) {
    return;
  }

  try {
    const details =
      await loadCasualtyRecordDetails(casualtyId);

    closeRecordModal();

    document.body.insertAdjacentHTML(
      "beforeend",
      renderCasualtyRecordModal(
        details.casualty,
        details,
      ),
    );

    document
      .querySelectorAll("[data-close-modal]")
      .forEach((element) => {
        element.addEventListener("click", (event) => {
          if (
            event.target === element ||
            element.matches("button")
          ) {
            closeRecordModal();
          }
        });
      });

    bindVerificationReviewActions();
    bindAttachmentPreviewActions();
    bindOpenCasualtyRecord();
  } catch (error) {
    console.error(
      "Failed to load casualty record details:",
      error,
    );

    showDashboardToast(
      error instanceof Error
        ? error.message
        : "Unable to load casualty record.",
      "error",
    );
  }
}

function bindOpenCasualtyRecord() {
  document.querySelectorAll("[data-open-casualty]").forEach((element) => {
    if (element.dataset.openBound === "true") return;
    element.dataset.openBound = "true";

    element.addEventListener("click", (event) => {
      if (
        event.target.closest("[data-review-action]") ||
        event.target.closest("[data-delete-casualty]")
      ) {
        return;
      }
      event.stopPropagation();
      openCasualtyRecordModal(element.dataset.openCasualty);
    });
  });
}

function bindVerificationReviewActions() {
  document.querySelectorAll("[data-review-action]").forEach((button) => {
    if (button.dataset.reviewBound === "true") return;
    button.dataset.reviewBound = "true";

    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const casualtyId = button.dataset.casualtyId;
      const status = button.dataset.reviewAction;

      if (!casualtyId || !status) return;

      let notes = "";

      if (status === "rejected") {
        notes = await showDashboardTextPrompt({
          title: "Reject casualty record",
          message:
            "Add the reason this casualty record is being returned to the responder.",
          label: "Rejection notes",
          placeholder: "Example: Missing triage details or incorrect victim code",
          confirmLabel: "Reject record",
          cancelLabel: "Cancel",
          required: true,
          requiredMessage: "Rejection notes are required.",
        }) || "";

        if (!notes) {
          setMessage("verificationMessage", "Rejection notes are required.", "error");
          return;
        }
      }

      setMessage("verificationMessage", "Updating verification status...");

      try {
        await apiRequest(`/casualties/${encodeURIComponent(casualtyId)}/verification`, {
          method: "PATCH",
          body: JSON.stringify({
            status,
            notes,
          }),
        });

        await loadSharedData();
        closeRecordModal();
        renderCurrentView();
        bindView();
        setMessage("verificationMessage", "Verification status updated.", "success");
        showDashboardToast("Verification status updated.", "success");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to update verification status.";
        setMessage("verificationMessage", message, "error");
        showDashboardToast(message, "error");
      }
    });
  });
}

function bindDeleteCasualtyActions() {
  document.querySelectorAll("[data-delete-casualty]").forEach((button) => {
    if (button.dataset.deleteBound === "true") return;
    button.dataset.deleteBound = "true";

    button.addEventListener("click", async (event) => {
      event.stopPropagation();

      const casualtyId = button.dataset.deleteCasualty;

      if (!casualtyId) {
        return;
      }

      const confirmed = await showDashboardConfirm({
        title: "Delete casualty record?",
        message:
          "This record will disappear from the web dashboard and mobile app records.",
        confirmLabel: "Delete record",
        cancelLabel: "Keep record",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        button.disabled = true;
        button.textContent = "Deleting...";

        await apiRequest(`/casualties/${encodeURIComponent(casualtyId)}`, {
          method: "DELETE",
        });

        await loadSharedData();
        renderCurrentView();
        bindView();
        setMessage(
          "verificationMessage",
          "Casualty record deleted successfully.",
          "success",
        );
        showDashboardToast(
          "Casualty record deleted successfully.",
          "success",
        );
      } catch (error) {
        button.disabled = false;
        button.textContent = "Delete";
        const message =
          error instanceof Error
            ? error.message
            : "Unable to delete casualty record.";
        setMessage("verificationMessage", message, "error");
        showDashboardToast(
          message,
          "error",
        );
      }
    });
  });
}

function renderAdminActionLogs() {
  return renderActionLogsShell();
}

function formatAuditAction(action) {
  const labels = {
    "account.created": "Account created",
    "account.updated": "Account updated",
    "account.deleted": "Account deleted",
    "account.deactivated": "Account deactivated",
    "casualty.created": "Casualty added",
    "casualty.verified": "Casualty verified",
    "casualty.rejected": "Casualty rejected",
    "casualty.deleted": "Casualty deleted",
    "casualty.resubmitted": "Casualty resubmitted",
    "casualty.verification_updated": "Verification updated",
    "incident.created": "Incident created",
    "incident.updated": "Incident updated",
    "incident.closed": "Incident closed",
    "operational_data.reset": "Records reset",
    "healthcare_facility.created": "Healthcare facility created",
    "healthcare_facility.updated": "Healthcare facility updated",
    "evacuation_center.created": "Evacuation center created",
    "bulk_import.admin_accounts": "Bulk admin account import",
    "bulk_import.unit_accounts": "Bulk unit account import",
    "bulk_import.healthcare_facilities": "Bulk healthcare facility import",
    "bulk_import.evacuation_centers": "Bulk evacuation center import",
  };

  return labels[action] || String(action || "Unknown action")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditEntityType(entityType) {
  return String(entityType || "record")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditDetails(log) {
  const metadata = log?.metadata || {};
  const parts = [];

  if (
    typeof metadata.created === "number" ||
    typeof metadata.skipped === "number" ||
    typeof metadata.failed === "number"
  ) {
    parts.push(
      `Created ${metadata.created ?? 0}`,
      `Skipped ${metadata.skipped ?? 0}`,
      `Failed ${metadata.failed ?? 0}`,
    );
  }

  if (metadata.oldStatus || metadata.newStatus) {
    parts.push(
      `${metadata.oldStatus || "none"} -> ${metadata.newStatus || "none"}`,
    );
  }

  if (Array.isArray(metadata.updatedFields) && metadata.updatedFields.length) {
    parts.push(`Fields: ${metadata.updatedFields.join(", ")}`);
  }

  if (metadata.incidentCode) {
    parts.push(`Incident ${metadata.incidentCode}`);
  }

  if (metadata.accountRole) {
    parts.push(`Role: ${metadata.accountRole}`);
  }

  if (metadata.scope) {
    parts.push(`Scope: ${metadata.scope}`);
  }

  return parts.length ? parts.join(" | ") : "No extra details";
}

function renderAuditLogsTable() {
  const logs = (state.auditLogs || [])
    .filter((log) => {
      if (!state.auditLogDateFilter) return true;
      return formatDateFilterValue(log.created_at) === state.auditLogDateFilter;
    })
    .sort(
      (first, second) =>
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime(),
    );

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Action Logs</h2>
          <p class="panel-subtitle">${isSuperAdmin() ? "Audit trail for admin accounts only." : "Audit trail scoped to your admin unit, including responders and documenters you created."}</p>
        </div>
      </div>
      <div class="form-grid two" style="margin-top:16px">
        <label class="field">
          <span>Filter by date</span>
          <input
            id="auditLogDateFilterInput"
            type="date"
            value="${escapeHtml(state.auditLogDateFilter)}"
          />
        </label>
        <div class="field">
          <span>Showing</span>
          <div class="readonly-field">${logs.length} newest-first action logs</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Record</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${
              logs
                .map(
                  (log) => `
                    <tr>
                      <td>${formatDate(log.created_at)}</td>
                      <td><span class="pill blue">${escapeHtml(formatAuditAction(log.action))}</span></td>
                      <td>
                        <strong>${escapeHtml(log.entity_label || "Unknown record")}</strong><br />
                        <span class="panel-subtitle">${escapeHtml(formatAuditEntityType(log.entity_type))}</span>
                      </td>
                      <td>
                        <strong>${escapeHtml(log.actor_full_name || "Unknown user")}</strong><br />
                        <span class="panel-subtitle">${escapeHtml(log.actor_role || "Unknown role")}</span>
                      </td>
                      <td>${escapeHtml(formatAuditDetails(log))}</td>
                    </tr>
                  `,
                )
                .join("") ||
              `<tr><td colspan="5"><div class="empty-state">No audit logs yet.</div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderIncidentHistory() {
  const allVisibleIncidents = state.allIncidents.length
    ? state.allIncidents
    : state.incidents;
  const incidents = filterIncidentsBySearchAndDate(allVisibleIncidents);
  const subtitle = isUnitScopedAdmin()
    ? "All official incidents created by this admin account, including active and closed incidents."
    : "All official incidents created by admin users, including active and closed incidents.";

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Incident history</h2>
          <p class="panel-subtitle">${escapeHtml(subtitle)}</p>
        </div>
      </div>
      ${renderIncidentSearchFilters(incidents.length, allVisibleIncidents.length)}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Hazard</th><th>Location</th><th>Status</th><th>Started</th><th>Actions</th></tr></thead>
          <tbody>
            ${incidents
              .map(
                (incident) => `
                  <tr>
                    <td>${escapeHtml(incident.incident_code)}</td>
                    <td><strong>${escapeHtml(incident.incident_name)}</strong></td>
                    <td>${escapeHtml(incident.disaster_type)}</td>
                    <td>${escapeHtml([incident.barangay, incident.municipality, incident.province].filter(Boolean).join(", "))}</td>
                    <td><span class="pill blue">${escapeHtml(incident.status)}</span></td>
                    <td>${formatDate(incident.started_at)}</td>
                    <td>
                      <div class="table-actions">
                        <button class="ghost-button mini" type="button" data-view-incident-records="${escapeHtml(incident.id)}">View records</button>
                        <button class="ghost-button mini" type="button" data-view-incident-analytics="${escapeHtml(incident.id)}">View analytics</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("") || `<tr><td colspan="7"><div class="empty-state">No incidents match the current search filters.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderActionLogsShell() {
  return renderAuditLogsTable();
}

function renderRecentActivity() {
  return `
    <section class="panel">
      <h2>Recent mobile activity</h2>
      <p class="panel-subtitle">Latest casualty records from responders and documenters.</p>
      <div class="table-wrap" style="margin-top:12px">
        <table>
          <thead><tr><th>Incident</th><th>Status</th><th>Verification</th><th>Reported</th></tr></thead>
          <tbody>
            ${state.recentActivity
              .map(
                (item) => `
                  <tr>
                    <td>${escapeHtml(item.incident?.incident_name || "Unknown incident")}</td>
                    <td>${escapeHtml(item.current_status)}</td>
                    <td><span class="pill orange">${escapeHtml(item.verification_status)}</span></td>
                    <td>${formatDate(item.reported_at)}</td>
                  </tr>
                `,
              )
              .join("") || `<tr><td colspan="4"><div class="empty-state">No recent activity yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function bindAuditLogsFilters() {
  const dateInput = qs("#auditLogDateFilterInput");

  if (!dateInput) return;

  dateInput.addEventListener("input", () => {
    state.auditLogDateFilter = dateInput.value;
    renderCurrentView();
    bindView();
  });
}

function renderCallDownList() {
  const activeStaff = state.callDownStaff.filter((staff) => staff.is_active !== false);

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Call Down List</h2>
          <p class="panel-subtitle">Extra operational staff contacts used by DMMP Staff Call Down. System account users are added automatically.</p>
        </div>
        <span class="pill blue">${activeStaff.length} active contacts</span>
      </div>
      <form id="callDownStaffForm" class="form-grid">
        <input name="staffId" type="hidden" />
        <div class="form-grid two">
          <label class="field"><span>Full name</span><input name="fullName" required placeholder="Staff full name" /></label>
          <label class="field"><span>Role / position</span><input name="rolePosition" placeholder="Doctor, nurse, driver, coordinator" /></label>
          <label class="field"><span>Contact number</span><input name="contactNumber" placeholder="Mobile or radio contact" /></label>
          <label class="field"><span>Assigned team / unit</span><input name="assignedTeamUnit" placeholder="DMMP, EMS, ER, logistics" /></label>
        </div>
        <label class="field"><span>Notes</span><textarea name="notes" placeholder="Availability, specialty, or contact instruction"></textarea></label>
        <div class="button-row">
          <button class="primary-button" type="submit" id="callDownStaffSubmitButton">Add staff contact</button>
          <button class="ghost-button" type="button" data-clear-call-down-staff-form>Clear form</button>
        </div>
        <div id="callDownStaffMessage" class="status-message" hidden></div>
      </form>
      <div class="table-wrap" style="margin-top:18px">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role / Position</th>
              <th>Contact</th>
              <th>Team / Unit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.callDownStaff
              .map(
                (staff) => `
                  <tr>
                    <td><strong>${escapeHtml(staff.full_name || "Unnamed staff")}</strong></td>
                    <td>${escapeHtml(staff.role_position || "Not recorded")}</td>
                    <td>${escapeHtml(staff.contact_number || "Not recorded")}</td>
                    <td>${escapeHtml(staff.assigned_team_unit || "Not recorded")}</td>
                    <td><span class="pill ${staff.is_active === false ? "orange" : "green"}">${staff.is_active === false ? "Inactive" : "Active"}</span></td>
                    <td>
                      <div class="table-actions">
                        <button class="ghost-button mini" type="button" data-edit-call-down-staff="${escapeHtml(staff.id)}">Edit</button>
                        ${
                          staff.is_active === false
                            ? `<button class="secondary-button mini" type="button" data-activate-call-down-staff="${escapeHtml(staff.id)}">Reactivate</button>`
                            : `<button class="danger-button mini" type="button" data-deactivate-call-down-staff="${escapeHtml(staff.id)}">Deactivate</button>`
                        }
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("") || `<tr><td colspan="6"><div class="empty-state">No call down staff contacts yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function setCallDownStaffForm(staff = null) {
  const form = qs("#callDownStaffForm");
  if (!form) return;

  form.elements.staffId.value = staff?.id || "";
  form.elements.fullName.value = staff?.full_name || "";
  form.elements.rolePosition.value = staff?.role_position || "";
  form.elements.contactNumber.value = staff?.contact_number || "";
  form.elements.assignedTeamUnit.value = staff?.assigned_team_unit || "";
  form.elements.notes.value = staff?.notes || "";

  const button = qs("#callDownStaffSubmitButton");
  if (button) {
    button.textContent = staff ? "Save staff contact" : "Add staff contact";
  }
}

function bindCallDownStaffActions() {
  const form = qs("#callDownStaffForm");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const staffId = formValue(form, "staffId");
      const isEditing = Boolean(staffId);

      try {
        setMessage("callDownStaffMessage", isEditing ? "Saving staff contact..." : "Adding staff contact...");
        await apiRequest(
          isEditing
            ? `/call-down-staff/${encodeURIComponent(staffId)}`
            : "/call-down-staff",
          {
            method: isEditing ? "PATCH" : "POST",
            body: JSON.stringify({
              fullName: formValue(form, "fullName"),
              rolePosition: nullableFormText(form, "rolePosition"),
              contactNumber: nullableFormText(form, "contactNumber"),
              assignedTeamUnit: nullableFormText(form, "assignedTeamUnit"),
              notes: nullableFormText(form, "notes"),
            }),
          },
        );
        await loadSharedData();
        renderCurrentView();
        bindView();
        setMessage("callDownStaffMessage", isEditing ? "Staff contact saved." : "Staff contact added.", "success");
      } catch (error) {
        setMessage("callDownStaffMessage", getErrorMessage(error), "error");
      }
    });
  }

  qs("[data-clear-call-down-staff-form]")?.addEventListener("click", () => {
    setCallDownStaffForm(null);
  });

  document.querySelectorAll("[data-edit-call-down-staff]").forEach((button) => {
    button.addEventListener("click", () => {
      const staff = state.callDownStaff.find(
        (item) => item.id === button.dataset.editCallDownStaff,
      );
      setCallDownStaffForm(staff || null);
      qs("#callDownStaffForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document
    .querySelectorAll("[data-deactivate-call-down-staff], [data-activate-call-down-staff]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const staffId =
          button.dataset.deactivateCallDownStaff ||
          button.dataset.activateCallDownStaff;
        const isActive = Boolean(button.dataset.activateCallDownStaff);

        if (!staffId) return;

        try {
          await apiRequest(`/call-down-staff/${encodeURIComponent(staffId)}`, {
            method: "PATCH",
            body: JSON.stringify({ isActive }),
          });
          await loadSharedData();
          renderCurrentView();
          bindView();
          showDashboardToast(
            isActive ? "Staff contact reactivated." : "Staff contact deactivated.",
            "success",
          );
        } catch (error) {
          showDashboardToast(getErrorMessage(error), "error");
        }
      });
    });
}

const incidentTimelineFields = [
  ["disasterOccurredAt", "Disaster occurred", "disaster_occurred_at"],
  ["eventNotificationAt", "Event notification", "event_notification_at"],
  ["dmmpActivatedAt", "DMMP activated", "dmmp_activated_at"],
  ["medicalCoordinatorNotifiedAt", "Medical coordinator notified", "medical_coordinator_notified_at"],
  ["firstEmsOnSceneAt", "First EMS on scene", "first_ems_on_scene_at"],
  ["triageOrderedAt", "Triage ordered", "triage_ordered_at"],
  ["sceneDemobilizedAt", "Scene demobilized", "scene_demobilized_at"],
];

const coordinationFields = [
  ["initialActionsRating", "Initial actions", "initial_actions_rating"],
  ["sceneCoordinationRating", "Scene coordination", "scene_coordination_rating"],
  ["systemCoordinationRating", "System coordination", "system_coordination_rating"],
  ["communicationsRating", "Communications", "communications_rating"],
  ["resourceManagementRating", "Resource management", "resource_management_rating"],
];

const disruptionOptions = ["none", "minimal", "moderate", "total", "unknown"];
const safetyOptions = ["yes", "no", "unknown"];

const incidentManagementSections = [
  ["edit-incident", "Edit Incident", true, "accent"],
  ["timeline", "Response Timeline", true],
  ["dmmp-staff", "DMMP Staff Call-down", true],
  ["responder-safety", "Responder Safety", false],
  ["coordination", "Coordination Assessment", true],
  ["deactivation", "Deactivation & Continuity", true],
  ["onsite-triage", "Onsite Triage", false],
  ["facility-triage", "Facility Triage", false],
  ["onsite-care", "Onsite Care", false],
  ["scene-clearance", "Scene Clearance", false],
  ["survivor-distribution", "Survivor Distribution", false],
  ["ed-resources", "ED Resources", false],
  ["hospital-resources", "Hospital Resources", false],
  ["morbidity-mortality", "Morbidity & Mortality", false],
  ["sitrep-close", "SitRep & Close Incident", false],
];

async function loadIncidentManagementDetails(incidentId, options = {}) {
  const { renderLoading = true } = options;

  state.loadingIncidentManagementId = incidentId;

  if (renderLoading) {
    renderCurrentView();
    bindView();
  }

  const endpoints = {
    analytics: `/incidents/${encodeURIComponent(incidentId)}/analytics`,
    timeline: `/incidents/${encodeURIComponent(incidentId)}/timeline`,
    dmmpStaff: `/incidents/${encodeURIComponent(incidentId)}/dmmp-staff`,
    dmmpStaffSummary: `/incidents/${encodeURIComponent(incidentId)}/dmmp-staff-summary`,
    coordination: `/incidents/${encodeURIComponent(incidentId)}/coordination-assessment`,
    responderSafety: `/incidents/${encodeURIComponent(incidentId)}/responder-safety-report`,
    deactivation: `/incidents/${encodeURIComponent(incidentId)}/deactivation-continuity`,
    facilityOperational: `/incidents/${encodeURIComponent(incidentId)}/facility-operational-summary`,
    onsiteTriage: `/incidents/${encodeURIComponent(incidentId)}/onsite-triage-summary`,
    facilityTriage: `/incidents/${encodeURIComponent(incidentId)}/facility-triage-summary`,
    onsiteCare: `/incidents/${encodeURIComponent(incidentId)}/onsite-care-summary`,
    sceneClearance: `/incidents/${encodeURIComponent(incidentId)}/scene-clearance-summary`,
    survivorDistribution: `/incidents/${encodeURIComponent(incidentId)}/survivor-distribution-summary`,
    edResources: `/incidents/${encodeURIComponent(incidentId)}/ed-resource-summary`,
    hospitalResources: `/incidents/${encodeURIComponent(incidentId)}/hospital-resources`,
    hospitalResourceSummary: `/incidents/${encodeURIComponent(incidentId)}/hospital-resource-summary`,
    morbidityMortality: `/incidents/${encodeURIComponent(incidentId)}/morbidity-mortality-summary`,
  };

  const results = await Promise.allSettled(
    Object.entries(endpoints).map(async ([key, path]) => {
      const response = await apiRequest(path);
      return [key, response];
    }),
  );

  state.incidentManagementDetails[incidentId] = results.reduce((details, result) => {
    if (result.status === "fulfilled") {
      const [key, response] = result.value;
      details[key] = response;
    }
    return details;
  }, {});
  if (state.loadingIncidentManagementId === incidentId) {
    state.loadingIncidentManagementId = null;
  }
}

function renderIncidentManagement() {
  const sourceIncidents = state.allIncidents.length ? state.allIncidents : state.incidents;
  const incidents = filterIncidentsBySearchAndDate(sourceIncidents);

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Incident Management</h2>
          <p class="panel-subtitle">Manage every incident record, including active, closed, archived, and draft incidents.</p>
        </div>
        <span class="pill blue">${sourceIncidents.length} incidents</span>
      </div>
      ${renderIncidentSearchFilters(incidents.length, sourceIncidents.length)}
      <div class="incident-management-list">
        ${
          incidents
            .map((incident) => renderIncidentManagementItem(incident))
            .join("") || `<div class="empty-state">No incidents found.</div>`
        }
      </div>
      <div id="incidentManagementMessage" class="status-message" hidden></div>
    </section>
    ${renderIncidentSectionModal()}
  `;
}

function renderIncidentManagementItem(incident) {
  const isExpanded = state.expandedIncidentId === incident.id;
  const location = [incident.barangay, incident.municipality, incident.province]
    .filter(Boolean)
    .join(", ");
  const details = state.incidentManagementDetails[incident.id];
  const isLoading = state.loadingIncidentManagementId === incident.id;

  return `
    <article class="incident-management-item">
      <button class="incident-management-toggle" type="button" data-incident-toggle="${escapeHtml(incident.id)}">
        <div>
          <span class="eyebrow">${escapeHtml(incident.incident_code)}</span>
          <h3>${escapeHtml(incident.incident_name)}</h3>
          <p>${escapeHtml(location || incident.description || "No location recorded")}</p>
        </div>
        <div class="incident-management-meta">
          <span class="pill ${incident.status === "active" ? "green" : "blue"}">${escapeHtml(roleLabel(incident.status))}</span>
          <span>${formatDate(incident.started_at)}</span>
          <strong>${isExpanded ? "Collapse" : "Expand"}</strong>
        </div>
      </button>
      ${
        isExpanded
          ? isLoading
            ? `<div class="incident-management-body"><div class="empty-state">Loading incident sections...</div></div>`
            : renderIncidentManagementSections(incident, details || {})
          : ""
      }
    </article>
  `;
}

function getIncidentSectionLauncherSubtitle(sectionId, canEdit, details) {
  if (sectionId === "dmmp-staff") {
    const accountNames = state.unitUsers
      .filter((user) => user.is_active !== false)
      .map((user) => user.full_name || user.email)
      .filter(Boolean);
    const extraNames = state.callDownStaff
      .filter((staff) => staff.is_active !== false)
      .map((staff) => staff.full_name)
      .filter(Boolean);
    const names = [...accountNames, ...extraNames]
      .slice(0, 3)
      .filter(Boolean);
    const extraCount = Math.max(
      0,
      accountNames.length + extraNames.length - names.length,
    );

    if (names.length > 0) {
      return `${names.join(", ")}${extraCount > 0 ? ` +${extraCount} more` : ""}`;
    }

    return "Created accounts appear automatically";
  }

  return canEdit ? "View or edit" : "View summary";
}

function renderIncidentManagementSections(incident, details) {
  return `
    <div class="incident-management-body">
      <div class="section-launcher-grid">
        ${incidentManagementSections
          .map(
            ([id, title, canEdit, tone]) => `
              <button class="section-launcher ${tone === "accent" ? "section-launcher-accent" : ""}" type="button" data-open-incident-section="${id}" data-incident-id="${escapeHtml(incident.id)}">
                <span>${escapeHtml(title)}</span>
                <small>${escapeHtml(getIncidentSectionLauncherSubtitle(id, canEdit, details))}</small>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function getIncidentSectionMeta(sectionId) {
  const found = incidentManagementSections.find(([id]) => id === sectionId);
  return found
    ? { id: found[0], title: found[1], canEdit: found[2] }
    : null;
}

function getIncidentById(incidentId) {
  return [...state.allIncidents, ...state.incidents].find(
    (incident) => incident.id === incidentId,
  );
}

function renderIncidentSectionModal() {
  const modal = state.activeIncidentSectionModal;
  if (!modal) return "";

  const incident = getIncidentById(modal.incidentId);
  const meta = getIncidentSectionMeta(modal.section);

  if (!incident || !meta) return "";

  const details = state.incidentManagementDetails[incident.id] || {};
  const isEditMode = Boolean(modal.editMode);
  const modalBody = isEditMode
    ? renderIncidentSectionEditContent(incident, details, meta.id)
    : renderIncidentSectionViewContent(incident, details, meta.id);

  return `
    <div class="modal-backdrop" data-close-incident-section-modal>
      <section class="record-modal incident-section-modal" role="dialog" aria-modal="true" aria-labelledby="incidentSectionModalTitle">
        <div class="modal-header">
          <div>
            <span class="eyebrow">${escapeHtml(incident.incident_code)}</span>
            <h2 id="incidentSectionModalTitle">${escapeHtml(meta.title)}</h2>
            <p>${escapeHtml(incident.incident_name)}</p>
          </div>
          <button class="icon-button" type="button" data-close-incident-section-modal aria-label="Close section">&times;</button>
        </div>
        <div class="modal-body">
          ${modalBody}
        </div>
        <div class="modal-footer">
          <div id="incidentSectionModalMessage" class="status-message modal-inline-message" hidden></div>
          <div class="modal-footer-spacer"></div>
          <button class="ghost-button" type="button" data-close-incident-section-modal>Close</button>
          ${
            meta.canEdit
              ? isEditMode
                ? `<button class="primary-button" type="submit" form="incidentSectionEditForm">Save</button>`
                : `<button class="primary-button" type="button" data-edit-incident-section>Edit</button>`
              : ""
          }
        </div>
      </section>
    </div>
  `;
}

function renderIncidentSectionEditContent(incident, details, sectionId) {
  switch (sectionId) {
    case "timeline":
      return renderTimelineManagementForm(incident, details, true);
    case "dmmp-staff":
      return renderDmmpStaffManagement(
        details.dmmpStaff?.data || [],
        details.dmmpStaffSummary?.data,
        true,
      );
    case "coordination":
      return renderCoordinationManagementForm(details.coordination?.data, true);
    case "deactivation":
      return renderDeactivationManagementForm(details, true);
    case "hospital-resources":
      return renderHospitalResourcesManagementForm(
        details.hospitalResources?.data,
        details.hospitalResourceSummary?.data,
        true,
      );
    case "edit-incident":
      return renderIncidentEditForm(incident);
    default:
      return renderIncidentSectionViewContent(incident, details, sectionId);
  }
}

function renderIncidentSectionViewContent(incident, details, sectionId) {
  switch (sectionId) {
    case "timeline":
      return renderKeyValueSection(
        incidentTimelineFields.map(([name, label, key]) => [
          label,
          name === "disasterOccurredAt"
            ? formatDate(incident.started_at)
            : formatDate(details.timeline?.data?.[key]),
        ]).concat([
          ["First site triage", formatDate(details.onsiteTriage?.data?.firstSiteTriageAt)],
          ["Last site triage", formatDate(details.onsiteTriage?.data?.lastSiteTriageAt)],
          ["First transport from scene", formatDate(details.sceneClearance?.data?.firstTransportFromSceneAt)],
          ["Last transport from scene", formatDate(details.sceneClearance?.data?.lastTransportFromSceneAt)],
          ["DMMP activated?", formatBoolean(details.timeline?.data?.dmmp_activated)],
          ["DMMP activation trigger", details.timeline?.data?.dmmp_activation_trigger || "Not recorded"],
        ]),
      );
    case "dmmp-staff":
      return renderDmmpStaffView(
        details.dmmpStaff?.data || [],
        details.dmmpStaffSummary?.data,
      );
    case "coordination":
      return renderKeyValueSection([
        ...coordinationFields.map(([, label, key]) => [
          label,
          details.coordination?.data?.[key] ?? "Not recorded",
        ]),
        ["Assessed at", formatDate(details.coordination?.data?.assessed_at)],
        ["Notes", details.coordination?.data?.notes || "Not recorded"],
      ]);
    case "responder-safety":
      return renderResponderSafetySummaryView(details);
    case "deactivation":
      return renderDeactivationSummaryView(details);
    case "onsite-triage":
      return renderSummaryFacts(details.onsiteTriage?.data);
    case "facility-triage":
      return renderSummaryFacts(details.facilityTriage?.data);
    case "onsite-care":
      return renderSummaryFacts(details.onsiteCare?.data);
    case "scene-clearance":
      return renderSummaryFacts(details.sceneClearance?.data);
    case "survivor-distribution":
      return renderSummaryFacts(details.survivorDistribution?.data);
    case "ed-resources":
      return renderSummaryFacts(details.edResources?.data);
    case "hospital-resources":
      return renderHospitalResourceSummaryView(details);
    case "morbidity-mortality":
      return renderSummaryFacts(details.morbidityMortality?.data);
    case "sitrep-close":
      return renderSitrepAndCloseSection(incident);
    case "edit-incident":
      return renderIncidentEditView(incident);
    default:
      return `<div class="empty-state">Section unavailable.</div>`;
  }
}

function renderIncidentEditView(incident) {
  return renderKeyValueSection([
    ["Incident code", incident.incident_code],
    ["Incident name", incident.incident_name],
    ["Type of hazard", incident.disaster_type],
    ["Incident exact location", incident.description || "Not recorded"],
    ["Barangay", incident.barangay || "Not recorded"],
    ["Municipality / City", incident.municipality || "Not recorded"],
    ["Province", incident.province || "Not recorded"],
    ["Status", roleLabel(incident.status)],
    ["Incident onsite", formatDate(incident.started_at)],
    ["Closed / ended at", formatDate(incident.ended_at)],
  ]);
}

function renderIncidentEditForm(incident) {
  const hazardOptions = hazardTypes.includes(incident.disaster_type)
    ? hazardTypes
    : [incident.disaster_type, ...hazardTypes].filter(Boolean);

  return `
    <form id="incidentSectionEditForm" class="incident-section-card" data-incident-section-form="edit-incident">
      <div class="section-card-header">
        <div>
          <h3>Edit Incident</h3>
          <p class="panel-subtitle">Update the official incident fields synced to the mobile app.</p>
        </div>
      </div>
      <div class="form-grid two">
        <label class="field">
          <span>Incident name</span>
          <input name="incidentName" required value="${escapeHtml(incident.incident_name)}" />
        </label>
        <label class="field">
          <span>Type of hazard</span>
          <select name="disasterType" required>
            ${hazardOptions
              .map(
                (item) =>
                  `<option ${item === incident.disaster_type ? "selected" : ""}>${escapeHtml(item)}</option>`,
              )
              .join("")}
          </select>
        </label>
      </div>
      <label class="field">
        <span>Incident exact location</span>
        <input name="description" value="${escapeHtml(incident.description || "")}" placeholder="Street, landmark, building, purok, or coordinates" />
      </label>
      <div class="form-grid three">
        <label class="field">
          <span>Barangay</span>
          <input name="barangay" value="${escapeHtml(incident.barangay || "")}" />
        </label>
        <label class="field">
          <span>Municipality / City</span>
          <input name="municipality" value="${escapeHtml(incident.municipality || "")}" />
        </label>
        <label class="field">
          <span>Province</span>
          <input name="province" value="${escapeHtml(incident.province || "")}" />
        </label>
      </div>
      <div class="form-grid three">
        <label class="field">
          <span>Incident onsite</span>
          <input name="startedAt" type="datetime-local" value="${toLocalDateTimeInput(incident.started_at)}" />
        </label>
        <label class="field">
          <span>Closed / ended at</span>
          <input name="endedAt" type="datetime-local" value="${toLocalDateTimeInput(incident.ended_at)}" />
        </label>
        <label class="field">
          <span>Status</span>
          <select name="status">
            ${["draft", "active", "closed", "archived"]
              .map(
                (status) =>
                  `<option value="${status}" ${status === incident.status ? "selected" : ""}>${escapeHtml(roleLabel(status))}</option>`,
              )
              .join("")}
          </select>
        </label>
      </div>
      <div id="editIncidentMessage" class="status-message" hidden></div>
    </form>
  `;
}

function renderKeyValueSection(rows) {
  return `
    <div class="summary-facts">
      ${rows
        .map(
          ([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value ?? "Not recorded")}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderExtractedTimelineFacts(details) {
  return `
    <section class="incident-section-card summary-preview full-width">
      <div class="section-card-header">
        <div>
          <h3>Extracted from records</h3>
          <p class="panel-subtitle">Calculated from the Onsite Triage and Scene Clearance summaries.</p>
        </div>
      </div>
      ${renderKeyValueSection([
        ["First site triage", formatDate(details?.onsiteTriage?.data?.firstSiteTriageAt)],
        ["Last site triage", formatDate(details?.onsiteTriage?.data?.lastSiteTriageAt)],
        ["First transport from scene", formatDate(details?.sceneClearance?.data?.firstTransportFromSceneAt)],
        ["Last transport from scene", formatDate(details?.sceneClearance?.data?.lastTransportFromSceneAt)],
      ])}
    </section>
  `;
}

function renderDeactivationSummaryView(details) {
  return `
    ${renderKeyValueSection([
      ["Scene demobilized", formatDate(details.deactivation?.summary?.sceneDemobilizedAt)],
      ["EMS coverage disruption", roleLabel(details.deactivation?.summary?.emsCoverageDisruption || "unknown")],
      ["Assessed at", formatDate(details.deactivation?.summary?.assessedAt)],
      ["Notes", details.deactivation?.summary?.notes || "Not recorded"],
    ])}
    ${renderFacilityOperationalSummary(details.facilityOperational?.data, "continuity")}
  `;
}

function renderHospitalResourceSummaryView(details) {
  return `
    ${renderKeyValueSection([
      ["ICU admissions", details.hospitalResourceSummary?.data?.icu?.admittedTotal ?? 0],
      ["Ventilated percentage", `${details.hospitalResourceSummary?.data?.icu?.ventilatedPercentage ?? 0}%`],
      ["First surgical intervention", formatDate(details.hospitalResourceSummary?.data?.surgery?.firstSurgicalInterventionAt)],
      ["Last surgical intervention", formatDate(details.hospitalResourceSummary?.data?.surgery?.lastSurgicalInterventionAt)],
      ["Mean surgery minutes", details.hospitalResourceSummary?.data?.surgery?.meanDurationMinutes ?? "Not recorded"],
    ])}
    ${renderFacilityOperationalSummary(details.facilityOperational?.data, "resources")}
  `;
}

function renderFacilityOperationalSummary(summary, mode = "continuity") {
  const facilities = summary?.facilities || [];

  return `
    <section class="incident-section-card summary-preview full-width">
      <div class="section-card-header">
        <div>
          <h3>View Summary by Hospital</h3>
          <p class="panel-subtitle">Extracted from HCFD entries and healthcare facility records.</p>
        </div>
      </div>
      <div class="facility-summary-list">
        ${
          facilities
            .map((facility) => {
              const subtitle = [
                facility.facilityLevel ? roleLabel(facility.facilityLevel) : null,
                facility.municipality,
                facility.province,
              ]
                .filter(Boolean)
                .join(" - ");

              return `
                <article class="facility-summary-card">
                  <div>
                    <h4>${escapeHtml(facility.facilityName)}</h4>
                    <p>${escapeHtml(subtitle || "Official healthcare facility")}</p>
                  </div>
                  ${
                    mode === "continuity"
                      ? renderKeyValueSection([
                          ["Facility care disruption", roleLabel(facility.continuity?.facilityCareDisruption || "unknown")],
                          ["Last facility deactivation", formatDate(facility.continuity?.lastFacilityDeactivatedAt)],
                        ])
                      : renderKeyValueSection([
                          ["HCFD encounters", facility.hofdEntries?.encountersTotal ?? 0],
                          ["Arrivals", facility.hofdEntries?.arrivedTotal ?? 0],
                          ["Admitted / discharged", `${facility.hofdEntries?.admittedTotal ?? 0}/${facility.hofdEntries?.dischargedTotal ?? 0}`],
                          ["Surgery / OR use", `${facility.hofdEntries?.surgeryTotal ?? 0}/${facility.hofdEntries?.operatingRoomUseTotal ?? 0}`],
                          ["X-ray / US / CT", `${facility.hofdEntries?.xrayUseTotal ?? 0}/${facility.hofdEntries?.ultrasoundUseTotal ?? 0}/${facility.hofdEntries?.ctUseTotal ?? 0}`],
                          ["ICU / ventilated", `${facility.hofdEntries?.icuAdmissions ?? 0}/${facility.hofdEntries?.ventilatedTotal ?? 0}`],
                          [
                            "Resource snapshot",
                            facility.resources
                              ? `${facility.resources.totalOperatingRooms ?? "?"} OR, ${facility.resources.totalResuscitationRooms ?? "?"} resus`
                              : "Not recorded",
                          ],
                        ])
                  }
                </article>
              `;
            })
            .join("") || `<div class="empty-state">No hospital summary is available yet.</div>`
        }
      </div>
    </section>
  `;
}

function getDmmpStaffRosterRows(staffRecords) {
  const accountStaff = state.unitUsers
    .filter((user) => user.is_active !== false)
    .slice()
    .sort((first, second) => compareText(first.full_name, second.full_name));
  const extraStaff = state.callDownStaff
    .filter((staff) => staff.is_active !== false)
    .slice()
    .sort((first, second) => compareText(first.full_name, second.full_name));
  const recordsByUserId = new Map(
    staffRecords
      .filter((record) => record.linked_user_id)
      .map((record) => [record.linked_user_id, record]),
  );
  const recordsByStaffId = new Map(
    staffRecords
      .filter((record) => record.call_down_staff_id)
      .map((record) => [record.call_down_staff_id, record]),
  );
  const accountRows = accountStaff.map((user) => ({
    source: "account",
    sourceId: user.id,
    name: user.full_name || user.email || "Unnamed account",
    roleName: roleLabel(user.role),
    teamName: user.assigned_barangay || user.assigned_municipality || "System account",
    record: recordsByUserId.get(user.id) || null,
  }));
  const extraRows = extraStaff.map((staff) => ({
    source: "staff",
    sourceId: staff.id,
    name: staff.full_name || "Unnamed staff",
    roleName: staff.role_position || "No role",
    teamName: staff.assigned_team_unit || "Extra staff",
    record: recordsByStaffId.get(staff.id) || null,
  }));
  const legacyRows = staffRecords
    .filter((record) => !record.call_down_staff_id && !record.linked_user_id)
    .map((record) => ({
      source: "legacy",
      sourceId: record.id,
      name: record.staff_name || "Unnamed staff",
      roleName: record.role_name || "No role",
      teamName: "Legacy record",
      record,
    }));

  return [...accountRows, ...extraRows, ...legacyRows];
}

function renderDmmpStaffView(staffRecords, summary) {
  const rosterRows = getDmmpStaffRosterRows(staffRecords);
  const totalStaffRecords = Math.max(
    summary?.totalStaffRecords ?? 0,
    rosterRows.length,
  );

  return `
    ${renderKeyValueSection([
      ["Total staff records", totalStaffRecords],
      ["Contacted", summary?.totalContacted ?? 0],
      ["Arrived", summary?.totalArrived ?? 0],
      ["Arrived within standard", summary?.totalArrivedWithinStandard ?? 0],
      ["Reporting percentage", `${summary?.reportingPercentage ?? 0}%`],
      ["Time of arrival of last person contacted", formatDate(summary?.lastPersonContactedArrivalAt)],
    ])}
    <div class="table-wrap" style="margin-top:14px">
      <table>
        <thead>
          <tr><th>Staff</th><th>Role</th><th>Contacted?</th><th>Arrived?</th><th>Status</th><th>Arrival time</th></tr>
        </thead>
        <tbody>
          ${rosterRows
            .map(
              ({ source, name, roleName, teamName, record }) => {
                const displayRole = [roleName, teamName].filter(Boolean).join(" / ");

                return `
                <tr>
                  <td>
                    <strong>${escapeHtml(name)}</strong>
                    <div class="panel-subtitle">${source === "account" ? "System account" : source === "staff" ? "Call Down List" : "Legacy entry"}</div>
                  </td>
                  <td>${escapeHtml(displayRole || "No role")}</td>
                  <td>${record?.was_contacted ? "Yes" : "No"}</td>
                  <td>${record?.has_arrived || record?.arrived_at ? "Yes" : "No"}</td>
                  <td>${escapeHtml(roleLabel(record?.status || "unknown"))}</td>
                  <td>${formatDate(record?.arrived_at)}</td>
                </tr>
              `;
              },
            )
            .join("") || `<tr><td colspan="6"><div class="empty-state">No account users or extra call down staff contacts yet.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function formatBoolean(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function renderTimelineManagementForm(incident, details, forModal = false) {
  const timeline = details?.timeline?.data ?? null;

  return `
    <form id="${forModal ? "incidentSectionEditForm" : ""}" class="incident-section-card" data-incident-section-form="timeline">
      <div class="section-card-header">
        <div>
          <h3>Response Timeline</h3>
          <p class="panel-subtitle">Matches the mobile incident response timeline section.</p>
        </div>
        ${forModal ? "" : `<button class="primary-button mini" type="submit">Save timeline</button>`}
      </div>
      <div class="form-grid two">
        <label class="field">
          <span>DMMP activated?</span>
          <select name="dmmpActivated">
            <option value="">Unknown</option>
            <option value="true" ${timeline?.dmmp_activated === true ? "selected" : ""}>Yes</option>
            <option value="false" ${timeline?.dmmp_activated === false ? "selected" : ""}>No</option>
          </select>
        </label>
        <label class="field"><span>DMMP activation trigger</span><input name="dmmpActivationTrigger" value="${escapeHtml(timeline?.dmmp_activation_trigger || "")}" /></label>
      </div>
      <div class="timeline-fields">
        ${incidentTimelineFields
          .map(([name, label, key]) => {
            const value =
              name === "disasterOccurredAt"
                ? incident.started_at
                : timeline?.[key];

            return `<label class="field"><span>${label}</span><input name="${name}" type="datetime-local" value="${toLocalDateTimeInput(value)}" /></label>`;
          })
          .join("")}
      </div>
      ${renderExtractedTimelineFacts(details)}
      <div id="timelineMessage" class="status-message" hidden></div>
    </form>
  `;
}

function renderDmmpStaffManagement(staffRecords, summary, forModal = false) {
  const rosterRows = getDmmpStaffRosterRows(staffRecords);
  const totalStaffRecords = Math.max(
    summary?.totalStaffRecords ?? 0,
    rosterRows.length,
  );

  return `
    <section class="incident-section-card">
      <div class="section-card-header">
        <div>
          <h3>DMMP Staff Call-down</h3>
          <p class="panel-subtitle">${summary ? `${summary.totalArrived || 0}/${summary.totalStaffRecords || 0} arrived. Reporting ${summary.reportingPercentage || 0}%. Last contacted-staff arrival: ${formatDate(summary.lastPersonContactedArrivalAt)}.` : "Update incident-specific staff call-down status."}</p>
        </div>
      </div>
      <form id="${forModal ? "incidentSectionEditForm" : ""}" class="form-grid" data-incident-section-form="dmmp-staff">
        <div class="summary-facts">
          <div><span>Total staff records</span><strong>${totalStaffRecords}</strong></div>
          <div><span>Contacted</span><strong>${summary?.totalContacted ?? 0}</strong></div>
          <div><span>Arrived</span><strong>${summary?.totalArrived ?? 0}</strong></div>
          <div><span>Reporting percentage</span><strong>${summary?.reportingPercentage ?? 0}%</strong></div>
          <div><span>Last contacted-staff arrival</span><strong>${formatDate(summary?.lastPersonContactedArrivalAt)}</strong></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Role / Team</th>
                <th>Contacted?</th>
                <th>Arrived?</th>
                <th>Status</th>
                <th>Arrival time</th>
              </tr>
            </thead>
            <tbody>
              ${rosterRows
                .map(({ source, sourceId, name, roleName, teamName, record }) => {
                  const displayRole = [roleName, teamName].filter(Boolean).join(" / ");

                  return `
                    <tr data-dmmp-staff-row>
                      <td>
                        <strong>${escapeHtml(name)}</strong>
                        <div class="panel-subtitle">${source === "account" ? "System account" : source === "staff" ? "Call Down List" : "Legacy entry"}</div>
                        <input type="hidden" data-dmmp-field="recordId" value="${escapeHtml(record?.id || "")}" />
                        <input type="hidden" data-dmmp-field="linkedUserId" value="${escapeHtml(source === "account" ? sourceId : record?.linked_user_id || "")}" />
                        <input type="hidden" data-dmmp-field="callDownStaffId" value="${escapeHtml(source === "staff" ? sourceId : record?.call_down_staff_id || "")}" />
                        <input type="hidden" data-dmmp-field="staffName" value="${escapeHtml(name)}" />
                        <input type="hidden" data-dmmp-field="roleName" value="${escapeHtml(displayRole || "No role")}" />
                      </td>
                      <td>${escapeHtml(displayRole || "No role")}</td>
                      <td><input type="checkbox" data-dmmp-field="wasContacted" ${record?.was_contacted ? "checked" : ""} aria-label="Contacted ${escapeHtml(name)}" /></td>
                      <td><input type="checkbox" data-dmmp-field="hasArrived" ${record?.has_arrived || record?.arrived_at ? "checked" : ""} aria-label="Arrived ${escapeHtml(name)}" /></td>
                      <td>
                        <select data-dmmp-field="status" aria-label="Status for ${escapeHtml(name)}">
                          ${renderDmmpStaffStatusOptions(record?.status)}
                        </select>
                      </td>
                      <td><input type="datetime-local" data-dmmp-field="arrivedAt" value="${toLocalDateTimeInput(record?.arrived_at)}" /></td>
                    </tr>
                  `;
                })
                .join("") || `<tr><td colspan="6"><div class="empty-state">No account users or extra call down staff contacts yet.</div></td></tr>`}
            </tbody>
          </table>
        </div>
        <div id="dmmpStaffMessage" class="status-message" hidden></div>
      </form>
    </section>
  `;
}

function renderDmmpStaffStatusOptions(selected) {
  const options = [
    ["", "Not recorded"],
    ["ill", "Ill"],
    ["injured", "Injured"],
    ["deceased", "Deceased"],
    ["safe", "Safe"],
    ["unsafe", "Unsafe"],
  ];

  return options
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`,
    )
    .join("");
}

function buildResponderSafetyStatusSummary(details) {
  const staffRecords = details?.dmmpStaff?.data || [];
  const rosterRows = getDmmpStaffRosterRows(staffRecords);
  const statusCounts = {
    safe: 0,
    unsafe: 0,
    ill: 0,
    injured: 0,
    deceased: 0,
    notRecorded: 0,
  };

  rosterRows.forEach(({ record }) => {
    const status = record?.status;

    if (status && Object.prototype.hasOwnProperty.call(statusCounts, status)) {
      statusCounts[status] += 1;
    } else {
      statusCounts.notRecorded += 1;
    }
  });

  const analyticsSafety =
    details?.analytics?.data?.barGraphs?.responderSafety || {};
  const analyticsSafe = Number(analyticsSafety.safe || 0);
  const analyticsUnsafe = Number(analyticsSafety.unsafe || 0);

  return {
    rosterRows,
    statusCounts,
    totalResponders: rosterRows.length,
    analyticsSafe,
    analyticsUnsafe,
  };
}

function renderResponderSafetySummaryView(details) {
  const {
    rosterRows,
    statusCounts,
    totalResponders,
    analyticsSafe,
    analyticsUnsafe,
  } = buildResponderSafetyStatusSummary(details);
  const totalUnsafeStatus =
    statusCounts.unsafe +
    statusCounts.ill +
    statusCounts.injured +
    statusCounts.deceased;

  return `
    ${renderKeyValueSection([
      ["Total responders / staff in call-down", totalResponders],
      ["Safe from Call Down", statusCounts.safe],
      ["Unsafe from Call Down", totalUnsafeStatus],
      ["Ill", statusCounts.ill],
      ["Injured", statusCounts.injured],
      ["Deceased", statusCounts.deceased],
      ["Not recorded", statusCounts.notRecorded],
      ["Analytics safe responders", analyticsSafe],
      ["Analytics unsafe responders", analyticsUnsafe],
    ])}
    <div class="table-wrap" style="margin-top:14px">
      <table>
        <thead>
          <tr>
            <th>Responder / Staff</th>
            <th>Source</th>
            <th>Role / Team</th>
            <th>Call-down status</th>
            <th>Contacted?</th>
            <th>Arrived?</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRows
            .map(({ source, name, roleName, teamName, record }) => {
              const displayRole = [roleName, teamName].filter(Boolean).join(" / ");
              const sourceLabel =
                source === "account"
                  ? "System account"
                  : source === "staff"
                    ? "Call Down List"
                    : "Legacy entry";

              return `
                <tr>
                  <td><strong>${escapeHtml(name)}</strong></td>
                  <td>${escapeHtml(sourceLabel)}</td>
                  <td>${escapeHtml(displayRole || "No role")}</td>
                  <td>${escapeHtml(roleLabel(record?.status || "not_recorded"))}</td>
                  <td>${record?.was_contacted ? "Yes" : "No"}</td>
                  <td>${record?.has_arrived || record?.arrived_at ? "Yes" : "No"}</td>
                </tr>
              `;
            })
            .join("") || `<tr><td colspan="6"><div class="empty-state">No responder or call-down staff roster is available yet.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderCoordinationManagementForm(assessment, forModal = false) {
  return `
    <form id="${forModal ? "incidentSectionEditForm" : ""}" class="incident-section-card" data-incident-section-form="coordination">
      <div class="section-card-header">
        <div>
          <h3>Coordination Assessment</h3>
          <p class="panel-subtitle">Rate each coordination area from 1 to 7.</p>
        </div>
        ${forModal ? "" : `<button class="primary-button mini" type="submit">Save coordination</button>`}
      </div>
      <div class="form-grid two">
        ${coordinationFields
          .map(
            ([name, label, key]) => `
              <label class="field">
                <span>${label}</span>
                <select name="${name}">
                  <option value="">Not recorded</option>
                  ${[1, 2, 3, 4, 5, 6, 7]
                    .map((value) => `<option value="${value}" ${assessment?.[key] === value ? "selected" : ""}>${value}</option>`)
                    .join("")}
                </select>
              </label>
            `,
          )
          .join("")}
        <label class="field"><span>Assessed at</span><input name="assessedAt" type="datetime-local" value="${toLocalDateTimeInput(assessment?.assessed_at)}" /></label>
      </div>
      <label class="field"><span>Notes</span><textarea name="notes">${escapeHtml(assessment?.notes || "")}</textarea></label>
      <div id="coordinationMessage" class="status-message" hidden></div>
    </form>
  `;
}

function renderResponderSafetyManagementForm(report, summary, forModal = false) {
  return `
    <form id="${forModal ? "incidentSectionEditForm" : ""}" class="incident-section-card" data-incident-section-form="responder-safety">
      <div class="section-card-header">
        <div>
          <h3>Responder Safety</h3>
          <p class="panel-subtitle">${summary ? `${summary.deceasedResponders || 0} deceased, ${summary.illOrInjuredResponders || 0} ill or injured responders.` : "Record responder safety counts and times."}</p>
        </div>
        ${forModal ? "" : `<button class="primary-button mini" type="submit">Save safety</button>`}
      </div>
      <div class="form-grid two">
        ${renderSafetySelect("safetyActionsEstablished", "Safety actions established?", report?.safety_actions_established)}
        <label class="field"><span>PPE decision at</span><input name="ppeDecisionAt" type="datetime-local" value="${toLocalDateTimeInput(report?.ppe_decision_at)}" /></label>
        <label class="field"><span>Response deactivated at</span><input name="responseDeactivatedAt" type="datetime-local" value="${toLocalDateTimeInput(report?.response_deactivated_at)}" /></label>
        <label class="field"><span>Deployed responders</span><input name="deployedResponders" type="number" min="0" value="${escapeHtml(report?.deployed_responders ?? "")}" /></label>
        <label class="field"><span>Injured responders</span><input name="injuredResponders" type="number" min="0" value="${escapeHtml(report?.injured_responders ?? "")}" /></label>
        <label class="field"><span>Ill responders</span><input name="illResponders" type="number" min="0" value="${escapeHtml(report?.ill_responders ?? "")}" /></label>
        <label class="field"><span>Deceased responders</span><input name="deceasedResponders" type="number" min="0" value="${escapeHtml(report?.deceased_responders ?? "")}" /></label>
      </div>
      <div id="responderSafetyMessage" class="status-message" hidden></div>
    </form>
  `;
}

function renderDeactivationManagementForm(details, forModal = false) {
  const summary = details?.deactivation?.summary ?? details ?? null;

  return `
    <form id="${forModal ? "incidentSectionEditForm" : ""}" class="incident-section-card" data-incident-section-form="deactivation">
      <div class="section-card-header">
        <div>
          <h3>Deactivation & Continuity</h3>
          <p class="panel-subtitle">Record scene demobilization and continuity of care disruption.</p>
        </div>
        ${forModal ? "" : `<button class="primary-button mini" type="submit">Save deactivation</button>`}
      </div>
      <div class="form-grid two">
        <label class="field"><span>Scene demobilized</span><input name="sceneDemobilizedAt" type="datetime-local" value="${toLocalDateTimeInput(summary?.sceneDemobilizedAt)}" /></label>
        ${renderDisruptionSelect("emsCoverageDisruption", "EMS coverage disruption", summary?.emsCoverageDisruption)}
        <label class="field"><span>Assessed at</span><input name="assessedAt" type="datetime-local" value="${toLocalDateTimeInput(summary?.assessedAt)}" /></label>
      </div>
      ${renderFacilityOperationalSummary(details?.facilityOperational?.data, "continuity")}
      <label class="field"><span>Notes</span><textarea name="notes">${escapeHtml(summary?.notes || "")}</textarea></label>
      <div id="deactivationMessage" class="status-message" hidden></div>
    </form>
  `;
}

function renderHospitalResourcesManagementForm(resources, summary, forModal = false) {
  return `
    <form id="${forModal ? "incidentSectionEditForm" : ""}" class="incident-section-card" data-incident-section-form="hospital-resources">
      <div class="section-card-header">
        <div>
          <h3>Hospital Resources</h3>
          <p class="panel-subtitle">${summary ? `${summary.icu?.admittedTotal || 0} ICU admissions, ${summary.icu?.ventilatedPercentage || 0}% ventilated.` : "Record hospital resource snapshot values."}</p>
        </div>
        ${forModal ? "" : `<button class="primary-button mini" type="submit">Save resources</button>`}
      </div>
      <div class="form-grid two">
        <label class="field"><span>Recorded at</span><input name="recordedAt" type="datetime-local" value="${toLocalDateTimeInput(resources?.recorded_at)}" /></label>
        <label class="field"><span>Total operating rooms</span><input name="totalOperatingRooms" type="number" min="0" value="${escapeHtml(resources?.total_operating_rooms ?? "")}" /></label>
        <label class="field"><span>Total resuscitation rooms</span><input name="totalResuscitationRooms" type="number" min="0" value="${escapeHtml(resources?.total_resuscitation_rooms ?? "")}" /></label>
        <label class="field">
          <span>Alternative ICU in use?</span>
          <select name="alternativeIcuInUse">
            <option value="">Unknown</option>
            <option value="true" ${resources?.alternative_icu_in_use === true ? "selected" : ""}>Yes</option>
            <option value="false" ${resources?.alternative_icu_in_use === false ? "selected" : ""}>No</option>
          </select>
        </label>
      </div>
      <label class="field"><span>Notes</span><textarea name="notes">${escapeHtml(resources?.notes || "")}</textarea></label>
      <div id="hospitalResourcesMessage" class="status-message" hidden></div>
    </form>
  `;
}

function renderSafetySelect(name, label, selected) {
  return `
    <label class="field">
      <span>${label}</span>
      <select name="${name}">
        ${safetyOptions.map((option) => `<option value="${option}" ${selected === option ? "selected" : ""}>${roleLabel(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderDisruptionSelect(name, label, selected) {
  return `
    <label class="field">
      <span>${label}</span>
      <select name="${name}">
        ${disruptionOptions.map((option) => `<option value="${option}" ${selected === option ? "selected" : ""}>${roleLabel(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderSummarySection(title, data, fullWidth = false) {
  return `
    <section class="incident-section-card summary-preview ${fullWidth ? "full-width" : ""}">
      <div class="section-card-header">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p class="panel-subtitle">Computed from casualty records and timeline data.</p>
        </div>
      </div>
      ${data ? renderSummaryFacts(data) : `<div class="empty-state">No summary data available.</div>`}
    </section>
  `;
}

function renderSummaryFacts(data) {
  const facts = flattenSummaryFacts(data).slice(0, 10);
  return `
    <div class="summary-facts">
      ${
        facts
          .map(([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `)
          .join("") || `<div class="empty-state">No values recorded.</div>`
      }
    </div>
  `;
}

function flattenSummaryFacts(data, prefix = "") {
  if (!data || typeof data !== "object") return [];

  return Object.entries(data).flatMap(([key, value]) => {
    if (key.toLowerCase().includes("formula") || key === "incidentId") return [];
    const label = prefix ? `${prefix} ${roleLabel(key)}` : roleLabel(key);

    if (value === null || value === undefined) {
      return [[label, "Not recorded"]];
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      return flattenSummaryFacts(value, label);
    }

    if (Array.isArray(value)) {
      return [[label, `${value.length} entries`]];
    }

    return [[label, String(value)]];
  });
}

function renderSitrepAndCloseSection(incident) {
  return `
    <section class="incident-section-card">
      <div class="section-card-header">
        <div>
          <h3>SitRep & Close Incident</h3>
          <p class="panel-subtitle">Generate an incident-wide situation report covering FR, SAR, and HCFD records.</p>
        </div>
      </div>
      <div class="selected-incident-summary">
        <span>Selected incident</span>
        <strong>${escapeHtml(incident.incident_name || "Unnamed incident")}</strong>
        <small>${escapeHtml(incident.incident_code || incident.id)} · ${escapeHtml(roleLabel(incident.status || "unknown"))}</small>
      </div>
      <div class="button-row">
        <button class="secondary-button" type="button" data-generate-sitrep="${escapeHtml(incident.id)}">Generate Selected Incident SitRep</button>
        <button class="ghost-button" type="button" data-download-sitrep="pdf" data-incident-id="${escapeHtml(incident.id)}">Download Latest PDF</button>
        <button class="ghost-button" type="button" data-download-sitrep="csv" data-incident-id="${escapeHtml(incident.id)}">Download Latest CSV</button>
        <button class="ghost-button" type="button" data-export-download="/incidents/${escapeHtml(incident.id)}/export/casualties.csv" data-export-file="${escapeHtml(incident.incident_code || incident.id)}-casualties.csv">Download Casualty CSV</button>
        <button class="ghost-button" type="button" data-export-download="/exports/incidents/${escapeHtml(incident.id)}/package.json" data-export-file="${escapeHtml(incident.incident_code || incident.id)}-incident-package.json">Download Incident Package</button>
        ${
          incident.status === "closed"
            ? isSuperAdmin()
              ? incident.reopen_request_status === "pending"
                ? `<button class="primary-button" type="button" data-approve-reopen-incident="${escapeHtml(incident.id)}">Approve Reopen</button>`
                : `<span class="pill blue">Closed</span>`
              : incident.reopen_request_status === "pending"
                  ? `<span class="pill orange">Reopen requested</span>`
                  : `<button class="secondary-button" type="button" data-request-reopen-incident="${escapeHtml(incident.id)}">Request Reopen</button>`
            : `<button class="danger-button" type="button" data-close-incident="${escapeHtml(incident.id)}">Close Incident</button>`
        }
      </div>
      <div id="incidentActionMessage" class="status-message" hidden></div>
    </section>
  `;
}

function getIncidentCloseWarnings(incidentId) {
  const details = state.incidentManagementDetails[incidentId] || {};
  const missing = [];

  if (!details.timeline?.data?.dmmp_activated_at) {
    missing.push("DMMP activation time");
  }

  if (!details.dmmpStaffSummary?.data?.totalStaffRecords) {
    missing.push("DMMP staff call-down records");
  }

  if (!details.coordination?.data) {
    missing.push("Coordination assessment");
  }

  if (
    !buildResponderSafetyStatusSummary(details).rosterRows.some(
      ({ record }) => Boolean(record?.status),
    )
  ) {
    missing.push("Responder safety");
  }

  if (!details.deactivation?.summary?.sceneDemobilizedAt) {
    missing.push("Scene demobilization");
  }

  return missing;
}

function bindIncidentManagementActions() {
  document.querySelectorAll("[data-incident-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.incidentToggle;

      if (!incidentId) return;

      if (state.expandedIncidentId === incidentId) {
        state.expandedIncidentId = null;
        renderCurrentView();
        bindView();
        return;
      }

      state.expandedIncidentId = incidentId;

      if (!state.incidentManagementDetails[incidentId]) {
        await loadIncidentManagementDetails(incidentId);
      }

      renderCurrentView();
      bindView();
    });
  });

  document.querySelectorAll("[data-open-incident-section]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.incidentId;
      const section = button.dataset.openIncidentSection;

      if (!incidentId || !section) return;

      if (!state.incidentManagementDetails[incidentId]) {
        state.expandedIncidentId = incidentId;
        await loadIncidentManagementDetails(incidentId);
      }

      state.activeIncidentSectionModal = {
        incidentId,
        section,
        editMode: false,
      };
      renderCurrentView();
      bindView();
    });
  });

  document.querySelectorAll("[data-close-incident-section-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target !== element && !element.matches("button")) return;
      state.activeIncidentSectionModal = null;
      renderCurrentView();
      bindView();
    });
  });

  const editSectionButton = qs("[data-edit-incident-section]");
  if (editSectionButton) {
    editSectionButton.addEventListener("click", () => {
      if (!state.activeIncidentSectionModal) return;

      state.activeIncidentSectionModal = {
        ...state.activeIncidentSectionModal,
        editMode: true,
      };
      renderCurrentView();
      bindView();
    });
  }

  document.querySelectorAll("[data-incident-section-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleIncidentSectionSubmit(form);
    });
  });

  document.querySelectorAll("[data-delete-dmmp-staff]").forEach((button) => {
    button.addEventListener("click", async () => {
      const staffId = button.dataset.deleteDmmpStaff;

      if (!staffId) return;

      const confirmed = await showDashboardConfirm({
        title: "Delete DMMP staff record?",
        message:
          "This removes the staff call-down record from this incident. This cannot be undone from the dashboard.",
        confirmLabel: "Delete record",
        cancelLabel: "Keep record",
        danger: true,
      });

      if (!confirmed) return;

      try {
        await apiRequest(`/dmmp-staff/${encodeURIComponent(staffId)}`, {
          method: "DELETE",
        });
        await reloadExpandedIncident("DMMP staff record deleted.");
        showDashboardToast("DMMP staff record deleted.", "success");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to delete DMMP staff record.";
        setMessage("incidentManagementMessage", message, "error");
        showDashboardToast(message, "error");
      }
    });
  });

  document.querySelectorAll("[data-generate-sitrep]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.generateSitrep;

      if (!incidentId) {
        setMessage("incidentActionMessage", "Select an incident before generating a SitRep.", "error");
        return;
      }

      try {
        setMessage("incidentActionMessage", "Generating SitRep...");
        const response = await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/sitreps`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        const reportNumber = response.data?.report_number || "latest-sitrep";
        await downloadApiFile(
          `/incidents/${encodeURIComponent(incidentId)}/export/sitrep.pdf`,
          `${reportNumber}-incident.pdf`,
        );
        setMessage(
          "incidentActionMessage",
          `SitRep generated and downloaded: ${reportNumber}.pdf.`,
          "success",
        );
      } catch (error) {
        setMessage("incidentActionMessage", error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-download-sitrep]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.incidentId;
      const format = button.dataset.downloadSitrep;

      if (!incidentId) {
        setMessage("incidentActionMessage", "Select an incident before downloading a SitRep.", "error");
        return;
      }

      if (!["pdf", "csv"].includes(format)) return;

      try {
        setMessage("incidentActionMessage", `Preparing SitRep ${format.toUpperCase()}...`);
        await downloadApiFile(
          `/incidents/${encodeURIComponent(incidentId)}/export/sitrep.${format}`,
          `dcms-${incidentId}-incident-sitrep.${format}`,
        );
        setMessage(
          "incidentActionMessage",
          `SitRep ${format.toUpperCase()} downloaded.`,
          "success",
        );
      } catch (error) {
        setMessage("incidentActionMessage", error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-close-incident]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.closeIncident;

      if (!incidentId) return;

      if (!state.incidentManagementDetails[incidentId]) {
        await loadIncidentManagementDetails(incidentId, { renderLoading: false });
      }

      const warnings = getIncidentCloseWarnings(incidentId);
      const warningText = warnings.length
        ? `Missing or incomplete items: ${warnings.join(", ")}. You can still proceed if the incident must be closed now.`
        : "All key incident management sections have recorded data.";
      const confirmed = await showDashboardConfirm({
        title: "Close incident?",
        message:
          `This marks the incident as closed and removes it from active incident workflows. Historical records remain available. ${warningText}`,
        confirmLabel: "Close incident",
        cancelLabel: "Keep active",
        danger: true,
      });

      if (!confirmed) return;

      try {
        setMessage("incidentActionMessage", "Closing incident...");
        await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/close`, {
          method: "PATCH",
        });
        delete state.incidentManagementDetails[incidentId];
        await loadSharedData();
        await loadIncidentManagementDetails(incidentId);
        renderCurrentView();
        bindView();
        setMessage("incidentManagementMessage", "Incident closed.", "success");
        showDashboardToast("Incident closed.", "success");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to close incident.";
        setMessage("incidentActionMessage", message, "error");
        showDashboardToast(message, "error");
      }
    });
  });
}

async function handleIncidentSectionSubmit(form) {
  const incidentId =
    state.activeIncidentSectionModal?.incidentId ??
    state.expandedIncidentId;
  const section = form.dataset.incidentSectionForm;

  if (!incidentId || !section) return;

  const sectionHandlers = {
    "edit-incident": saveIncidentDetailsSection,
    timeline: saveIncidentTimelineSection,
    "dmmp-staff": saveDmmpStaffSection,
    coordination: saveCoordinationSection,
    deactivation: saveDeactivationSection,
    "hospital-resources": saveHospitalResourcesSection,
  };

  const handler = sectionHandlers[section];
  if (!handler) return;

  try {
    await handler(incidentId, form);
  } catch (error) {
    const messageId = {
      "edit-incident": "editIncidentMessage",
      timeline: "timelineMessage",
      "dmmp-staff": "dmmpStaffMessage",
      coordination: "coordinationMessage",
      deactivation: "deactivationMessage",
      "hospital-resources": "hospitalResourcesMessage",
    }[section];

    setMessage(messageId, error.message, "error");
  }
}

async function saveIncidentDetailsSection(incidentId, form) {
  setMessage("editIncidentMessage", "Saving incident...");

  const updated = await apiRequest(`/incidents/${encodeURIComponent(incidentId)}`, {
    method: "PUT",
    body: JSON.stringify({
      incidentName: formValue(form, "incidentName"),
      disasterType: formValue(form, "disasterType"),
      description: formValue(form, "description"),
      barangay: formValue(form, "barangay"),
      municipality: formValue(form, "municipality"),
      province: formValue(form, "province"),
      startedAt: toIsoFromLocal(formValue(form, "startedAt")),
      endedAt: toNullableIsoFromLocal(formValue(form, "endedAt")),
      status: formValue(form, "status"),
    }),
  });

  await loadSharedData();
  await reloadExpandedIncident("Incident details saved.");
}

async function reloadExpandedIncident(successMessage) {
  const incidentId =
    state.activeIncidentSectionModal?.incidentId ??
    state.expandedIncidentId;
  if (!incidentId) return;

  delete state.incidentManagementDetails[incidentId];
  await loadIncidentManagementDetails(incidentId);

  if (state.activeIncidentSectionModal) {
    state.activeIncidentSectionModal = {
      ...state.activeIncidentSectionModal,
      editMode: false,
    };
  }

  renderCurrentView();
  bindView();
  setMessage("incidentSectionModalMessage", successMessage, "success");
  setMessage("incidentManagementMessage", successMessage, "success");
}

async function saveIncidentTimelineSection(incidentId, form) {
  setMessage("timelineMessage", "Saving timeline...");

  const payload = {
    dmmpActivated: nullableFormBoolean(form, "dmmpActivated"),
    dmmpActivationTrigger: nullableFormText(form, "dmmpActivationTrigger"),
  };

  incidentTimelineFields.forEach(([name]) => {
    payload[name] = toNullableIsoFromLocal(formValue(form, name));
  });

  await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/timeline`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  await reloadExpandedIncident("Response timeline saved.");
}

async function saveDmmpStaffSection(incidentId, form) {
  setMessage("dmmpStaffMessage", "Saving DMMP staff call-down...");

  const rows = Array.from(form.querySelectorAll("[data-dmmp-staff-row]"));

  if (rows.length === 0) {
    throw new Error("Add staff contacts in Call Down List before saving DMMP staff call-down.");
  }

  await Promise.all(
    rows.map((row) => {
      const valueFor = (field) =>
        row.querySelector(`[data-dmmp-field="${field}"]`)?.value || "";
      const checkedFor = (field) =>
        Boolean(row.querySelector(`[data-dmmp-field="${field}"]`)?.checked);
      const recordId = valueFor("recordId");
      const arrivedAt = toNullableIsoFromLocal(valueFor("arrivedAt"));
      const hasArrived = checkedFor("hasArrived");
      const payload = {
        linkedUserId: nullableTextValue(valueFor("linkedUserId")),
        callDownStaffId: nullableTextValue(valueFor("callDownStaffId")),
        staffName: nullableTextValue(valueFor("staffName")),
        roleName: nullableTextValue(valueFor("roleName")),
        wasContacted: checkedFor("wasContacted"),
        hasArrived,
        status: nullableTextValue(valueFor("status")),
        arrivedAt,
      };

      return apiRequest(
        recordId
          ? `/dmmp-staff/${encodeURIComponent(recordId)}`
          : `/incidents/${encodeURIComponent(incidentId)}/dmmp-staff`,
        {
          method: recordId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
    }),
  );

  await reloadExpandedIncident("DMMP staff call-down saved.");
}

async function saveCoordinationSection(incidentId, form) {
  setMessage("coordinationMessage", "Saving coordination assessment...");

  const payload = {
    notes: nullableFormText(form, "notes"),
    assessedAt: toNullableIsoFromLocal(formValue(form, "assessedAt")),
  };

  coordinationFields.forEach(([name]) => {
    payload[name] = nullableFormNumber(form, name);
  });

  await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/coordination-assessment`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  await reloadExpandedIncident("Coordination assessment saved.");
}

async function saveResponderSafetySection(incidentId, form) {
  setMessage("responderSafetyMessage", "Saving responder safety...");

  await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/responder-safety-report`, {
    method: "PUT",
    body: JSON.stringify({
      safetyActionsEstablished: nullableFormText(form, "safetyActionsEstablished"),
      ppeDecisionAt: toNullableIsoFromLocal(formValue(form, "ppeDecisionAt")),
      responseDeactivatedAt: toNullableIsoFromLocal(formValue(form, "responseDeactivatedAt")),
      deployedResponders: nullableFormNumber(form, "deployedResponders"),
      injuredResponders: nullableFormNumber(form, "injuredResponders"),
      illResponders: nullableFormNumber(form, "illResponders"),
      deceasedResponders: nullableFormNumber(form, "deceasedResponders"),
    }),
  });
  await reloadExpandedIncident("Responder safety saved.");
}

async function saveDeactivationSection(incidentId, form) {
  setMessage("deactivationMessage", "Saving deactivation and continuity...");

  await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/deactivation-continuity`, {
    method: "PUT",
    body: JSON.stringify({
      sceneDemobilizedAt: toNullableIsoFromLocal(formValue(form, "sceneDemobilizedAt")),
      emsCoverageDisruption: nullableFormText(form, "emsCoverageDisruption"),
      notes: nullableFormText(form, "notes"),
      assessedAt: toNullableIsoFromLocal(formValue(form, "assessedAt")),
    }),
  });
  await reloadExpandedIncident("Deactivation and continuity saved.");
}

async function saveHospitalResourcesSection(incidentId, form) {
  setMessage("hospitalResourcesMessage", "Saving hospital resources...");

  await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/hospital-resources`, {
    method: "PUT",
    body: JSON.stringify({
      recordedAt: toNullableIsoFromLocal(formValue(form, "recordedAt")),
      totalOperatingRooms: nullableFormNumber(form, "totalOperatingRooms"),
      totalResuscitationRooms: nullableFormNumber(form, "totalResuscitationRooms"),
      alternativeIcuInUse: nullableFormBoolean(form, "alternativeIcuInUse"),
      notes: nullableFormText(form, "notes"),
    }),
  });
  await reloadExpandedIncident("Hospital resources saved.");
}

function draftFormLabel(formType) {
  const labels = {
    incident: "Official Incident",
    healthcare_facility: "Healthcare Facility",
    casualty_field_responder: "Field Responder Casualty",
    casualty_sar: "SAR Casualty",
    casualty_hcfd: "HCFD Casualty",
    account: "Account",
  };

  return labels[formType] || roleLabel(formType);
}

function draftTargetView(formType) {
  switch (formType) {
    case "incident":
      return "incidents";
    case "healthcare_facility":
      return "facilities";
    case "account":
      return isSuperAdmin() ? "registration" : "users";
    default:
      return null;
  }
}

function getIncidentDraftPayload(form) {
  return {
    incidentName: formValue(form, "incidentName"),
    disasterType: formValue(form, "disasterType"),
    description: formValue(form, "description"),
    barangay: formValue(form, "barangay"),
    municipality: formValue(form, "municipality"),
    province: formValue(form, "province"),
    startedAt: formValue(form, "startedAt"),
    emsAlertedAt: formValue(form, "emsAlertedAt"),
    emsDeployedAt: formValue(form, "emsDeployedAt"),
    emsArrivedAt: formValue(form, "emsArrivedAt"),
  };
}

function getHealthcareFacilityDraftPayload(form) {
  return {
    facilityName: formValue(form, "facilityName"),
    facilityLevel: formValue(form, "facilityLevel"),
    address: formValue(form, "address"),
    barangay: formValue(form, "barangay"),
    municipality: formValue(form, "municipality"),
    province: formValue(form, "province"),
    contactPerson: formValue(form, "contactPerson"),
    contactNumber: formValue(form, "contactNumber"),
  };
}

function getAccountDraftPayload(form) {
  return {
    fullName: formValue(form, "fullName"),
    email: formValue(form, "email"),
    role: formValue(form, "role"),
    phoneNumber: formValue(form, "phoneNumber"),
    assignedMunicipality: formValue(form, "assignedMunicipality"),
    assignedBarangay: formValue(form, "assignedBarangay"),
  };
}

function setFormValues(form, payload = {}) {
  Object.entries(payload || {}).forEach(([name, value]) => {
    const field = form.elements[name];
    if (!field) return;

    field.value = value ?? "";
  });
}

function getDraftTitle(formType, payload) {
  if (formType === "incident") {
    return payload.incidentName || "Untitled official incident";
  }

  if (formType === "healthcare_facility") {
    return payload.facilityName || "Untitled healthcare facility";
  }

  if (formType === "account") {
    return payload.fullName || payload.email || "Untitled account";
  }

  return `${draftFormLabel(formType)} draft`;
}

async function saveFormDraft({
  form,
  formType,
  payload,
  messageId,
}) {
  setMessage(messageId, "Saving draft...");

  const existingDraftId = form.dataset.draftId;
  const savedDraft = await apiRequest(
    existingDraftId
      ? `/drafts/${encodeURIComponent(existingDraftId)}`
      : "/drafts",
    {
      method: existingDraftId ? "PATCH" : "POST",
      body: JSON.stringify({
        ...(existingDraftId ? {} : { formType }),
        title: getDraftTitle(formType, payload),
        payload,
      }),
    },
  );

  form.dataset.draftId = savedDraft.data.id;

  await loadSharedData();
  setMessage(messageId, "Draft saved. You can resume it from Drafts.", "success");
  showDashboardToast("Draft saved.", "success");
  return savedDraft.data;
}

function clearFormAfterDraftSave(form) {
  if (!form) return;

  form.reset();
  delete form.dataset.draftId;
}

async function deleteSubmittedFormDraft(form) {
  const draftId = form?.dataset?.draftId;
  if (!draftId) return;

  try {
    await apiRequest(`/drafts/${encodeURIComponent(draftId)}`, {
      method: "DELETE",
    });
    delete form.dataset.draftId;
  } catch (error) {
    console.warn("Unable to remove submitted draft:", error);
  }
}

function applyPendingDraftToForm(form, formType, messageId) {
  const draft = state.draftToResume;
  if (!draft || draft.form_type !== formType) return;

  form.dataset.draftId = draft.id;
  setFormValues(form, draft.payload || {});
  setMessage(messageId, `Loaded draft: ${draft.title}`, "success");
  state.draftToResume = null;
}

function renderDrafts() {
  const rows = state.formDrafts
    .slice()
    .sort(
      (first, second) =>
        new Date(second.updated_at || 0).getTime() -
        new Date(first.updated_at || 0).getTime(),
    )
    .map((draft) => {
      const targetView = draftTargetView(draft.form_type);

      return `
        <tr>
          <td><strong>${escapeHtml(draft.title || "Untitled draft")}</strong></td>
          <td>${escapeHtml(draftFormLabel(draft.form_type))}</td>
          <td>${formatDate(draft.updated_at || draft.created_at)}</td>
          <td>
            <div class="table-actions">
              ${
                targetView
                  ? `<button class="ghost-button mini" type="button" data-resume-draft="${escapeHtml(draft.id)}">Resume</button>`
                  : `<button class="ghost-button mini" type="button" disabled>Mobile draft</button>`
              }
              <button class="danger-button mini" type="button" data-delete-draft="${escapeHtml(draft.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    });

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Drafts</h2>
          <p class="panel-subtitle">Resume saved forms that have not been submitted yet.</p>
        </div>
        <span class="pill blue">${state.formDrafts.length} draft${state.formDrafts.length === 1 ? "" : "s"}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Draft</th>
              <th>Form</th>
              <th>Last saved</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join("") || `<tr><td colspan="4"><div class="empty-state">No saved drafts yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      <div id="draftsMessage" class="status-message" hidden></div>
    </section>
  `;
}

function bindDraftActions() {
  document.querySelectorAll("[data-resume-draft]").forEach((button) => {
    if (button.dataset.draftBound === "true") return;
    button.dataset.draftBound = "true";

    button.addEventListener("click", () => {
      const draft = state.formDrafts.find(
        (item) => item.id === button.dataset.resumeDraft,
      );
      if (!draft) return;

      const targetView = draftTargetView(draft.form_type);
      if (!targetView) {
        setMessage("draftsMessage", "This draft can only be resumed in the mobile app.", "error");
        return;
      }

      state.draftToResume = draft;
      setActiveView(targetView);
      renderDashboardShellIntoExisting();
    });
  });

  document.querySelectorAll("[data-delete-draft]").forEach((button) => {
    if (button.dataset.deleteDraftBound === "true") return;
    button.dataset.deleteDraftBound = "true";

    button.addEventListener("click", async () => {
      const draftId = button.dataset.deleteDraft;
      if (!draftId) return;

      const confirmed = await showDashboardConfirm({
        title: "Delete draft?",
        message: "This removes the saved draft. Submitted records are not affected.",
        confirmLabel: "Delete draft",
        cancelLabel: "Keep draft",
        tone: "danger",
      });

      if (!confirmed) return;

      try {
        await apiRequest(`/drafts/${encodeURIComponent(draftId)}`, {
          method: "DELETE",
        });
        await loadSharedData();
        renderCurrentView();
        bindView();
        showDashboardToast("Draft deleted.", "success");
      } catch (error) {
        setMessage("draftsMessage", getErrorMessage(error), "error");
      }
    });
  });

  document.querySelectorAll("[data-request-reopen-incident]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.requestReopenIncident;

      if (!incidentId) return;

      const reason = await showDashboardTextPrompt({
        title: "Request incident reopen",
        message:
          "Send a reopen request to the super admin. The incident remains closed until approved.",
        label: "Reason",
        placeholder: "Explain why this closed incident should be reopened.",
        confirmLabel: "Request reopen",
        required: true,
      });

      if (reason === null) return;

      try {
        setMessage("incidentActionMessage", "Submitting reopen request...");
        await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/reopen-request`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        delete state.incidentManagementDetails[incidentId];
        await loadSharedData();
        await loadIncidentManagementDetails(incidentId);
        renderCurrentView();
        bindView();
        showDashboardToast("Reopen request submitted.", "success");
      } catch (error) {
        showDashboardToast(getErrorMessage(error), "error");
      }
    });
  });

  document.querySelectorAll("[data-approve-reopen-incident]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.approveReopenIncident;

      if (!incidentId) return;

      const confirmed = await showDashboardConfirm({
        title: "Approve reopen request?",
        message:
          "This returns the incident to active status and clears its closed timestamp.",
        confirmLabel: "Approve reopen",
        cancelLabel: "Cancel",
      });

      if (!confirmed) return;

      try {
        setMessage("incidentActionMessage", "Approving reopen request...");
        await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/reopen-approval`, {
          method: "PATCH",
        });
        delete state.incidentManagementDetails[incidentId];
        await loadSharedData();
        await loadIncidentManagementDetails(incidentId);
        renderCurrentView();
        bindView();
        showDashboardToast("Incident reopened.", "success");
      } catch (error) {
        showDashboardToast(getErrorMessage(error), "error");
      }
    });
  });
}

function renderIncidentCreator(compact = false) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Add official incident</h2>
          <p class="panel-subtitle">Created incidents sync to the mobile Add Casualty incident picker.</p>
        </div>
      </div>
      <form id="incidentForm" class="form-grid">
        <div class="form-section-title">Incident identity</div>
        <div class="form-grid two">
          <label class="field"><span>Incident name</span><input name="incidentName" required placeholder="e.g. Flood in Barangay San Isidro" /></label>
          <label class="field"><span>Type of hazard</span><select name="disasterType" required>${hazardTypes.map((item) => `<option>${item}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>Incident exact location</span><input name="description" placeholder="Street, landmark, building, purok, or coordinates" /></label>
        <div class="form-grid three">
          <label class="field"><span>Barangay</span><input name="barangay" /></label>
          <label class="field"><span>Municipality / City</span><input name="municipality" /></label>
          <label class="field"><span>Province</span><input name="province" /></label>
        </div>
        <div class="form-section-title">Response timeline</div>
        <div class="timeline-fields">
          <label class="field"><span>Incident onsite</span><input name="startedAt" type="datetime-local" /></label>
          <label class="field"><span>EMS alerted</span><input name="emsAlertedAt" type="datetime-local" /></label>
          <label class="field"><span>EMS deployed</span><input name="emsDeployedAt" type="datetime-local" /></label>
          <label class="field"><span>EMS arrived</span><input name="emsArrivedAt" type="datetime-local" /></label>
        </div>
        <div class="button-row">
          <button class="primary-button" type="submit">Create official incident</button>
          <button class="ghost-button" type="button" data-save-draft="incident">Save draft</button>
          <button class="ghost-button" type="button" data-view-link="drafts">Open drafts</button>
        </div>
        <div id="incidentMessage" class="status-message" hidden></div>
      </form>
    </section>
    ${compact ? "" : `<div style="margin-top:16px">${renderIncidentHistory()}</div>`}
  `;
}

function bindCreateIncidentForm() {
  const form = qs("#incidentForm");
  if (!form) return;

  applyPendingDraftToForm(form, "incident", "incidentMessage");

  qs('[data-save-draft="incident"]')?.addEventListener("click", async () => {
    try {
      await saveFormDraft({
        form,
        formType: "incident",
        payload: getIncidentDraftPayload(form),
        messageId: "incidentMessage",
      });
      clearFormAfterDraftSave(form);
      await showDashboardNotice({
        eyebrow: "Draft saved",
        title: "Saved as draft",
        message:
          "This official incident form was saved in Drafts. The form has been cleared so you can start a new entry.",
        confirmLabel: "Done",
      });
    } catch (error) {
      setMessage("incidentMessage", getErrorMessage(error), "error");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("incidentMessage", "Creating incident...");

    try {
      const created = await apiRequest("/incidents", {
        method: "POST",
        body: JSON.stringify({
          incidentName: formValue(form, "incidentName"),
          disasterType: formValue(form, "disasterType"),
          description: formValue(form, "description"),
          barangay: formValue(form, "barangay"),
          municipality: formValue(form, "municipality"),
          province: formValue(form, "province"),
          startedAt: toIsoFromLocal(formValue(form, "startedAt")),
        }),
      });

      const timelinePayload = {
        eventNotificationAt: toIsoFromLocal(formValue(form, "emsAlertedAt")),
        dmmpActivatedAt: toIsoFromLocal(formValue(form, "emsDeployedAt")),
        firstEmsOnSceneAt: toIsoFromLocal(formValue(form, "emsArrivedAt")),
      };

      if (Object.values(timelinePayload).some(Boolean)) {
        await apiRequest(`/incidents/${encodeURIComponent(created.data.id)}/timeline`, {
          method: "PUT",
          body: JSON.stringify(timelinePayload),
        });
      }

      await deleteSubmittedFormDraft(form);
      form.reset();
      setMessage("incidentMessage", "Official incident created and synced to mobile incident selection.", "success");
      await loadSharedData();
    } catch (error) {
      setMessage("incidentMessage", error.message, "error");
    }
  });
}

function bindCreateEvacuationForm() {
  const form = qs("#evacuationForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("evacuationMessage", "Creating evacuation center...");

    try {
      await apiRequest("/evacuation-centers", {
        method: "POST",
        body: JSON.stringify({
          incidentId: formValue(form, "incidentId"),
          centerName: formValue(form, "centerName"),
          address: formValue(form, "address"),
          barangay: formValue(form, "barangay"),
          municipality: formValue(form, "municipality"),
          province: formValue(form, "province"),
          capacity: numberOrUndefined(formValue(form, "capacity")),
          contactPerson: formValue(form, "contactPerson"),
          contactNumber: formValue(form, "contactNumber"),
        }),
      });

      form.reset();
      setMessage("evacuationMessage", "Evacuation center created.", "success");
    } catch (error) {
      setMessage("evacuationMessage", error.message, "error");
    }
  });
}

function renderFacilityCreator() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Add healthcare facility</h2>
          <p class="panel-subtitle">Facilities created here become selectable from transport and hospital care workflows.</p>
        </div>
        <button
          class="ghost-button mini"
          type="button"
          data-export-download="/exports/healthcare-facilities.csv"
          data-export-file="dcms-healthcare-facilities.csv"
        >
          Export CSV
        </button>
      </div>
      <form id="facilityForm" class="form-grid" style="margin-top:14px">
        <div class="form-section-title">Facility profile</div>
        <div class="form-grid two">
          <label class="field"><span>Facility name</span><input name="facilityName" required /></label>
          <label class="field"><span>Facility level</span><select name="facilityLevel">${facilityLevels.map((level) => `<option value="${level}">${roleLabel(level)}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>Address</span><input name="address" /></label>
        <div class="form-grid three">
          <label class="field"><span>Barangay</span><input name="barangay" /></label>
          <label class="field"><span>Municipality</span><input name="municipality" /></label>
          <label class="field"><span>Province</span><input name="province" /></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Contact person</span><input name="contactPerson" /></label>
          <label class="field"><span>Contact number</span><input name="contactNumber" /></label>
        </div>
        <div class="button-row">
          <button class="primary-button" type="submit">Create healthcare facility</button>
          <button class="ghost-button" type="button" data-save-draft="healthcare_facility">Save draft</button>
          <button class="ghost-button" type="button" data-view-link="drafts">Open drafts</button>
        </div>
        <div id="facilityMessage" class="status-message" hidden></div>
      </form>
      ${renderBulkImportPanel(
        "healthcareFacilities",
        " Upload Healthcare Facilities",
        "Upload a CSV or Excel file to create multiple official healthcare facilities.",
      )}
    </section>
    ${renderHealthcareFacilitiesTable()}
  `;
}

function renderHealthcareFacilitiesTable() {
  const rows = state.healthcareFacilities
    .slice()
    .sort((first, second) =>
      compareText(first.facility_name, second.facility_name),
    )
    .map((facility) => {
      const location = formatLocation(
        facility.address,
        facility.barangay,
        facility.municipality,
        facility.province,
      );

      return `
        <tr>
          <td><strong>${escapeHtml(facility.facility_name)}</strong></td>
          <td>${escapeHtml(roleLabel(facility.facility_level))}</td>
          <td>${escapeHtml(location)}</td>
          <td>${escapeHtml(facility.contact_person || "Not recorded")}</td>
          <td>${escapeHtml(facility.contact_number || "Not recorded")}</td>
          <td><span class="pill ${facility.is_active ? "green" : "red"}">${facility.is_active ? "Active" : "Inactive"}</span></td>
          <td>${formatDate(facility.created_at)}</td>
          <td><button class="ghost-button mini" type="button" data-edit-healthcare-facility="${escapeHtml(facility.id)}">Edit facility</button></td>
        </tr>
      `;
    });

  return `
    <section class="panel" style="margin-top:18px">
      <div class="panel-header">
        <div>
          <h2>Added healthcare facilities</h2>
          <p class="panel-subtitle">Facilities available to healthcare facility documenters and responder workflows.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Facility</th>
              <th>Level</th>
              <th>Location</th>
              <th>Contact person</th>
              <th>Contact number</th>
              <th>Status</th>
              <th>Date added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join("") || `<tr><td colspan="8"><div class="empty-state">No healthcare facilities added yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      <div id="facilityTableMessage" class="status-message" hidden></div>
    </section>
  `;
}

function renderHealthcareFacilityEditModal(facility) {
  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="record-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="facilityModalTitle">
        <form id="facilityEditForm">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Healthcare Facilities</span>
              <h2 id="facilityModalTitle">Edit facility</h2>
              <p>${escapeHtml(facility.facility_name || "Healthcare facility")}</p>
            </div>
            <button class="icon-button" type="button" data-close-modal aria-label="Close facility editor">&times;</button>
          </div>

          <div class="modal-body">
            <div class="form-grid two">
              <label class="field"><span>Facility name</span><input name="facilityName" required value="${escapeHtml(facility.facility_name || "")}" /></label>
              <label class="field">
                <span>Facility level</span>
                <select name="facilityLevel">
                  ${facilityLevels
                    .map(
                      (level) =>
                        `<option value="${escapeHtml(level)}" ${facility.facility_level === level ? "selected" : ""}>${escapeHtml(roleLabel(level))}</option>`,
                    )
                    .join("")}
                </select>
              </label>
              <label class="field">
                <span>Status</span>
                <select name="isActive">
                  <option value="true" ${facility.is_active ? "selected" : ""}>Active</option>
                  <option value="false" ${!facility.is_active ? "selected" : ""}>Inactive</option>
                </select>
              </label>
              <label class="field"><span>Contact person</span><input name="contactPerson" value="${escapeHtml(facility.contact_person || "")}" /></label>
              <label class="field"><span>Contact number</span><input name="contactNumber" value="${escapeHtml(facility.contact_number || "")}" /></label>
              <label class="field"><span>Barangay</span><input name="barangay" value="${escapeHtml(facility.barangay || "")}" /></label>
              <label class="field"><span>Municipality</span><input name="municipality" value="${escapeHtml(facility.municipality || "")}" /></label>
              <label class="field"><span>Province</span><input name="province" value="${escapeHtml(facility.province || "")}" /></label>
            </div>
            <label class="field"><span>Address</span><input name="address" value="${escapeHtml(facility.address || "")}" /></label>
            <div class="account-status-strip">
              <span class="pill ${facility.is_active ? "green" : "red"}">${facility.is_active ? "Active" : "Inactive"}</span>
              <span>${facility.created_at ? `Created ${formatDate(facility.created_at)}` : "No creation date recorded"}</span>
              <span>${facility.updated_at ? `Last updated ${formatDate(facility.updated_at)}` : "No update recorded"}</span>
            </div>
            <div id="facilityEditMessage" class="status-message" hidden></div>
          </div>

          <div class="modal-footer">
            <button class="ghost-button" type="button" data-close-modal>Cancel</button>
            <button class="primary-button" type="submit">Save facility</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function openHealthcareFacilityEditModal(facilityId) {
  const facility = state.healthcareFacilities.find(
    (item) => item.id === facilityId,
  );

  if (!facility) {
    setMessage("facilityTableMessage", "Healthcare facility could not be found.", "error");
    return;
  }

  closeRecordModal();
  document.body.insertAdjacentHTML(
    "beforeend",
    renderHealthcareFacilityEditModal(facility),
  );

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target === element || element.matches("button")) {
        closeRecordModal();
      }
    });
  });

  bindHealthcareFacilityEditForm(facility.id);
}

function bindHealthcareFacilityActions() {
  document.querySelectorAll("[data-edit-healthcare-facility]").forEach((button) => {
    if (button.dataset.editBound === "true") return;
    button.dataset.editBound = "true";

    button.addEventListener("click", () => {
      openHealthcareFacilityEditModal(button.dataset.editHealthcareFacility);
    });
  });
}

function bindHealthcareFacilityEditForm(facilityId) {
  const form = qs("#facilityEditForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("facilityEditMessage", "Saving healthcare facility...");

    try {
      await apiRequest(`/healthcare-facilities/${encodeURIComponent(facilityId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          facilityName: formValue(form, "facilityName"),
          facilityLevel: formValue(form, "facilityLevel"),
          isActive: formValue(form, "isActive") === "true",
          address: formValue(form, "address"),
          barangay: formValue(form, "barangay"),
          municipality: formValue(form, "municipality"),
          province: formValue(form, "province"),
          contactPerson: formValue(form, "contactPerson"),
          contactNumber: formValue(form, "contactNumber"),
        }),
      });

      await loadSharedData();
      closeRecordModal();
      renderCurrentView();
      bindView();
      setMessage("facilityTableMessage", "Healthcare facility updated successfully.", "success");
      showDashboardToast("Healthcare facility updated successfully.", "success");
    } catch (error) {
      setMessage("facilityEditMessage", error.message, "error");
    }
  });
}

function bindCreateFacilityForm() {
  const form = qs("#facilityForm");
  if (!form) return;

  applyPendingDraftToForm(form, "healthcare_facility", "facilityMessage");

  qs('[data-save-draft="healthcare_facility"]')?.addEventListener("click", async () => {
    try {
      await saveFormDraft({
        form,
        formType: "healthcare_facility",
        payload: getHealthcareFacilityDraftPayload(form),
        messageId: "facilityMessage",
      });
      clearFormAfterDraftSave(form);
      await showDashboardNotice({
        eyebrow: "Draft saved",
        title: "Saved as draft",
        message:
          "This healthcare facility form was saved in Drafts. The form has been cleared so you can start a new entry.",
        confirmLabel: "Done",
      });
    } catch (error) {
      setMessage("facilityMessage", getErrorMessage(error), "error");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("facilityMessage", "Creating healthcare facility...");

    try {
      await apiRequest("/healthcare-facilities", {
        method: "POST",
        body: JSON.stringify({
          facilityName: formValue(form, "facilityName"),
          facilityLevel: formValue(form, "facilityLevel"),
          address: formValue(form, "address"),
          barangay: formValue(form, "barangay"),
          municipality: formValue(form, "municipality"),
          province: formValue(form, "province"),
          contactPerson: formValue(form, "contactPerson"),
          contactNumber: formValue(form, "contactNumber"),
        }),
      });

      await deleteSubmittedFormDraft(form);
      form.reset();
      await loadSharedData();
      renderCurrentView();
      bindView();
      setMessage("facilityMessage", "Healthcare facility created.", "success");
    } catch (error) {
      setMessage("facilityMessage", error.message, "error");
    }
  });
}

function incidentOptions() {
  return state.incidents
    .filter((incident) => incident.status === "active")
    .map(
      (incident) =>
        `<option value="${escapeHtml(incident.id)}">${escapeHtml(incident.incident_name)} (${escapeHtml(incident.incident_code)})</option>`,
    )
    .join("");
}

render();
