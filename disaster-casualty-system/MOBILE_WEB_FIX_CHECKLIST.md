# Mobile PWA And Web Dashboard Fix Checklist

This checklist is based on the pasted UPDRRM DCMS requirements. Work should be done in stages, with inspection and verification before each implementation.

## 1. Multiple Users / "Unable To Reach Server"

### Investigation

- [ ] Confirm exact screens/actions where users see "Unable to reach server".
- [x] Check mobile API client timeout and error mapping.
- [ ] Check frontend network requests during simultaneous use.
- [x] Check whether screens duplicate requests on mount/focus.
- [x] Check login/session token storage and refresh behavior.
- [x] Check backend auth middleware for per-request user handling.
- [x] Check backend logs for request failures, timeouts, and 500 errors.
- [ ] Check Supabase/database query errors or slow queries.
- [ ] Check Render/server resource usage during multiple simultaneous users.
- [x] Check whether offline queue retry/sync causes request bursts.
- [x] Verify that one user's session cannot overwrite another user's session.

### Likely Files

- [x] `mobile/src/api/client.ts`
- [x] `mobile/src/utils/uiMessages.ts`
- [x] `mobile/src/auth/session.ts`
- [x] `mobile/src/screens/dashboard/HomeDashboardScreen.tsx`
- [x] `mobile/src/app/(tabs)/records.tsx`
- [x] `mobile/src/offline/casualtyQueue.ts`
- [x] `api/src/app.ts`
- [x] `api/src/middleware/auth.ts`
- [x] `api/src/controllers/casualty.controller.ts`
- [x] `api/src/controllers/dashboard.controller.ts`

### Implementation

- [x] Add request duration/request-id logging if needed.
- [x] Improve client-side logging for network vs timeout vs server errors.
- [x] Avoid duplicate screen-load requests where possible.
- [ ] Reduce heavy list loading where safe.
- [x] Preserve drafts and queued offline records during connection errors.
- [x] Keep retry options visible and clear.

### Testing

- [ ] Log in as multiple users at the same time.
- [ ] Open Home, Records, Add Casualty, and Profile concurrently.
- [ ] Simulate poor connection or temporary API outage.
- [ ] Confirm app does not crash.
- [ ] Confirm unsaved form data is preserved where applicable.
- [ ] Confirm queued/offline sync still works.

### Status Notes

- [x] API now emits an `x-request-id` response header and logs method, path, status, and duration.
- [x] Mobile API requests now send `x-request-id`, log duration, and classify failures as timeout, network, or server response.
- [x] Mobile request timeout was increased from 15 seconds to 30 seconds to reduce false timeout failures during slow API/database responses.
- [x] Records screen now uses one shared load path for screen focus and refresh instead of a separate duplicated focus loader.
- [x] Offline queue "sync all" now has an in-process guard so overlapping sync attempts share one run instead of uploading the same local queue concurrently.
- [ ] Production Render logs still need to be reviewed after redeploy.
- [ ] Supabase slow query/resource data still needs to be reviewed during multi-user testing.

## 2. Advanced Medical Responder / STAB - GCS Display

### Investigation

- [ ] Locate current GCS options in the AMP/STAB workflow.
- [ ] Confirm whether automatic GCS total is already calculated.
- [ ] Confirm stored assessment field names stay unchanged.

### Likely Files

- [ ] `mobile/src/app/(tabs)/add-casualty.tsx`
- [ ] `api/src/services/triage/calculate-triage.ts`
- [ ] `api/src/services/triage/calculate-triage.test.ts`

### Implementation

- [ ] Show score numbers beside GCS Eye Opening options.
- [ ] Show score numbers beside GCS Verbal Response options.
- [ ] Show score numbers beside GCS Motor Response options.
- [ ] Keep existing option values and API payload fields.
- [ ] Display `GCS Total: X / 15` after all three components are selected, if appropriate.

### Testing

- [ ] Log in as AMP/STAB account.
- [ ] Open Add Casualty.
- [ ] Navigate to the GCS assessment fields.
- [ ] Confirm each option shows the number and description.
- [ ] Select all three components.
- [ ] Confirm total displays correctly.
- [ ] Submit record and confirm triage calculation still works.

## 3. Superadmin - Closed Incident / Final SitRep

### Investigation

- [ ] Locate current incident status source of truth.
- [ ] Locate Final SitRep generation/export UI.
- [ ] Confirm whether Final SitRep can currently be exported before incident closure.
- [ ] Check backend export route behavior, if any closed-status enforcement exists.

### Likely Files

- [ ] `website/app.js`
- [ ] `api/src/controllers/export.controller.ts`
- [ ] `api/src/routes/export.routes.ts`
- [ ] `api/src/controllers/incident.controller.ts`

