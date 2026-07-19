# Utstein-Based Mobile App Field Mapping and Gap Analysis

Source reviewed: `Debacker et al (2008) Utstein-Style Template for Uniform Data Reporting of Acute Medical Response in Disasters.docx`

System reviewed:

- Mobile casualty form: `mobile/src/app/(tabs)/add-casualty.tsx`
- Mobile casualty API types: `mobile/src/api/casualties.ts`
- Mobile incident API types: `mobile/src/api/incidents.ts`
- Mobile evacuation center API types: `mobile/src/api/evacuation-centers.ts`
- Database schema: `UP-Manila-DB.sql`

## Executive Summary

The current mobile app is a strong casualty registry and field responder reporting prototype. It can record a casualty profile, address, disaster incident, evacuation center, GPS point, status, severity, medical notes, assistance, remarks, attachments, status history, and offline casualty submission queueing.

However, the Utstein disaster response template is broader than individual casualty encoding. It expects standardized disaster-wide response metrics such as event notification, disaster medical plan activation, triage system and triage timing, casualty clearance, survivor distribution, hospital resource use, morbidity, mortality, responder safety, and continuity of normal care.

So the current app partially supports an Utstein-based documentation system, but it does not yet fully satisfy the complete Utstein reporting template. The biggest missing area is incident-level operational reporting and automated SitRep/report generation.

## Current Mobile App Fields

### Add/Edit Casualty: Personal

- ID number, currently auto-generated
- Age
- First name
- Middle name
- Last name
- Sex
- Date of birth

Database/API also supports but the current mobile UI does not fully expose:

- ID type
- Identification status
- Suffix
- Civil status
- Nationality
- Contact number

### Add/Edit Casualty: Address

- House/street
- Barangay
- Municipality/city
- Province
- Region

### Add/Edit Casualty: Incident

- Disaster incident selection
- Quick create incident
- Disaster type
- Current location
- Evacuation center selection
- Quick create evacuation center
- Evacuation center name
- Evacuation center address
- Evacuation center capacity
- Latitude
- Longitude
- Use current GPS location

### Add/Edit Casualty: Status

- Casualty status: safe, displaced, evacuated, rescued, missing, injured, hospitalized, deceased, unknown
- Severity: none, minor, moderate, severe, critical
- Hospital/facility
- Visible injury
- Medical condition
- Assistance needed
- Assistance provided

### Add/Edit Casualty: Remarks

- Remarks
- Casualty photo attachment

### Existing Supporting Features

- Login with authenticated API token
- Role checks for incident and evacuation center creation
- Records list and casualty detail screen
- Casualty edit flow
- Status history recording and display
- Attachment upload and viewing
- Incident management screen with create/list/close
- Evacuation center dropdown with richer labels
- GPS permission and location capture
- Offline queue for casualty submissions that fail due to network issues
- Dashboard summary and recent activity

## Utstein Required Reporting Field Groups

The Utstein template can be grouped into these required reporting areas:

1. Event notification
2. Disaster Medical Management Plan activation
3. Disaster medical operations coordination
4. On-site triage
5. On-site medical care
6. Scene casualty clearance
7. Distribution of ill/injured survivors
8. Triage upon arrival at healthcare facility
9. Responder safety and health
10. Deactivation of the disaster medical management plan
11. Continuity of care for non-disaster patients
12. Emergency department resource utilization
13. Hospital resource utilization
14. Morbidity and length of stay
15. Mortality

## Utstein vs Current App Coverage

| Utstein Area | Current App Coverage | Gap |
| --- | --- | --- |
| Event notification | Partial | Incidents have `started_at` and `created_at`, but no official notification time or dispatch notification field. |
| DMMP activation | Missing | No fields for plan activation, activation trigger, staff notification, last staff reporting, or call-down percentage. |
| Medical operations coordination | Missing | No standardized 1 to 7 ratings for on-scene coordination, system coordination, communications, or resource management. |
| On-site triage | Partial | App has casualty status and severity, but no triage system, triage category, triage timestamps, or over/under-triage tracking. |
| On-site medical care | Partial | App has visible injury, medical condition, and assistance fields, but no treatment area/stabilization model or per-time-unit stabilization metrics. |
| Scene casualty clearance | Partial | App has current location, hospital/facility, GPS, and status, but no EMS arrival time, transport time, last casualty cleared time, or BLS/ALS ambulance counts. |
| Survivor distribution | Partial | App has hospital/facility as free text, but no healthcare facility registry, facility level, EMS vs independent arrival, or interhospital transfer tracking. |
| Facility arrival triage | Missing | No arrival triage category, facility triage system, first/last facility triage time, or triage mismatch tracking. |
| Responder safety and health | Missing | No responder PPE, injury, illness, or death reporting module. |
| DMMP deactivation | Partial | Incidents can be closed and have `ended_at`, but there is no explicit scene demobilization time. |
| Continuity of care | Missing | No fields for disruption of normal EMS or healthcare facility operations. |
| ED resources | Missing | No ED arrivals by triage category, admission/discharge counts, resuscitation room utilization, or ED timing. |
| Hospital resources | Missing | No surgery, OR, imaging, ICU, ventilator, or alternate ICU fields. |
| Morbidity/length of stay | Missing | No ED/ICU/hospital length of stay fields or ventilator patient-days. |
| Mortality | Partial | Casualty status can be deceased, but there is no death category such as impact, pre-hospital, in-hospital, ED, OR, ICU, or death time. |

