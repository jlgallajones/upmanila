const PRODUCTION_API_BASE_URL = "https://dcms-api-ljco.onrender.com/api";
const LOCAL_API_BASE_URL = "http://localhost:5000/api";

function getDefaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return LOCAL_API_BASE_URL;
  }

  const { hostname } = window.location;

  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return LOCAL_API_BASE_URL;
  }

  return PRODUCTION_API_BASE_URL;
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
  activeView: "home",
  incidents: [],
  allIncidents: [],
  expandedIncidentId: null,
  analyticsIncidentId: null,
  activeIncidentSectionModal: null,
  incidentManagementDetails: {},
  loadingIncidentManagementId: null,
  casualties: [],
  healthcareFacilities: [],
  unitUsers: [],
  dashboard: null,
  recentActivity: [],
};

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

const superAdminViews = [
  ["home", "Summary"],
  ["registration", "Account Registration"],
  ["incident-management", "Incident Management"],
  ["incident-analytics", "Incident Analytics"],
  ["history", "Incident History"],
  ["logs", "Action Logs"],
];

const adminViews = [
  ["home", "Homepage"],
  ["incident-management", "Incident Management"],
  ["incident-analytics", "Incident Analytics"],
  ["incidents", "Official Incidents"],
  ["evacuation", "Evacuation Centers"],
  ["facilities", "Healthcare Facilities"],
  ["users", "Accounts"],
  ["records", "Casualty Records"],
  ["verification", "Verification Review"],
  ["logs", "Action Logs"],
];

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

function clearSession() {
  state.user = null;
  state.accessToken = null;
  localStorage.removeItem("dcms.admin.user");
  localStorage.removeItem("dcms.admin.accessToken");
}

function roleLabel(role) {
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
  const response = await fetch(`${state.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    if (contentType.includes("application/json")) {
      const body = await response.json();
      message = body.message || message;
    }

    if (response.status === 401) {
      clearSession();
      render();
    }

    throw new Error(message);
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

function setMessage(id, message, type = "") {
  const element = document.getElementById(id);
  if (!element) return;
  element.className = `status-message ${type}`;
  element.textContent = message;
  element.hidden = !message;
}

async function loadSharedData() {
  if (!state.accessToken) return;

  const [
    dashboard,
    incidents,
    allIncidents,
    casualties,
    healthcareFacilities,
    unitUsers,
    recent,
  ] =
    await Promise.allSettled([
      apiRequest("/dashboard/summary"),
      apiRequest("/incidents"),
      apiRequest("/incidents?scope=all"),
      apiRequest("/casualties"),
      apiRequest("/healthcare-facilities"),
      apiRequest("/auth/unit-users"),
      apiRequest("/dashboard/recent-activity?limit=12"),
    ]);

  if (dashboard.status === "fulfilled") {
    state.dashboard = dashboard.value.data;
  }

  let loadedIncidents = state.incidents;
  let loadedAllIncidents = state.allIncidents;
  let loadedCasualties = state.casualties;
  let loadedHealthcareFacilities = state.healthcareFacilities;
  let loadedUnitUsers = state.unitUsers;
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

  if (healthcareFacilities.status === "fulfilled") {
    loadedHealthcareFacilities = healthcareFacilities.value.data || [];
  }

  if (unitUsers.status === "fulfilled") {
    loadedUnitUsers = unitUsers.value.data || [];
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
  state.healthcareFacilities = loadedHealthcareFacilities;
  state.unitUsers = loadedUnitUsers;
  state.recentActivity = loadedRecentActivity;

  recomputeAdminDashboardSummary();
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
      state.activeView = response.data.user.role === "super_admin" ? "home" : "home";
      render();
    } catch (error) {
      setMessage("loginMessage", error.message, "error");
    }
  });
}

function renderDashboardShell() {
  const views = isSuperAdmin() ? superAdminViews : adminViews;

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
          ${views
            .map(
              ([id, label]) => `
                <button class="nav-button ${state.activeView === id ? "active" : ""}" data-view="${id}" title="${escapeHtml(label)}">
                  <span class="nav-glyph"></span>
                  <span>${label}</span>
                </button>
              `,
            )
            .join("")}
        </nav>

        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-avatar">${escapeHtml(state.user.full_name?.slice(0, 1) || "A")}</div>
            <div class="user-chip-text">
            <strong>${escapeHtml(state.user.full_name)}</strong>
            <span>${roleLabel(state.user.role)}</span>
            </div>
          </div>
          <button id="logoutButton" class="danger-button">Logout</button>
        </div>
      </aside>

      <main class="main">
        <div class="workspace-band">
          <div>
            <span class="workspace-eyebrow">${isSuperAdmin() ? "System Command" : "Incident Administration"}</span>
            <strong>${isSuperAdmin() ? "Oversight Console" : "Official Records Console"}</strong>
          </div>
          <span class="live-indicator">Live API</span>
        </div>
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
    renderDashboardShellIntoExisting();
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      document.querySelectorAll(".nav-button").forEach((item) =>
        item.classList.toggle("active", item.dataset.view === state.activeView),
      );
      renderCurrentView();
      bindView();
    });
  });

  qs("#logoutButton").addEventListener("click", () => {
    clearSession();
    render();
  });
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
        "incident-management": "Incident Management",
        "incident-analytics": "Incident Analytics",
        incidents: "Official Incidents",
        evacuation: "Evacuation Centers",
        facilities: "Healthcare Facilities",
        users: "Accounts",
        records: "Casualty Records",
        verification: "Verification Review",
        logs: "Action Logs",
      }[state.activeView];

  root.innerHTML = `
    <header class="topbar">
      <div>
        <span class="eyebrow">${isSuperAdmin() ? "Super Admin" : "Admin"}</span>
        <h1>${title}</h1>
        <p>${isSuperAdmin() ? "System-wide oversight and administrator controls." : "Create official response references for the mobile app."}</p>
      </div>
      <button id="refreshButton" class="ghost-button">Refresh</button>
    </header>
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
  bindRegisterAdminForm();
  bindRegisterUnitUserForm();
  bindAccountActions();
  bindIncidentManagementActions();
  bindIncidentAnalyticsActions();
  bindOpenCasualtyRecord();
  bindVerificationReviewActions();
  bindScopeLinks();
}

function bindScopeLinks() {
  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.viewLink || "home";
      renderDashboardShellIntoExisting();
    });
  });
}

