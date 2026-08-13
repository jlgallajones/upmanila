# DCMS Architecture Components

This file summarizes the current Disaster Casualty Management System architecture in a diagram-ready list format.

## 1. User Actors

- **Bystander / Responder**
  - Uses the mobile/PWA interface through a phone browser or installed PWA.
  - Can log casualty/victim information depending on assigned account role and responder function.

- **Field Responder**
  - Uses the mobile/PWA Add Casualty workflow.
  - Limited workflow: primary triage-focused fields and status notes.

- **Stabilization Area Responder**
  - Uses the mobile/PWA Add Casualty workflow.
  - Currently uses the fuller casualty entry workflow.

- **Healthcare Facility Documenter**
  - Uses mobile/PWA role-based workflows for facility-side documentation.
  - Intended for receiving facility / ED / hospital-care context.

- **Admin / Administrator / Encoder**
  - Uses the desktop admin website.
  - Creates official incidents, evacuation centers, healthcare facilities, and responder/documenter accounts.
  - Reviews casualty entries submitted from the mobile/PWA app.

- **Super Admin**
  - Uses the desktop admin website.
  - Has system-wide oversight and can create admin/encoder accounts.

## 2. Client Applications

- **Mobile App / PWA**
  - Location: `mobile/`
  - Technology:
    - Expo
    - React Native
    - Expo Router
    - React Native Web
    - TypeScript
    - Axios
    - AsyncStorage / SecureStore
    - Expo SQLite
    - Expo Location, FileSystem, Image Picker
  - Build/output:
    - `npm run build:web`
    - Generates static web output in `mobile/dist`
    - PWA assets in `mobile/public/manifest.webmanifest`, `mobile/public/sw.js`, and `mobile/public/icons`
  - Main responsibilities:
    - Login and session handling.
    - Dashboard/home view.
    - Add Casualty wizard.
    - Role and responder-function based casualty workflows.
    - Incident selection.
    - Casualty record viewing.
    - Notifications.
    - Profile and responder function selection.
    - Mobile verification review page.
  - API connection:
    - Uses `EXPO_PUBLIC_API_URL`.
    - Axios client in `mobile/src/api/client.ts`.
    - Sends Supabase access token as `Authorization: Bearer <token>`.

- **Desktop Admin Website**
  - Location: `website/`
  - Technology:
    - Plain HTML
    - CSS
    - JavaScript
    - Fetch API
  - Runtime:
    - Static site served locally or from any static host.
    - Default local port: `5173`.
  - Main responsibilities:
    - Admin/super admin login.
    - Super admin dashboard.
    - Admin dashboard.
    - Official incident creation.
    - Evacuation center creation.
    - Healthcare facility creation.
    - Responder/documenter account creation and editing.
    - Account active/offline/online status display.
    - Casualty records summary.
    - Verification review with casualty record popup.
  - API connection:
    - Uses `/api/auth/login`.
    - Uses stored bearer token for authenticated API calls.
    - Defaults to `http://localhost:5000/api` for local development.
    - Uses same host plus port `5000` when opened from a LAN IP.

## 3. Backend API

- **Node/Express API**
  - Location: `api/`
  - Technology:
    - Node.js
    - Express 5
    - TypeScript
    - Supabase JavaScript client
    - CORS
    - dotenv
  - Local development:
    - `npm run dev`
    - Runs through `tsx watch src/server.ts`
    - Common local API URL: `http://localhost:5000/api`
  - Production build:
    - `npm run build`
    - `npm start`
    - Runs compiled JS from `api/dist`
  - Main API entry:
    - `api/src/app.ts`
  - Health endpoint:
    - `GET /api/health`
  - CORS:
    - Allows localhost ports used by Expo/admin website.
    - Allows LAN development origins.
    - Allows Netlify app origins.
    - Allows `ngrok-skip-browser-warning` header.

## 4. API Route Modules

- **Authentication and Account Management**
  - Route prefix: `/api/auth`
  - Files:
    - `api/src/routes/auth.routes.ts`
    - `api/src/controllers/auth.controller.ts`
  - Responsibilities:
    - Login.
    - Super admin creates administrator/encoder accounts.
    - Admin creates responder/documenter unit accounts.
    - Admin lists unit accounts.
    - Admin edits unit accounts.
    - Updates `last_seen_at` on successful login.

