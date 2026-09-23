# DCMS Project Flowchart And Data Flow Diagrams

This document summarizes the main workflow and data flow of the Disaster Casualty Management System, covering the web dashboard, mobile/PWA app, backend API, Supabase database, Supabase Auth, Supabase Storage, and offline sync behavior.

For one-file PDF export, open `PROJECT_FLOWCHART_AND_DFD_PRINT.html` in a browser, wait for all diagrams to render, then use Print > Save as PDF.

## 1. System Overview Flowchart

```mermaid
flowchart TD
  Start([User opens DCMS]) --> ChooseClient{Which client?}

  ChooseClient --> Web[Web Dashboard]
  ChooseClient --> Mobile[Mobile/PWA App]

  Web --> WebLogin[Admin/Super Admin Login]
  Mobile --> MobileLogin[Responder/Documenter Login]

  WebLogin --> Auth[Supabase Auth via API]
  MobileLogin --> Auth

  Auth --> Profile[Load User Profile And Role]

  Profile --> WebRole{Web Role}
  Profile --> MobileRole{Mobile Role}

  WebRole -->|Super Admin| SuperAdmin[System Monitoring, Admin Accounts, Backup, Logs]
  WebRole -->|Admin| Admin[Incidents, Accounts, Facilities, Records, Verification, Analytics, Match Casing]

  MobileRole -->|Field Responder| FR[Add Field Responder Casualty Record]
  MobileRole -->|AMP| AMP[Add AMP/Stabilization Record]
  MobileRole -->|HCFD| HCFD[Add Healthcare Facility Record]

  FR --> SubmitCasualty[Submit Casualty Data]
  AMP --> SubmitCasualty
  HCFD --> SubmitCasualty

  SubmitCasualty --> OnlineCheck{Online?}
  OnlineCheck -->|Yes| API[Express API]
  OnlineCheck -->|No| OfflineQueue[Local Offline Queue]
  OfflineQueue --> RetrySync[Retry Sync Later]
  RetrySync --> API

  Admin --> API
  SuperAdmin --> API

  API --> DB[(Supabase PostgreSQL)]
  API --> Storage[(Supabase Storage)]
  API --> Realtime[Supabase Realtime]

  Realtime --> Web
  DB --> Analytics[Incident Analytics]
  DB --> Records[Casualty Records]
  DB --> Logs[Action Logs]
```

## 2. Web Dashboard Flowchart

```mermaid
flowchart TD
  WebStart([Open Web Dashboard]) --> LoadConfig[Load website/config.js]
  LoadConfig --> Login[Login Form]
  Login --> AuthRequest[POST /api/auth/login]
  AuthRequest --> AuthResult{Valid Credentials?}

  AuthResult -->|No| LoginError[Show Login Error]
  AuthResult -->|Yes| StoreSession[Store Session Token And User Profile]

  StoreSession --> RoleCheck{Role}
  RoleCheck -->|Super Admin| SuperAdminDashboard[Super Admin Dashboard]
  RoleCheck -->|Admin| AdminDashboard[Admin Dashboard]

  SuperAdminDashboard --> SAAccounts[Create/Manage Admin Accounts]
  SuperAdminDashboard --> SALogs[View System Action Logs]
  SuperAdminDashboard --> SABackup[Export/Backup System Data]
  SuperAdminDashboard --> ReopenApprove[Approve Reopen Requests]

  AdminDashboard --> IncidentManagement[Incident Management]
  AdminDashboard --> OfficialIncidents[Official Incidents / Incident History]
  AdminDashboard --> CallDownList[Call Down List]
  AdminDashboard --> Facilities[Healthcare Facilities]
  AdminDashboard --> Accounts[FR/AMP/HCFD Accounts]
  AdminDashboard --> Records[Casualty Records]
  AdminDashboard --> Verification[Verification Review / Records Review]
  AdminDashboard --> MatchCasing[Match Casing]
  AdminDashboard --> MatchedCases[Matched Cases]
  AdminDashboard --> Analytics[Incident Analytics]
  AdminDashboard --> ActionLogs[Action Logs]
  AdminDashboard --> Drafts[Drafts]

  IncidentManagement --> API[Express API]
  OfficialIncidents --> API
  CallDownList --> API
  Facilities --> API
  Accounts --> API
  Records --> API
  Verification --> API
  MatchCasing --> API
  MatchedCases --> API
  Analytics --> API
  ActionLogs --> API
  Drafts --> API

  API --> DB[(Supabase PostgreSQL)]
  API --> Storage[(Supabase Storage)]
  API --> Realtime[Supabase Realtime Updates]
  Realtime --> AdminDashboard
```

## 3. Mobile/PWA Flowchart