function bindIncidentAnalyticsActions() {
  if (state.activeView !== "incident-analytics") return;

  const incidents = state.allIncidents.length ? state.allIncidents : state.incidents;
  const selectedIncident =
    incidents.find((incident) => incident.id === state.analyticsIncidentId) ||
    incidents.find((incident) => incident.status === "active") ||
    incidents[0] ||
    null;
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
    case "incident-management":
      return renderIncidentManagement();
    case "incident-analytics":
      return renderIncidentAnalytics();
    case "incidents":
      return renderIncidentCreator();
    case "evacuation":
      return renderEvacuationCreator();
    case "facilities":
      return renderFacilityCreator();
    case "users":
      return renderAdminUnitRegistration();
    case "records":
      return renderAdminCasualtyRecords();
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
  const items = analytics?.timelineVisuals || [];

  return `
    <section class="panel analytics-wide">
      <div class="panel-header">
        <div>
          <h2>Incident Timeline</h2>
          <p class="panel-subtitle">Key milestones extracted from incident, triage, transport, HCFD, and responder safety records.</p>
        </div>
      </div>
      <div class="analytics-timeline">
        ${
          items
            .map(
              (item) => `
                <div class="analytics-timeline-item ${item.at ? "complete" : ""}">
                  <span></span>
                  <div>
                    <strong>${escapeHtml(item.label)}</strong>
                    <small>${formatDate(item.at)}</small>
                    <div class="analytics-timeline-meta">
                      <em>From previous: ${escapeHtml(formatMinutes(item.elapsedSincePreviousMinutes))}</em>
                      <em>From DMMP: ${escapeHtml(formatMinutes(item.elapsedSinceActivationMinutes))}</em>
                    </div>
                  </div>
                </div>
              `,
            )
            .join("") || `<div class="empty-state">No timeline values available yet.</div>`
        }
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

  if (normalized === "1 minute") {
    return "1m";
  }

  if (normalized.endsWith(" minutes")) {
    return `${normalized.replace(" minutes", "")}m`;
  }

  if (normalized === "1 hour") {
    return "1h";
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
  const normalizedSeries = (series || [])
    .map((item, index) => ({
      key: item.key || item.label || `series-${index}`,
      label: item.label || item.key || `Series ${index + 1}`,
      data: Array.isArray(item.data) ? item.data : [],
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

function renderAnalyticsGraphGrid(analytics) {
  const graphs = analytics?.barGraphs || {};
  const lineGraphs = getAnalyticsLineGraphs(analytics);
  const cumulativeNote = "Cumulative after disaster plan activation: 1 minute, 5 minutes, 10 minutes, 15 minutes, 30 minutes, and 1 hour.";

  return `
    ${renderAnalyticsSection(
      "Triage & Patient Distribution",
      "Primary triage, secondary triage, and ED-care distribution with count and percentage labels.",
      `<div class="analytics-graph-grid">
        ${renderAnalyticsGraphSection("Immediate, Delayed, Minor, and Expectant Victims Using Primary Triage", graphs.primaryTriageByCategory, { chart: "pie" })}
        ${renderAnalyticsGraphSection("Immediate, Delayed, Minor, and Expectant Victims Using Secondary Triage", graphs.secondaryTriageByCategory, { chart: "pie" })}
        ${renderAnalyticsGraphSection("Victims Seeking ED Care According to Triage Category", graphs.edCareByTriageCategory, { chart: "pie" })}
      </div>`,
    )}
    ${renderAnalyticsSection(
      "Treatment / Stabilization & Responder Safety",
      "Stabilization strategies and responder safety responses for the selected incident.",
      `<div class="analytics-graph-grid">
        ${renderAnalyticsGraphSection("Victims Stabilized Using Each Evacuation Strategy", graphs.stabilizationStrategies, { chart: "pie" })}
        ${renderAnalyticsGraphSection("Safe and Unsafe Responders", graphs.responderSafety, { chart: "pie" })}
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

function renderIncidentAnalytics() {
  const incidents = state.allIncidents.length ? state.allIncidents : state.incidents;
  const selectedIncident =
    incidents.find((incident) => incident.id === state.analyticsIncidentId) ||
    incidents.find((incident) => incident.status === "active") ||
    incidents[0] ||
    null;
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
    <div class="grid four">
      ${renderMetric("Selected incident", selectedIncident ? 1 : 0, "emphasis", selectedIncident ? `Status: ${roleLabel(selectedIncident.status)}` : "No incident selected")}
      ${renderMetric("Casualty records", totalCasualties, "", "For selected incident")}
      ${renderMetric("Verified records", verifiedRecords, "", "For selected incident")}
      ${renderMetric("Pending review", pendingRecords, "", "For selected incident")}
    </div>
    ${
      !selectedIncident
        ? `<section class="panel" style="margin-top:18px"><div class="empty-state">No incidents available for analytics.</div></section>`
        : isLoading || !analytics
          ? `<section class="panel" style="margin-top:18px"><div class="empty-state">${isLoading ? "Loading analytics..." : "Analytics data is not loaded yet."}</div></section>`
          : `
            <div style="margin-top:18px">${renderTimelineVisual(analytics)}</div>
            <div style="margin-top:18px">${renderPlainTextAnalytics(analytics)}</div>
            <div style="margin-top:18px">${renderAnalyticsGraphGrid(analytics)}</div>
          `
    }
    <section class="panel" style="margin-top:18px">
      <div class="panel-header">
        <div>
          <h2>Visible incident list</h2>
          <p class="panel-subtitle">Scoped to ${isSuperAdmin() ? "all units" : "the logged-in admin account"}.</p>
        </div>
      </div>
      ${renderAnalyticsBars(Object.fromEntries(incidents.map((incident) => [incident.incident_name, casualtyCounts.get(incident.id) || 0])))}
    </section>
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
        <button class="scope-item" data-view-link="users"><strong>Accounts</strong><span>Register and manage responder/documenter accounts in this unit.</span></button>
        <button class="scope-item" data-view-link="incidents"><strong>Reported incident history</strong><span>Review incidents created within this unit.</span></button>
        <button class="scope-item" data-view-link="records"><strong>Casualty records</strong><span>See a summary of all casualty entries.</span></button>
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

function renderRegistrationShell() {
  return `
    <section class="panel">
      <h2>Account registration</h2>
      <p class="panel-subtitle">Create command accounts with Supabase Auth login and a matching DCMS user profile.</p>
      <form id="registerAdminForm" class="form-grid" style="margin-top:14px">
        <div class="form-grid two">
          <label class="field"><span>Full name</span><input name="fullName" required placeholder="Account holder full name" /></label>
          <label class="field"><span>Email</span><input name="email" type="email" required placeholder="user@example.com" /></label>
          <label class="field"><span>Temporary password</span><input name="password" type="password" required minlength="6" /></label>
          <label class="field"><span>Role</span><select name="role"><option value="administrator">Administrator</option><option value="super_admin">Super Admin</option></select></label>
          <label class="field"><span>Phone number</span><input name="phoneNumber" /></label>
          <label class="field"><span>Assigned municipality</span><input name="assignedMunicipality" /></label>
        </div>
        <label class="field"><span>Assigned barangay</span><input name="assignedBarangay" /></label>
        <button class="primary-button" type="submit">Create account</button>
        <div id="registrationMessage" class="status-message" hidden></div>
      </form>
    </section>
  `;
}

function bindRegisterAdminForm() {
  const form = qs("#registerAdminForm");
  if (!form) return;

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
      <p class="panel-subtitle">Create responder and documenter accounts tied to this admin unit. Responders choose Field or Stabilization Area function in the mobile Profile tab.</p>
    </section>
    <section class="panel" style="margin-top:16px">
      <form id="unitUserForm" class="form-grid">
        <div class="form-grid two">
          <label class="field"><span>Full name</span><input name="fullName" required placeholder="Responder full name" /></label>
          <label class="field"><span>Email</span><input name="email" type="email" required placeholder="responder@example.com" /></label>
          <label class="field"><span>Temporary password</span><input name="password" type="password" required minlength="6" /></label>
          <label class="field">
            <span>Account role</span>
            <select name="role">
              <option value="responder">Responder</option>
              <option value="documenter">Healthcare Facility Documenter</option>
            </select>
          </label>
          <label class="field"><span>Assigned municipality</span><input name="assignedMunicipality" value="${escapeHtml(state.user.assigned_municipality || "")}" placeholder="Current admin unit" /></label>
          <label class="field"><span>Assigned barangay</span><input name="assignedBarangay" value="${escapeHtml(state.user.assigned_barangay || "")}" /></label>
          <label class="field"><span>Phone number</span><input name="phoneNumber" /></label>
        </div>
        <button class="primary-button" type="submit">Create unit user</button>
        <div id="unitUserMessage" class="status-message" hidden></div>
      </form>
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
          <p class="panel-subtitle">Responder and documenter accounts that can access the mobile app.</p>
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
                .join("") || `<tr><td colspan="6"><div class="empty-state">No responder or documenter accounts created yet.</div></td></tr>`
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
      setMessage("unitUserMessage", error.message, "error");
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
                  <option value="responder" ${user.role === "responder" ? "selected" : ""}>Responder</option>
                  <option value="documenter" ${user.role === "documenter" ? "selected" : ""}>Healthcare Facility Documenter</option>
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
    const confirmed = window.confirm(
      `Delete ${label}? This removes their login access. If records already reference this profile, it will be kept as inactive for history.`,
    );

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
    } catch (error) {
      button.disabled = false;
      setMessage("accountEditMessage", error.message, "error");
    }
  });
}

function renderAdminCasualtyRecords(compact = false) {
  const byIncident = new Map();

  for (const item of state.casualties) {
    const incidentName = item.incident?.incident_name || "Unknown incident";
    const current = byIncident.get(incidentName) || {
      total: 0,
      pending: 0,
      verified: 0,
    };

    current.total += 1;

    if (item.verification_status === "verified") {
      current.verified += 1;
    } else {
      current.pending += 1;
    }

    byIncident.set(incidentName, current);
  }

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Casualty records summary</h2>
          <p class="panel-subtitle">Summary of available casualty records from mobile submissions.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Incident</th><th>Total</th><th>Pending</th><th>Verified</th></tr></thead>
          <tbody>
            ${
              Array.from(byIncident.entries())
                .map(
                  ([incidentName, counts]) => `
                    <tr>
                      <td><strong>${escapeHtml(incidentName)}</strong></td>
                      <td>${counts.total}</td>
                      <td><span class="pill orange">${counts.pending}</span></td>
                      <td><span class="pill green">${counts.verified}</span></td>
                    </tr>
                  `,
                )
                .join("") || `<tr><td colspan="4"><div class="empty-state">No casualty records available yet.</div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAdminVerificationReview() {
  const reviewItems = state.casualties
    .filter((item) =>
      ["submitted", "under_review"].includes(item.verification_status),
    )
    .sort(compareVerificationRecords);

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Verification review</h2>
          <p class="panel-subtitle">Casualty entries awaiting review from responder accounts in this admin unit.</p>
        </div>
      </div>
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
                      <td>${formatDate(item.reported_at)}</td>
                      <td>
                        <div class="table-actions">
                          <button class="ghost-button mini" data-open-casualty="${escapeHtml(item.id)}">Open record</button>
                          <button class="ghost-button mini" data-review-action="under_review" data-casualty-id="${escapeHtml(item.id)}">Review</button>
                          <button class="secondary-button mini" data-review-action="verified" data-casualty-id="${escapeHtml(item.id)}">Approve</button>
                          <button class="danger-button mini" data-review-action="rejected" data-casualty-id="${escapeHtml(item.id)}">Reject</button>
                        </div>
                      </td>
                    </tr>
                  `,
                )
                .join("") || `<tr><td colspan="7"><div class="empty-state">No pending verification items.</div></td></tr>`
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

function renderCasualtyRecordModal(item) {
  const casualty = item.casualty || {};
  const incident = item.incident || {};
  const evacuationCenter = item.evacuation_center || {};
  const healthcareFacility = item.healthcare_facility || {};
  const encoder = item.encoder || {};

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
          <section class="record-section">
            <h3>Personal Details</h3>
            <div class="casualty-detail-grid">
              ${detailItem("ID type", casualty.id_type)}
              ${detailItem("Identification", roleLabel(casualty.identification_status))}
              ${detailItem("Sex", casualty.sex)}
              ${detailItem("Age", casualty.estimated_age)}
              ${detailItem("Date of birth", casualty.date_of_birth)}
              ${detailItem("Contact number", casualty.contact_number)}
              ${detailItem("Address", formatLocation(casualty.house_street, casualty.barangay, casualty.municipality, casualty.province, casualty.region))}
            </div>
          </section>

          <section class="record-section">
            <h3>Incident Details</h3>
            <div class="casualty-detail-grid">
              ${detailItem("Incident code", incident.incident_code)}
              ${detailItem("Incident name", incident.incident_name)}
              ${detailItem("Hazard", incident.disaster_type)}
              ${detailItem("Incident status", roleLabel(incident.status))}
              ${detailItem("Reported at", formatDate(item.reported_at))}
              ${detailItem("Encoded by", encoder.full_name)}
              ${detailItem("Encoder unit", encoderUnitName(encoder))}
              ${detailItem("Encoder role", roleLabel(encoder.role))}
            </div>
          </section>

          <section class="record-section">
            <h3>Care And Location</h3>
            <div class="casualty-detail-grid">
              ${detailItem("Current location", item.current_location)}
              ${detailItem("Hospital name", item.hospital_name)}
              ${detailItem("Evacuation center", evacuationCenter.center_name)}
              ${detailItem("Evacuation address", formatLocation(evacuationCenter.address, evacuationCenter.barangay, evacuationCenter.municipality, evacuationCenter.province))}
              ${detailItem("Healthcare facility", healthcareFacility.facility_name)}
              ${detailItem("Facility level", roleLabel(healthcareFacility.facility_level))}
              ${detailItem("Facility address", formatLocation(healthcareFacility.address, healthcareFacility.barangay, healthcareFacility.municipality, healthcareFacility.province))}
            </div>
          </section>

          <section class="record-section">
            <h3>Clinical Notes</h3>
            <div class="casualty-detail-grid">
              ${detailItem("Visible injury", item.visible_injury)}
              ${detailItem("Medical condition", item.medical_condition)}
              ${detailItem("Assistance needed", item.assistance_needed)}
              ${detailItem("Assistance provided", item.assistance_provided)}
              ${detailItem("Remarks", item.remarks || "No remarks")}
              ${detailItem("Coordinates", item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : "Not recorded")}
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button class="ghost-button" type="button" data-review-action="under_review" data-casualty-id="${escapeHtml(item.id)}">Mark under review</button>
          <button class="secondary-button" type="button" data-review-action="verified" data-casualty-id="${escapeHtml(item.id)}">Approve record</button>
          <button class="danger-button" type="button" data-review-action="rejected" data-casualty-id="${escapeHtml(item.id)}">Reject record</button>
        </div>
      </section>
    </div>
  `;
}

function closeRecordModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

function openCasualtyRecordModal(casualtyId) {
  const item = state.casualties.find((record) => record.id === casualtyId);

  if (!item) {
    setMessage("verificationMessage", "Casualty record could not be found.", "error");
    return;
  }

  closeRecordModal();
  document.body.insertAdjacentHTML("beforeend", renderCasualtyRecordModal(item));

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target === element || element.matches("button")) {
        closeRecordModal();
      }
    });
  });

  bindVerificationReviewActions();
}

