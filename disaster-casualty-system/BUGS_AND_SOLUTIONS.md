# DCMS Bugs, Problems, and Solutions

This document summarizes the main issues encountered during development of the Disaster Casualty Management System and the solutions applied.

## 1. SitRep Download And Filtering

**Problem:** Generated SitRep files were difficult to view and downloaded files appeared identical. Earlier testing explored responder-function filtering, but this was later superseded by the requirement that SitRep exports must be incident-wide.

**Solution:** SitRep generation/export was updated to produce downloadable reports. Later updates changed SitRep generation to selected-incident scope and added analytics-backed PDF content.

## 2. Rejected Casualty Record Resubmission

**Problem:** When responders edited rejected casualty records, Save Changes did not clearly save or return the record to admin review.

**Solution:** The rejected-record edit flow was updated so corrected records are returned for admin review. Confirmation feedback was added after saving.

## 3. Rejection Notifications

**Problem:** Responders were not being notified when an admin rejected their casualty record.

**Solution:** Notification behavior was connected so responders receive rejection notifications tied to their submitted records.

## 4. Responder Add Casualty Form Improvements

**Problem:** Several responder form fields needed better behavior, including triage deselection, SAR witness multi-select, hidden personal details for unidentified patients, and limited triage systems by role.

**Solution:** The mobile form was updated to allow deselection, support multi-select witness entries, conditionally show personal details, and restrict triage systems to START/STIEVE for Field Responder and SORT for SAR.

## 5. HCFD Facility Selection Flow

**Problem:** Facility Disruption and Close Facility Response flows closed or stopped after incident selection, and users could not proceed to healthcare facility selection.

**Solution:** The sequence was corrected to require incident selection, then official healthcare facility selection, then the target HCFD form.

## 6. Victim Code And Transport Record Edits

**Problem:** SAR victim code behaved differently from Field Responder, transport editing was missing, and responder records needed limited editing rules.

**Solution:** SAR victim code was changed to a text field, triage time was formatted as 12-hour time, transport fields were expanded, and an edit button was added specifically for the transport card.

## 7. Mobile Console Errors

**Problem:** The mobile app showed 401 errors and a `startTime` undefined error in casualty detail/history views.

**Solution:** Auth handling and defensive data access were improved so missing or unauthorized records no longer crash the view.

## 8. Incident Analytics

**Problem:** Incident Analytics was missing from the web dashboard and needed timeline, plain-text metrics, pie charts, and bar graphs filtered per incident.

**Solution:** A new Incident Analytics tab was added. Metrics were scoped per selected incident, cards were corrected to show incident-specific counts, pie charts and axis-based bar charts were added, and legends/colors were refined.

## 8A. HCFD ED-Care Pie Chart Showing No Data

**Problem:** The "Victims Seeking ED Care According to Triage Category" pie chart could stay empty even after HCFD/documenter users selected a receiving facility, arrival time, and tertiary triage assessment. Tertiary systems such as ESI, METTS, and ED Triage could save the normalized `triage_category` as `unknown` while keeping the visible answer in `assessment_answers.finalTriage`.

**Solution:** Incident Analytics now normalizes triage category values from multiple sources: `triage_category`, `responder_category`, `calculated_category`, and `assessment_answers.finalTriage`. ED-style values such as `red`, `orange`, `yellow`, `green`, `blue`, `black`, `white`, and `esi_1` through `esi_5` are mapped into the analytics buckets `immediate`, `delayed`, `minimal`, and `expectant`.

## 8B. METTS Final Triage Not Calculating

**Problem:** The HCFD/documenter METTS assessment showed a Final triage field, but the app did not calculate a final METTS color even after all METTS vital-sign questions were answered. The mobile and API triage calculators treated METTS as `unknown`.

**Solution:** METTS calculation was added to the mobile app and API. The formula now maps unstable RED criteria, potentially life-threatening ORANGE criteria, YELLOW emergency-care criteria, and GREEN stable criteria from the METTS vital-sign fields. METTS colors are mapped into the system analytics categories so red/orange count as immediate, yellow as delayed, and green/blue as minimal.

## 9. Sidebar And Web Dashboard Responsiveness

**Problem:** The collapsible sidebar looked unprofessional when collapsed and the dashboard was not mobile-browser friendly.

**Solution:** Sidebar collapse/expand styling and animations were improved. The dashboard layout was adjusted to be more usable on phone-sized browsers.

## 10. Realtime Dashboard Updates

**Problem:** Some dashboard tabs, especially Incident Analytics and Audit Logs, required manual refresh to show new records.

**Solution:** Realtime refresh behavior was expanded so more dashboard sections update without needing a full page refresh.

## 10A. Logout Had No Confirmation

**Problem:** The web dashboard logged the user out immediately when the Logout button was clicked, which made accidental clicks disruptive.

**Solution:** Logout now opens an in-app confirmation dialog. The session is only cleared after the user confirms; cancelling keeps the user signed in.

## 10B. Mobile Forgot Password Was Not Connected

**Problem:** The mobile login screen had a Forgot Password button, but it only showed a placeholder message and did not start a real password recovery flow.

**Solution:** Mobile forgot password now sends a Supabase password recovery email through the API. A `/reset-password` mobile/PWA screen was added to accept the recovery token, validate the new password, and update the account password through the backend.

## 11. Search, Sorting, And Date Filters

**Problem:** Incident and casualty records lacked useful date filtering and some tables were sorted randomly.

**Solution:** Date-range filters were added. Casualty records and verification review records were sorted latest-to-past, with additional filters by incident and verification status.

## 12. Mobile Records Visibility By Role

**Problem:** Mobile casualty records showed records outside the current responder/documenter account’s scope.

**Solution:** Mobile records were filtered so responders/documenters only see records encoded by their own account, while admin views remain broader.

## 13. SAR Photo Capture And Attachments

**Problem:** Add Casualty Photo in SAR did not open correctly, capture photo opened files instead of camera, and uploaded attachments were not visible on the web dashboard.

**Solution:** Photo source selection was fixed, camera capture was implemented separately from file import, and web dashboard record views were updated to display and preview attachments.

## 14. Profile, Password, Delete, And Reset Controls

**Problem:** Dashboard profile was not clickable, password changes were unavailable, destructive actions used browser dialogs, and reset behavior needed stronger safety.

**Solution:** A profile modal was added with account editing, password change, and reset controls. Delete/reset confirmations were replaced with in-app dialogs, typed confirmation, current password confirmation, affected counts, and post-action summaries.

## 15. Bulk Upload

**Problem:** Creating accounts, healthcare facilities, and evacuation centers one by one was inefficient.

**Solution:** CSV/Excel bulk upload was added while keeping manual creation. Preview tables validate rows before import, mark duplicates/invalid rows, show row-level errors, require explicit confirmation, and allow failed rows to be downloaded.

## 16. Audit Logs

**Problem:** There was no complete audit trail for admin, responder, documenter, casualty, import, and reset activity.

**Solution:** An `audit_logs` table and Audit Logs dashboard tab were added. Logs are scoped so admins see activity from their created responders/documenters, while super admin sees admin-level activity.

## 17. UI Message Standardization

**Problem:** Loading, success, and error messages were inconsistent across mobile and web.

**Solution:** User-facing messages were standardized, technical errors were kept in console/API logs, and success/failure messages were made clearer and more persistent.

## 18. Data Export And Backup

**Problem:** The system needed exports for casualty records, accounts, healthcare facilities, evacuation centers, incident packages, and system backups.

**Solution:** Export endpoints and dashboard buttons were added for incident-level and system-level data. Exports include attachments or attachment references and enforce role-based permissions.

## 19. Mobile Offline And Retry Behavior

**Problem:** Failed mobile submissions could be lost or unclear when the API was unreachable.

**Solution:** Offline casualty queue behavior was improved. Queued records now show pending/failed status, retry buttons, retry-all action, preserved payloads, and attachment-safe sync handling.

## 20. Responders/Documenters Export Bug

**Problem:** Exporting responders/documenters caused a 500 error because the API queried `users.role` using invalid enum values such as `field_responder`.

**Solution:** The export query was corrected to use only real account roles: `responder` and `documenter`. Field Responder and SAR are responder functions, not database account roles.

## 21. Offline Add Casualty Incident Selection

**Problem:** When adding a casualty while offline, the mobile app could not load active incidents from the API. Because incident selection was required, users could not proceed to the next section. Removing the required incident field was not a valid fix because queued casualty records still need a real `incidentId` to sync later.

**Solution:** The mobile Add Casualty screen now caches the incident list when the app is online. If the API is unreachable, the app falls back to the last saved incident list and labels it as a saved/offline list. This allows responders to select a real incident while offline and queue the casualty for later sync.

## 22. Incident Analytics Table Layout And Timeline Sorting

**Problem:** Incident Analytics timeline rows became hard to read when event text was long. The table also needed better centering, more balanced column widths, and final ordering based on the Time column.

**Solution:** The analytics table layout was constrained with deliberate column widths, centered table/container rules, text wrapping, and explicit Time-based sorting before rendering.

## 23. Role-Specific Casualty Detail Parity

**Problem:** Casualty detail pages showed unrelated or duplicated sections, especially around SAR details. Web and mobile record-detail views risked drifting away from the actual FR, SAR, and HCFD Add Casualty workflows.

**Solution:** Record detail views were aligned around the role-specific form structures. FR, SAR, and HCFD sections should use the Add Casualty forms as the source of truth, and future form changes should be paired with record-display updates.

## 24. Scoped Duplicate Victim Code Validation

**Problem:** Victim Code duplicate checks needed the correct scope. A global duplicate rule would be too strict, but no scope would allow accidental duplicate codes by the same user.

**Solution:** Duplicate validation was scoped by Incident + Account + Role + Victim Code. This allows the same victim code across different accounts or different roles while blocking duplicates within the same operational scope.

## 25. Add Casualty Back And Previous Navigation

**Problem:** The top Back button and bottom Previous button were performing similar navigation even though they had different user expectations.

**Solution:** Navigation behavior was separated. The top Back exits the Add Casualty workflow, while the bottom Previous button moves only to the previous form step.

## 26. Victim Code Sticky Header Context

**Problem:** The sticky Victim Code header did not show enough context for users working through the casualty form.

**Solution:** User Code was displayed beside Victim Code in the sticky header so responders can keep both identifiers visible while encoding.

## 27. Backend Role Privacy Enforcement Risk

**Problem:** FR, SAR, and HCFD users must not be able to retrieve other roles' private records. Frontend filtering alone is not enough because direct API requests could still bypass UI hiding.

**Solution:** Role privacy should be enforced at the backend/API and database-policy level using the authenticated user identity, account role, responder function, encoder, and admin scope. UI filters remain useful for presentation but must not be the only access-control layer.

## 28. SAR Receiving Facility Reference List

**Problem:** Receiving Facility values in SAR referral/transfer flows could become inconsistent if entered as free text.

**Solution:** Receiving Facility should use the admin-managed healthcare facility list and store the stable facility ID along with the display name.

## 29. HCFD And Clinical Record Filters

**Problem:** HCFD and clinical record lists needed more operational filters, including review/sync states and clinical narrowing by triage or admission location.

**Solution:** Planned filters include Draft, Unsynced, Under Review, Returned, Confirmed, All, ESI 1-5, Emergency Department, Ward, ICU, and Discharged. These should use controlled status and clinical values instead of free text.

## 30. Treatment History 404

**Problem:** Casualty details showed "No record yet" for Treatment because the treatment-history request returned HTTP 404.

**Solution:** The treatment-history route and related data handling were fixed/deployed so treatment data can be fetched and displayed when it exists.

## 31. Missing Latest Triage And Transport Summaries

**Problem:** Casualty records did not initially include convenient latest-triage and latest-transport summaries.

**Solution:** The casualty record response was enriched with latest triage assessment and latest transport record data before presentation.

## 32. Assessment Answers Not Displaying

**Problem:** Some records showed "No answers recorded" even though assessment answers existed.

**Solution:** Assessment retrieval and serialization were corrected so recorded answers are included in the response structure consumed by web and mobile views.

## 33. HTTP 304 Misread As Fetch Failure

**Problem:** HTTP 304 responses were initially interpreted as casualty-fetch failures.

**Solution:** The team clarified that `304 Not Modified` is a cache-validation response, not the same as a 4xx or 5xx error when usable cached data exists. Debugging should check both HTTP status and whether application state received usable data.

## 34. Successful Submission Notification Click-Through

**Problem:** Rejection notifications existed, but successful casualty submission notifications and click-through navigation to the submitted casualty record were still incomplete.

**Solution:** A successful submission notification should be created only after casualty creation returns a valid casualty/record ID. The notification payload should include the event type and casualty ID, and tapping the notification should route to the same casualty detail view used by Records.

## 35. First-Time Offline Add Casualty Blocked By Missing Incident List

**Problem:** If a responder opened the mobile app in airplane mode before the incident list had ever been cached, the Add Casualty flow had no incident options and blocked the user from proceeding or submitting. Removing the required incident field would allow navigation, but the casualty still could not sync later because the API requires an official incident ID.

**Solution:** Add Casualty now allows a first-time offline placeholder path when no incident list is available. The casualty can be saved locally in the offline queue without an incident ID, with an optional temporary offline incident name. Records now marks those queued casualties as needing an incident, lets the user assign an active incident after reconnecting, and then retry sync.

