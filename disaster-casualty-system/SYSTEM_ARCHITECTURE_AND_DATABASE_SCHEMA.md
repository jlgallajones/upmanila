# DCMS System Architecture And Database Schema

This document provides Mermaid-ready diagrams for the Disaster Casualty Management System architecture and database schema. It is intended for technical submission, documentation, and presentation materials.

For one-file PDF export, open `SYSTEM_ARCHITECTURE_AND_DATABASE_SCHEMA_PRINT.html` in a browser, wait for all diagrams to render, then use Print > Save as PDF.

The diagrams are based on the current project structure:

- `website/` - Web dashboard for admins and super admins.
- `mobile/` - Expo React Native / PWA app for Field Responders, SAR, and HCFD users.
- `api/` - Node/Express API.
- Supabase - Auth, PostgreSQL, Storage, and Realtime.

## 1. System Architecture Diagram

```mermaid
flowchart TD
  subgraph Clients["Client Layer"]
    Web["Web Dashboard\nHTML/CSS/JS\nAdmin + Super Admin"]
    Mobile["Mobile/PWA App\nExpo React Native\nFR + SAR + HCFD"]
  end

  subgraph ApiLayer["Application Layer"]
    API["Express API\nTypeScript Controllers + Services"]
    AuthMiddleware["Auth Middleware\nBearer Token Validation"]
    RoleGuards["Role/Scope Guards\nAdmin Scope + User Role"]
    ExportService["Export / Report Services\nCSV, JSON, PDF/SitRep"]
    AuditService["Audit Logging Service"]
  end

  subgraph Supabase["Supabase Backend"]
    SupabaseAuth["Supabase Auth"]
    DB[("Supabase PostgreSQL")]
    Storage[("Supabase Storage\nCasualty Attachments")]
    Realtime["Supabase Realtime"]
  end

  subgraph LocalMobile["Mobile Local Persistence"]
    SecureStore["SecureStore\nSession Token"]
    AsyncStorage["AsyncStorage\nCached Incidents, Queue, Drafts"]
    FileSystem["FileSystem / Image Picker\nLocal Photos"]
  end

  Web -->|"fetch() + Bearer Token"| API
  Mobile -->|"Axios + Bearer Token"| API

  Mobile --> SecureStore
  Mobile --> AsyncStorage
  Mobile --> FileSystem

  API --> AuthMiddleware
  AuthMiddleware --> SupabaseAuth
  AuthMiddleware --> RoleGuards
  RoleGuards --> DB

  API --> ExportService
  API --> AuditService
  API --> Storage
  API --> Realtime

  ExportService --> DB
  AuditService --> DB
  DB --> Realtime
  Realtime --> Web
```

## 2. Deployment Architecture

```mermaid
flowchart LR
  AdminBrowser["Admin Browser"] --> WebHost["Static Web Host\nNetlify / Static Server"]
  MobileBrowser["Phone Browser / Installed PWA"] --> PwaHost["Static PWA Host\nNetlify / Static Server"]

  WebHost -->|"API Base URL"| RenderAPI["Render Web Service\nNode/Express API"]
  PwaHost -->|"EXPO_PUBLIC_API_URL"| RenderAPI

  RenderAPI --> SupabaseAuth["Supabase Auth"]
  RenderAPI --> SupabasePostgres[("Supabase PostgreSQL")]
  RenderAPI --> SupabaseStorage[("Supabase Storage")]
  SupabasePostgres --> SupabaseRealtime["Supabase Realtime"]
  SupabaseRealtime --> AdminBrowser

  RenderAPI --> Logs["Render Logs"]
```

## 3. Backend API Module Architecture

```mermaid
flowchart TD
  App["api/src/app.ts"] --> Routes["Routes"]
  Routes --> AuthRoutes["/api/auth"]
  Routes --> ProfileRoutes["/api/profile"]
  Routes --> IncidentRoutes["/api/incidents"]
  Routes --> CasualtyRoutes["/api/casualties"]
  Routes --> AttachmentRoutes["/api/attachments"]
  Routes --> FacilityRoutes["/api/healthcare-facilities"]
  Routes --> DraftRoutes["/api/form-drafts"]
  Routes --> AuditRoutes["/api/audit-logs"]
  Routes --> ExportRoutes["/api/exports"]

  AuthRoutes --> Controllers["Controllers"]
  ProfileRoutes --> Controllers
  IncidentRoutes --> Controllers
  CasualtyRoutes --> Controllers
  AttachmentRoutes --> Controllers
  FacilityRoutes --> Controllers
  DraftRoutes --> Controllers
  AuditRoutes --> Controllers
  ExportRoutes --> Controllers

  Controllers --> Services["Services"]
  Controllers --> SupabaseClient["Supabase Client"]
  Services --> SupabaseClient
  SupabaseClient --> DB[("PostgreSQL")]
  SupabaseClient --> Storage[("Storage")]
  SupabaseClient --> Auth["Auth"]
```

