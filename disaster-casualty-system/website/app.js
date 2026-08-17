function getDefaultApiBaseUrl() {
  const fallback = "http://localhost:5000/api";

  if (typeof window === "undefined") {
    return fallback;
  }

  const { protocol, hostname } = window.location;

  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return fallback;
  }

  return `${protocol}//${hostname}:5000/api`;
}

function getInitialApiBaseUrl() {
  const stored = localStorage.getItem("dcms.admin.apiBaseUrl");
  const defaultUrl = getDefaultApiBaseUrl();

  if (
    stored &&
    !(
      stored.includes("localhost") &&
      !["localhost", "127.0.0.1"].includes(window.location.hostname)
    )
  ) {
    return stored;
  }

  localStorage.setItem("dcms.admin.apiBaseUrl", defaultUrl);
  return defaultUrl;
}

const state = {
  apiBaseUrl: getInitialApiBaseUrl(),
  user: readJson("dcms.admin.user"),
  accessToken: localStorage.getItem("dcms.admin.accessToken"),
  activeView: "home",
  incidents: [],
  casualties: [],
  unitUsers: [],
  dashboard: null,
  recentActivity: [],
};

const hazardTypes = [
  "Typhoon",
  "Flooding",
  "Fire",
  "Earthquake",
  "Landslide",
  "Explosion",
  "Mass Gathering",
  "Armed Conflict",
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
  ["history", "Incident History"],
  ["logs", "Action Logs"],
];

const adminViews = [
  ["home", "Homepage"],
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

function setMessage(id, message, type = "") {
  const element = document.getElementById(id);
  if (!element) return;
  element.className = `status-message ${type}`;
  element.textContent = message;
  element.hidden = !message;
}

async function loadSharedData() {
  if (!state.accessToken) return;

  const [dashboard, incidents, casualties, unitUsers, recent] =
    await Promise.allSettled([
      apiRequest("/dashboard/summary"),
      apiRequest("/incidents"),
      apiRequest("/casualties"),
      apiRequest("/auth/unit-users"),
      apiRequest("/dashboard/recent-activity?limit=12"),
    ]);

  if (dashboard.status === "fulfilled") {
    state.dashboard = dashboard.value.data;
  }

  if (incidents.status === "fulfilled") {
    state.incidents = incidents.value.data || [];
  }

  if (casualties.status === "fulfilled") {
    state.casualties = casualties.value.data || [];
  }

  if (unitUsers.status === "fulfilled") {
    state.unitUsers = unitUsers.value.data || [];
  }

  if (recent.status === "fulfilled") {
    state.recentActivity = recent.value.data || [];
  }
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
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-title">
          <div class="sidebar-mark">DC</div>
          <div>
            <strong>DCMS Admin</strong>
            <span>${isSuperAdmin() ? "Super Admin Portal" : "Admin Portal"}</span>
          </div>
        </div>

        <div class="nav-section-label">Workspace</div>
        <nav class="nav-list">
          ${views
            .map(
              ([id, label]) => `
                <button class="nav-button ${state.activeView === id ? "active" : ""}" data-view="${id}">
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
            <div>
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
        history: "Reported Incident History",
        logs: "Action Logs",
      }[state.activeView]
    : {
        home: "Admin Homepage",
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

function renderMetric(label, value, extraClass = "") {
  return `
    <section class="panel metric ${extraClass}">
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
      <small>${extraClass ? "Current active system count" : "Updated from mobile records"}</small>
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
  const reviewItems = state.casualties.filter((item) =>
    ["submitted", "under_review"].includes(item.verification_status),
  );

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
          <thead><tr><th>Casualty</th><th>Incident</th><th>Status</th><th>Verification</th><th>Reported</th><th>Actions</th></tr></thead>
          <tbody>
            ${
              reviewItems
                .map(
                  (item) => `
                    <tr class="clickable-row" data-open-casualty="${escapeHtml(item.id)}">
                      <td>
                        <button class="record-link" type="button" data-open-casualty="${escapeHtml(item.id)}">
                          ${escapeHtml(fullCasualtyName(item.casualty))}
                        </button>
                        <br><span class="panel-subtitle">${escapeHtml(item.casualty?.id_number || "No ID number")}</span>
                      </td>
                      <td>${escapeHtml(item.incident?.incident_name || "Unknown incident")}</td>
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
                .join("") || `<tr><td colspan="6"><div class="empty-state">No pending verification items.</div></td></tr>`
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