## 36. Offline Sync Reported False Duplicate Record

**Problem:** A first-time offline casualty could save locally, but after assigning an incident and retrying sync online, the mobile app showed “A matching record already exists” even when the user did not see a matching casualty record. The message was too generic and could be triggered by the backend duplicate `id_number` guard, especially when a generated offline casualty ID collided with an existing generated ID.

**Solution:** Mobile error handling now preserves the specific casualty ID-number duplicate message instead of converting it to a generic matching-record message. Offline queue sync now detects duplicate generated casualty IDs and retries once with a safe `CAS-SYNC-*` ID. Manually entered ID numbers are not silently changed.

## 37. Healthcare Facilities Could Not Be Edited

**Problem:** Healthcare facilities could be created and imported from the web dashboard, but there was no row-level edit action like the one available in Account Management. Fixing facility names, levels, locations, contacts, or active status required database-level changes.

**Solution:** The web dashboard now shows an **Edit facility** button in the Healthcare Facilities table Actions column. It opens an in-app edit modal for facility profile, location, contact details, and active/inactive status. The API now supports a scoped healthcare facility update endpoint and records an audit log entry when a facility is edited.

## 38. Evacuation Center Section Removed From Dashboard

**Problem:** The web dashboard still exposed an Evacuation Centers management section even though the current workflow no longer needs that standalone section.

**Solution:** The Evacuation Centers navigation item, admin view route, and super admin evacuation center export shortcut were removed from the dashboard UI. The underlying API/data code was left in place so existing records are preserved and the feature can be restored later if needed.

## 39. Admin Incident History Did Not Launch Closed Incident Review

**Problem:** Incident History under Official Incidents did not clearly support reviewing all incidents created by the logged-in admin, and closed incidents had no direct row actions for reviewing casualty records or analytics.

**Solution:** Incident History now uses the all-incidents dataset for the logged-in admin, including active and closed incidents. Each history row now has **View records** and **View analytics** actions. View records opens Casualty Records scoped to that incident, while View analytics opens Incident Analytics with that incident selected, including closed incidents.

## 40. Responder Role Needed Separation Into FR And SAR

**Problem:** The old unit account model used a generic `responder` role for both Field Responder and SAR/Stabilization workflows, while the team now needs them separated in account management and mobile behavior.

**Solution:** The system now supports `field_responder`, `sa_responder`, and `documenter` as separated account roles. The web dashboard account creation and bulk import flow now creates FR, SAR, or HCFD accounts. Legacy `responder` accounts remain supported and editable so existing accounts and records are not broken. Mobile role logic now treats new FR/SAR roles as fixed assignments, while only legacy responder accounts can use the old responder-function selector. A root documentation file explains the transition.

## 41. New FR/SAR Account Creation Hit Old Backend Validation

**Problem:** Creating a new separated role account could show the old security message: `Admins can only create responder or documenter accounts.` This means the dashboard reached an API build from before the FR/SAR/HCFD separation.

**Solution:** The current API source accepts `field_responder`, `sa_responder`, and `documenter`. The web dashboard now converts that old backend message into a clearer deployment/runtime warning. The separation documentation was updated to explain that the database migration must be applied and the API must be restarted or redeployed; redeploying only the website is not enough.

## 42. Match Casing Needed Photo Clues Across All Roles

**Problem:** After separating FR, SAR, and HCFD into different account roles, each role can create a separate record for the same real-world casualty. Because the role forms collect different fields and victim codes may differ per user, future Match Casing needs visual/photo clues from all role submissions. Only one flow exposed the casualty photo control.

**Solution:** The mobile Add Casualty photo control is now available for all separated operational roles. Field Responder can attach a photo from the Status step, SAR keeps the existing photo attachment in Remarks, and HCFD can attach a photo from Disposition. The existing capture/import, offline queue, upload, and viewing logic is reused.

## 43. Separated Role Records Needed Admin Match Casing

**Problem:** FR, SAR, and HCFD now create separate role-specific casualty records. Without a matching layer, the same real-world casualty can appear as multiple partial records, and the web dashboard has no formal way to connect them.

**Solution:** A Match Casing workflow was added. The new `casualty_case_links` table stores links between existing casualty records without merging, deleting, or rewriting them. The API can list matched case links and create a complete locked matched case from one FR, one SAR, and one HCFD record. The admin dashboard now has a Match Casing section for creating matches and a separate Matched Cases section for reviewing completed matches.

## 44. Matched Case Link Was Not Visible From Record Details

**Problem:** After matching an FR record with an HCFD or SAR record, opening the FR record still showed only that one record's own fields. This made it look like Match Casing did not sync, even though the link existed in the Match Casing section.

**Solution:** The casualty record modal now includes a **Matched Case** section when the opened record belongs to a matched case. It lists the linked FR/SAR/HCFD records and provides an **Open matched record** button. The records remain separate; the modal now makes the link visible and verifiable.

## 45. Matched Role Records Did Not Fill Their Role Sections

**Problem:** Even after the matched case link became visible, opening an FR record matched to an HCFD or SAR record still left the HCFD/SAR sections empty because the modal rendered every role section from only the opened record.

**Solution:** The casualty record modal now loads full details for every linked record in the matched case. It uses the linked FR record for the Field Responder section, the linked SAR record for the Stabilization Area Responder section, and the linked HCFD record for the Healthcare Facility Documenter section. The records remain separate in the database, but the modal combines them for review.

## Priority Improvement Areas

These are the improvements that matter most based on the bugs encountered so far. They are ordered by risk to data privacy, data integrity, field usability, and presentation readiness.

### 1. Enforce Role Privacy In The Backend      

Frontend filtering is not enough. FR, SAR, HCFD/documenter, admin, and super admin visibility rules should be enforced by API queries and, where practical, database policies. Direct API requests from operational accounts should not be able to retrieve records outside their allowed role/account/admin scope.

**Why this matters:** This is the highest-risk remaining issue because it affects privacy and authorization, not just display.

### 2. Add Regression Tests For Critical Workflows

Add API and workflow tests for:

- Account creation, account editing, deletion/deactivation, and password changes.
- Casualty submit, edit, reject, resubmit, approve, and delete.
- Role-scoped casualty visibility for FR, SAR, HCFD/documenter, admin, and super admin.
- Attachment upload, retrieval, preview, export references, and deletion during reset.
- Bulk import validation for accounts, healthcare facilities, and evacuation centers.
- Incident Analytics calculations and per-incident scoping.
- Export permissions for incident packages, accounts, facilities, evacuation centers, and system backup.

**Why this matters:** Many previous bugs were regressions caused by one screen/API evolving separately from another. Tests should protect the workflows that are most likely to be checked during evaluation.

### 3. Complete Real-Device Offline Testing

Test the mobile app on an actual phone with:

- Airplane mode before opening Add Casualty.
- Airplane mode after the incident list has been cached.
- Weak or intermittent connection during casualty submission.
- Offline casualty submission with photo attachment.
- Retry one queued record.
- Retry all queued records.
- Login/session expiry while records are queued.

**Why this matters:** Offline behavior now exists in code, but it needs real-device proof because storage, camera files, cached incidents, and network failures behave differently outside the browser/dev environment.

### 4. Make Victim Code Generation Server-Safe

If Victim Codes become system-generated, generate them server-side or transactionally with a database-backed sequence. The final rule must prevent duplicate codes during simultaneous submissions while preserving the required operational scope.

**Why this matters:** Manual or client-only sequence generation can break under concurrency, especially in offline/retry flows.

### 5. Finish Successful Submission Notifications

Add a successful-submission notification after casualty creation succeeds. Store a typed payload with `event_type` and `casualty_id`, scope it to the submitting account, and make tapping the notification open the correct casualty detail screen.

**Why this matters:** Rejection notifications are useful, but responders also need confirmation that a submitted casualty exists and can be reopened.

### 6. Keep Add Casualty And Record Detail Views In Sync

Create a role-to-fields reference for FR, SAR, and HCFD/documenter, then use it to verify:

- Add Casualty form fields.
- Mobile record detail sections.
- Web dashboard casualty record sections.
- Verification Review record sections.
- Exported casualty fields.

**Why this matters:** Several bugs came from record views showing fields that did not match the role-specific Add Casualty workflow.

### 7. Strengthen Reference Data Usage

Use admin-managed reference lists consistently for:

- Receiving healthcare facilities.
- HCFD facility response/disruption facility selection.
- Evacuation centers.
- Incident selection, including cached incident support for offline use.

**Why this matters:** Stable IDs prevent spelling variants, broken analytics, and unreliable exports.

### 8. Improve Realtime Reliability Monitoring

Add visible fallback behavior when realtime updates do not arrive:

- Show last updated time on dashboard sections.
- Keep manual refresh buttons available.
- Log realtime subscription status and last event time.
- Consider periodic background refresh for analytics/audit sections if realtime is unavailable.

**Why this matters:** Realtime already worked after fixes, but it is easy for Supabase publication/RLS/channel settings to break silently.

### 9. Refactor High-Risk Large Files

Break down the largest files into smaller modules:

- `mobile/src/app/(tabs)/add-casualty.tsx`
- `website/app.js`
- `mobile/src/app/incidents.tsx`
- Large API controllers such as `incident.controller.ts` and `casualty.controller.ts`

**Why this matters:** These files are functional, but they are now difficult to safely change. Most future bugs will become harder to fix if the logic stays concentrated there.

### 10. Prepare A Presentation-Day QA Script

Create a short checklist for the exact demo flow:

- Login as super admin, admin, Field Responder, SAR, and HCFD/documenter.
- Create/manage accounts and reference data.
- Add casualty with attachment.
- Reject and resubmit casualty.
- Verify casualty.
- Show notification behavior.
- Show Incident Analytics.
- Export data.
- Demonstrate mobile browser/web responsiveness.
- Demonstrate offline queue and retry using cached incidents.

**Why this matters:** The system has many working parts. A rehearsed QA/demo script lowers the chance of discovering a setup issue during the presentation.

## 46. Match Casing Selection Needed Clearer Role Guardrails

**Problem:** Match Casing originally relied on small checkboxes, so it was easy to miss what was selected. It also did not clearly stop admins at selection time from choosing two records from the same role.

**Solution:** Match Casing was redesigned into a guided three-slot workflow. Admins now fill one Field Responder box, one SAR box, and one HCFD box using role-specific picker modals. Already selected and already matched records are removed from available picker options. The match button moved below the three boxes and is enabled only when all three slots are filled.

**Status:** Implemented.

## 47. Matched Cases Needed To Be Locked After Submission

**Problem:** The first Match Casing implementation supported unmatching, but the workflow requirement changed: once a case is matched, it should not be undone. The UI also mixed the creation workflow with already matched records.

**Solution:** Matched cases are now complete-case submissions requiring all three roles: Field Responder, SAR, and HCFD. The API rejects incomplete matches, rejects records already assigned to another matched case, and no longer deletes case links through the unmatch endpoint. Completed matches now appear in a separate Matched Cases section.

**Status:** Implemented.

## 48. Match Casing Navigation Buttons Needed Better Placement

**Problem:** The **View matched cases** and **Create match** buttons were in the page topbar, separated from the incident filter they relate to.

**Solution:** Both buttons were moved beside the incident dropdown in their respective filter panels.

**Status:** Implemented.

## 49. Progress Submission Documentation Needed

**Problem:** The project needed formal progress-submission documents separate from development notes, bug logs, and architecture scratch files.

**Solution:** Created `TECHNICAL_DOCUMENTATION.md` and `USER_MANUAL.md` at the project root. The documents summarize the current architecture, roles, workflows, deployment shape, local setup, web dashboard usage, mobile/PWA usage, Match Casing, offline behavior, exports, audit logs, and troubleshooting.

**Status:** Implemented.

## 50. Action Logs Needed Broader Cross-Device Coverage

**Problem:** Action Logs needed to reflect more than account-only activity. Admin actions such as incident creation, healthcare facility changes, record verification/rejection/deletion, Match Casing, attachment upload, and casualty submissions from mobile users needed to be visible to the correct admin scope.

**Solution:** Audit logging now covers major web and mobile workflows, including casualty creation, verification, rejection, deletion, case matching, incident changes, healthcare facility creation/edit/import, attachment upload, resets, imports, account changes, and web draft actions. Admin scope is resolved through the actor and the admin who created responder/documenter accounts, so mobile submissions appear in the creator admin's Action Logs.

**Status:** Implemented.

## 51. Add Forms Needed Save Draft Support

**Problem:** Users could lose progress when filling longer add forms, especially incident, healthcare facility, and mobile casualty workflows. There was also no Drafts folder for unfinished forms.

**Solution:** A `form_drafts` backend table and `/api/drafts` routes were added for web dashboard drafts. The dashboard now has a Drafts section, and Account Creation, Incident, and Healthcare Facility forms have Save Draft and Open Drafts controls. Temporary passwords are not stored in account drafts. After a draft is saved, the active form is cleared so the user can start another entry. The mobile Add Casualty flow now supports local device drafts through AsyncStorage with a Drafts tab, resume, update, delete, and post-save form clearing.

**Status:** Implemented.

## 52. Admin Unit Scope Button Opened Wrong Menu

