# Documentation Of Separation

This document explains the separation of the old combined responder setup into separate Field Responder and AMP Responder roles.

## What Changed

The system now supports separate operational account roles:

- `field_responder` for Field Responder / FR accounts.
- `sa_responder` for AMP / Advanced Medical Responder accounts.
- `documenter` for Healthcare Facility Documenter / HCFD accounts.
- `responder` remains supported as a legacy role for old accounts and old records.

## Database Change

A database migration file was added:

- `api/sql/add-separated-responder-roles.sql`

That SQL adds these enum values to `public.user_role`:

- `field_responder`
- `sa_responder`

Existing `responder` users are intentionally not changed by the SQL migration.

## Backend/API Changes

The API account-management logic now accepts and manages:

- `field_responder`
- `sa_responder`
- `documenter`
- legacy `responder`
- legacy `medical_personnel`

Account creation now maps the roles to reporting contexts:

- Field Responder -> `scene`
- AMP Responder -> `transport`
- HCFD -> `receiving_facility_ed`
- Legacy Responder -> `scene`

The responder/documenter export now includes the new FR and AMP roles, so exports do not fail or omit those accounts.

The API permission middleware already treats FR and AMP as responder-compatible roles, so existing responder endpoints continue to work.

## Web Dashboard Changes

In Account Management, admins now create:

- Field Responder
- AMP Responder
- Healthcare Facility Documenter

The old generic Responder option was removed from new account creation.

When editing existing accounts, legacy `responder` still appears as `Legacy Responder` so old accounts can still be seen and reassigned to Field Responder or AMP Responder.

Bulk upload templates and validation now use:

- `field_responder`
- `sa_responder`
- `documenter`

For compatibility, uploaded role labels like FR, Field Responder, AMP, SAR, Stabilization Area Responder, HCFD, Healthcare Documenter, and Documenter are normalized into the correct stored role.

## Mobile App Changes

The mobile app already had role-aware Add Casualty and Records behavior for FR, AMP, and HCFD. The transition tightened the role precedence:

- New `field_responder` accounts always use the Field Responder casualty flow.
- New `sa_responder` accounts always use the AMP/Stabilization casualty flow.
- HCFD/documenter accounts continue to use the HCFD casualty flow.
- Legacy `responder` accounts can still use the old mobile Profile responder-function selector.

For new FR and AMP accounts, the mobile Profile page shows the assigned function but does not allow switching it from the device. Role assignment is now controlled by admin account management.

## Existing Accounts

Existing accounts with role `responder` are preserved.

They are not automatically converted because the system cannot safely know whether each old responder account should become FR or AMP.

Admins can manually edit each legacy responder account in Account Management and change it to:

- Field Responder
- AMP Responder

Until edited, a legacy responder account still works using the mobile legacy responder-function selection.

## Existing Casualty Records

Existing casualty records are preserved.

No casualty records are deleted, moved, or rewritten by this separation.

Old records remain connected to:

- their casualty record ID
- their incident ID
- their encoder account
- their existing triage, treatment, transport, attachment, and verification data

The web dashboard still displays old records using the data already stored in the record, including Field Responder, AMP, and HCFD sections where data exists.

## Incident Analytics

Incident Analytics continues to work because analytics are primarily based on incident-linked casualty records, triage records, transport records, facility encounters, outcomes, timelines, and responder safety data.

The role split does not remove analytics data.

Analytics can still include old `responder` records because legacy responder remains compatible with responder workflows.

## Verification Review And Casualty Records

Verification Review and Casualty Records continue to show records by incident and admin scope.

The role separation mainly affects which Add Casualty fields a new account sees and which account role label is shown.

Existing records remain visible to admins and super admins according to the existing scope rules.

## Clean Transition Rule

The project now follows this rule:

- New accounts should use `field_responder`, `sa_responder`, or `documenter`.
- Old `responder` accounts remain readable and usable until manually reassigned.
- Existing records stay unchanged.
- Analytics and review screens continue reading historical data.

This avoids breaking current data while allowing the team to move forward with clearly separated FR, AMP, and HCFD accounts.

## Account Creation Validation Issue Found After Separation

After the role separation, creating a new FR or AMP account can still show the old security message:

- `Admins can only create responder or documenter accounts.`

That message is from the pre-separation API validation. It means the web dashboard reached an older API build that only knows the old `responder` and `documenter` roles.

The current source code already accepts:

- `field_responder`
- `sa_responder`
- `documenter`
- legacy `responder`
- legacy `medical_personnel`

The dashboard now translates that old API response into a clearer message explaining that the API must be restarted or redeployed.

## Required Deployment/Runtime Steps For Account Separation

To make account creation work after the separation:

1. Run the database migration:
   - `api/sql/add-separated-responder-roles.sql`

2. Restart or redeploy the API backend.
   - This is required because role validation happens in the backend.
   - Redeploying only the website is not enough.

3. If running locally, make sure the web dashboard is calling:
   - `http://localhost:5000/api`

4. If the dashboard still calls the deployed Render API, either redeploy Render or change the local dashboard API base URL.

5. If running the backend through `npm start`, rebuild first because `npm start` uses compiled files:
   - `cd api`
   - `npm run build`
   - `npm start`

6. If running the backend through development mode, restart:
   - `cd api`
   - `npm run dev`

## How To Confirm The Correct API Is Being Used

In browser DevTools:

1. Open the Network tab.
2. Create a Field Responder or AMP account.
3. Click the `/api/auth/register-unit-user` request.
4. Confirm the request URL points to the updated API.