## 4. Client Architecture

```mermaid
flowchart TD
  subgraph Web["Web Dashboard"]
    WebConfig["website/config.js\nRuntime API + Realtime Config"]
    WebApp["website/app.js\nDashboard Logic"]
    WebStyles["website/styles.css\nDashboard UI"]
    WebConfig --> WebApp
    WebStyles --> WebApp
  end

  subgraph Mobile["Mobile/PWA App"]
    ExpoRouter["Expo Router\nmobile/src/app"]
    Screens["Screens\nDashboard, Casualty Detail"]
    ApiClient["API Client\nmobile/src/api"]
    Session["Session Management\nmobile/src/auth"]
    Offline["Offline Queue\nmobile/src/offline"]
    ExpoRouter --> Screens
    Screens --> ApiClient
    Screens --> Session
    Screens --> Offline
  end

  WebApp --> API["Express API"]
  ApiClient --> API
```

## 5. Database Schema Overview

```mermaid
erDiagram
  USERS ||--o{ INCIDENTS : creates
  USERS ||--o{ CASUALTY_INCIDENTS : encodes
  USERS ||--o{ AUDIT_LOGS : performs
  USERS ||--o{ FORM_DRAFTS : owns
  USERS ||--o{ NOTIFICATIONS : receives

  INCIDENTS ||--o{ CASUALTY_INCIDENTS : contains
  CASUALTIES ||--o{ CASUALTY_INCIDENTS : appears_in
  CASUALTY_INCIDENTS ||--o{ CASUALTY_TRIAGE_ASSESSMENTS : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_TRANSPORT_RECORDS : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_TREATMENTS : has
  CASUALTY_INCIDENTS ||--o{ FACILITY_ENCOUNTERS : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_OUTCOMES : has
  CASUALTY_INCIDENTS ||--o{ ATTACHMENTS : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_STATUS_HISTORY : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_VERIFICATION_HISTORY : has

  INCIDENTS ||--o{ CASUALTY_CASE_LINKS : groups
  CASUALTY_INCIDENTS ||--o{ CASUALTY_CASE_LINKS : linked_record

  HEALTHCARE_FACILITIES ||--o{ FACILITY_ENCOUNTERS : receives
  HEALTHCARE_FACILITIES ||--o{ CASUALTY_TRANSPORT_RECORDS : destination
  HEALTHCARE_FACILITIES ||--o{ FACILITY_RESOURCE_SNAPSHOTS : reports

  INCIDENTS ||--o{ INCIDENT_RESPONSE_TIMELINES : has
  INCIDENTS ||--o{ DMMP_STAFF_CALL_DOWNS : has
  INCIDENTS ||--o{ MEDICAL_COORDINATION_ASSESSMENTS : has
  INCIDENTS ||--o{ RESPONDER_SAFETY_RESPONSES : has
  INCIDENTS ||--o{ SITREPS : has
```

## 6. Core Identity And Incident Tables

```mermaid
erDiagram
  USERS {
    uuid id PK
    text full_name
    text email
    text role
    text assigned_municipality
    text assigned_barangay
    text phone_number
    boolean is_active
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
  }

  INCIDENTS {
    uuid id PK
    text incident_code
    text incident_name
    text disaster_type
    text description
    text province
    text municipality
    text barangay
    text status
    timestamptz started_at
    timestamptz ended_at
    uuid created_by FK
    text reopen_request_status
    text reopen_request_reason
    uuid reopen_requested_by FK
    timestamptz reopen_requested_at
    uuid reopen_approved_by FK
    timestamptz reopen_approved_at
    timestamptz created_at
    timestamptz updated_at
  }

  HEALTHCARE_FACILITIES {
    uuid id PK
    text facility_name
    text facility_level
    text address
    text barangay
    text municipality
    text province
    text contact_number
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
  }

  USERS ||--o{ INCIDENTS : creates
  USERS ||--o{ HEALTHCARE_FACILITIES : creates
  USERS ||--o{ USERS : creates_accounts
```

