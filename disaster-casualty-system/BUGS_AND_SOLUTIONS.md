# DCMS Bugs, Problems, and Solutions

This document summarizes the main issues encountered during development of the Disaster Casualty Management System and the solutions applied.

## 1. SitRep Download And Filtering

**Problem:** Generated SitRep files were difficult to view and downloaded files appeared identical. The SitRep also needed filtering by responder function: Field Responder, SAR, or both.

**Solution:** SitRep generation/export was updated to support responder-function scope and downloadable report output. The SitRep analytics were also improved with charts instead of text-only summaries.

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

## 9. Sidebar And Web Dashboard Responsiveness

**Problem:** The collapsible sidebar looked unprofessional when collapsed and the dashboard was not mobile-browser friendly.

**Solution:** Sidebar collapse/expand styling and animations were improved. The dashboard layout was adjusted to be more usable on phone-sized browsers.

## 10. Realtime Dashboard Updates

**Problem:** Some dashboard tabs, especially Incident Analytics and Audit Logs, required manual refresh to show new records.

**Solution:** Realtime refresh behavior was expanded so more dashboard sections update without needing a full page refresh.

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