If the URL points to Render and Render has not been redeployed, the old validation message can still appear.

If the URL points to localhost but the old validation appears, the local API process is still running an old build and needs to be restarted or rebuilt.

## Match Casing Preparation

After separating FR, AMP, and HCFD into distinct account roles, each role can create a separate casualty record for the same real-world casualty.

This means the dashboard may show partial role sections:

- FR section filled, AMP and HCFD empty.
- AMP section filled, FR and HCFD empty.
- HCFD section filled, FR and AMP empty.

That is expected until a future Match Casing workflow links those separate role submissions into one casualty case.

Because the fields collected by FR, AMP, and HCFD are different, matching cannot rely on identical field values. The only commonly similar field is victim code, but victim code can differ because different users may encode or generate different values.

The recommended Match Casing approach is admin-confirmed matching based on:

- casualty photo attachment
- same incident
- close submission or event times
- triage category progression
- location, transport, or receiving-facility clues
- age, sex, name, or descriptive details when available
- admin judgment

Photo attachment is important but should not be the only matching rule because photos can be missing, unclear, duplicated, or added late.

## Attachment Support For Match Casing

To support future Match Casing, the mobile Add Casualty flow now exposes the same Add Casualty Photo control to all separated operational roles:

- Field Responder: photo attachment added to the Status step.
- AMP / Advanced Medical Responder: existing photo attachment remains in the Remarks step.
- HCFD / Healthcare Facility Documenter: photo attachment added to the Disposition step.

The existing shared photo capture/import, offline queue, upload, and attachment viewing logic is reused. This keeps attachment behavior consistent across all roles while making photo-based case review possible later.

## Match Casing Implementation

The first Match Casing workflow has been added to the admin web dashboard.

New dashboard section:

- `Match Casing`

What it does:

- Shows casualty records visible to the logged-in admin.
- Shows photo clues from each record's attachments.
- Lets the admin filter by incident.
- Lets the admin fill the required Field Responder and AMP slots, with HCFD available as an optional slot.
- Lets the admin match the required role selection into one locked casualty case.
- Shows completed matches in the separate Matched Cases section.
- Shows linked role records when opening a matched casualty record in Casualty Records or Verification Review.
- Uses the linked role records to fill the matching role sections in the casualty modal.

The matching rules are enforced by the API:

- Records must belong to the same incident.
- Records must be visible within the admin's scope.
- A new matched case must contain exactly one record for each required role slot.
- Required role slots are:
  - Field Responder
  - Advanced Medical Responder (AMP)
- HCFD is optional when the healthcare facility record is already available.
- Legacy responder records remain viewable as old data but are not eligible for new complete-case matching.

New database migration:

- `api/sql/add-casualty-case-links.sql`

New table:

- `casualty_case_links`

Important behavior:

- Existing casualty records are not merged.
- Existing casualty records are not deleted.
- Existing casualty records are not rewritten.
- The match is stored as a link layer on top of existing records.
- A matched case is locked after submission and cannot be undone from the dashboard or API.
- New matches require one Field Responder record and one AMP record. HCFD can be added when available.

New API behavior:

- `GET /api/casualties/case-links`
  - Retrieves matched case links visible to the current admin/super admin.

- `POST /api/casualties/case-links`
  - Creates a complete matched casualty case from required FR and AMP records, with optional HCFD.

- `DELETE /api/casualties/:id/case-link`
  - No longer removes links. Matched cases are locked after submission.

Audit log actions:

- `casualty.case_matched`

This gives admins a manual way to connect separate FR, AMP, and optional HCFD submissions while preserving the separated role records.

## How To Verify A Match Worked

After matching records:

1. Open **Match Casing**.
2. Fill the required role boxes:
   - Field Responder
   - AMP
   - Optional: HCFD
3. Click **Match selected records** at the bottom of the role boxes.
4. Confirm the records appear under **Matched Cases**.
5. Open any matched record from **Casualty Records** or **Verification Review**.
6. Check the new **Matched Case** section at the top of the casualty modal.
7. The section lists the linked FR, AMP, and optional HCFD records and includes an **Open matched record** button.
8. Scroll to the role sections.
   - Linked FR data fills the Field Responder section.
   - Linked AMP data fills the Advanced Medical Responder section.
   - Linked HCFD data fills the Healthcare Facility Documenter section.

Important note:

- Matching does not copy HCFD fields into the FR database record.
- Matching does not copy FR fields into the HCFD database record.
- The web modal combines the linked records for viewing, while the database records remain separate.

This is intentional so original submissions remain traceable by role and encoder.

## Match Casing Selection UX Update

The Match Casing selection flow was changed from open record-card selection to a guided role-slot workflow.

Current behavior:

- The Match Casing page only shows available record counts, required FR and AMP boxes, and an optional HCFD box.
- The required boxes are Field Responder and AMP.
- Each box has a large add button that opens a role-specific picker modal.
- The Field Responder picker only shows Field Responder records.
- The AMP picker only shows AMP records.
- The HCFD picker only shows HCFD records.
- Already selected records and already matched records are hidden from picker options.
- A selected record can be replaced before clicking **Match selected records**.
- The **Match selected records** button appears below the role boxes.
- The button is enabled once the required FR and AMP boxes are filled.
- The **View matched cases** and **Create match** navigation buttons sit beside the incident dropdown in their filter panels.
- Submitted matched cases are locked and cannot be undone.
- Completed matches are reviewed in the separate **Matched Cases** section.

This keeps matching manual while preventing incomplete required-role matches and accidental duplicate same-role matches.