- **Profile**
  - Route prefix: `/api/profile`
  - Files:
    - `api/src/routes/profile.routes.ts`
    - `api/src/controllers/profile.controller.ts`
  - Responsibilities:
    - Loads current user profile and assigned context.

- **Incidents**
  - Route prefix: `/api/incidents`
  - Files:
    - `api/src/routes/incident.routes.ts`
    - `api/src/controllers/incident.controller.ts`
  - Responsibilities:
    - Official incident creation/listing.
    - Incident history.
    - Incident SitRep generation/export support.
    - Incident-level summaries.

- **Casualties**
  - Route prefix: `/api/casualties`
  - Files:
    - `api/src/routes/casualty.routes.ts`
    - `api/src/controllers/casualty.controller.ts`
  - Responsibilities:
    - Create casualty record transactions.
    - List casualty entries.
    - Retrieve casualty detail.
    - Update casualty entries.
    - Status history.
    - Verification history.
    - Verification review status updates.
    - Triage history.
    - Transport history.

- **Triage**
  - Route prefix: `/api/casualty-incidents`
  - Files:
    - `api/src/routes/triage.routes.ts`
    - Triage calculation services in `api/src/services/triage/`
  - Responsibilities:
    - Calculates triage category from assessment answers.
    - Stores responder-entered and system-calculated triage results separately.
    - Supports accuracy calculations for overtriage/undertriage reporting.

- **Evacuation Centers**
  - Route prefix: `/api/evacuation-centers`
  - Files:
    - `api/src/routes/evacuation-center.routes.ts`
    - `api/src/controllers/evacuation-center.controller.ts`
  - Responsibilities:
    - Admin-managed evacuation center references.
    - Incident-specific evacuation center listing.

- **Healthcare Facilities**
  - Route prefix: `/api/healthcare-facilities`
  - Files:
    - `api/src/routes/healthcare-facility.routes.ts`
    - `api/src/controllers/healthcare-facility.controller.ts`
  - Responsibilities:
    - Admin-managed healthcare facility references.
    - Facility selection for transport and hospital-care workflows.

- **Dashboard**
  - Route prefix: `/api/dashboard`
  - Files:
    - `api/src/routes/dashboard.routes.ts`
    - `api/src/controllers/dashboard.controller.ts`
  - Responsibilities:
    - Summary cards.
    - Recent activity.
    - Dashboard counts for mobile/admin views.

- **Notifications**
  - Route prefix: `/api/notifications`
  - Files:
    - `api/src/routes/notification.routes.ts`
    - `api/src/controllers/notification.controller.ts`
  - Responsibilities:
    - User notifications for the mobile app.

- **Attachments**
  - Route prefix: `/api/attachments`
  - Files:
    - `api/src/routes/attachment.routes.ts`
    - `api/src/controllers/attachment.controller.ts`
  - Responsibilities:
    - Upload and retrieve casualty-related attachments.
    - Uses base64 payloads through API JSON requests.

- **Incident Operations**
  - Route prefix: `/api`
  - Files:
    - `api/src/routes/incident-operations.routes.ts`
    - `api/src/controllers/incident-operations.controller.ts`
  - Responsibilities:
    - Utstein/operations records.
    - Timeline records.
    - Continuity-of-care, staffing, coordination, safety, and facility resource data.

## 5. Backend Services