## Required PCR and Disaster Reporting Fields to Add

### Per-Casualty PCR Fields

These should be added to the casualty form or a new clinical/PCR tab:

- Triage system used
- Initial triage category: immediate, delayed, minimal/minor, expectant
- Current triage category
- Triage performed at
- Triage performed by
- On-site treatment provided
- Stabilized at
- Treatment area name/location
- Transport required
- Transport mode: EMS, independent, other
- EMS unit type: BLS, ALS, other
- Transport departed scene at
- Arrived at receiving facility at
- Receiving facility
- Receiving facility level: primary, secondary, tertiary, specialized
- Facility triage category
- Facility triage performed at
- ED disposition: admitted, discharged, transferred, deceased
- Hospital admission time
- ICU admission time
- OR/surgery required
- Surgery start/end time
- Imaging required: X-ray, ultrasound, CT
- Ventilator required
- Ventilator days
- ED length of stay
- ICU length of stay
- Hospital length of stay
- Death category, if deceased
- Death time, if deceased

### Incident-Level Disaster Reporting Fields

These belong in incident management, not the casualty form:

- Event notification time
- Dispatch or coordination center notified
- DMMP activated: yes/no/unknown
- DMMP activation trigger
- DMMP activation time
- Medical management coordinator notified time
- Last required staff reported time
- Staff call-down completion percentage
- First EMS vehicle on scene time
- Triage ordered time
- First casualty triaged on scene time
- Last casualty triaged on scene time
- First casualty transported from scene time
- Last casualty transported from scene time
- Scene demobilization time
- Responder PPE decision time
- Responder safety actions established
- Number of responders injured
- Number of responders killed
- Normal EMS coverage disruption level
- Normal healthcare facility disruption level

### Aggregate/SitRep Metrics

These can be generated from casualty and facility data, but may need snapshot tables:

- Counts by triage category
- Counts by casualty status
- Counts by severity
- Counts by destination facility level
- Counts transported by EMS vs independent arrival
- Counts admitted, discharged, transferred, deceased
- EMS BLS/ALS ambulance counts per time interval
- ED resuscitation room utilization
- OR utilization
- ICU utilization
- Imaging demand
- Ventilator demand
- Mortality by category
- Time from disaster onset to ED arrival
- Time from ED arrival to ICU admission

## Recommended Mobile Screen Mapping

### 1. Add/Edit Casualty

Keep the current five-step flow but expand it:

- Personal
- Address
- Incident
- Triage and Transport
- Clinical Care
- Remarks and Attachments
- Review and Submit

### 2. Triage and Transport Screen

Fields:

- Triage system
- Initial triage category
- Current triage category
- Triage time
- Treatment area
- Transport required
- Transport mode
- EMS unit type
- Departed scene time
- Destination facility
- Arrived facility time

### 3. Clinical Care Screen

Fields:

- Visible injury
- Medical condition
- Treatment provided
- Assistance needed
- Assistance provided
- ED disposition
- Hospital admission
- ICU admission
- Surgery required
- Imaging required
- Ventilator required
- Outcome

### 4. Incident Management

Add tabs or sections:

- Incident details
- Timeline
- Coordination
- Evacuation centers
- Resource snapshots
- SitReps
- Close incident

### 5. SitRep / Reports

Add a screen that can generate:

- Incident summary
- Casualty summary
- Triage summary
- Facility distribution
- Resource utilization
- Mortality summary
- Export to PDF/CSV

### 6. Admin

Add screens for:

- User management
- Role assignment
- Verification queue
- Approval/rejection
- Reference data management
- Facility management

## Suggested Database Changes

### New Enums or Reference Tables

Use either PostgreSQL enums or reference tables for:

- `triage_system`: START, NATO, SIEVE/SORT, SMART, SALT, MASS, Care Flight, ED Triage, other
- `triage_category`: immediate, delayed, minimal, expectant, unknown
- `triage_stage`: on_site, facility_arrival, reassessment
- `transport_mode`: ems, independent, walk_in, private_vehicle, other
- `ems_unit_type`: bls, als, other
- `facility_level`: primary, secondary, tertiary, specialized
- `ed_disposition`: admitted, discharged, transferred, deceased, unknown
- `death_category`: impact, pre_hospital, emergency_department, operating_room, icu, inpatient, other
- `disruption_level`: none, minimal, moderate, total, unknown