## 7. Casualty Record Schema

```mermaid
erDiagram
  CASUALTIES {
    uuid id PK
    text id_number
    text id_type
    text identification_status
    text first_name
    text middle_name
    text last_name
    text suffix
    date date_of_birth
    integer estimated_age
    text sex
    text contact_number
    text house_street
    text barangay
    text municipality
    text province
    text region
    timestamptz created_at
    timestamptz updated_at
  }

  CASUALTY_INCIDENTS {
    uuid id PK
    uuid casualty_id FK
    uuid incident_id FK
    uuid encoder_id FK
    text client_record_id
    text current_status
    text severity
    text verification_status
    uuid verified_by FK
    timestamptz verified_at
    uuid healthcare_facility_id FK
    text current_location
    numeric latitude
    numeric longitude
    text visible_injury
    text medical_condition
    text assistance_needed
    text assistance_provided
    text remarks
    timestamptz reported_at
    timestamptz created_at
    timestamptz updated_at
  }

  ATTACHMENTS {
    uuid id PK
    uuid casualty_incident_id FK
    text file_name
    text file_path
    text mime_type
    integer file_size
    uuid uploaded_by FK
    timestamptz created_at
  }

  CASUALTY_STATUS_HISTORY {
    uuid id PK
    uuid casualty_incident_id FK
    text old_status
    text new_status
    uuid changed_by FK
    text change_reason
    timestamptz created_at
  }

  CASUALTY_VERIFICATION_HISTORY {
    uuid id PK
    uuid casualty_incident_id FK
    text old_status
    text new_status
    uuid reviewed_by FK
    text review_notes
    timestamptz created_at
  }

  INCIDENTS ||--o{ CASUALTY_INCIDENTS : contains
  CASUALTIES ||--o{ CASUALTY_INCIDENTS : has_incident_record
  USERS ||--o{ CASUALTY_INCIDENTS : encodes
  USERS ||--o{ CASUALTY_INCIDENTS : verifies
  HEALTHCARE_FACILITIES ||--o{ CASUALTY_INCIDENTS : assigned_facility
  CASUALTY_INCIDENTS ||--o{ ATTACHMENTS : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_STATUS_HISTORY : status_changes
  CASUALTY_INCIDENTS ||--o{ CASUALTY_VERIFICATION_HISTORY : review_history
```

## 8. Triage, Transport, Treatment, And HCFD Schema

```mermaid
erDiagram
  CASUALTY_TRIAGE_ASSESSMENTS {
    uuid id PK
    uuid casualty_incident_id FK
    text triage_system
    text triage_category
    text responder_category
    text calculated_category
    jsonb assessment_answers
    text algorithm_version
    boolean is_over_triage
    boolean is_under_triage
    text triage_stage
    timestamptz triaged_at
    uuid triaged_by FK
    text location
    text notes
    timestamptz created_at
  }

  CASUALTY_TRANSPORT_RECORDS {
    uuid id PK
    uuid casualty_incident_id FK
    text transport_required
    text transport_mode
    text ems_unit_type
    timestamptz arrived_scene_at
    timestamptz departed_scene_at
    timestamptz arrived_facility_at
    uuid receiving_facility_id FK
    uuid recorded_by FK
    text notes
    timestamptz created_at
  }

  CASUALTY_TREATMENTS {
    uuid id PK
    uuid casualty_incident_id FK
    text treatment_strategy
    text treatment_area_name
    timestamptz stabilization_started_at
    timestamptz stabilized_at
    jsonb treatment_details
    uuid performed_by FK
    text notes
    timestamptz created_at
  }

  FACILITY_ENCOUNTERS {
    uuid id PK
    uuid casualty_incident_id FK
    uuid facility_id FK
    timestamptz arrived_at
    timestamptz ed_admitted_at
    timestamptz ed_departed_at
    boolean sought_ed_care
    boolean admitted_to_hospital
    boolean discharged_home
    timestamptz hospital_admitted_at
    timestamptz hospital_discharged_at
    text disposition
    uuid recorded_by FK
    timestamptz created_at
  }

  CASUALTY_OUTCOMES {
    uuid id PK
    uuid casualty_incident_id FK
    text outcome_status
    text death_stage
    timestamptz death_at
    text final_disposition
    uuid recorded_by FK
    timestamptz created_at
  }

  CASUALTY_INCIDENTS ||--o{ CASUALTY_TRIAGE_ASSESSMENTS : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_TRANSPORT_RECORDS : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_TREATMENTS : has
  CASUALTY_INCIDENTS ||--o{ FACILITY_ENCOUNTERS : has
  CASUALTY_INCIDENTS ||--o{ CASUALTY_OUTCOMES : has

  USERS ||--o{ CASUALTY_TRIAGE_ASSESSMENTS : triages
  USERS ||--o{ CASUALTY_TRANSPORT_RECORDS : records
  USERS ||--o{ CASUALTY_TREATMENTS : performs
  USERS ||--o{ FACILITY_ENCOUNTERS : documents
  USERS ||--o{ CASUALTY_OUTCOMES : records

  HEALTHCARE_FACILITIES ||--o{ CASUALTY_TRANSPORT_RECORDS : receives
  HEALTHCARE_FACILITIES ||--o{ FACILITY_ENCOUNTERS : hosts
```