**Problem:** In the admin unit scope card, the **Reported incident history** button opened the Official Incidents form/history section instead of the Incident Analytics section.

**Solution:** The button target was changed from `incidents` to `incident-analytics`, and the helper text now says it opens incident analytics for records within the admin unit.

**Status:** Implemented.

## 53. Incident Analytics Missing KPI And HCFD Tertiary Charts

**Problem:** After selecting an incident in Incident Analytics, some KPI values and the **Victims Seeking ED Care According to Triage Category** pie chart could show no data even when HCFD entries existed. The analytics query did not include `assessment_answers`, so tertiary systems that saved the visible final triage there were not being counted. The cumulative timeline also still used 1-minute, 5-minute, and 10-minute marks.

**Solution:** Incident Analytics now selects `assessment_answers`, normalizes tertiary `finalTriage` values, and uses the latest HCFD/facility-arrival triage when building ED-care and facility KPI metrics. Cumulative intervals were changed to 15 minutes, 30 minutes, 1 hour, 2 hours, and 3 hours, and the frontend line chart filters out old 1-minute, 5-minute, and 10-minute points even if an older API response is still cached. New separate tertiary-system pie charts were added for ESI, METTS, and ED Triage; if a specific tertiary system has no HCFD entries, its chart shows the no-data state. Pie chart cards were widened and the legend layout was tightened so chart labels and counts no longer crowd the card.

**Status:** Implemented.

## 54. Casualty Records Needed Explicit Admin Filters

**Problem:** The web dashboard Casualty Records page did not have a dedicated filter button and could not filter records by account type or sort submitted records ascending/descending by submitted time.

**Solution:** Added account-type filtering for Field Responder, SAR, HCFD, and legacy responder records. Added a submitted-time sort control for newest-first or oldest-first ordering. Added **Filter Records** and **Clear Filters** buttons so admins can set filter choices first and then apply them intentionally.

**Status:** Implemented.

## 55. Incident Management And DMMP Call Down Needed Clearer Workflow

**Problem:** Incident Management was difficult to navigate because important sections were not ordered by the expected workflow, DMMP Staff Call Down depended on incident-specific entries instead of a reusable staff list, analytics cards still showed a **View Responders** action, and closing incidents was too rigid for real operations.

**Solution:** Reordered Incident Management sections so **Edit Incident** appears first with a distinct color, followed by Response Timeline, DMMP Staff Call Down, Responder Safety, Coordination Assessment, Deactivation & Continuity, and the remaining summary sections. Added a separate **Call Down List** admin tab for extra staff contacts who do not have login accounts. Admin-created system accounts are automatically included in each incident's DMMP Staff Call Down roster, while Call Down List entries add non-account staff. DMMP Staff Call Down lets admins mark contacted, arrived, status, and arrival time while retaining reporting percentage and showing the time of arrival of the last contacted person. Removed the analytics **View Responders** button. Incident closing now warns about missing key details but allows the admin to proceed. Closed incidents can receive admin reopen requests, and super admins can approve those requests.

**Status:** Implemented.

## 56. Responder Safety Needed To Become A Read-Only Summary

**Problem:** The Incident Management **Responder Safety** section was editable and repeated operational fields such as safety action established, PPE decision, and response deactivated. The requested workflow treats responder safety as a summary, with statuses coming from responder/call-down records and analytics.

**Solution:** The Incident Management **Responder Safety** section is now view-summary-only. The edit action was removed for that section. The displayed summary no longer shows safety action established, PPE decision, or response deactivated fields. It now shows responder/staff safety counts from the DMMP Staff Call-down roster and also displays the safe/unsafe responder counts used by Incident Analytics.

**Status:** Implemented.

## 57. SitRep PDF Export Was Hard To Read

**Problem:** Downloaded SitRep PDFs were difficult to understand because the export used a simple text dump layout with weak section hierarchy, limited spacing, and chart content appended in a raw format.

**Solution:** The SitRep PDF generator was redesigned with a clearer report layout: branded header, report metadata cards, executive summary, operational snapshot cards, structured tables for responder coverage, casualties, triage, transport, and facilities, plus a visual summary section with cleaner horizontal bar charts. The content now reads like an operational situation report rather than raw exported text.

**Status:** Implemented.

## 58. Admin Sidebar Became Too Long

**Problem:** The admin dashboard sidebar had too many flat menu items, making it visually long and harder to scan as new features were added.

**Solution:** The sidebar navigation was reorganized into expandable workspace groups: Overview, Incidents, Casualties, Resources, Administration, and Reports & Logs. Active groups open automatically, menu highlighting is preserved, collapsed sidebar behavior still works, and the mobile browser layout remains horizontally scrollable.

**Status:** Implemented.

## 59. SitRep Was Role-Scoped Instead Of Incident-Wide

**Problem:** Generated SitRep exports were still tied to a Field Responder/SAR responder-function scope, so the report could represent only one role or a limited role pair instead of the whole selected incident. The PDF also looked too much like a raw data export instead of a professional situation report.

**Solution:** SitRep generation now always creates an incident-wide report for the selected incident and includes FR, SAR, and HCFD/documenter records together. The responder-scope dropdown was removed from the web dashboard. Latest SitRep export now retrieves the incident-level report, with compatibility for older saved reports. PDF labels and layout were updated to read as an incident situation report, including role coverage for Field Responder, SAR, Healthcare Facility Documenter, and unspecified records.

**Status:** Implemented.

## 60. SitRep Location Text And Analytics Snapshot Needed Fixes

**Problem:** Long incident locations in the SitRep PDF overlapped inside the report metadata card because wrapped lines were drawn on top of each other. The SitRep panel also needed to make the selected incident obvious, and the report needed data from Incident Analytics instead of only basic record counts.

**Solution:** The PDF metadata card renderer now gives each wrapped value line its own vertical position and grows the card height for long values. The web SitRep panel now displays the selected incident before generation and shows an error if no incident is selected. SitRep payloads now include an analytics snapshot with KPI counts, primary/secondary/facility triage distributions, ED-care by triage category, stabilization strategies, responder safety, and the updated 15 min, 30 min, 1 hr, 2 hr, and 3 hr cumulative intervals.

**Status:** Implemented.

## 61. Bulk Upload Needed A Clear Success Popup

**Problem:** After confirming CSV/Excel bulk imports, the dashboard only updated the inline status area. Users could miss whether the upload finished successfully, especially after importing accounts or healthcare facilities.

**Solution:** The shared bulk import flow now shows a modal popup titled **Successful upload** after the backend import completes. The popup summarizes rows processed, created, skipped, and failed for admin accounts, FR/SAR/HCFD accounts, healthcare facilities, and evacuation centers.

**Status:** Implemented.

## 62. Bulk Upload Showed Generic Error Even When Rows Were Created

**Problem:** Bulk account and healthcare facility imports could create records successfully but still show a generic “something went wrong” style message when some rows were skipped, duplicated, or invalid.

**Solution:** Completed bulk imports now use a success or warning status instead of an error status. The inline message keeps the detailed created/skipped/failed summary, while the successful upload modal still appears after the import finishes.

**Status:** Implemented.

## 63. Bulk Account Import Returned 500 After Creating The Account

**Problem:** Unit account bulk import could create the account successfully, but the API still returned a 500 error afterward. After refresh, the account appeared in the list, showing the failure happened after record creation.

**Solution:** Bulk import audit logging is now guarded for admin account imports, unit account imports, healthcare facility imports, and evacuation center imports. Bulk audit summary rows now provide an `entity_id` so deployments where `audit_logs.entity_id` is required do not fail after creating records. If audit logging still fails after rows are created, the API returns the completed import summary instead of failing the whole request.

**Status:** Implemented.

## 64. Incomplete Bulk Unit Account Rows Were Still Created

**Problem:** FR/SAR/HCFD account CSV rows with blank columns after `role`, such as missing phone number, assigned municipality, or assigned barangay, were still treated as valid and created accounts.

**Solution:** Bulk unit account preview and backend validation now require `phoneNumber`, `assignedMunicipality`, and `assignedBarangay`. Rows missing those fields are marked invalid and are not sent to Supabase Auth for account creation.

**Status:** Implemented.

## 65. Incident History Needed Status Filtering

**Problem:** Incident History did not have a direct status filter, making it harder for admins to separate active, closed, draft, and archived incidents while reviewing historical incident records.

**Solution:** Added a status dropdown to the shared incident filter controls. Incident History and Incident Management now display all loaded incident records by default and can be filtered by all statuses, active, closed, draft, or archived.

**Status:** Implemented.

## 66. Client Source Exposed Hardcoded Runtime Keys

**Problem:** The web dashboard had Supabase Realtime runtime values hardcoded near the top of `website/app.js`, and `mobile/.env` was tracked with an `EXPO_PUBLIC_TEST_USER_ID`. Even publishable keys and public Expo variables can be viewed from browser/mobile bundles, which can be flagged during security or penetration testing.

**Solution:** Removed hardcoded Supabase Realtime values and deployment API URLs from `website/app.js`. The dashboard now loads `website/config.js` before `app.js` and reads runtime values from `window.DCMS_CONFIG`, with `website/config.example.js` kept as the safe template. Added ignored runtime config/env patterns, created `mobile/.env.example`, removed the mobile test user variable, and removed `mobile/.env` from Git tracking while keeping it locally available.

**Status:** Implemented.

## 67. Deployed Mobile Login Called An API URL With An Encoded Quote

**Problem:** After PWA deployment, login failed with `API route not found` because the request URL included `%22` after `/api`, meaning the deployed `EXPO_PUBLIC_API_URL` value contained an accidental double quote.

**Solution:** The mobile API client now trims whitespace, strips wrapping single/double quotes, and removes trailing slashes from `EXPO_PUBLIC_API_URL` before creating the Axios client. The PWA deployment notes were also updated to show the correct production env format and warn not to wrap the URL in quotes.

**Status:** Implemented.

## 68. Mobile Save Draft Had No Visible Confirmation

**Problem:** In the mobile/PWA Add Casualty form, tapping **Save Draft** saved the local draft but did not show a clear confirmation like the web dashboard. The previous native alert behavior could be easy to miss or unreliable in the web/PWA runtime.

**Solution:** Mobile Add Casualty now uses the existing in-app feedback modal after saving a draft. The form still clears after the draft is saved, and the modal tells the user to open Drafts to continue later.

**Status:** Implemented.

## 69. SAR Info Fields Appeared Before Patient Identification Choice

**Problem:** In the SAR Add Casualty **Info** step, typing a victim code caused the patient identification selector and personal detail fields to appear together. Age, name, sex, birth date, and other personal details were visible before the user selected whether the patient was identified.

**Solution:** The SAR Info step now always shows only Victim Code, Patient Identified, and ID Number by default. Personal detail fields appear only when **Patient Identified?** is set to **Yes**. If **No** is selected, the personal detail fields remain hidden and previous personal detail values are cleared.

**Status:** Implemented.

## 70. Mobile Summary Cards Looked Equally Clickable

**Problem:** On the mobile home dashboard, the Active Incidents, Encoded Today, Verified Records, and Pending Review summary cards looked similar, even though only Active Incidents should behave like a navigation action.

**Solution:** The Active Incidents summary card now has a distinct clickable treatment with a maroon outline and an Open affordance. Encoded Today, Verified Records, and Pending Review remain display-only metric cards.

**Status:** Implemented.

## 71. Mobile Add Casualty And Records Needed Workflow Cleanup

**Problem:** Several mobile workflows were confusing: the SAR treatment field still said **Fill in Patient Care Report**, triage still asked for a triage location, Records did not make pending transport easy to identify, record cards showed vague unlabeled values such as location unavailable, the mobile home quick action still sent users to a separate Verification Review page, and tapping the already-selected incident could temporarily unlock responder safety.

**Solution:** Updated the SAR PCR prompt to **Add photo of your currently used PCR**, removed the triage location input from Add Casualty, renamed the mobile quick action to **Records Review** and routed it to Records, added incident and transport-status filters to Records, replaced the primary location row with transport status, added explicit ID Number and Age labels on record cards, removed the casualty detail **Status Timeline** card, and prevented the selected incident action from clearing a saved responder safety lock.

**Status:** Implemented.

## 72. Mobile UAT Refinements For Action Logs, Victim Codes, And Detail Labels

**Problem:** Action logs were overwhelming without date filtering, mobile responder action logs could show the current assignment instead of the role that encoded the record, the Add Casualty incident search prompt told responders to create incidents even though they cannot, FR victim codes still created mental load, and casualty detail/notification views used vague values such as Unknown, time-only last updated text, and internal casualty IDs.

**Solution:** Added newest-first action-log filtering by date on the web dashboard and mobile app, changed mobile synced casualty logs to display the record encoder role, revised the Add Casualty incident empty-state prompt to tell responders to refer to the incident commander, made FR victim code auto-generated and read-only, replaced the FR triage-stage dropdown with a fixed Primary Triage display, added Primary to the sticky Add Casualty header for FR, changed mobile verification filters to Submitted/Approved/Rejected/All, updated casualty detail headers to show the triage category badge, full last-updated date/time, responder-facing casualty ID, and FR-specific detail text that does not show sex/age/birth date placeholders.

**Status:** Implemented.