```mermaid
flowchart TD
  MobileStart([Open Mobile/PWA App]) --> Login[Login]
  Login --> AuthAPI[POST /api/auth/login]
  AuthAPI --> AuthResult{Valid Credentials?}

  AuthResult -->|No| LoginError[Show Login Error]
  AuthResult -->|Yes| SaveSession[Save Token And User Profile]

  SaveSession --> Dashboard[Home Dashboard]
  Dashboard --> ActiveIncidents[Active Incidents]
  Dashboard --> AddCasualty[Add Casualty]
  Dashboard --> Records[Records]
  Dashboard --> Notifications[Notifications]
  Dashboard --> ActionLogs[Action Logs]
  Dashboard --> RefreshData[Refresh Data / Sync Queue]

  AddCasualty --> RoleCheck{Mobile Role}
  RoleCheck -->|Field Responder| FRForm[FR Safety, Incident, Primary/Secondary Triage, Victim Code, Photo]
  RoleCheck -->|AMP| AMPForm[AMP Info, Stabilization, Transport, PCR Photo]
  RoleCheck -->|HCFD| HCFDForm[Facility Patient Info, Tertiary Triage, Management, Disposition]

  FRForm --> Submit[Submit Record]
  AMPForm --> Submit
  HCFDForm --> Submit

  Submit --> NetworkCheck{API Reachable?}
  NetworkCheck -->|Yes| UploadAttachments[Upload Attachments]
  UploadAttachments --> API[Express API]
  API --> DB[(Supabase PostgreSQL)]
  API --> Storage[(Supabase Storage)]

  NetworkCheck -->|No| SaveQueue[Save To Offline Queue]
  SaveQueue --> Records
  RefreshData --> SyncQueue[Sync Queued Casualty Records]
  SyncQueue --> NetworkCheck
```

## 4. Context Diagram / DFD Level 0

```mermaid
flowchart LR
  SuperAdmin[Super Admin]
  Admin[Admin]
  FR[Field Responder]
  AMP[AMP Responder]
  HCFD[Healthcare Facility Documenter]

  System((DCMS Platform))

  SupabaseAuth[(Supabase Auth)]
  SupabaseDB[(Supabase PostgreSQL)]
  SupabaseStorage[(Supabase Storage)]
  SupabaseRealtime[(Supabase Realtime)]

  SuperAdmin -->|Admin account actions, backup requests, reopen approvals| System
  Admin -->|Incidents, accounts, facilities, review, analytics, match casing| System
  FR -->|Field casualty records, photos, safety responses| System
  AMP -->|AMP casualty records, stabilization, transport, photos| System
  HCFD -->|Facility casualty records, treatment/outcome data, photos| System

  System -->|Authentication| SupabaseAuth
  System -->|Read/write operational records| SupabaseDB
  System -->|Upload/read signed attachment files| SupabaseStorage
  System -->|Realtime dashboard updates| SupabaseRealtime

  System -->|Dashboards, records, feedback, reports| SuperAdmin
  System -->|Dashboards, records, analytics, action logs| Admin
  System -->|Submission status, records, notifications| FR
  System -->|Submission status, records, notifications| AMP
  System -->|Submission status, records, notifications| HCFD
```

## 5. DFD Level 1 - Web Dashboard

```mermaid
flowchart TD
  AdminUser[Admin / Super Admin]

  P1((1. Authenticate User))
  P2((2. Manage Reference Data))
  P3((3. Manage Incidents))
  P4((4. Review Casualty Records))
  P5((5. Match Cases))
  P6((6. Generate Analytics / Reports))
  P7((7. View Action Logs))
  P8((8. Save / Resume Drafts))

  D1[(users)]
  D2[(incidents)]
  D3[(healthcare_facilities)]
  D4[(casualty_incidents)]
  D5[(attachments)]
  D6[(casualty_case_links)]
  D7[(audit_logs)]
  D8[(form_drafts)]
  D9[(dmmp_staff_call_downs / call_down_staff)]

  Auth[(Supabase Auth)]
  Storage[(Supabase Storage)]

  AdminUser --> P1
  P1 --> Auth
  P1 --> D1
  P1 --> AdminUser

  AdminUser --> P2
  P2 --> D1
  P2 --> D3
  P2 --> D7

  AdminUser --> P3
  P3 --> D2
  P3 --> D9
  P3 --> D7

  AdminUser --> P4
  P4 --> D4
  P4 --> D5
  P4 --> Storage
  P4 --> D7

  AdminUser --> P5
  P5 --> D4
  P5 --> D6
  P5 --> D7

  AdminUser --> P6
  P6 --> D2
  P6 --> D4
  P6 --> D6
  P6 --> D9
  P6 --> AdminUser

  AdminUser --> P7
  P7 --> D7
  P7 --> AdminUser

  AdminUser --> P8
  P8 --> D8
  P8 --> AdminUser
```