## 9. Match Casing Schema

```mermaid
erDiagram
  CASUALTY_CASE_LINKS {
    uuid id PK
    uuid case_group_id
    uuid incident_id FK
    uuid casualty_incident_id FK
    text role_type
    uuid linked_by FK
    timestamptz linked_at
    timestamptz created_at
  }

  INCIDENTS ||--o{ CASUALTY_CASE_LINKS : has_matched_case
  CASUALTY_INCIDENTS ||--o{ CASUALTY_CASE_LINKS : participates
  USERS ||--o{ CASUALTY_CASE_LINKS : links
```

## 10. Incident Operations Schema

```mermaid
erDiagram
  INCIDENT_RESPONSE_TIMELINES {
    uuid id PK
    uuid incident_id FK
    text event_type
    text description
    timestamptz event_time
    uuid updated_by FK
    timestamptz created_at
    timestamptz updated_at
  }

  CALL_DOWN_STAFF {
    uuid id PK
    text full_name
    text role_position
    text contact_number
    text assigned_team_unit
    text notes
    uuid linked_user_id FK
    uuid created_by FK
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  DMMP_STAFF_CALL_DOWNS {
    uuid id PK
    uuid incident_id FK
    uuid call_down_staff_id FK
    uuid linked_user_id FK
    text staff_name
    text role
    boolean contacted
    boolean has_arrived
    text status
    timestamptz contacted_at
    timestamptz arrival_time
    uuid recorded_by FK
    timestamptz created_at
  }

  MEDICAL_COORDINATION_ASSESSMENTS {
    uuid id PK
    uuid incident_id FK
    text coordination_status
    text notes
    uuid assessed_by FK
    timestamptz created_at
  }

  CONTINUITY_OF_CARE_ASSESSMENTS {
    uuid id PK
    uuid incident_id FK
    text continuity_status
    text notes
    uuid assessed_by FK
    timestamptz created_at
  }

  RESPONDER_SAFETY_RESPONSES {
    uuid id PK
    uuid incident_id FK
    uuid responder_id FK
    text safety_status
    timestamptz ppe_used_at
    boolean is_locked
    timestamptz created_at
    timestamptz updated_at
  }

  INCIDENTS ||--o{ INCIDENT_RESPONSE_TIMELINES : timeline
  INCIDENTS ||--o{ DMMP_STAFF_CALL_DOWNS : staff_call_down
  INCIDENTS ||--o{ MEDICAL_COORDINATION_ASSESSMENTS : coordination
  INCIDENTS ||--o{ CONTINUITY_OF_CARE_ASSESSMENTS : continuity
  INCIDENTS ||--o{ RESPONDER_SAFETY_RESPONSES : safety_responses
  CALL_DOWN_STAFF ||--o{ DMMP_STAFF_CALL_DOWNS : used_in_incident
  USERS ||--o{ CALL_DOWN_STAFF : creates
  USERS ||--o{ DMMP_STAFF_CALL_DOWNS : records
  USERS ||--o{ RESPONDER_SAFETY_RESPONSES : submits
```

## 11. Reporting, Logs, Notifications, And Drafts Schema