## 73. Mobile Refresh Data Needed Visible Sync Feedback

**Problem:** The mobile dashboard **Refresh Data** quick action could be tapped, but users did not get a clear in-app signal that syncing was running or completed, especially in the PWA build where native alerts are less consistent.

**Solution:** The Refresh Data quick action now disables itself and shows a spinner with **Refreshing... / Syncing data** while the refresh runs. When the refresh finishes, the dashboard shows an in-app completion modal for successful syncs, partial sync warnings, or up-to-date/no-queued-record states.

**Status:** Implemented.

## 74. Field Responder Triage Stage Needed A Simple Option Button

**Problem:** The Field Responder Add Casualty triage stage control was either a dropdown or a fixed read-only field, which did not match the requested Yes/No option-button interaction for choosing Primary or Secondary Triage.

**Solution:** Replaced the Field Responder triage stage field with a two-option segmented control. **Yes** saves `Primary Triage`, and **No** saves `Secondary Triage`. The Field Responder flow now allows both stages, and the sticky casualty header updates to show the selected stage.

**Status:** Implemented.

## 75. Records Triage Filters Needed Category Colors

**Problem:** Field Responder record filters were revised to Immediate, Delayed, Minor, and Expectant, but the filter controls did not visually reflect each triage category color.

**Solution:** Added category-colored filter buttons for Field Responder triage filters. Immediate uses red, Delayed uses orange, Minor uses green, and Expectant uses gray. Selected filters now invert to a filled category color so active filters are easier to scan.

**Status:** Implemented.

## 76. Project Flowchart And DFD Documentation Needed For Submission

**Problem:** The project needed a submission-ready documentation file showing the system flowchart, web dashboard flow, mobile/PWA flow, DFDs, database/storage relationships, match casing flow, and offline sync flow.

**Solution:** Added `PROJECT_FLOWCHART_AND_DFD.md` at the project root. It contains Mermaid diagrams for the full DCMS architecture, web dashboard flow, mobile/PWA flow, DFD Level 0, DFD Level 1 for web and mobile, database/storage data flow, casualty submission/verification sequence, match casing flow, offline sync, deployment view, and a data-store summary table. Also added `PROJECT_FLOWCHART_AND_DFD_PRINT.html` as a single browser-printable file so all flowchart and DFD diagrams can be rendered together and exported to PDF without pasting each chart one by one.

**Status:** Implemented.

## 77. System Architecture And Database Schema Mermaid Documentation Needed

**Problem:** The project needed a separate technical documentation file for system architecture and database schema diagrams that can be rendered with Mermaid.

**Solution:** Added `SYSTEM_ARCHITECTURE_AND_DATABASE_SCHEMA.md` at the project root. It includes Mermaid diagrams for system architecture, deployment architecture, backend API modules, client architecture, database schema overview, core identity/incident tables, casualty records, triage/transport/treatment/HCFD records, match casing, incident operations, logs/notifications/drafts/reporting, role-based access, and offline data architecture. Also added `SYSTEM_ARCHITECTURE_AND_DATABASE_SCHEMA_PRINT.html` as a single browser-printable file so all diagrams can be rendered together and exported to PDF without pasting each Mermaid chart one by one.

**Status:** Implemented.

## 78. Edited Legacy Responder Still Asked For Responder Function

**Problem:** After a legacy responder account was edited in the database to `field_responder` or `sa_responder`, the mobile Add Casualty screen could still show **Please Select Responder Function**. This happened because the mobile app was reading the locally cached login profile, which could still contain the old `responder` role.

**Solution:** Add Casualty now refreshes the current user profile from the API when the screen loads and saves the fresh profile back into local session storage. If the refreshed role is `field_responder` or `sa_responder`, the screen automatically uses the matching responder function and skips the legacy function-selection requirement.

**Status:** Implemented.

## 79. Profile Page Still Showed Responder Function Selection

**Problem:** The mobile Profile page still showed the old responder function selection UI even though responder accounts are now separated into `field_responder` and `sa_responder` roles.

**Solution:** Removed the responder function selection UI and its unused styles from the mobile Profile page. The page now only displays the assigned account role, while Add Casualty uses the separated role from the current profile.

**Status:** Implemented.

## 80. HCFD Dashboard Active Incidents Card Did Not Look Clickable

**Problem:** On the mobile home dashboard, responder accounts saw the **Active Incidents** summary card with clickable styling and an **Open** affordance, but HCFD/documenter accounts saw the same card as a display-only metric.

**Solution:** Updated the dashboard role logic so `documenter` and legacy `medical_personnel` accounts are also allowed to open the Active Incidents card. HCFD accounts now get the same clickable visual treatment as responder accounts.

**Status:** Implemented.

## 81. HCFD Add Casualty Flow Needed Simpler Patient And Disposition Handling

**Problem:** The HCFD Add Casualty flow repeated hospital admission/discharge fields in Triage, used confusing labels such as **Arrival Time**, **Active Care**, **ED Admission**, and **ED Discharge**, showed too many fields in Disposition, and allowed too many tabs to remain editable when editing an already submitted HCFD record.

**Solution:** Added an HCFD sticky patient-name header, renamed **Arrival Time** to **Time of Arrival of Victim**, changed **Active Care** wording to **Admitted to ED**, changed ED admission/discharge picker titles to **Admitted to Hospital?** and **Discharged from Hospital?**, added **Patient Identified?** at the top of the HCFD Patient tab, hid name and DOB fields when the patient is unidentified while keeping Sex available, removed the repeated hospital admission/discharge controls from Triage, simplified Disposition to **Discharged from Hospital?** plus discharge time when applicable and the victim photo attachment, and locked General, Patient Information, and Triage during HCFD edit mode so only Management and Disposition remain editable.

**Status:** Implemented.

## 82. Assisted Tertiary Triage Results Did Not Match Reference Flow

**Problem:** Some assisted tertiary triage results did not align with the entered assessment data, especially for NATO, MASS, ESI, and METTS.

**Solution:** Updated the tertiary assisted triage questions and calculation logic to better follow the provided reference flow. NATO now follows the green/red/yellow/black decision order from the reference. MASS now includes the initial walk/wave movement sorting before assessment and sorting. ESI now includes the danger-zone vital signs branch for multiple-resource cases. METTS now includes the restricted-care Blue category and requires no oxygen support for the all-normal Green result.

**Status:** Implemented.

## 83. HCFD Record Detail Did Not Allow Management And Disposition Editing

**Problem:** In the mobile Records detail view, submitted HCFD records still showed Management and Disposition as read-only even though only those two sections should remain editable after submission. The record header also showed two separate **Verified** badges.

**Solution:** Added focused **Edit** buttons to the HCFD Management and Disposition detail cards. These buttons reuse the Add Casualty edit flow and open the correct tab directly while the existing HCFD edit lock keeps General, Patient Information, and Triage read-only. Removed the duplicate boolean verified badge so the detail header only shows the review-status badge once.

**Status:** Implemented.

## 84. HCFD Records ESI Filters Did Not Match Saved Triage Values

**Problem:** In the mobile Records page, Healthcare Facility Documenter ESI filters such as **ESI 1** through **ESI 5** did not filter correctly even though other filters worked. The filter only checked one saved field and expected one exact value format.

**Solution:** Updated the HCFD Records ESI filter matching to normalize saved triage values and check `finalTriage`, possible ESI answer keys, `triage_category`, `calculated_category`, and `responder_category`. The filter now accepts saved formats such as `esi_1`, `ESI 1`, `esi1`, and ESI level numbers when the triage system is ESI/ED triage.

**Status:** Implemented.

## 85. Mobile Record Detail Verification Badge Needed Admin Decision Wording

**Problem:** After removing the duplicate **Verified** badge, the remaining badge represented the review status but still used a generic status formatter. Depending on the backend value, it could display inconsistent wording instead of clearly showing the admin decision.

**Solution:** Added a dedicated verification-status formatter for the mobile casualty detail badge. Admin-approved values such as `verified`, `accepted`, and `approved` now display as **Verified**, rejected records display as **Rejected**, and pending states display as **Submitted** or **Under Review**.

**Status:** Implemented.

## 86. Web Incident Timeline Needed First Facility Disaster Response Activation

**Problem:** The web Incident Analytics timeline did not show when the first healthcare facility activated its disaster response, even though HCFD entries can record a facility disaster plan activation time.

**Solution:** Updated the incident analytics backend to include `treatment_details` from HCFD treatment records, extract valid `disasterPlanActivationTime` values, and add the earliest one to `timelineVisuals` as **First healthcare facility to activate its disaster response**. The existing web timeline renderer will display the new event automatically.

**Status:** Implemented.

## 87. Web Incident Management Summary Card Labels Had No Spacing

**Problem:** Incident Management summary modals such as **Onsite Care**, **Scene Clearance**, **Survivor Distribution**, and **ED Resources** displayed raw object keys as card titles. Labels like `totalSurvivors` and `responseInitiatedAt` appeared as cramped uppercase text such as **TOTALSURVIVORS**.

**Solution:** Added a dedicated summary fact label formatter in the web dashboard. Known incident summary fields now use readable labels, nested metric paths are formatted with separators, camelCase keys are split into words, common acronyms such as EMS/ED/DMMP are preserved, and date-like values are displayed with the existing dashboard date formatter.

**Status:** Implemented.

## 88. DMMP Staff Call-down Needed Responder Safety Status Integration

**Problem:** The DMMP Staff Call-down status dropdown still included old Ill/Injured options, while responder Safe/Unsafe answers from the mobile responder safety flow were stored separately and were not shown as editable call-down status values. Arrival time also required manual date/time entry.

**Solution:** Limited DMMP Staff Call-down status values to Safe, Unsafe, and Deceased, while keeping a blank Not recorded placeholder for empty records. Linked system-account call-down rows now merge Safe/Unsafe values from `responder_safety_responses`; safety-only mobile responses appear in the call-down roster even before a DMMP row exists. Saving Safe/Unsafe from DMMP Call-down syncs back to responder safety so Incident Analytics remains aligned. Added a **Use current arrival time** button per row that fills the current date/time and marks the staff member as arrived.

**Status:** Implemented.

## 89. Field Responder Triage Badge Showed Minimal Instead of Minor

**Problem:** Field Responder casualty records displayed the green/minor triage category as **Minimal** in the rounded triage badge and related triage detail labels.

**Solution:** Added mobile triage-specific display formatting so stored `minimal` category values continue to work internally while user-facing triage labels show **Minor**. The Add Casualty assessment summary now uses the same display wording.

**Status:** Implemented.

## 90. Field Responder Primary Triage Systems Were Hidden And Some Assisted Results Were Wrong

**Problem:** Field Responder Add Casualty only exposed STIEVE and START even though the primary triage flow includes additional systems. Some assisted-calculation results also did not match the provided primary triage references, such as mSTART walking patients being marked Minor instead of Delayed.

**Solution:** Unhid the supported primary triage systems for Field Responder accounts: STIEVE, START, mSTART, JumpSTART, SIEVE, Care Flight, SALT, PTT, MITT, Homebush, and MPTT. Updated mobile and API assisted-calculation rules for primary triage flows, including mSTART walking patients, SIEVE airway handling, Care Flight command/radial-pulse branching, SALT individual assessment, PTT pediatric thresholds, MITT/MPTT age and heart-rate handling, and Homebush-specific classification.

**Status:** Implemented.

## 91. Secondary Triage Needed More Systems And Manual Fallbacks

**Problem:** SAR secondary triage only exposed SORT, while the secondary triage reference also included SAVE and META. Some listed systems, such as SwiFT, SMART, and Other, did not have configured assessment forms, causing the app to block assessment instead of letting responders encode a final triage manually.

**Solution:** Unhid the secondary triage systems for SAR accounts. SAVE, SORT, and META remain assisted systems, with SORT upgraded to collect Eye, Verbal, and Motor GCS components and calculate the SORT score from GCS, respiratory rate, and systolic blood pressure. SwiFT, SMART, and Other now open a manual final-triage assessment with explanatory messaging instead of pretending to calculate a result. Mobile and API triage calculation logic were aligned, and API tests were added for SORT component scoring and manual final-triage mapping.

**Status:** Implemented.

## 92. Closed Incidents Still Allowed Incident Management Edits

**Problem:** After closing an incident from the web dashboard, editable Incident Management sections such as Response Timeline could still be opened in edit mode and saved.

**Solution:** Closed and archived incidents now render Incident Management sections as view-only. Editable section launchers show a locked-after-closure subtitle, section modals display a view-only warning, Edit/Save buttons are hidden, and submit/edit handlers block stale attempts to modify locked incidents.

**Status:** Implemented.

## 93. Match Casing Required HCFD Even When Only FR And AMP Should Be Mandatory

**Problem:** Web Match Casing and the API both required exactly three role records: Field Responder, Advanced Medical Responder, and HCFD. This blocked completing a matched victim case when the required FR and AMP records existed but no HCFD record was available yet.

**Solution:** Updated Match Casing so Field Responder and Advanced Medical Responder are the only required slots. HCFD now appears as an optional slot in the web dashboard, and the API accepts either a two-record FR+AMP match or a three-record FR+AMP+HCFD match while still rejecting duplicate roles and unsupported record roles.

**Status:** Implemented.