function bindOpenCasualtyRecord() {
  document.querySelectorAll("[data-open-casualty]").forEach((element) => {
    if (element.dataset.openBound === "true") return;
    element.dataset.openBound = "true";

    element.addEventListener("click", (event) => {
      if (event.target.closest("[data-review-action]")) return;
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
        notes = window.prompt("Enter rejection notes for this casualty entry:")?.trim() || "";

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
      } catch (error) {
        setMessage("verificationMessage", error.message, "error");
      }
    });
  });
}

function renderAdminActionLogs() {
  return `
    <section class="panel api-note">
      <h2>Action logs by created users</h2>
      <p class="panel-subtitle">This requires persistent audit logging with creator/admin-unit ownership. Recent activity is shown as a temporary operational trail.</p>
    </section>
    <div style="margin-top:16px">${renderRecentActivity()}</div>
  `;
}

function renderIncidentHistory() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Incident history</h2>
          <p class="panel-subtitle">All official incidents created by admin users.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Hazard</th><th>Location</th><th>Status</th><th>Started</th></tr></thead>
          <tbody>
            ${state.incidents
              .map(
                (incident) => `
                  <tr>
                    <td>${escapeHtml(incident.incident_code)}</td>
                    <td><strong>${escapeHtml(incident.incident_name)}</strong></td>
                    <td>${escapeHtml(incident.disaster_type)}</td>
                    <td>${escapeHtml([incident.barangay, incident.municipality, incident.province].filter(Boolean).join(", "))}</td>
                    <td><span class="pill blue">${escapeHtml(incident.status)}</span></td>
                    <td>${formatDate(incident.started_at)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderActionLogsShell() {
  return `
    <section class="panel api-note">
      <h2>Action logs</h2>
      <p class="panel-subtitle">The dashboard needs a backend audit_logs table/endpoint for full user action tracking. For now, recent casualty activity is shown below as the available operational history.</p>
    </section>
    <div style="margin-top:16px">${renderRecentActivity()}</div>
  `;
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
  ["timeline", "Response Timeline", true],
  ["dmmp-staff", "DMMP Staff Call-down", true],
  ["coordination", "Coordination Assessment", true],
  ["responder-safety", "Responder Safety", true],
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
  ["edit-incident", "Edit Incident", true],
];

async function loadIncidentManagementDetails(incidentId) {
  state.loadingIncidentManagementId = incidentId;
  renderCurrentView();
  bindView();

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
  state.loadingIncidentManagementId = null;
}

function renderIncidentManagement() {
  const incidents = state.allIncidents.length ? state.allIncidents : state.incidents;

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Incident Management</h2>
          <p class="panel-subtitle">Manage every incident record, including active, closed, archived, and draft incidents.</p>
        </div>
        <span class="pill blue">${incidents.length} incidents</span>
      </div>
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

function renderIncidentManagementSections(incident, _details) {
  return `
    <div class="incident-management-body">
      <div class="section-launcher-grid">
        ${incidentManagementSections
          .map(
            ([id, title, canEdit]) => `
              <button class="section-launcher" type="button" data-open-incident-section="${id}" data-incident-id="${escapeHtml(incident.id)}">
                <span>${escapeHtml(title)}</span>
                <small>${canEdit ? "View or edit" : "View summary"}</small>
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
    case "responder-safety":
      return renderResponderSafetyManagementForm(
        details.responderSafety?.data,
        details.responderSafety?.summary,
        true,
      );
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
      return renderKeyValueSection([
        ["Safety actions established", roleLabel(details.responderSafety?.data?.safety_actions_established || "unknown")],
        ["PPE decision at", formatDate(details.responderSafety?.data?.ppe_decision_at)],
        ["Response deactivated at", formatDate(details.responderSafety?.data?.response_deactivated_at)],
        ["Deployed responders", details.responderSafety?.data?.deployed_responders ?? 0],
        ["Injured responders", details.responderSafety?.data?.injured_responders ?? 0],
        ["Ill responders", details.responderSafety?.data?.ill_responders ?? 0],
        ["Deceased responders", details.responderSafety?.data?.deceased_responders ?? 0],
        ["Killed percentage", `${details.responderSafety?.summary?.killedPercentage ?? 0}%`],
      ]);
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

function renderDmmpStaffView(staffRecords, summary) {
  return `
    ${renderKeyValueSection([
      ["Total staff records", summary?.totalStaffRecords ?? 0],
      ["Contacted", summary?.totalContacted ?? 0],
      ["Arrived", summary?.totalArrived ?? 0],
      ["Arrived within standard", summary?.totalArrivedWithinStandard ?? 0],
      ["Reporting percentage", `${summary?.reportingPercentage ?? 0}%`],
    ])}
    <div class="mini-table">
      ${staffRecords
        .map(
          (record) => `
            <div class="mini-table-row readonly">
              <strong>${escapeHtml(record.staff_name || "Unnamed staff")}</strong>
              <span>${escapeHtml(record.role_name || "No role")}</span>
              <span>${record.was_contacted ? "Contacted" : "Not contacted"}</span>
              <span>${record.arrived_at ? `Arrived ${formatDate(record.arrived_at)}` : "No arrival time"}</span>
            </div>
          `,
        )
        .join("") || `<div class="empty-state">No DMMP staff records yet.</div>`}
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
  return `
    <section class="incident-section-card">
      <div class="section-card-header">
        <div>
          <h3>DMMP Staff Call-down</h3>
          <p class="panel-subtitle">${summary ? `${summary.totalArrived || 0}/${summary.totalStaffRecords || 0} arrived. Reporting ${summary.reportingPercentage || 0}%.` : "Add and review DMMP staff contact records."}</p>
        </div>
      </div>
      <form id="${forModal ? "incidentSectionEditForm" : ""}" class="form-grid" data-incident-section-form="dmmp-staff">
        <div class="form-grid two">
          <label class="field"><span>Staff name</span><input name="staffName" placeholder="Name" /></label>
          <label class="field"><span>Role / assignment</span><input name="roleName" placeholder="Role" /></label>
          <label class="field">
            <span>Was contacted?</span>
            <select name="wasContacted"><option value="false">No</option><option value="true">Yes</option></select>
          </label>
          <label class="field"><span>Contacted at</span><input name="contactedAt" type="datetime-local" /></label>
          <label class="field"><span>Required arrival</span><input name="requiredArrivalAt" type="datetime-local" /></label>
          <label class="field"><span>Arrived at</span><input name="arrivedAt" type="datetime-local" /></label>
        </div>
        ${forModal ? "" : `<button class="secondary-button mini" type="submit">Add staff record</button>`}
        <div id="dmmpStaffMessage" class="status-message" hidden></div>
      </form>
      <div class="mini-table">
        ${staffRecords
          .map(
            (record) => `
              <div class="mini-table-row">
                <strong>${escapeHtml(record.staff_name || "Unnamed staff")}</strong>
                <span>${escapeHtml(record.role_name || "No role")}</span>
                <span>${record.was_contacted ? "Contacted" : "Not contacted"}</span>
                <span>${record.arrived_at ? `Arrived ${formatDate(record.arrived_at)}` : "No arrival time"}</span>
                <button class="danger-button mini" type="button" data-delete-dmmp-staff="${escapeHtml(record.id)}">Delete</button>
              </div>
            `,
          )
          .join("") || `<div class="empty-state">No DMMP staff records yet.</div>`}
      </div>
    </section>
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
          <p class="panel-subtitle">Generate the latest situation report or close an active incident.</p>
        </div>
      </div>
      <label class="field">
        <span>Responder function scope</span>
        <select id="sitrepResponderFunctionFilter">
          <option value="both">Field Responder and SAR</option>
          <option value="field_responder">Field Responder only</option>
          <option value="sa_responder">Stabilization Area Responder only</option>
        </select>
      </label>
      <div class="button-row">
        <button class="secondary-button" type="button" data-generate-sitrep="${escapeHtml(incident.id)}">Generate & Download PDF</button>
        <button class="ghost-button" type="button" data-download-sitrep="pdf" data-incident-id="${escapeHtml(incident.id)}">Download Latest PDF</button>
        <button class="ghost-button" type="button" data-download-sitrep="csv" data-incident-id="${escapeHtml(incident.id)}">Download Latest CSV</button>
        <button class="danger-button" type="button" data-close-incident="${escapeHtml(incident.id)}" ${incident.status !== "active" ? "disabled" : ""}>Close Incident</button>
      </div>
      <div id="incidentActionMessage" class="status-message" hidden></div>
    </section>
  `;
}

function getSelectedSitrepResponderFunctionFilter() {
  const value = qs("#sitrepResponderFunctionFilter")?.value;

  return ["field_responder", "sa_responder", "both"].includes(value)
    ? value
    : "both";
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

      if (!staffId || !confirm("Delete this DMMP staff record?")) return;

      try {
        await apiRequest(`/dmmp-staff/${encodeURIComponent(staffId)}`, {
          method: "DELETE",
        });
        await reloadExpandedIncident("DMMP staff record deleted.");
      } catch (error) {
        setMessage("incidentManagementMessage", error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-generate-sitrep]").forEach((button) => {
    button.addEventListener("click", async () => {
      const incidentId = button.dataset.generateSitrep;

      if (!incidentId) return;

      try {
        const responderFunctionFilter =
          getSelectedSitrepResponderFunctionFilter();
        setMessage("incidentActionMessage", "Generating SitRep...");
        const response = await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/sitreps`, {
          method: "POST",
          body: JSON.stringify({ responderFunctionFilter }),
        });
        const reportNumber = response.data?.report_number || "latest-sitrep";
        const encodedScope = encodeURIComponent(responderFunctionFilter);
        await downloadApiFile(
          `/incidents/${encodeURIComponent(incidentId)}/export/sitrep.pdf?responderFunctionFilter=${encodedScope}`,
          `${reportNumber}-${responderFunctionFilter}.pdf`,
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

      if (!incidentId || !["pdf", "csv"].includes(format)) return;

      try {
        const responderFunctionFilter =
          getSelectedSitrepResponderFunctionFilter();
        const encodedScope = encodeURIComponent(responderFunctionFilter);
        setMessage("incidentActionMessage", `Preparing SitRep ${format.toUpperCase()}...`);
        await downloadApiFile(
          `/incidents/${encodeURIComponent(incidentId)}/export/sitrep.${format}?responderFunctionFilter=${encodedScope}`,
          `dcms-${incidentId}-sitrep-${responderFunctionFilter}.${format}`,
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

      if (!incidentId || !confirm("Close this incident? This will mark it as closed.")) return;

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
      } catch (error) {
        setMessage("incidentActionMessage", error.message, "error");
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
    "responder-safety": saveResponderSafetySection,
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
      "responder-safety": "responderSafetyMessage",
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
  setMessage("dmmpStaffMessage", "Adding staff record...");

  const hasStaffInput = [
    "staffName",
    "roleName",
    "contactedAt",
    "requiredArrivalAt",
    "arrivedAt",
  ].some((name) => formValue(form, name));

  if (!hasStaffInput) {
    throw new Error("Enter staff details before saving a new DMMP staff record.");
  }

  await apiRequest(`/incidents/${encodeURIComponent(incidentId)}/dmmp-staff`, {
    method: "POST",
    body: JSON.stringify({
      staffName: nullableFormText(form, "staffName"),
      roleName: nullableFormText(form, "roleName"),
      wasContacted: nullableFormBoolean(form, "wasContacted"),
      contactedAt: toNullableIsoFromLocal(formValue(form, "contactedAt")),
      requiredArrivalAt: toNullableIsoFromLocal(formValue(form, "requiredArrivalAt")),
      arrivedAt: toNullableIsoFromLocal(formValue(form, "arrivedAt")),
    }),
  });
  await reloadExpandedIncident("DMMP staff record added.");
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
        <button class="primary-button" type="submit">Create official incident</button>
        <div id="incidentMessage" class="status-message" hidden></div>
      </form>
    </section>
    ${compact ? "" : `<div style="margin-top:16px">${renderIncidentHistory()}</div>`}
  `;
}

function bindCreateIncidentForm() {
  const form = qs("#incidentForm");
  if (!form) return;

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

      form.reset();
      setMessage("incidentMessage", "Official incident created and synced to mobile incident selection.", "success");
      await loadSharedData();
    } catch (error) {
      setMessage("incidentMessage", error.message, "error");
    }
  });
}

function renderEvacuationCreator() {
  return `
    <section class="panel">
      <h2>Add evacuation center</h2>
      <p class="panel-subtitle">Evacuation centers are assigned to an active incident.</p>
      <form id="evacuationForm" class="form-grid" style="margin-top:14px">
        <div class="form-section-title">Center assignment</div>
        <label class="field"><span>Incident</span><select name="incidentId" required>${incidentOptions()}</select></label>
        <div class="form-grid two">
          <label class="field"><span>Center name</span><input name="centerName" required /></label>
          <label class="field"><span>Capacity</span><input name="capacity" type="number" min="0" /></label>
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
        <button class="primary-button" type="submit">Create evacuation center</button>
        <div id="evacuationMessage" class="status-message" hidden></div>
      </form>
    </section>
  `;
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
      <h2>Add healthcare facility</h2>
      <p class="panel-subtitle">Facilities created here become selectable from transport and hospital care workflows.</p>
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
        <button class="primary-button" type="submit">Create healthcare facility</button>
        <div id="facilityMessage" class="status-message" hidden></div>
      </form>
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
            </tr>
          </thead>
          <tbody>
            ${rows.join("") || `<tr><td colspan="7"><div class="empty-state">No healthcare facilities added yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function bindCreateFacilityForm() {
  const form = qs("#facilityForm");
  if (!form) return;

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