## 6. DFD Level 1 - Mobile/PWA App

```mermaid
flowchart TD
  MobileUser[FR / AMP / HCFD User]

  P1((1. Login And Load Profile))
  P2((2. Load Incidents And Dashboard))
  P3((3. Encode Casualty Record))
  P4((4. Capture / Attach Photo))
  P5((5. Submit Online))
  P6((6. Queue Offline))
  P7((7. Retry Sync))
  P8((8. View Records / Notifications / Logs))
  P9((9. Save / Resume Draft))

  LocalSession[(SecureStore / AsyncStorage Session)]
  LocalQueue[(AsyncStorage Offline Queue)]
  LocalDrafts[(Local Drafts / API Drafts)]
  LocalFiles[(Image Picker / FileSystem)]

  API[Express API]
  Auth[(Supabase Auth)]
  DB[(Supabase PostgreSQL)]
  Storage[(Supabase Storage)]

  MobileUser --> P1
  P1 --> API
  API --> Auth
  API --> DB
  P1 --> LocalSession

  MobileUser --> P2
  P2 --> API
  API --> DB
  P2 --> MobileUser

  MobileUser --> P3
  P3 --> P4
  P4 --> LocalFiles

  P3 --> P5
  P5 --> API
  API --> DB
  API --> Storage

  P5 -->|Network/API failed| P6
  P6 --> LocalQueue

  MobileUser --> P7
  P7 --> LocalQueue
  P7 --> API
  API --> DB
  API --> Storage

  MobileUser --> P8
  P8 --> API
  API --> DB
  P8 --> MobileUser

  MobileUser --> P9
  P9 --> LocalDrafts
  P9 --> API
  API --> DB
```

## 7. Database And Storage DFD

```mermaid
flowchart TD
  API[Express API Controllers And Services]

  Users[(users)]
  Incidents[(incidents)]
  Casualties[(casualties)]
  CasualtyIncidents[(casualty_incidents)]
  Triage[(casualty_triage_assessments)]
  Transport[(casualty_transport_records)]
  Treatment[(casualty_treatments)]
  FacilityEncounters[(facility_encounters)]
  Outcomes[(casualty_outcomes)]
  Attachments[(attachments)]
  CaseLinks[(casualty_case_links)]
  Facilities[(healthcare_facilities)]
  CallDownStaff[(call_down_staff)]
  CallDownResponses[(dmmp_staff_call_downs)]
  Drafts[(form_drafts)]
  AuditLogs[(audit_logs)]
  Notifications[(notifications)]
  Storage[(Supabase Storage Buckets)]

  API --> Users
  API --> Incidents
  API --> Casualties
  API --> CasualtyIncidents
  API --> Triage
  API --> Transport
  API --> Treatment
  API --> FacilityEncounters
  API --> Outcomes
  API --> Attachments
  API --> CaseLinks
  API --> Facilities
  API --> CallDownStaff
  API --> CallDownResponses
  API --> Drafts
  API --> AuditLogs
  API --> Notifications
  API --> Storage

  Casualties --> CasualtyIncidents
  Incidents --> CasualtyIncidents
  CasualtyIncidents --> Triage
  CasualtyIncidents --> Transport
  CasualtyIncidents --> Treatment
  CasualtyIncidents --> FacilityEncounters
  CasualtyIncidents --> Outcomes
  CasualtyIncidents --> Attachments
  CasualtyIncidents --> CaseLinks
  Attachments --> Storage
  Users --> AuditLogs
  Users --> Drafts
  Users --> CallDownStaff
  Incidents --> CallDownResponses
  CallDownStaff --> CallDownResponses
```

## 8. Casualty Submission And Verification Flow

```mermaid
sequenceDiagram
  participant Mobile as Mobile/PWA User
  participant API as Express API
  participant Auth as Supabase Auth
  participant DB as Supabase DB
  participant Storage as Supabase Storage
  participant Admin as Web Admin

  Mobile->>API: POST /api/casualties with bearer token
  API->>Auth: Validate token
  Auth-->>API: Valid user
  API->>DB: Insert casualty + casualty_incident
  API->>DB: Insert role-specific triage/transport/treatment/facility data
  API->>Storage: Upload attachment files when provided
  API->>DB: Insert attachment metadata
  API->>DB: Insert audit log and notification
  API-->>Mobile: Submission result

  Admin->>API: GET casualty records / verification queue
  API->>DB: Load scoped records and related data
  API-->>Admin: Records for review
  Admin->>API: Approve / reject / delete record
  API->>DB: Update verification status
  API->>DB: Insert verification history and audit log
  API-->>Admin: Review result
```

## 9. Match Casing Flow