## 94. FR Victim Codes Did Not Advance Per Incident And Offline Sync Needed Safe Correction

**Problem:** Field Responder victim codes were generated from a global/date-based sequence and could stay on the same value after submission. Offline queued records could later collide with synced records for the same incident.

**Solution:** FR victim codes now use the logged-in responder initials plus the synced victim count for that same responder code within the selected incident, so each responder has an independent sequence per incident. The API sequence endpoint supports incident-and-user-code based counts, and duplicate ID checks are scoped to the incident. Offline queue sync now detects when a queued code is behind that same responder-code sequence, asks for confirmation, then updates both the visible victim code and internal ID number before syncing.

**Status:** Implemented.

## 95. SitRep Needed Triage Comparison And Operational Charts

**Problem:** SitRep and Incident Analytics did not fully show the requested primary/secondary over-triage and under-triage comparisons, transition breakdowns, and operational line graphs. Triage percentages also needed a consistent denominator based on all recorded victims.

**Solution:** Added analytics-backed over/under/correct triage summaries, primary and secondary triage breakdowns, transition examples such as `Immediate -> Delayed`, and operational line-graph series. Percentages use all recorded victims as the denominator, while unassisted triage comparisons are kept separate from assisted assessments.

**Status:** Implemented.

## 96. Empty Incident Analytics Charts Were Misleading

**Problem:** Pie charts and line graphs were still displayed when their datasets contained no meaningful values, leaving blank chart areas that looked like missing or broken analytics.

**Solution:** Web Incident Analytics and SitRep PDF generation now render a pie chart only when at least one category has data and render a line graph only when at least one series contains data points. Empty chart datasets are omitted instead of shown as empty visuals.

**Status:** Implemented.

## 97. SitRep File Names And Download Actions Needed Standardization

**Problem:** SitRep downloads did not consistently follow the required naming convention, and the SitRep action labels did not clearly distinguish draft generation from final generation. Empty line-graph series could also leave misleading chart color/legend output.

**Solution:** SitRep files now use `SITREP-[office name]-[incident name]-[date].[extension]` on web and mobile, with filename segments sanitized for safe downloads and the date taken from the generation/download operation. The SitRep and Close Incident actions were renamed to **Generate Final Incident SitRep** and **Download Incident SitRep Draft**, and chart series are filtered before rendering so zero-count series do not leave misleading legends. The final report remains gated until the incident is closed.

**Status:** Implemented.

## 98. Admitted-To-Unit Choices Were Not Consistent Across Casualty Workflows

**Problem:** Hospital admission details did not consistently preserve the selected unit, and users needed clear choices for ICU, Ward, another unit, not admitted, or unknown.

**Solution:** Added the admitted-unit choices **ICU**, **Ward**, **Other Unit**, **Not Admitted**, and **Unknown**. The selected unit, admission time, and related hospital-arrival values are carried through the casualty payload and shown in casualty detail views.

**Status:** Implemented.

## 99. Theme Mode Needed Professional Colors And Device Synchronization

**Problem:** Dark mode used inconsistent gray, white, and accent combinations across mobile and web. Some screens stayed light, and manually selected mode did not automatically follow the device color scheme.

**Solution:** Reworked the light/dark palettes around neutral surfaces, readable primary text, restrained teal accents, and clear warning colors. Mobile and web now default to the device/system color scheme, listen for system theme changes, and still allow an explicit Light or Dark override. Theme controls use clear sun/moon icons and are positioned beside the logged-in account area in the web dashboard.

**Status:** Implemented.

## 100. Dark-Mode Login Fields Had Autofill, Icon, And Corner-Overlap Defects

**Problem:** Login fields could remain pale blue or white in dark mode because of browser autofill. The email and password icons were not centered, their icon panels were square against rounded fields, and placeholder/value contrast was inconsistent in both themes.

**Solution:** Added theme-aware autofill styling, corrected icon alignment, matched the icon panel clipping to the field radius, and standardized placeholder and input colors for light and dark mode. The login field controls now remain visually contained inside their rounded borders.

**Status:** Implemented.

## 101. Dashboard And Analytics Visual Hierarchy Needed Stronger Separation

**Problem:** Web sidebar controls were oversized, analytics overview blocks were difficult to distinguish, and dashboard summary-card titles such as **Active Incidents**, **Encoded Today**, **Verified Records**, and **Pending Review** were too faint compared with their captions.

**Solution:** Reduced sidebar navigation button sizing, strengthened analytics divider lines in both themes, and updated mobile summary-card titles to use the theme-aware primary text color with stronger font weight while keeping descriptions visually secondary.

**Status:** Implemented.

## 102. Minor Incident Documenter Needed A Dedicated Account Flow

**Problem:** The system only had the existing AMP responder account behavior, but the revised workflow needed a separate **Minor Incident Documenter** account while AMP Responder uses a shorter capture flow.

**Solution:** Added the `minor_incident_documenter` role to the database enum migration, API permissions, account-management screens, exports, analytics, and mobile role handling. Minor Incident Documenter retains the full AMP-style flow. AMP Responder now uses **Safety -> Triage -> Treatment -> Transport -> Remarks**, with Victim Code and generated ID Number at the top of Triage and automatic Secondary Triage handling. The existing role privacy and scoped-data rules were extended to the new account type.

**Status:** Implemented.

## 103. Triage Mode Needed To Be Configured Per Official Incident

**Problem:** Responders could switch between Assisted and Unassisted triage while encoding a casualty, even though the triage workflow should be consistent for everyone working under the same official incident.

**Solution:** Official incident creation now requires an incident-level triage mode selection. Mobile casualty workflows read that setting, display the configured mode as locked, and clear incompatible assessment answers when the incident changes. The API validates the submitted triage mode during casualty creation, triage assessment creation, and casualty updates. Manual-only systems such as SWIFT, SMART, and Other retain their manual Final Triage choices even when the incident mode is Assisted because no automatic calculator exists for those systems. Existing incidents remain compatible through the default Assisted setting.

**Status:** Implemented. The database migration `api/sql/add-incident-triage-mode.sql` must be applied before using the new incident field.

## 104. Scooter And Play And Run Were Duplicate Treatment Choices

**Problem:** On-site treatment workflows exposed both **Scooter** and **Play and Run**, even though they were requested to be represented as one treatment strategy.

**Solution:** New mobile treatment selections, automatic treatment mapping, mobile detail views, incident summaries, and web analytics now use **Scooter** only. Legacy `play_and_run` values are normalized to `scooter` when received or displayed. The migration `api/sql/merge-play-and-run-into-scooter.sql` converts existing database rows and removes the legacy value from the treatment constraint.

**Status:** Implemented.

## 105. Field Responder Treatment Label Needed Load-And-Go Wording

**Problem:** The Field Responder treatment workflow displayed the shorter **Scoop and Run** label, while the required operational term is **Scoop and Run/Load and Go**.

**Solution:** Updated mobile treatment choices, automatic treatment labels, casualty details, incident summaries, and web analytics labels. The internal `scoop_and_run` value remains unchanged for database compatibility.

**Status:** Implemented.

## 106. Incident Ownership Needed A Temporary Acting IC Workflow

**Problem:** The system has one permanent admin per unit, but an incident can continue for multiple shifts. A permanent ownership transfer or a second admin account would create unclear unit scope, make return-to-duty handling difficult, and risk leaving the original owner with inappropriate management access during an active handover.

**Solution:** Added incident-specific Acting Incident Commander delegation. The original `incidents.created_by` value remains the permanent owner and unit-scope anchor. The primary admin can designate one or more active unit users as backup ICs, delegate control to a selected backup with a required reason, and later resume primary ownership. While delegation is active, the primary owner's incident-management writes are blocked and the Acting IC receives incident-level management access. Responders remain in their existing unit scope and can continue encoding victims. Delegation and resume actions are recorded in the audit log, and delegation history remains available for accountability.

The database migration is `api/sql/add-incident-acting-ic-delegation.sql`. Apply it in Supabase before using the Acting IC controls.

**Status:** Implemented.

## 107. Acting IC Needed A Restricted Web Workspace And Mobile Notification

**Problem:** A primary IC could designate a unit user as Acting IC, but responder accounts normally use the mobile app and were not given a safe web entry point. The designated user also needed a clear notification that incident control had been assigned to them.

**Solution:** Added a current Acting IC assignment endpoint and a restricted desktop login path. A unit user can sign in to the web only while an active Acting IC assignment exists, and is routed to the **Acting IC Workspace**. That workspace shows only assigned incidents and incident-level management controls; it does not grant admin navigation, account administration, facility management, or unit-wide ownership powers. Ordinary unit users without an active assignment remain on the mobile workflow. Delegation now also creates a user-specific `incident` notification addressed to the selected Acting IC, using the existing mobile Notifications screen and unread-count behavior.

**Status:** Implemented.

## 108. Acting IC Workspace Needed Incident Analytics

**Problem:** Acting IC users could manage their delegated incident from the web but had no Incident Analytics view for monitoring operational progress.

**Solution:** Added Incident Analytics to the Acting IC workspace. The view is read-only, hides the cross-incident selector, and displays only the incident with an active Acting IC delegation for the signed-in user. The analytics endpoint also rejects direct requests for incidents outside that active assignment.

**Status:** Implemented.

## 109. Existing Casualty Attachments Needed To Be Viewable During Editing

**Problem:** When adding more photos to an existing casualty record, the edit workflow showed only newly selected photos. Previously uploaded attachments were not visible, so users could not confirm which photos were already attached.

**Solution:** The mobile add/edit casualty screen now loads the existing attachment list for the record and provides a **View attached photos** action in both the victim-photo and Patient Care Report photo sections. The viewer displays image thumbnails, filenames, attachment type, and an empty state when no attachments exist. New photo selection and upload behavior remains unchanged.

**Status:** Implemented.

## 110. Victim Submission Could Stop Without Visible Failure Feedback

**Problem:** In some mobile/PWA submission failures, the loading state stopped without a reliable visible explanation. Native alert behavior was not dependable in every runtime, and a failure inside the offline queue fallback could escape the user-facing error path.

**Solution:** Victim submission now has a synchronous in-flight guard so rapid taps cannot start overlapping requests. Create requests retry transient network and timeout failures with the same client record ID, and the API treats an already-created client record as an idempotent success so a lost response cannot create a false failure. Submission failures use the in-app feedback dialog and keep the form data intact so the responder can retry. Network and expired-session fallback queue operations are wrapped so queue failures are reported as well. Successful offline queueing continues to show the queued status and directs the responder to sign in and synchronize when required. Error feedback uses a distinct warning icon and danger color instead of the success styling.

**Status:** Implemented.

## 111. Offline Records Were Not Account-Scoped And Could Block Records Scrolling

**Problem:** Offline casualty submissions were stored in one device-wide queue. As a result, a Field Responder, AMP Responder, and HCFD account using the same device could see one another's unsynchronized victim records. The Records screen also rendered every queued card in an unrestricted block above the submitted records list, which could make the page appear frozen and prevent users from reaching normally submitted records.

**Solution:** Each new queued casualty now stores the authenticated creator's user ID. Queue reads, retry, incident assignment, victim-code correction, count, and synchronization are restricted to the current account, while entries from older queue data without an owner remain stored but are hidden from authenticated accounts rather than being exposed to another user. The offline queue display now has a bounded internal scroll area and a collapse/expand control, leaving the main submitted-records list independently scrollable.

**Status:** Implemented.

## 112. Victim Submission And Offline Synchronization Were Too Slow

**Problem:** Submitting a victim waited for a responder-record refresh and all selected photo uploads before showing that the core victim record had been saved. Offline synchronization processed every queued victim one at a time, so a large queue made the mobile app appear frozen or unresponsive.

**Solution:** The mobile app now confirms the core victim save immediately after the API returns. Photo uploads and the responder-code refresh continue in the background, with a visible warning if a photo upload needs attention. Offline synchronization now processes up to three independent queued victims concurrently while preserving per-record retry, duplicate protection, account scoping, and queue integrity. The API also performs independent post-create writes concurrently before returning the final response.

**Status:** Implemented.

## 113. STIEVE Special-Population Walking Result Was Green

**Problem:** In assisted STIEVE triage, selecting both **Special population** and **Walking / no visible injuries** allowed the walking rule to run first. The result was saved and displayed as **Minimal/green**, even though special-population cases must remain **Immediate/red**.

**Solution:** STIEVE now evaluates **Special population** before the walking rule in both the API calculator and the mobile assisted-assessment calculator. A regression test confirms that special population overrides walking and returns `immediate`, which maps to the red triage result.

**Status:** Implemented.

## 114. Offline Responder Safety Entries Could Be Repeated Or Overwritten

**Problem:** Offline responders could press the safety, arrival-time, and PPE-use controls repeatedly because the fields did not lock locally. The offline queue also did not retain the responder-safety response separately from the victim record, and the backend used an upsert that could replace the first entry with a later synchronized entry.

**Solution:** Offline casualty queue items now retain the responder's safety status, responder arrival time, PPE-use time, and responder function. Synchronization sends that response before creating the casualty record. The API now uses first-entry-wins behavior for each incident and responder: the first valid response is inserted, while duplicate submissions return the original response without changing its safety status or timestamps. Existing online locking behavior remains unchanged.

**Status:** Implemented.