- **Supabase Client Layer**
  - File: `api/src/config/supabase.ts`
  - Uses:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`
  - Creates:
    - `supabase`
    - `supabaseAuth`
  - Purpose:
    - Database access.
    - Supabase Auth admin/user operations.
    - Token validation.

- **Authentication Middleware**
  - File: `api/src/middleware/auth.ts`
  - Responsibilities:
    - Reads bearer token from `Authorization` header.
    - Validates token using Supabase Auth.
    - Loads user profile from `public.users`.
    - Rejects inactive accounts.
    - Attaches authenticated user to request.
    - Role checks with equivalent roles.

- **Triage Calculation Services**
  - Location: `api/src/services/triage/`
  - Files:
    - `calculate-triage.ts`
    - `compare-triage.ts`
    - `accuracy-summary.ts`
    - `start.service.ts`
    - test files
  - Responsibilities:
    - Map assessment answers into calculated triage category.
    - Compare responder triage against calculated/system triage.
    - Summarize overtriage and undertriage counts.

## 6. Data Layer / Database

- **Cloud Database**
  - Service: Supabase PostgreSQL
  - Schema scripts location: `api/sql/`
  - Main tables:
    - `users`
    - `incidents`
    - `casualties`
    - `casualty_incidents`
    - `casualty_triage_assessments`
    - `casualty_transport_records`
    - `casualty_status_history`
    - `casualty_verification_history`
    - `evacuation_centers`
    - `healthcare_facilities`
    - `facility_encounters`
    - `icu_encounters`
    - `clinical_procedures`
    - `casualty_treatments`
    - `casualty_outcomes`
    - `incident_response_timelines`
    - `dmmp_staff_call_downs`
    - `medical_coordination_assessments`
    - `continuity_of_care_assessments`
    - `responder_safety_reports`
    - `ems_vehicle_arrivals`
    - `facility_resource_snapshots`
    - `sitreps`
    - `notifications`
  - Central relationship:
    - `casualty_incidents` links:
      - one `casualties` person record
      - one `incidents` official incident
      - optional evacuation center
      - optional healthcare facility
      - encoder user
      - verifier user
      - triage, transport, treatment, facility encounter, outcome, and review histories

- **Supabase Auth**
  - Used for:
    - Login credentials.
    - Access token generation.
    - Token validation in API middleware.
    - Admin-created users through service-role API calls.
  - The app also keeps a profile row in `public.users` for role, reporting context, active state, and unit scope.

## 7. Cloud Services and Deployment Integrations

- **Supabase**
  - Database: PostgreSQL.
  - Authentication: email/password users and JWT access tokens.
  - Service-role access from backend API.

- **Render**
  - Config file: `render.yaml`
  - Purpose:
    - Hosts the Node/Express API as a web service.
  - Build command:
    - `npm ci && npm run build`
  - Start command:
    - `npm start`
  - Health check:
    - `/api/health`
  - Environment variables:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`

- **Netlify-compatible Static Hosting**
  - Config file: `netlify.toml`
  - Purpose:
    - Hosts the Expo web/PWA output.
  - Build base:
    - `mobile`
  - Build command:
    - `npm ci && npm run build:web`
  - Publish directory:
    - `mobile/dist`
  - SPA fallback:
    - All routes redirect to `/index.html`.

- **ngrok**
  - Used during testing for temporary public tunnels.
  - Common pattern:
    - API tunnel points to local port `5000`.
    - PWA/static tunnel points to local static server port such as `3000`.
  - Not a permanent production dependency.

- **Expo / EAS**
  - Config files:
    - `mobile/app.json`
    - `mobile/eas.json`
  - Used for Expo project metadata and native/mobile build support.
  - Current web/PWA flow exports static web files.

## 8. Main System Data Flows

- **Login Flow**
  - Mobile app or admin website sends email/password to `POST /api/auth/login`.
  - API authenticates with Supabase Auth.
  - API loads matching row from `public.users`.
  - API rejects inactive or missing profiles.
  - API updates `last_seen_at`.
  - API returns user profile plus access/refresh token.
  - Client stores token and sends it as bearer token for later requests.

- **Mobile Casualty Submission Flow**
  - Responder opens Add Casualty in mobile/PWA.
  - App loads active official incidents from API.
  - User selects incident and enters casualty data.
  - App sends payload to `POST /api/casualties`.
  - API validates authenticated role.
  - API writes through `create_casualty_record_transaction`.
  - Database creates:
    - `casualties`
    - `casualty_incidents`
    - optional `casualty_triage_assessments`
    - optional `casualty_transport_records`
  - Record starts with verification status `submitted`.

- **Triage Calculation Flow**
  - Mobile collects triage assessment answers.
  - API triage service calculates system category.
  - API stores responder category and calculated/system category separately.
  - Accuracy services compare expected/system triage against responder-entered triage.
  - Overtriage/undertriage summaries are available for reporting but hidden from normal mobile entry.

