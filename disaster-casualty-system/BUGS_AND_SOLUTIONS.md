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