## 115. SIEVE Rules Needed Correction In Field Responder Triage

**Problem:** The SIEVE assisted assessment used an obsolete injury question and older thresholds. Walking patients could be delayed because of injury data, absent breathing after airway management did not return red, and the respiratory and pulse-rate options did not match the requested SIEVE flow.

**Solution:** SIEVE now immediately classifies walking patients as minimal/green, removes the injury question from the SIEVE assessment, uses 9-or-below and 30-or-above respiratory thresholds, maps breathing after airway management to red/black, and uses 121-or-above versus 120-or-below pulse-rate thresholds. Capillary refill remains an alternative circulation check, with more than two seconds returning red and less than two seconds returning delayed/yellow. Legacy answer keys, including the older `more_than_30` respiratory value, remain supported for previously saved assessments. Regression tests cover the corrected decision paths.

**Status:** Implemented.

## 116. Scene Clearance Needed The Legacy Summary And A New Ambulance Editor

**Problem:** The Scene Clearance modal had lost the original incident summary layout, and the new ambulance editor placed too many controls in one row. The rounded editor containers became crowded at narrower widths, making the fields and actions look as though they overlapped.

**Solution:** Restored the original Scene Clearance summary at the top of the modal, placed the current ambulance editor below it, and added a saved-records table underneath. The ambulance fields now use a responsive field grid, while **Use current time** and **Remove** use a separate action row so the controls remain inside their rounded container on smaller screens.

**Status:** Implemented.

## 117. Scene Clearance Ambulances Did Not Persist As Separate Saved Records

**Problem:** After an ambulance was entered, the editor remained populated and the record did not appear in the table below. Saving also used replacement behavior, which could remove previously saved ambulance records when a new ambulance was added.

**Solution:** Added the `incident_scene_clearance_ambulances` table and Scene Clearance save endpoint. Ambulance entries are now appended to the incident's saved records, the table reloads from the database after saving, and the editor resets to one blank ambulance row for the next entry. The migration is `api/sql/add-incident-scene-clearance-ambulances.sql`.

**Status:** Implemented. Apply the migration in Supabase and restart the API before testing.

## 118. SitRep Used A Legacy Template And Did Not Include Current Ambulance Analytics

**Problem:** Newly exported SitReps could still use the older maroon/DCMS report presentation and did not include the current Scene Clearance ambulance arrival data used by Incident Analytics.

**Solution:** SitRep generation now reads saved Scene Clearance ambulance records and stores BLS, ACLS, Patient Transport Vehicle, and Other arrival series at the Utstein intervals of 15 minutes, 30 minutes, 1 hour, 2 hours, and 3 hours after DMMP activation. The PDF header, footer, and section accents now use SCRIBER branding. Downloading a draft without a current-session report first generates a fresh SitRep so an old stored snapshot is not silently exported.

**Status:** Implemented.

## 119. SitRep Charts And Page Layout Needed Better Report Structure

**Problem:** SitRep visual summaries were rendered as bar graphs, empty line series could leave misleading legends, the Executive Summary looked like an unformatted paragraph, and the Incident Analytics Snapshot heading could be stranded at the bottom of a page while its table began on the next page.

**Solution:** Categorical SitRep charts now use pie charts with counts and percentages, while time-based ambulance data uses line graphs. Empty line series are removed from both web and PDF legends. The Executive Summary is shown in a bordered narrative callout, longer card values wrap using the available width, and the Incident Analytics Snapshot begins on a new page with its table.

**Status:** Implemented.

## 120. Survivor Distribution Exposed Vague EMS And Facility Metrics

**Problem:** The Survivor Distribution summary flattened internal fields into user-facing cards such as **Primary non-EMS facility level**, **Primary non-EMS transport use**, and **Primary EMS facility level**. Values like `primary`, `non_ems`, and separate zeroed numerator/denominator cards did not explain what was being measured.

**Solution:** The API now calculates a primary-triage survivor transport breakdown for Immediate, Delayed, Minor, and Expectant categories. Each category distinguishes survivors who arrived at a recorded healthcare facility using EMS from those who arrived without EMS, with an explicit count, denominator, and percentage. The existing Utstein facility-level measures remain available but are now presented as **[facility level] healthcare facility arrivals transported by EMS** or **[facility level] healthcare facility arrivals without EMS transport**. Web and mobile views no longer expose raw internal codes, and zero-denominator metrics display **No recorded arrivals** instead of an unexplained `0`.

The summary also keeps the total survivors, total facility arrivals, response initiation time, interhospital transfer ratio, and facility-arrival interval measures visible with descriptive labels.

**Status:** Implemented.

## 121. ED Resources Exposed Vague Care And Admission Metrics

**Problem:** The ED Resources summary displayed raw fields such as **Immediate sought care label**, **Immediate sought care numerator**, **Immediate sought care denominator**, and **Immediate admitted label**. These labels did not explain that the sought-care percentage represented the triage-category share among all ED or similar facility care seekers, while admission and discharge percentages used that triage category's own ED-care denominator.

**Solution:** Updated the API, web dashboard, and mobile incident-management view with explicit labels. The summary now identifies measures such as **Immediate survivors among ED care seekers**, **Immediate survivors admitted after ED care**, and **Immediate survivors discharged after ED care**. The interface also shows the total survivors, total ED-care seekers, response and disaster-onset times, median arrival timing, resuscitation intervals, and room-use intervals with descriptive labels. Existing numerator, denominator, and percentage calculations were preserved; zero-denominator results now display **No recorded cases** instead of an unexplained value.

**Status:** Implemented.

## 122. Hospital Resource Facility Cards Had Poor Dark-Mode Contrast

**Problem:** In the web dashboard's dark-mode **Hospital Resources** summary, the nested hospital cards kept a light background while their headings and facility details used dark-mode light text. The result was white text on a near-white card, making the hospital name and location difficult to read.

**Solution:** Added a dark-mode-specific surface for facility summary cards. The outer hospital card now uses the dark raised surface while its metric cards retain the darker contrast layer, keeping the existing light-mode presentation unchanged.

**Status:** Implemented.

## 123. Morbidity And Mortality Summary Needed Utstein Labels And Mortality Output

**Problem:** The Morbidity & Mortality summary exposed internal labels such as **Morbidity - ED - Immediate - Mean Minutes**, and the web summary's default card limit could hide the mortality section entirely. ED and ICU counts represented completed LOS calculations without clearly identifying transfers out of the department or ICU.

**Solution:** Added explicit ED and ICU labels for average LOS, median LOS, and total immediate/delayed survivors transferred out of the ED or ICU. The API now returns separate transferred-out counts while preserving the LOS calculations. The web view now presents total victims, total recorded deaths, ED and ICU measures, additional hospital-stay measures, and Utstein mortality categories for impact, pre-hospital, in-hospital, and immediate-category deaths. The mobile view uses the same terminology and displays the mortality results alongside the LOS measures.

**Status:** Implemented.

## 124. Incident Management Search Input Reversed Typed Characters

**Problem:** The Incident Management search field rebuilt the current view after every keystroke and then focused the newly rendered input. Because the caret defaulted to the beginning of the replacement field, subsequent characters were inserted before the existing text and the query appeared backwards.

**Solution:** The search handler now captures the input selection range before re-rendering and restores the same caret or selection after the new field is focused. Search filtering behavior is unchanged, but normal typing now proceeds from the expected cursor position.

**Status:** Implemented.

## 125. Login Landing Used The Older UP Logo Asset

**Problem:** The first University of the Philippines logo in the web and mobile landing/login screens still referenced the older SVG asset instead of the supplied UP Manila PNG. This made the branding inconsistent with the requested logo asset.

**Solution:** The web landing and login views now use `website/assets/upmanila.png`, and the mobile landing screen now uses `mobile/src/assets/UP-Manila.png`. Both supplied PNGs already have transparent pixels outside the seal, so the official white portions inside the emblem were preserved while no rectangular background is rendered around the logo.

**Status:** Implemented.

## 126. User-Facing Casualty Terminology Needed To Be Replaced

**Problem:** The web and mobile interfaces still exposed casualty/casualties terminology in headings, record labels, notifications, validation messages, legal pages, login copy, exports, and summary views even though the preferred user-facing term is victim/victims.

**Solution:** Updated rendered web and mobile text to use victim/victims terminology, including record cards, incident summaries, verification messages, offline-queue messages, login/about/legal copy, and SitRep labels. Internal API routes, database table names, payload fields, TypeScript types, route paths, storage keys, and other application identifiers were left unchanged.

**Status:** Implemented.

## 127. Action Logs Needed Incident And Mobile Record Edit Events

**Problem:** Incident edits were already stored as `incident.updated`, but successful edits to an existing mobile victim record did not create a corresponding general audit-log entry, making those changes difficult to trace in Action Logs.

**Solution:** Existing incident edit logging was retained. Successful victim-record updates now create `casualty.updated` audit entries with the edited sections, incident context, actor, timestamp, and client source. Mobile API requests identify themselves as mobile, and the web Action Logs display the event as **Victim record updated**.

**Status:** Implemented.

## 128. Matched Cases Needed Editable Identified-Victim Names

**Problem:** Completed matched cases displayed only the generated case identifier, such as `2C354368`. When a victim was later identified, administrators could not replace that opaque label with the victim's actual name. The linked Field Responder, Advanced Medical Responder, and HCFD records also needed to remain separate and permanently associated.

**Solution:** Added an optional `case_name` display field to `casualty_case_links`, with migration `api/sql/add-casualty-case-name.sql`. Administrators can now select **Edit name** in **Victims > Matched Cases**, enter the identified victim name, and save it. The API updates the display label across the existing links for that `case_id` without changing, deleting, or recreating any linked victim records. The generated case ID remains visible as a stable reference, and the rename is recorded in Action Logs as **Matched case name updated**.

**Status:** Implemented. Apply the migration in Supabase and restart the API before testing.

## 129. Incident Management Needed A Dedicated Incident Control Card

**Problem:** The Acting IC delegation panel was rendered above the Incident Management section grid. This made the launcher layout uneven and mixed incident-control actions with the general section content.

**Solution:** Added an **Incident Control** launcher card in the final grid position and moved the existing Acting IC panel into its section modal. Delegating control, designating backup ICs, resuming primary ownership, notifications, permissions, and API behavior remain unchanged.

**Status:** Implemented.

## 130. Incident Control Backup Selector Needed A More Intentional Layout

**Problem:** The Acting IC backup selector appeared as an isolated default dropdown beside the save button, making the Incident Control modal look unfinished.

**Solution:** Added a dedicated backup-coverage block with explanatory context, consistent field styling, a full-width themed selector, clear focus treatment, and responsive action layout for light and dark modes. Existing backup designation and delegation handlers remain unchanged.

**Status:** Implemented.

## 131. Incident Control User Dropdown Was Difficult To Scan

**Problem:** The native backup IC dropdown displayed a long browser-controlled list of plain text names and roles. It was difficult to scan and visually inconsistent with the Incident Control modal.

**Solution:** Replaced the native option list with a searchable user picker. Each available user is presented as a distinct row with the name and role separated, while the selected user remains visible in the field. The picker supports keyboard focus, outside-click closing, light/dark styling, and continues submitting the same `userId` value to the existing backup designation endpoint.

**Status:** Implemented.

## 132. Incident Control Modal Clipped The User Picker

**Problem:** The Incident Control modal sized itself to its closed content. When the backup IC picker opened, the list extended beyond the modal body and required unnecessary scrolling.

**Solution:** Preserved the shared height of the other Incident Management modals and changed the searchable user picker to open upward from the selector. This keeps the list visible without making the Incident Control window unusually tall.

**Status:** Implemented.

## 133. Incident Control Needed Responsible Officer Accounts

**Problem:** Admins needed a separate read-only command account for incident management and analytics, without requiring the user to be delegated as Acting IC. The existing account workflow did not provide a dedicated Responsible Officer form, account list, or suspension controls.

**Solution:** Added the `responsible_officer` authenticated role and Supabase migration. The Incident Control section now provides a Name, Email, and Password form plus a scoped Responsible Officer account table with edit and suspend/reactivate actions. Responsible Officer accounts are restricted to their creating admin's unit, can access only Incident Management and Incident Analytics, and remain read-only. Acting IC backup selection explicitly excludes Responsible Officer accounts.

**Status:** Implemented.

## 134. Operational Backup And Reset Needed Incident-Level Scope

**Problem:** Backup and reset operations needed to support two different scopes. An administrator must manage selected incidents, while a Super Admin must manage an entire administrator account. The original workflow also allowed a combined multi-incident backup, making it impossible to restore only one incident cleanly.

**Solution:** Added authenticated operational backup, restore, preview, and reset endpoints. Administrators can select incidents in their own scope, while Super Admins select an administrator account. Backups are generated as separate JSON files for each incident, including related victim records, assessments, operational records, notifications, audit data, and stored attachments. User accounts and login access remain outside operational backups and are preserved during reset and restore.

**Status:** Implemented.

## 135. Backup And Reset Needed Closed-Incident Protection

**Problem:** Backup and reset should not run while an incident is still active because an active incident may still be receiving mobile submissions or require operational changes. Super Admin account-level operations must apply the same rule to every incident under the selected administrator.