- **Admin Official Incident Flow**
  - Admin logs into desktop website.
  - Admin creates incident through `/api/incidents`.
  - Admin may add timeline values through incident timeline endpoints.
  - Active incidents become selectable in the mobile Add Casualty workflow.

- **Admin Reference Data Flow**
  - Admin creates evacuation centers through `/api/evacuation-centers`.
  - Admin creates healthcare facilities through `/api/healthcare-facilities`.
  - Mobile uses those references in casualty, transport, and hospital-care workflows.

- **Account Management Flow**
  - Admin creates responder/documenter accounts through `/api/auth/register-unit-user`.
  - API creates Supabase Auth account.
  - API creates/updates `public.users` profile with role, reporting context, unit scope, and `created_by`.
  - Admin lists accounts through `/api/auth/unit-users`.
  - Admin edits account through `/api/auth/unit-users/:id`.
  - Online/offline display is derived from `last_seen_at`.

- **Verification Review Flow**
  - Admin opens desktop Verification Review.
  - Website loads casualty entries from `/api/casualties`.
  - Admin opens casualty record popup.
  - Admin marks record under review, approves, or rejects through `/api/casualties/:id/verification`.
  - API updates `casualty_incidents.verification_status`.
  - API records audit trail in `casualty_verification_history`.

- **SitRep Flow**
  - Admin/system requests incident report generation.
  - API gathers incident, casualty, triage, transport, facility, and operations records.
  - API stores generated report in `sitreps`.
  - Generated payload is stored as JSONB for reproducible reporting/export.

## 9. Security and Access Control

- **API authentication**
  - Bearer token required for protected routes.
  - Token validated through Supabase Auth.
  - Profile loaded from `public.users`.

- **Role-based authorization**
  - Middleware: `requireRole`.
  - Role equivalences:
    - `admin` and `administrator` are treated as equivalent.
    - `documenter` and `medical_personnel` are treated as equivalent.
    - `field_responder` and `sa_responder` are treated as responder variants.

- **Account active state**
  - `users.is_active` controls whether a user can access authenticated routes.

- **Supabase service-role key**
  - Used only by backend API.
  - Must remain server-side.
  - Should not be exposed in mobile or website builds.

## 10. Architecture Diagram Node List

- **Actors**
  - Bystander
  - Field Responder
  - Stabilization Area Responder
  - Healthcare Facility Documenter
  - Admin / Encoder
  - Super Admin

- **Client Nodes**
  - Mobile/PWA App: Expo React Native Web
  - Desktop Admin Website: Static HTML/CSS/JS

- **API Nodes**
  - Express API Gateway
  - Auth Controller
  - Incident Controller
  - Casualty Controller
  - Triage Services
  - Dashboard Controller
  - Reference Data Controllers
  - Incident Operations Controller
  - Notification Controller
  - Attachment Controller

- **Cloud/External Nodes**
  - Supabase Auth
  - Supabase PostgreSQL
  - Render API Hosting
  - Netlify-compatible Static Hosting
  - ngrok Development Tunnels
  - Expo/EAS Project Services

- **Database Nodes**
  - users
  - incidents
  - casualties
  - casualty_incidents
  - casualty_triage_assessments
  - casualty_transport_records
  - casualty_status_history
  - casualty_verification_history
  - evacuation_centers
  - healthcare_facilities
  - facility_encounters
  - casualty_treatments
  - casualty_outcomes
  - incident_response_timelines
  - sitreps
  - notifications

## 11. High-Level Connection List

- Mobile/PWA App -> Express API via HTTPS/HTTP JSON API.
- Desktop Admin Website -> Express API via HTTPS/HTTP JSON API.
- Express API -> Supabase Auth for login, token validation, and user creation.
- Express API -> Supabase PostgreSQL for all operational records.
- Express API -> Triage Services for calculated triage and accuracy logic.
- Mobile/PWA App -> Browser PWA install through manifest and service worker.
- Render -> Hosts Express API in production-like deployment.
- Netlify-compatible static host -> Hosts mobile PWA static export.
- Admin Website -> Static hosting or local static server.
- ngrok -> Temporary external access during development/testing.