```mermaid
flowchart TD
  Admin[Admin Opens Match Casing] --> SelectIncident[Select Incident Filter]
  SelectIncident --> FRBox[Choose One Field Responder Record]
  SelectIncident --> AMPBox[Choose One AMP Record]
  SelectIncident --> HCFDBox[Optional HCFD Record]

  FRBox --> CompleteCheck{Required FR And AMP Selected?}
  AMPBox --> CompleteCheck
  HCFDBox -. Optional .-> SubmitMatch

  CompleteCheck -->|No| Wait[Match Button Disabled]
  CompleteCheck -->|Yes| SubmitMatch[Click Match Selected Records]

  SubmitMatch --> API[POST /api/casualties/case-links]
  API --> Validate[Validate Same Incident And Unmatched Records]
  Validate --> CaseLinkDB[(casualty_case_links)]
  CaseLinkDB --> Locked[Matched Case Locked]
  Locked --> RecordsView[Casualty Record Shows Linked FR/AMP Sections And Optional HCFD Section]
  Locked --> MatchedCases[Matched Cases Section]
```

## 10. Offline Sync Flow

```mermaid
flowchart TD
  AddRecord[Mobile User Adds Casualty] --> NetworkCheck{Network/API Available?}
  NetworkCheck -->|Yes| SubmitOnline[Submit To API]
  SubmitOnline --> UploadFiles[Upload Attachments]
  UploadFiles --> SaveDB[(Supabase DB)]

  NetworkCheck -->|No| SaveQueue[Save Record In Local Offline Queue]
  SaveQueue --> RecordsPending[Show Pending / Failed Sync In Records]

  Refresh[User Taps Refresh Data Or Retry] --> ReadQueue[Read Local Queue]
  ReadQueue --> RetryAPI{API Reachable?}
  RetryAPI -->|No| KeepQueue[Keep In Queue And Show Warning]
  RetryAPI -->|Yes| SubmitQueued[Submit Queued Record]
  SubmitQueued --> UploadQueuedFiles[Upload Queued Attachments]
  UploadQueuedFiles --> SaveDB
  SaveDB --> RemoveQueue[Remove Synced Item From Queue]
  RemoveQueue --> SyncComplete[Show Sync Complete Feedback]
```

## 11. Main Data Stores

| Store | Purpose |
| --- | --- |
| `users` | User profile, role, assignment, admin scope, account metadata. |
| `incidents` | Official disaster incident records and status. |
| `casualties` | Person-level casualty identity/demographic information. |
| `casualty_incidents` | Incident-specific casualty record, status, severity, encoder, location, verification status. |
| `casualty_triage_assessments` | Primary, secondary, and tertiary triage assessment data. |
| `casualty_transport_records` | AMP/transport movement and receiving facility details. |
| `casualty_treatments` | Stabilization/treatment/PCR-related data. |
| `facility_encounters` | HCFD arrival, ED care, admission, management, ICU, and disposition data. |
| `casualty_outcomes` | Final outcome/death/disposition details. |
| `attachments` | Attachment metadata linked to casualty records. |
| Supabase Storage | Actual uploaded attachment files/photos. |
| `casualty_case_links` | Manual match casing links between required FR and AMP records, with optional HCFD records. |
| `healthcare_facilities` | Facility reference list. |
| `call_down_staff` | Reusable staff contact list, including staff without login accounts. |
| `dmmp_staff_call_downs` | Incident-specific call-down response, contacted, arrived, status, and arrival time. |
| `form_drafts` | Saved draft payloads for web/mobile add workflows. |
| `audit_logs` | Action logs across web/mobile activities. |
| `notifications` | Notifications for users/admin workflows. |

## 12. Deployment View

```mermaid
flowchart LR
  Browser[Web Browser - Admin Dashboard] --> Netlify[Static Web Host]
  Phone[Mobile Browser / Installed PWA] --> MobileHost[Static PWA Host]

  Netlify --> RenderAPI[Render Node/Express API]
  MobileHost --> RenderAPI

  RenderAPI --> SupabaseAuth[(Supabase Auth)]
  RenderAPI --> SupabaseDB[(Supabase PostgreSQL)]
  RenderAPI --> SupabaseStorage[(Supabase Storage)]
  SupabaseDB --> SupabaseRealtime[(Supabase Realtime)]
  SupabaseRealtime --> Browser
```

## 13. Notes For Submission

- The web dashboard and mobile/PWA app do not directly write to the database. They call the Express API.
- Supabase Auth handles authentication, but role and scope decisions are also enforced by the API.
- Supabase PostgreSQL stores structured operational data.
- Supabase Storage stores casualty attachments/photos.
- Supabase Realtime helps the web dashboard update when operational records change.
- Mobile/PWA supports offline queueing for casualty submissions and retries when the API becomes reachable again.
- Match Casing does not merge or delete records. It creates a link layer through `casualty_case_links`.