**Solution:** The API now verifies incident status before backup, reset preview, and reset execution. Administrators must select only closed incidents, and Super Admins can proceed only when all incidents belonging to the selected administrator are closed. Open incidents return a clear conflict response listing the incidents that must be closed first. Restored incidents retain their stored closed status and continue to use the existing reopen-request workflow.

**Status:** Implemented.

## 136. Backup File Naming And Individual Restore

**Problem:** Backup downloads did not consistently identify the administrator and incident, and a multi-incident download could combine unrelated incident data into one file.

**Solution:** Each generated file now uses the format `SCRIBER-[AdminAccountName]-[IncidentName]-[DateOfBackup].json`. The web profile panel downloads one file per selected incident. A Super Admin selecting an administrator account receives one file per incident under that account. Restoring one file replaces only that incident's operational scope and does not restore or remove other incidents or user accounts.

**Status:** Implemented.

## 137. Backup And Reset Selections Needed To Be Independent

**Problem:** The Account Profile modal reused one incident or administrator selector for both backup and reset. A selection made for backup could therefore be mistaken for the reset target.

**Solution:** Added separate selectors for **Incidents to back up** and **Incidents to reset** for administrators, plus separate **Admin account to back up** and **Admin account to reset** selectors for Super Admins. Each button now reads only its own selection, and the reset panel explains that its scope is independent from the backup scope.

**Status:** Implemented.

## 138. Backup And Reset Selectors Displayed Active Incidents

**Problem:** The active-incident endpoint was being used to populate the Account Profile selectors, so closed incidents were not available for eligible backup or reset operations.

**Solution:** The selectors now use the complete incident scope and filter the displayed options to closed incidents only. Active incidents are hidden from both selectors, while the API continues enforcing the same rule server-side.

**Status:** Implemented.

## 139. Mobile Users Could See Records From Closed Incidents

**Problem:** Mobile incident lists already excluded closed incidents, but victim-record list requests and direct record/history requests could still return records linked to a closed incident.

**Solution:** Mobile-facing victim queries now restrict visible records to incidents that are active and not ended. The same visibility rule applies to direct victim access, status/triage/transport/treatment histories, case-link access, and related mobile record actions. Administrator and Super Admin views remain unchanged. When an incident is reopened and becomes active again, its records become visible to mobile users without changing or deleting the stored data.

**Status:** Implemented.

## Additional Acceptance Tests

54. As an administrator, close two incidents and confirm only those closed incidents appear in both the backup and reset selectors. Confirm active incidents do not appear.
55. Select different incidents in the backup and reset selectors and confirm each action uses only its own selection.
56. As an administrator, attempt backup and reset while an incident is active and confirm the API rejects the operation with the incident status message.
57. As an administrator, select multiple closed incidents and confirm one `SCRIBER-[Admin]-[Incident]-[Date].json` file is downloaded per incident.
58. As a Super Admin, select an administrator account with multiple incidents and confirm one backup file is created per closed incident. Confirm the operation is rejected if any incident under that administrator remains active.
59. Reset one closed incident, restore only its backup file, and confirm that incident and its related records return while other incidents and user accounts remain unchanged.
60. Sign in as a mobile responder and confirm a closed incident and its victim records do not appear. Confirm the same records become visible after the incident is reopened.
61. Confirm an administrator and Super Admin can still view the closed incident and its victim records while mobile users cannot.

## 140. Incident Triage Mode Can Support Assisted And Unassisted Workflows

**Problem:** Official incidents previously supported only one triage mode. Administrators could not change the mode from **Incident Management > Edit Incident**, and responders could not use either workflow for incidents that needed both assisted and unassisted triage.

**Solution:** Added **Both** as an incident triage mode and added the mode selector to the web **Edit Incident** form. The API now accepts and validates `assisted`, `unassisted`, and `both`; incidents configured as **Both** accept either submitted workflow. Mobile incident creation exposes the same three choices. For a **Both** incident, the responder can switch between Assisted and Unassisted until the first Assisted answer is entered. After that first Assisted answer, the selected mode is locked. Unassisted answers may be cleared when switching to Assisted, preserving the existing confirmation behavior. Fixed-mode incidents retain their previous locked behavior, and manual-only triage systems remain unassisted.

**Database:** Apply `api/sql/add-incident-triage-mode.sql` so the incident constraint permits `both`.

**Status:** Implemented.

## 141. Deactivation And Continuity Must Respect Admin Hospital Scope

**Problem:** The facility operational summary used by **Deactivation & Continuity** loaded every active healthcare facility across all administrator accounts. This caused hospitals created by another admin to appear in the current incident's summary.

**Solution:** The API now loads the incident owner before building the summary. Non-Super Admin users receive only active hospitals whose `created_by` matches the incident's owning admin account. Facility IDs from encounters, resource snapshots, and operation notes are also checked against that scoped facility set so unrelated hospitals cannot re-enter the response as unspecified facilities. Super Admin retains global visibility.

**Status:** Implemented.

## 142. Treatment Must Be Assigned From Field Responder Triage

**Problem:** AMP responders could manually enter the on-site treatment strategy, while Field Responders did not have the transferred treatment step. This allowed treatment data to diverge from the triage system used.

**Solution:** Removed the Treatment step from the AMP workflow and added it to the Field Responder workflow. Field Responders now see a read-only treatment assignment derived from the selected triage system. The API applies the same mapping when saving or synchronizing records so the assignment cannot be changed by a client payload.

Current mapping:

- STIEVE and SALT -> Stay and Play
- START, SIEVE, SIEVE/SORT, PTT, MPTT, mSTART, JumpSTART, and MITT -> Scooter (the existing merged Play and Run strategy)
- CareFlight and Homebush -> Scoop and Run/Load and Go

Additional acceptance tests:

63. Sign in as an AMP Responder and confirm the Treatment step is not shown.
64. Sign in as a Field Responder, select each supported triage system, and confirm the treatment assignment updates automatically without a treatment selector.
65. Submit a Field Responder record and confirm the saved treatment strategy matches the triage-system mapping.
66. Alter the treatment strategy in a submitted client payload and confirm the API stores the mapped strategy instead.
67. Confirm AMP records no longer create manual treatment records through the removed Treatment step.

## 143. Minor Incident Documenter Incident List Must Be Admin-Scoped

**Problem:** Minor Incident Documenter accounts were not included in the API's responder incident-viewer scope, so their incident selector could display incidents created by every admin account.

**Solution:** Added `minor_incident_documenter` to the same admin-owner incident scope used by Field Responder, AMP, and HCFD accounts. Mobile incident caches are also now keyed by signed-in user ID, preventing an older cached list from exposing another account's incident options while offline.

Additional acceptance tests:

68. Create incidents under two administrator accounts and sign in as a Minor Incident Documenter created by the first admin. Confirm the incident selector shows only the first admin's active incidents.
69. Sign in as an AMP, Field Responder, and HCFD account created by the same admin and confirm their incident lists remain unchanged and scoped to that admin.
70. Load the Minor Incident Documenter incident list, go offline, and confirm the cached list contains only the incidents previously returned for that signed-in account.

## 144. AMP Records Need Conditional Editing For Pending Departure

**Problem:** AMP users had no direct edit action from the mobile Records list for victims whose transport status was still **Pending Departure**. Records that had already been released or referred should remain non-editable from that list.

**Solution:** Added an **Edit record** action inside each victim record card and an **Edit** action in the individual record's **Transport** section for AMP accounts only. Both actions appear only when the saved transport notes identify **Patient for: Pending Departure** and open the existing Transport-focused edit workflow. Other roles and non-pending records do not receive the conditional button.

Additional acceptance tests:

71. Sign in as AMP and confirm a Pending Departure record shows **Edit record** in its card.
72. Open the button and confirm the existing victim editor opens at the Transport step.
73. Open a pending-departure victim record and confirm its Transport section shows the per-record **Edit** action.
74. Confirm records marked Release, Referral/Transfer, or any non-pending status do not show either conditional edit action.
75. Sign in as Field Responder, Minor Incident Documenter, or HCFD and confirm the conditional AMP edit actions are not shown.

## 145. Transport Status Must Match Between Records List And Detail View

**Problem:** The mobile Records list could show **Transport: Pending** from the saved transport record while the opened record displayed **Patient For: Unavailable** because the detail view only read the AMP transport notes. The per-record edit action also depended only on note text, so pending records without that note format could miss the action.

**Solution:** The detail view now falls back to the saved transport status and displays **Pending Departure** for an unknown/pending transport state. The same transport status is used when deciding whether an AMP user may edit the record. The AMP Transport section now contains the per-record Edit action, while the existing Edit record action remains available on the Records list. The later generic Transport section does not duplicate the action for AMP records.

Additional acceptance tests:

76. Open a record whose list badge says **Transport: Pending** and confirm the Transport section displays **Patient For: Pending Departure** instead of **Unavailable**.
77. As an AMP user, confirm a pending-departure record shows the per-record **Edit** action inside its Transport section and the existing list-level **Edit record** action.
78. Confirm a released or referred record does not show either conditional edit action and its detail value remains consistent with its saved transport state.

## 146. Edited Victim Records Must Refresh In Mobile And Web Cards

**Problem:** Editing a victim record could leave the previous card summary visible. Transport edits were especially affected because each edit creates a new transport-history row, while latest-row selection used only the timestamp and the update response returned the base casualty row without refreshed summaries. The mobile detail screen also loaded only on initial mount, and the web dashboard depended on its cached state or Realtime refresh.

**Solution:** Latest triage, transport, and facility rows now use a deterministic timestamp-and-ID order. The update endpoint returns the edited record with refreshed latest summaries. The mobile detail screen reloads whenever it receives focus, while the Records screen continues to reload on focus. The web dashboard remains subscribed to casualty and related history tables so its shared records state refreshes after edits.

Additional acceptance tests:

79. For each mobile role with an edit action—Administrator, Super Admin, AMP, Field Responder, HCFD, and Minor Incident Documenter—edit a permitted field, save, return to Records, and confirm the card reflects the new value.
80. Change AMP **Patient For** from **Pending Departure** to **Release** and confirm the mobile card no longer says **Transport: Pending**.
81. Open the edited record immediately after saving and confirm its detail sections show the same values as the card.
82. With the web dashboard open, edit a mobile record and confirm the web victim record table and opened record reflect the updated data after the Realtime refresh. Refresh the page and confirm the same values remain.
83. Confirm edits to triage, treatment, facility, status, personal, and transport sections use the newest saved history row in both mobile and web views.

## 147. Saving A Record Must Not Duplicate Its Detail Screen

**Problem:** When an edit was opened from an existing victim detail screen, saving used `router.replace()` to navigate to another copy of the same detail route. The first Back action returned to the old detail screen, and the next Back action could produce Expo Router's unhandled `GO_BACK` warning.

**Solution:** Detail-origin edits now carry route context. After a successful save, the edit screen closes with `router.back()` so the existing detail screen is reused and refreshed. Edits opened directly from the Records list keep their direct route to the edited record detail. The navigation stack now has one detail screen per record visit.

Additional acceptance tests:

84. Open a victim detail screen, edit any permitted section, save, and confirm the updated detail screen appears.
85. Press Back once and confirm the app returns to Records. Pressing Back is no longer required a second time and produces no unhandled navigator warning.
86. Start an edit from the Records list's direct Edit action, save, confirm the edited record detail opens, and confirm one Back returns to Records.

## 148. Completed Transport Must Not Retain The Pending Edit Action

**Problem:** A transport edit appended new notes to the existing transport notes. After changing **Patient For** from **Pending Departure** to **Release**, the latest transport row correctly showed **Not required**, but the Records card still found the old pending text and incorrectly displayed **Edit record**.

**Solution:** The latest transport status is now authoritative. Records marked `yes` or `no` cannot be treated as pending even if older notes contain **Pending Departure**. The detail view also displays **Release** or **Referral or Transfer to Health Facility** from the latest saved status instead of stale note text. Only an `unknown` transport state may show the pending edit action.

Additional acceptance tests:

87. Change an AMP record from **Pending Departure** to **Release** and confirm the card shows **Transport: Not required** with no **Edit record** button.
88. Open the record and confirm **Patient For: Release** is displayed, even when older transport notes contain **Pending Departure**.
89. Change a record to referral/transfer and confirm it also has no pending edit action.

## 149. Field Responder Status Must Show Automatic Interventions

**Problem:** The Field Responder Status tab displayed an editable **NOTES** field instead of showing the intervention determined by the responder's selected triage system.

**Solution:** Replaced the Field Responder Status-tab Notes field with a read-only **INTERVENTIONS DONE** panel. The panel displays the existing automatic treatment mapping and identifies the selected triage system as its source. Other roles and the existing triage-based assignment behavior remain unchanged.

Additional acceptance tests:

90. Open the Field Responder Status tab and confirm **INTERVENTIONS DONE** is shown instead of the editable Notes field.
91. Confirm the displayed intervention is read-only and cannot be manually changed.
92. Confirm STIEVE/SALT shows **Stay and Play**, START/SIEVE-family systems show **Scooter**, and CareFlight/Homebush shows **Scoop and Run/Load and Go**.
93. Change the selected triage system and confirm the intervention updates automatically.

## 150. Opening Add Victim After Editing Must Start A New Record