```mermaid
erDiagram
  AUDIT_LOGS {
    uuid id PK
    text action
    text entity_type
    uuid entity_id
    text entity_label
    uuid actor_id FK
    text actor_full_name
    text actor_role
    uuid scope_admin_id FK
    jsonb metadata
    timestamptz created_at
  }

  FORM_DRAFTS {
    uuid id PK
    uuid owner_id FK
    text form_type
    text title
    jsonb payload
    text status
    timestamptz created_at
    timestamptz updated_at
  }

  NOTIFICATIONS {
    uuid id PK
    uuid user_id FK
    text title
    text message
    text type
    text entity_type
    uuid entity_id
    boolean is_read
    timestamptz created_at
  }

  SITREPS {
    uuid id PK
    uuid incident_id FK
    text report_type
    text status
    jsonb payload
    uuid generated_by FK
    uuid approved_by FK
    timestamptz generated_at
    timestamptz approved_at
    timestamptz created_at
  }

  FACILITY_RESOURCE_SNAPSHOTS {
    uuid id PK
    uuid incident_id FK
    uuid facility_id FK
    integer bed_capacity
    integer beds_available
    integer icu_capacity
    integer icu_available
    uuid recorded_by FK
    timestamptz recorded_at
    timestamptz created_at
  }

  USERS ||--o{ AUDIT_LOGS : actor
  USERS ||--o{ FORM_DRAFTS : owns
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ SITREPS : generates
  USERS ||--o{ FACILITY_RESOURCE_SNAPSHOTS : records
  INCIDENTS ||--o{ SITREPS : has
  INCIDENTS ||--o{ FACILITY_RESOURCE_SNAPSHOTS : has
  HEALTHCARE_FACILITIES ||--o{ FACILITY_RESOURCE_SNAPSHOTS : reports
```

## 12. Role-Based Access Architecture

```mermaid
flowchart TD
  Request["Incoming API Request"] --> TokenCheck["Validate Bearer Token"]
  TokenCheck --> ProfileLoad["Load users profile row"]
  ProfileLoad --> RoleCheck{Role}

  RoleCheck -->|super_admin| SuperAdminAccess["System-wide admin account, backup, logs, reopen approval"]
  RoleCheck -->|admin / administrator| AdminScope["Admin-scoped incidents, accounts, records, facilities, analytics"]
  RoleCheck -->|field_responder| FRScope["Own FR casualty submissions and records"]
  RoleCheck -->|sa_responder| SARScope["Own SAR casualty submissions and records"]
  RoleCheck -->|documenter| HCFDScope["Own HCFD casualty submissions and records"]
  RoleCheck -->|legacy responder| AssignmentCheck["Check stored responder assignment"]

  AssignmentCheck -->|field_responder| FRScope
  AssignmentCheck -->|sa_responder| SARScope

  SuperAdminAccess --> Controller["Controller Operation"]
  AdminScope --> Controller
  FRScope --> Controller
  SARScope --> Controller
  HCFDScope --> Controller
  Controller --> DB[("Supabase PostgreSQL")]
```

## 13. Offline Data Architecture

```mermaid
flowchart TD
  MobileForm["Mobile Add Casualty Form"] --> SubmitAttempt["Submit Attempt"]
  SubmitAttempt --> OnlineCheck{API reachable?}

  OnlineCheck -->|Yes| API["Express API"]
  API --> DB[("Supabase DB")]
  API --> Storage[("Supabase Storage")]

  OnlineCheck -->|No| Queue["AsyncStorage Offline Queue"]
  Queue --> RecordsScreen["Records Screen\nPending/Failed Local Items"]
  RecordsScreen --> Retry["Retry Single / Retry All / Refresh Data"]
  Retry --> API
  API --> SyncResult["Sync Result"]
  SyncResult --> QueueUpdate["Remove synced items or keep failed items"]
  QueueUpdate --> RecordsScreen
```

## 14. Database Notes

- `casualties` stores person-level identity data.
- `casualty_incidents` stores incident-specific casualty records, including status, severity, encoder, location, and verification state.
- FR, SAR, and HCFD records remain separate records after role separation.
- `casualty_case_links` connects separate FR, SAR, and HCFD records into one matched case without merging or deleting the original records.
- `attachments` stores metadata, while Supabase Storage stores the actual files.
- `audit_logs` stores cross-device actions for traceability.
- `form_drafts` stores saved draft payloads.
- `call_down_staff` stores reusable staff contacts, including people who do not have login accounts.
- `dmmp_staff_call_downs` stores incident-specific call-down responses.
- Some SQL migrations add columns incrementally, so the diagrams show the practical/current logical schema instead of every historical migration step.