### New Table: healthcare_facilities

Purpose: replace free-text hospital names with reusable facility records.

Recommended columns:

- `id`
- `facility_name`
- `facility_level`
- `address`
- `barangay`
- `municipality`
- `province`
- `contact_person`
- `contact_number`
- `latitude`
- `longitude`
- `is_active`
- `created_at`
- `updated_at`

### New Table: casualty_triage_assessments

Purpose: record triage history and compare on-site vs facility triage.

Recommended columns:

- `id`
- `casualty_incident_id`
- `triage_stage`
- `triage_system`
- `triage_category`
- `triaged_at`
- `triaged_by`
- `location`
- `notes`
- `created_at`

### New Table: casualty_transport_records

Purpose: track scene clearance and destination.

Recommended columns:

- `id`
- `casualty_incident_id`
- `transport_required`
- `transport_mode`
- `ems_unit_type`
- `departed_scene_at`
- `arrived_facility_at`
- `receiving_facility_id`
- `interhospital_transfer`
- `transferred_to_facility_id`
- `notes`
- `created_at`

### New Table: casualty_clinical_encounters

Purpose: record ED, hospital, ICU, OR, imaging, and outcome details.

Recommended columns:

- `id`
- `casualty_incident_id`
- `facility_id`
- `ed_arrived_at`
- `facility_triaged_at`
- `facility_triage_category`
- `ed_disposition`
- `admitted_at`
- `discharged_at`
- `icu_admitted_at`
- `icu_discharged_at`
- `surgery_required`
- `surgery_started_at`
- `surgery_ended_at`
- `xray_required`
- `ultrasound_required`
- `ct_required`
- `ventilator_required`
- `ventilator_days`
- `death_category`
- `death_at`
- `created_at`
- `updated_at`

### New Table: incident_response_timeline

Purpose: store major Utstein disaster response timestamps.

Recommended columns:

- `id`
- `incident_id`
- `event_notification_at`
- `dmmp_activated`
- `dmmp_activation_trigger`
- `dmmp_activated_at`
- `medical_coordinator_notified_at`
- `last_staff_reported_at`
- `staff_call_down_percent`
- `first_ems_on_scene_at`
- `triage_ordered_at`
- `first_site_triage_at`
- `last_site_triage_at`
- `first_transport_from_scene_at`
- `last_transport_from_scene_at`
- `scene_demobilized_at`
- `created_at`
- `updated_at`

### New Table: incident_coordination_assessments

Purpose: store the Utstein ordinal coordination ratings.

Recommended columns:

- `id`
- `incident_id`
- `initial_actions_score`
- `on_scene_medical_control_score`
- `system_medical_coordination_score`
- `communications_information_score`
- `medical_resource_management_score`
- `assessed_by`
- `assessed_at`
- `notes`

### New Table: responder_safety_reports

Purpose: track responder safety and health.

Recommended columns:

- `id`
- `incident_id`
- `safety_actions_established`
- `ppe_decision_at`
- `responders_injured_count`
- `responders_killed_count`
- `responders_sought_medical_care_count`
- `notes`
- `reported_by`
- `reported_at`

### New Table: incident_resource_snapshots

Purpose: capture time-based metrics for SitReps.

Recommended columns:

- `id`
- `incident_id`
- `snapshot_at`
- `interval_minutes`
- `bls_ambulances_on_scene`
- `als_ambulances_on_scene`
- `ed_resuscitation_rooms_total`
- `ed_resuscitation_rooms_used`
- `operating_rooms_total`
- `operating_rooms_used`
- `icu_beds_total`
- `icu_beds_used`
- `ventilators_total`
- `ventilators_used`
- `notes`
- `created_by`
- `created_at`

### New Table: sitreps

Purpose: store generated situation reports and their source data snapshot.

Recommended columns:

- `id`
- `incident_id`
- `report_number`
- `period_start`
- `period_end`
- `summary`
- `generated_payload`
- `generated_by`
- `generated_at`
- `approved_by`
- `approved_at`
- `status`

## Missing Feature Checklist

### High Priority

- [x] Add a true triage module with triage system, category, stage, timestamp, and reassessment history.
- [x] Add receiving healthcare facility records instead of only free-text hospital names.
- [x] Add transport tracking: EMS/independent, BLS/ALS, departure time, arrival time, destination.
- [ ] Add incident response timeline fields for notification, activation, EMS arrival, triage, transport, and demobilization.
- [ ] Add automated SitRep generation from incident, casualty, triage, transport, and facility data.
- [ ] Add verification/approval workflows for admin and medical personnel.
- [ ] Add export support: PDF and CSV.