### Implementation

- [ ] Add a clear closed-incident indicator when status is `closed`.
- [ ] Display text such as `INCIDENT CLOSED - Final SitRep is now available for export.`
- [ ] Use database incident status, not temporary frontend state.
- [ ] Disable or hide Final SitRep export until closure if currently available too early.
- [ ] Preserve existing SitRep export logic unless enforcement is required.

### Testing

- [ ] Open an active incident as admin/superadmin.
- [ ] Confirm closed indicator is not shown.
- [ ] Confirm Final SitRep is unavailable or disabled if required.
- [ ] Close the incident.
- [ ] Confirm closed indicator appears.
- [ ] Confirm Final SitRep export is clearly available.

## 4. Admin - Incident Management Timeline Redesign

### Investigation

- [ ] Locate current incident response timeline section.
- [ ] Identify manually encoded timeline fields.
- [ ] Identify system/mobile-derived timeline fields.
- [ ] Confirm save behavior updates existing timeline row instead of creating duplicates.
- [ ] Confirm current date/time format used elsewhere in DCMS.

### Required Manual Timeline Sequence

- [ ] Incident Onset
- [ ] Event Notification
- [ ] Activation of DMMP
- [ ] Notification of First Appropriate Staff Person to Assume Medical Management Coordination Role
- [ ] First EMS Vehicle Arrived
- [ ] Triage Ordered
- [ ] Scene Demobilized

### Likely Files

- [ ] `website/app.js`
- [ ] `api/src/controllers/incident-operations.controller.ts`
- [ ] `api/src/routes/incident-operations.routes.ts`
- [ ] `mobile/src/api/incidents.ts`

### Implementation

- [ ] Create one dedicated manual timeline section/menu.
- [ ] Place all seven manual time points in the required order.
- [ ] Add date/time input for every manual time point.
- [ ] Add `Use current time` button for every manual time point.
- [ ] Ensure current time button uses the app's existing date/time format.
- [ ] Keep mobile/system extracted timeline events.
- [ ] Keep mobile/system extracted events read-only unless already editable by design.
- [ ] Preserve chronological sorting in final timeline display.
- [ ] Ensure edits update existing timeline data rather than duplicating records.

### Testing

- [ ] Open Incident Management as admin.
- [ ] Enter all seven manual time points.
- [ ] Use `Use current time` on each field.
- [ ] Save and reload the incident.
- [ ] Confirm values persist.
- [ ] Edit one value and save.
- [ ] Confirm it updates instead of creating a duplicate.
- [ ] Confirm system/mobile timeline events still display.

## 5. All Accounts - Remove Guest Responder Screen

### Investigation

- [ ] Locate app entry route.
- [ ] Locate Guest Responder/Landing screen.
- [ ] Locate logout redirect.
- [ ] Locate expired-session redirect.
- [ ] Check guest-mode messages across tabs.

### Likely Files

- [ ] `mobile/src/app/index.tsx`
- [ ] `mobile/src/screens/LandingScreen.tsx`
- [ ] `mobile/src/app/login.tsx`
- [ ] `mobile/src/app/(tabs)/profile.tsx`
- [ ] `mobile/src/screens/dashboard/HomeDashboardScreen.tsx`
- [ ] `mobile/src/app/(tabs)/records.tsx`
- [ ] `mobile/src/app/(tabs)/notifications.tsx`
- [ ] `mobile/src/auth/session.ts`

### Implementation

- [ ] Make app open directly to Login.
- [ ] Remove or bypass Guest Responder as an intermediate screen.
- [ ] Ensure logout returns to Login.
- [ ] Ensure expired or invalid session returns to Login.
- [ ] Make sure users are not redirected back to Guest Responder.
- [ ] Preserve authentication for FR, AMP, HCFD, Admin, and Superadmin.
- [ ] Decide whether guest/offline capture mode should be fully removed or only hidden from initial flow.

### Testing

- [ ] Open app fresh.
- [ ] Confirm Login is first screen.
- [ ] Log in as Field Responder.
- [ ] Log in as AMP.
- [ ] Log in as HCFD.
- [ ] Log in as Admin.
- [ ] Log in as Superadmin.
- [ ] Log out and confirm redirect to Login.
- [ ] Expire/clear session and confirm redirect to Login.

## Global Rules For All Fixes

- [ ] Inspect current implementation before changing each issue.
- [ ] Preserve current database relationships.
- [ ] Preserve role restrictions.
- [ ] Preserve API contracts unless absolutely required.
- [ ] Preserve current record data.
- [ ] Do not redesign unrelated modules.
- [ ] Make changes incrementally.
- [ ] Identify root cause before final fix.
- [ ] Test each issue before moving to the next one.
- [ ] Keep user-facing terminology consistent with current system.