**Problem:** After a successful edit, the cached Add Victim route could retain the previous `editId` and form state. Opening Add Victim again then displayed the record that had just been edited instead of a blank new-victim form.

**Solution:** Successful detail-origin edits now reset the form and clear the edit route parameters before returning to the record detail. The current incident context may remain available, but the edited victim, attachments, and edit-only navigation state are removed from the next Add Victim session.

Additional acceptance tests:

94. Edit and save a record from each mobile role that has an edit action.
95. Return to Records, open Add Victim, and confirm the form is blank and titled **Add Victim**, not **Edit Victim**.
96. Confirm the new form can be completed and submitted as a new record without changing the previously edited record.

## 151. HCFD Records Cards Showed Unknown Instead Of The Triage Category

**Problem:** The HCFD mobile record detail displayed the correct triage category, but the corresponding Records card showed **Unknown**. The card was reading `current_status`, while the detail view used the latest calculated or selected triage assessment.

**Solution:** The shared mobile Records card now reads `latest_triage_assessment.calculated_category` first and falls back to `triage_category`, matching the detail view. The displayed category normalizes **Minimal** to **Minor** and retains the existing unknown fallback when no triage assessment exists. Triage-specific badge colors are also applied when a category is available.

Additional acceptance tests:

97. Sign in as HCFD and open Records for a casualty with a saved triage assessment. Confirm the card badge matches the triage category shown inside the record.
98. Verify that Immediate, Delayed, Minor, and Expectant categories use their corresponding badge colors.
99. Open a record without a triage assessment and confirm the card still shows **Unknown** rather than displaying an unrelated value.

## 152. Witness Selection Needed Multi-Selection Guidance

**Problem:** The Minor Incident Documenter witness-present field allowed multiple selections, but the form did not tell the user that all applicable choices could be selected.

**Solution:** Added the helper instruction **Select all that apply.** below the Witness Present selector. The selection behavior and stored values remain unchanged.

Additional acceptance tests:

100. Open the Minor Incident Documenter Add Victim flow and confirm the Witness Present field displays **Select all that apply.**
101. Select more than one witness option and confirm all selected values remain selected and are saved with the record.

## 153. Mobile Web Dashboard Needed A Usable Responsive Navigation Layout

**Problem:** The web dashboard was difficult to use on phone-sized screens. Sidebar categories and account controls consumed too much vertical space, navigation content could be clipped, and the profile, theme, and logout controls were not arranged consistently for a compact viewport.

**Solution:** Added a mobile navigation presentation with a hamburger control, scrollable navigation content, compact single-column category groups, and responsive account controls. Profile and theme controls remain inside the opened navigation menu, while Logout stays beside the hamburger control. Desktop navigation behavior remains unchanged.

Additional acceptance tests:

102. Open the web dashboard at a phone-sized viewport and confirm the hamburger control opens and closes the navigation menu.
103. Open every navigation category and confirm the full list can scroll without clipping lower buttons.
104. Confirm Profile, theme, and Logout controls remain reachable and do not overlap the page content on phone and tablet widths.
105. Resize back to desktop width and confirm the existing sidebar layout and navigation behavior remain intact.

## 154. Transport Status Badge Must Respect Role Sections

**Problem:** The mobile Records card currently renders a transport line for every role. When a record has no transport row, the shared formatter displays **Transport: Pending**, including for HCFD and Field Responder accounts whose record detail workflow does not contain the Transport or Patient For section.

**Analysis:** The AMP-only restriction currently controls transport editing, but the Records-card display is not role-aware. The API includes transport summaries in the shared record response, and the card renders that value independently of the role-specific detail sections.

**Planned correction:** Reuse the detail-screen role/section visibility rules so the transport line is shown only for roles with the corresponding transport workflow. Roles without Transport or Patient For should show no transport badge or transport filter result.

**Status:** Identified; implementation pending.

## Verification Instructions

Run these commands from the repository root in PowerShell:

```powershell
cd disaster-casualty-system
npm.cmd --prefix api run typecheck
node --check website/app.js
```

For the full repository verification run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\run-verification.ps1
```

Manual Acting IC acceptance test:

1. Apply `api/sql/add-incident-acting-ic-delegation.sql` in the project Supabase database.
2. Sign in as a unit admin, create an active incident, and confirm that at least one active unit user is available.
3. Open **Incident Management**, expand the incident, designate a backup IC, and confirm that the designation is shown.
4. Select **Delegate Incident Control**, enter a reason, and confirm that the incident shows the delegated user as Acting IC.
5. Sign in to the mobile app as the designated Acting IC and confirm the unread notification **You are the Acting IC** appears in Notifications and links to the incident workflow.
6. Sign in to the web as the designated Acting IC and confirm that only **Incident Management** and **Incident Analytics** are available in the Acting IC workspace.
7. Confirm that the primary admin's incident edit, timeline, and close operations are rejected while delegation is active.
8. Confirm that the Acting IC can manage the assigned incident but cannot access accounts, facilities, or other admin controls.
9. Confirm that a responder can still add a victim to the same incident.
10. Select **Resume Primary Ownership**, enter a reason, and confirm that the primary admin regains control and the Acting IC session is closed.
11. Review **Action Logs** and confirm entries for backup designation, delegation, and resumed ownership.
12. While the delegation is active, open **Incident Analytics** in the Acting IC workspace and confirm that only the delegated incident is shown and its analytics load.
13. Confirm that a direct analytics request for an unrelated incident returns HTTP 403 for the Acting IC user.
14. Open an existing casualty record for editing, confirm **View attached photos** is available, and verify that previously uploaded photos are visible before adding more.
15. Disable the API or switch the device to offline mode, submit a completed victim form, and confirm the spinner stops with a visible queued result; the record should be available for synchronization.
16. Simulate an offline queue failure, submit a completed victim form, and confirm an error dialog appears, the submission does not silently stop, and the form remains available for retry.
17. On one device, submit an offline victim as a Field Responder, sign in as an AMP Responder, and confirm the Field Responder's queued record is not visible or included in the AMP queue count.
18. Repeat the account-isolation check with HCFD and confirm retry, incident assignment, victim-code correction, and **Sync all queued** operate only on the signed-in account's queue.
19. Create enough offline queued records to exceed the queue panel height, scroll inside the queue, collapse it, and confirm the normal submitted Records list remains reachable and scrollable.
20. Submit a victim with and without photos and confirm the saved-record feedback appears before photo processing finishes; verify any photo failure is shown as a warning.
21. Queue at least six victims for one account, run **Sync all queued**, and confirm multiple records enter syncing together and the queue completes without duplicate server records.
22. Apply `api/sql/add-incident-scene-clearance-ambulances.sql` in Supabase and restart the API server.
23. Open an incident's **Scene Clearance** section and confirm the legacy summary appears first, followed by the ambulance editor and the saved-records table.
24. Add a BLS ambulance with provider, plate number, and arrival time, select **Save**, and confirm the record appears in the table while the editor resets to a blank row.
25. Add an ACLS, Patient Transport Vehicle, or Other ambulance and confirm earlier saved rows remain in the table.
26. Resize the Scene Clearance modal to a narrow width and confirm fields stay inside their rounded container and the action buttons remain separated below the fields.
27. Generate or download a SitRep and confirm the filename follows `SITREP-[office]-[incident]-[date].[extension]` on web and mobile.
28. Confirm the SitRep Executive Summary is displayed in a bordered callout and the Incident Analytics Snapshot starts on a new page with its table.
29. Confirm categorical SitRep charts render as pie charts, time-based ambulance arrivals render as a line chart, and ambulance types with no arrivals do not appear in the line-chart legend.
30. Confirm **Generate Final Incident SitRep** creates the current report and **Download Incident SitRep Draft** does not silently export an older stored snapshot after a fresh page session.
31. Open **Survivor Distribution** for an incident and confirm the primary-triage section uses clear labels such as **Immediate survivors transported by EMS** and **Immediate survivors without EMS transport**.
32. Confirm the facility-level section uses descriptive healthcare-facility and transport labels, does not show `primary` or `non_ems` as standalone values, and shows **No recorded arrivals** when the denominator is zero.
33. Verify the same Survivor Distribution labels and values in the mobile incident-management view, including the response-interval and interhospital-transfer summaries.
34. Open **ED Resources** and confirm the category cards explain that sought-care values are the category share among ED-care seekers, while admitted and discharged values use the category's ED-care total as their denominator.
35. Confirm the ED Resources view no longer exposes raw label, numerator, denominator, or percentage field names, and that zero-denominator categories display **No recorded cases**.
36. Open **Hospital Resources** with dark mode enabled and confirm hospital names, locations, and metrics remain readable with no white card behind white text. Switch to light mode and confirm the existing light layout remains readable.
37. Open **Morbidity & Mortality** and confirm the ED cards identify average/median LOS and total immediate or delayed survivors transferred out of the ED.
38. Confirm the ICU cards identify average/median LOS and total immediate survivors transferred out of the ICU.
39. Confirm the summary displays total recorded deaths and the Utstein mortality categories for impact, pre-hospital, in-hospital, and immediate-category deaths in both web and mobile views.
40. Open **Incident Management**, type a search query character by character, and confirm the text remains in the entered order. Move the caret into the middle of the query, type or select text, and confirm the selection position is preserved after filtering.
41. Open the web and mobile login/landing screens and confirm the first UP logo uses the supplied UP Manila PNG, with transparent space outside the seal and no white rectangular background.
42. Open the web and mobile interfaces and confirm visible record, incident, notification, validation, login, about, legal, and SitRep text uses **victim/victims** terminology while API routes, database identifiers, and internal record handling continue to function normally.
43. Edit an official incident and confirm **Incident updated** appears in Action Logs. Edit an existing victim record from mobile and confirm **Victim record updated** appears with the edited sections and **Source: mobile**.
44. Apply `api/sql/add-casualty-case-name.sql` in Supabase, open **Victims > Matched Cases**, select **Edit name** on a completed case, enter an identified victim name, and save. Confirm the name appears with the stable case ID, the linked role records remain unchanged, and **Matched case name updated** appears in Action Logs.
45. Open **Incident Management**, expand an incident, and confirm the launcher grid has an **Incident Control** card in the previously empty position. Open it and confirm backup designation, **Delegate Incident Control**, and **Resume Primary Ownership** retain their existing behavior and permissions.
46. Open **Incident Control** in light and dark mode, confirm the backup selector matches the modal surface, has visible focus styling, and remains aligned with **Save Backup IC** on desktop and stacked cleanly on narrow screens.
47. Open the backup IC picker, search by a user name or role, select a user, and confirm the selected name remains visible. Submit it and confirm the existing backup designation and delegation flow still works.
48. Open **Incident Control** on desktop and mobile widths, open the backup IC picker, and confirm the user list remains inside the enlarged modal without requiring the modal itself to scroll.
49. Apply `api/sql/add-responsible-officer-role.sql` in Supabase before creating the first Responsible Officer account.
50. As an admin, open an incident's **Incident Control** section, create a Responsible Officer with a name, email, and password, and confirm the account appears in the scoped table.
51. Edit the Responsible Officer name/email or password, then suspend and reactivate the account. Confirm the account status changes and a suspended account cannot sign in.
52. Sign in as the Responsible Officer and confirm only **Incident Management** and **Incident Analytics** are available, with no Acting IC delegation required.
53. Confirm the Responsible Officer can view incidents and analytics in the creating admin's unit but cannot edit incidents, delegate Acting IC control, or access other admin modules.
54. Create an official incident with **Assisted**, **Unassisted**, and **Both**, and confirm each mode is saved and displayed correctly in web and mobile incident views.
55. In **Incident Management > Edit Incident**, change an active incident between all three triage modes and confirm the selected mode is saved and controls the mobile workflow.
56. For a **Both** incident, start Assisted triage, answer one assisted question, and confirm the mode selector becomes locked.
57. For a **Both** incident, start Unassisted triage, answer questions, switch to Assisted, confirm the existing confirmation appears and answers are cleared, then answer one Assisted question and confirm the mode locks.
58. Confirm Assisted-only incidents reject Unassisted submissions, Unassisted-only incidents reject Assisted submissions, and Both incidents accept either submission.
59. Confirm manual-only triage systems remain unassisted and do not expose an Assisted workflow.
60. Create hospitals under two different administrator accounts, then open **Deactivation & Continuity** for an incident owned by the first admin and confirm only the first admin's hospitals appear.
61. Add a facility encounter or resource snapshot referencing a hospital owned by another admin and confirm it does not appear in the first admin's facility operational summary.
62. Sign in as Super Admin and confirm the facility operational summary can still show hospitals across administrator accounts.
63. Edit an AMP casualty transport record and change **Patient For** to **Release**. Confirm the saved **Condition Before Release**, **Release of Liability Accepted**, **Departed Scene**, and **Transport / Release Notes** values appear in the record detail.
64. Edit an AMP casualty transport record and change **Patient For** to **Referral or Transfer to Health Facility**. Confirm **Condition Before Transfer**, **Receiving Facility**, **Departed Scene**, **Arrived Facility**, **Used EMS Vehicle**, and **Transport / Release Notes** appear after saving.
65. Repeat the transport edit/detail check for every role that has an edit action. Confirm each role keeps its own edit fields and that saving one field does not replace previously saved transport values.

Latest full verification run: **10 / 10 checks passed**.
