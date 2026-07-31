# DCMS Mobile App Current Status

Last updated: July 31, 2026

## Overview

The mobile app is an Expo React Native application that now also exports as a Progressive Web App (PWA). It can be opened in a mobile browser and installed to a phone home screen through Safari/Chrome after the web build is deployed.

The app currently supports casualty/victim encoding, incident management, triage assessment, transport details, clinical status, hospital care details, records viewing, verification review, and incident operation summaries.

## Current Build Status

The current web/PWA build command is:

```powershell
npm.cmd run build:web
```

This generates the production web output in:

```text
mobile/dist
```

The latest checks passed:

```powershell
npx.cmd tsc --noEmit
npm.cmd run build:web
```

## Major Features Currently Implemented

- PWA export support with `manifest.webmanifest`, service worker, and web metadata.
- Landing page with UP, UPM DRRMH, DOST, and DOST PCHRD logos.
- Add Casualty wizard with 8 steps:
  - Personal
  - Address
  - Incident
  - Triage
  - Status
  - Transport
  - Hospital Care
  - Remarks
- Disaster-first workflow:
  - User can create/select an incident first.
  - User can add casualties directly under a selected incident.
  - Add Casualty shows the selected incident context.
- Incident quick-create, evacuation center quick-create, and healthcare facility quick-create are collapsible.
- Hazard type selection is now a searchable drop-down/combo picker using the expanded hazard list from the matrix.
- Triage assessment is shown as a popup after selecting a triage system.
- Triage category is calculated by the system algorithms instead of relying only on the user-visible input field.
- Final triage choices are color-coded and arranged evenly.
- "Use current time" controls now use a consistent input + button layout.
- Overtriage/undertriage accuracy summaries are hidden from the normal mobile user flow to reduce biased data entry.
- Verification review was moved out of individual record details into a dedicated Verification Review queue.
- Quick Actions on the dashboard now scroll horizontally and include Verification Review.
- Role-based triage stage filtering was added:
  - `responder` sees Primary Triage and Secondary Triage.
  - `medical_personnel` sees Tertiary Triage.
  - `administrator`, `super_admin`, and `encoder` see all triage stages.

## Triage Status

The app currently separates:

- User-entered/responder final triage from the assessment popup.
- System-calculated triage category from algorithm logic.
- Overtriage/undertriage detection in backend/reporting logic.

The visible triage category field was removed from the Add Casualty form. The system still submits triage information using the assessment answers and keeps calculated triage results available for reporting.

Important limitation: role-based triage filtering is currently based on account role only. The app does not yet know the user's real reporting location or assignment, such as scene, ambulance/transport, emergency department, or receiving ward.

## Known Issues Found and Fixed

- `npm ci` failed on a new Windows device because PowerShell execution policy blocked `npm.ps1`.
  - Workaround used: run npm through `npm.cmd`.
- PWA build output was missing before the web export setup.
  - Fixed by adding `build:web` and PWA metadata/service worker files.
- React production error `#418` occurred in the Safari-installed PWA.
  - Likely cause: hydration mismatch from generating dates/IDs during initial static render.
  - Fixed by moving auto-generated casualty ID, default triage time, and page dates to client-side effects.
- Add Casualty step labels wrapped badly on iPhone PWA.
  - Fixed by using compact one-line progress labels.
- Quick Actions overflowed horizontally and could not be scrolled.
  - Fixed by making the quick action row horizontally scrollable.
- Verification review controls were mixed into normal record detail viewing.
  - Fixed by moving review actions to a dedicated review queue.
- Deactivation & Continuity modal spacing was too bulky.
  - Improved summary card sizing, disruption grid layout, and current-time controls.

## Current Limitations

- No true separate interfaces yet for bystander, EMT, nurse, administrator, etc.
- Triage stage filtering is role-based, not assignment/location-based.
- The current roles are broad:
  - `responder`
  - `medical_personnel`
  - `encoder`
  - `administrator`
  - `super_admin`
- There is no explicit user profile field yet for:
  - reporting location
  - assignment
  - triage scope
  - facility/scene context
- The triage algorithm implementation should still be clinically validated against the final approved Utstein template/matrix.
- PWA behavior should still be tested on real iOS Safari after every deployment because service worker caching can keep older bundles.
- There are no dedicated automated UI/e2e tests for the mobile workflows yet.
- Visual QA has been manual so far; responsive regressions may still appear on different phone sizes.

## Recommended Improvements

1. Add role-specific or assignment-specific interfaces.
   - Bystander: minimal casualty report only.
   - EMT/responder: primary and secondary triage, scene care, transport.
   - Nurse/receiving facility: tertiary triage, ED/hospital care, facility resources.
   - Admin/researcher: reporting, verification, overtriage/undertriage summaries.

2. Add a user assignment field separate from role.
   - Example values:
     - `scene`
     - `transport`
     - `receiving_facility`
     - `admin`
   - This is better than using role alone because a responder and nurse may both need different screens depending on where they are assigned.

3. Add stronger triage-stage enforcement in the backend.
   - The mobile app currently filters the UI.
   - Backend validation should also prevent unauthorized triage stages for a user's role/assignment.

4. Add an admin-only analytics/reporting dashboard.
   - Keep overtriage/undertriage hidden from encoders.
   - Show aggregate values only to authorized reviewers/researchers.

5. Add automated tests.
   - Typecheck already passes.
   - Recommended next tests:
     - Add casualty submit flow.
     - Incident-first casualty flow.
     - Triage assessment calculation flow.
     - Verification review queue.
     - PWA hydration smoke test.

6. Improve deployment/cache handling for PWA.
   - Add clearer versioning/cache busting.
   - Confirm users receive the newest bundle after updating `dist`.
   - Consider showing an "Update available" prompt when a new service worker is installed.

## Suggested Next Development Priority

The highest-value next improvement is to add a real **reporting context / assignment** model. The current role-based triage filtering is a good first step, but the client request is really about where the user is reporting from.

Recommended model:

```text
role: responder | medical_personnel | encoder | administrator | super_admin
assignment: scene | transport | receiving_facility | command_center
triage_scope: primary | secondary | tertiary | all
```

Then the app can show the correct menus more accurately:

- Scene/EMT: Primary Triage and Secondary Triage.
- Transport team: Secondary Triage and transport fields.
- Receiving facility nurse: Tertiary Triage and hospital care fields.
- Administrator/researcher: reports and aggregate metrics.

## Developer Notes

Main files changed during this phase:

- `mobile/src/app/(tabs)/add-casualty.tsx`
- `mobile/src/app/incidents.tsx`
- `mobile/src/app/verification-review.tsx`
- `mobile/src/screens/dashboard/HomeDashboardScreen.tsx`
- `mobile/src/screens/casualties/CasualtyDetailScreen.tsx`
- `mobile/src/screens/LandingScreen.tsx`
- `mobile/src/app/+html.tsx`
- `mobile/public/manifest.webmanifest`
- `mobile/public/sw.js`
- `api/src/services/triage/calculate-triage.ts`

Build commands:

```powershell
cd C:\Users\jlgallajones\upmanila\disaster-casualty-system\mobile
npm.cmd run build:web
```

Typecheck command:

```powershell
cd C:\Users\jlgallajones\upmanila\disaster-casualty-system\mobile
npx.cmd tsc --noEmit
```