### Medium Priority

- [ ] Add hospital/ED resource utilization tracking.
- [ ] Add ICU, OR, imaging, and ventilator tracking.
- [ ] Add morbidity fields such as ED, ICU, and hospital length of stay.
- [ ] Add mortality category and death time.
- [ ] Add responder safety and health module.
- [ ] Add continuity of care disruption fields.
- [ ] Add incident detail/edit screens beyond quick create and close.
- [ ] Add richer dashboards by active incident.

### Polish and Operational Readiness

- [ ] Test login/logout on real Android and iOS devices.
- [ ] Test API access through Render or another public HTTPS host.
- [ ] Test add/edit casualty with real GPS and real photo upload.
- [ ] Test offline casualty creation and later sync.
- [ ] Test duplicate ID number protection.
- [ ] Test role restrictions for responder, encoder, medical personnel, administrator, and super admin.
- [ ] Add audit logs for verification, incident close, user changes, and report approval.
- [ ] Add user-facing error messages for common network, permission, and validation failures.

## User Manual Draft

### Purpose

The Disaster Casualty Management System mobile app allows authorized responders to encode casualty records during disaster response operations. It supports casualty identification, incident assignment, location capture, evacuation center tagging, clinical notes, attachments, and record updates.

### Login

1. Open the mobile app.
2. Enter the official responder email and password.
3. Tap login.
4. If login fails, confirm internet access and verify that the API service is reachable.

### Add a Casualty

1. Go to the Add tab.
2. Complete the Personal step. The ID number is automatically generated.
3. Complete the Address step.
4. Select an active disaster incident.
5. If allowed by role, quick-create a new incident when needed.
6. Enter the current location or use GPS capture.
7. Select or quick-create an evacuation center if applicable.
8. Choose casualty status and severity.
9. Add hospital/facility, injury, condition, and assistance details.
10. Add remarks and optional photo attachment.
11. Review the record and submit.

### Edit a Casualty

1. Open Records.
2. Select a casualty.
3. Tap Edit Casualty.
4. Update the needed fields.
5. Save changes.
6. Status changes are stored in the status history timeline.

### View a Casualty

1. Open Records.
2. Tap a casualty card.
3. Review personal details, incident details, location, status, attachments, and status history.

### Manage Incidents

1. Open Incident Management.
2. Review active and closed incidents.
3. Create incidents if your role allows it.
4. Close incidents when the response is complete.

### Offline Use

If a casualty submission fails because of a network issue, the app can queue the record locally. The app attempts to sync queued records when connectivity returns.

## Technical Documentation Draft

### Architecture

The system uses an Expo mobile app, an Express/Node API, and Supabase for authentication, database, and storage.

### Authentication

The mobile app logs in through the API. The API validates the authenticated user and reads the user ID from the access token. Sensitive Supabase service-role access remains server-side.

### Main Data Flow

1. Mobile user logs in.
2. Mobile app stores the session token.
3. API requests include the bearer token.
4. Add Casualty submits a structured payload to the API.
5. API validates the payload and authenticated user.
6. API calls a Supabase RPC to create casualty and casualty incident records transactionally.
7. Attachments are uploaded to Supabase Storage through the API.
8. Records and details are retrieved from API endpoints.

### Existing Core Tables

- `users`
- `incidents`
- `casualties`
- `casualty_incidents`
- `casualty_status_history`
- `evacuation_centers`
- `attachments`
- `audit_logs`

### Current Strengths

- Transactional casualty creation through RPC
- Authenticated user enforcement in API
- Role-based restrictions for reference data creation
- Status history support
- Attachment support
- GPS support
- Offline queue for casualty submission
- Database constraints for age, coordinates, duplicate mobile client record, and unique ID numbers

### Main Technical Gaps

- No full Utstein operational timeline model yet
- No structured triage history table yet
- No structured receiving facility model yet
- No transport tracking table yet
- No ED/hospital resource utilization model yet
- No automated SitRep generation yet
- Offline sync only covers casualty creation, not edits, attachments, incidents, or evacuation centers

## Recommended Next Build Order

1. Add healthcare facilities table and API. Done: added `healthcare_facilities`, `/api/healthcare-facilities`, and mobile facility selection/quick-create.
2. Add triage assessment table and mobile triage screen. Done: added `casualty_triage_assessments`, `/api/casualties/:id/triage-history`, mobile Triage step, and casualty detail triage history.
3. Add transport record table and mobile transport fields. Done: added `casualty_transport_records`, `/api/casualties/:id/transport-history`, mobile Transport step, and casualty detail transport history.
4. Add incident response timeline screen.
5. Add SitRep generation endpoint and dashboard.
6. Add admin verification and report approval workflow.
7. Expand offline sync to attachments and edits.
