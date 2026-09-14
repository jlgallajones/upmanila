# Disaster Casualty Management System User Manual

Progress submission version for the current Disaster Casualty Management System implementation.

## 1. Purpose Of The System

The Disaster Casualty Management System, or DCMS, helps responders and administrators encode, review, verify, match, analyze, and export casualty records during disaster response operations.

The system has two main user interfaces:

- **Web Dashboard** for super admins and admins.
- **Mobile/PWA App** for Field Responders, SAR/Stabilization Area Responders, and Healthcare Facility Documenters.

## 2. User Roles

### Super Admin

Uses the web dashboard to:

- View system summary information.
- Create administrator accounts.
- View action logs.
- Export or back up system data.
- Perform system-wide reset operations when allowed.

### Admin

Uses the web dashboard to:

- Create and manage Field Responder, SAR, and HCFD accounts.
- Create official incidents.
- Manage healthcare facilities.
- Review casualty records.
- Verify, reject, or delete casualty submissions.
- Match FR, SAR, and HCFD casualty records into one matched case.
- View incident analytics.
- Export scoped records.
- View action logs.

### Field Responder

Uses the mobile/PWA app to:

- Add Field Responder casualty records.
- Record field-side triage and status data.
- Attach casualty photos.
- Submit records online or queue records offline.
- View synced and queued records.

### SAR / Stabilization Area Responder

Uses the mobile/PWA app to:

- Add SAR/Stabilization casualty records.
- Record stabilization, transport, and related field data.
- Attach casualty photos.
- Submit records online or queue records offline.
- View synced and queued records.

### Healthcare Facility Documenter

Uses the mobile/PWA app to:

- Add healthcare facility casualty records.
- Record facility-side triage, treatment, outcome, and resource data.
- Attach casualty photos.
- Submit records online or queue records offline.
- View synced and queued records.

## 3. General Login

1. Open the web dashboard or mobile/PWA app.
2. Enter the assigned email and password.
3. Select login.
4. After successful login, the system opens the dashboard for the user's role.

If login fails:

- Check email spelling.
- Check password.
- Confirm the account is active.
- Confirm the app is connected to the correct API.
- Contact an admin if the account is disabled or missing.

## 4. Web Dashboard Manual

### 4.1 Dashboard Navigation

After login, the sidebar shows available sections based on role.

Common admin sections include:

- Homepage.
- Incident Management.
- Incident Analytics.
- Official Incidents.
- Healthcare Facilities.
- Accounts.
- Casualty Records.
- Match Casing.
- Matched Cases.
- Verification Review.
- Action Logs.
- Drafts.

Use the sidebar to move between sections. The sidebar can be collapsed to save screen space.

### 4.2 Create Operational Accounts

Admin path:

```text
Accounts
```

Steps:

1. Open **Accounts**.
2. Enter the account user's full name and email.
3. Select the account role:
   - Field Responder.
   - SAR Responder.
   - Healthcare Facility Documenter.
4. Enter a temporary password.
5. Use the show/hide password control if needed.
6. Confirm assigned municipality/barangay if applicable.
7. Select **Save draft** if the account details are not ready.
8. Submit the form when ready.

Notes:

- New responder accounts should use Field Responder or SAR, not the legacy responder role.
- Existing legacy accounts remain visible for compatibility.
- Admins may edit existing accounts when needed.
- Temporary passwords are not stored in saved drafts. Type the password when creating the account.

### 4.3 Bulk Upload Accounts Or Reference Data

Where available, bulk upload allows CSV/Excel-style import.

Steps:

1. Open the related management section.
2. Choose the upload/import control.
3. Select the CSV or Excel file.
4. Review the preview table.
5. Check row statuses:
   - Valid.
   - Duplicate.
   - Invalid.
6. Fix invalid rows if needed.
7. Confirm import.

Import only saves records after explicit confirmation.

### 4.4 Create Official Incident

Admin path:

```text
Official Incidents
```

Steps:

1. Open **Official Incidents**.
2. Enter incident name and required incident details.
3. Select **Save draft** if the incident details are not ready for submission.
4. Select **Create official incident** when ready.
5. Confirm the incident appears in incident lists and mobile incident selection.

Important:

- Mobile users need incident data loaded before offline incident selection can work.
- If mobile users cannot see an incident, confirm the API is online and the app has refreshed incident data.

### 4.5 Manage Healthcare Facilities

Admin path:

```text
Healthcare Facilities
```

Steps:

1. Open **Healthcare Facilities**.
2. Add a healthcare facility manually or import in bulk.
3. Select **Save draft** if the facility details are not ready for submission.
4. Edit facilities when details change.
5. Use exports if facility lists are needed for reporting.

### 4.6 View Casualty Records

Admin path:

```text
Casualty Records
```

Steps:

1. Open **Casualty Records**.
2. Use filters if available.
3. Select a casualty record.
4. Review role sections:
   - Field Responder.
   - SAR.
   - Healthcare Facility Documenter.
5. Open attachments if present.
6. If the record is part of a matched case, review the **Matched Case** section.

Notes:

- Matched records remain separate in the database.
- The dashboard combines linked role records for viewing.

### 4.7 Review Attachments

Attachments may appear in casualty detail modals.

Steps:

1. Open a casualty record.
2. Find the attachment/photo area.
3. Click the attachment.
4. Review the expanded view.
5. Close the preview when done.

### 4.8 Verification Review

Admin path:

```text
Verification Review
```

Steps:

1. Open **Verification Review**.
2. Select a submitted casualty record.
3. Review casualty details and attachments.
4. Choose an action:
   - Approve/verify.
   - Reject with reason.
   - Delete if appropriate.
5. Confirm destructive actions through the in-app confirmation modal.

Expected result:

- Approved records become verified.
- Rejected records show rejection/review history.
- Deleted records are removed from web and mobile records where scoped.

### 4.9 Match Casing

Admin path:

```text
Match Casing
```

Purpose:

Match Casing connects three separate records for the same casualty:

- One Field Responder record.
- One SAR record.
- One HCFD record.

Rules:

- All three roles must be filled before matching.
- The selected records must belong to the same incident.
- Already matched records cannot be selected again.
- A selected record can be replaced before matching.
- Once submitted, the matched case is locked and cannot be undone.

Steps:

1. Open **Match Casing**.
2. Use the incident dropdown to filter records if needed.
3. Review the available record count.
4. In the Field Responder box, click the large add button.
5. Select one Field Responder record from the popup.
6. Repeat for SAR.
7. Repeat for HCFD.
8. Confirm all three boxes are filled.
9. Click **Match selected records** at the bottom.
10. The completed match appears in **Matched Cases**.

To replace a selection before submitting:

1. Click **Replace** in the role box.
2. Choose a different record for that role.

### 4.10 Matched Cases

Admin path:

```text
Matched Cases
```

Purpose:

Review completed and locked matched cases.

Steps:

1. Open **Matched Cases**.
2. Use the incident dropdown if needed.
3. Review each matched case group.
4. Open individual records from the case cards.

Notes:

- Submitted matches cannot be undone.
- Matching does not merge database records.
- Each original role record remains traceable.

### 4.11 Incident Analytics

Admin path:

```text
Incident Analytics
```

Steps:

1. Open **Incident Analytics**.
2. Select an incident.
3. Review available charts and statistics.

Possible analytics include:

- Casualty counts.
- Triage category distributions.
- ED care triage charts.
- Timeline summaries.
- Facility/resource metrics.
- Transport/facility arrival metrics.

If a chart shows no data:

- Confirm the selected incident has matching casualty records.
- Confirm the required fields were encoded by the relevant role.
- Confirm the API is using the latest backend code.

### 4.12 Action Logs

Admin path:

```text
Action Logs
```

Use this section to review tracked actions such as:

- Account creation or edits.
- Casualty approval/rejection/deletion.
- Casualty submission.
- Incident creation.
- Facility imports.
- Healthcare facility edits.
- Attachment uploads.
- Bulk upload results.
- Match Casing creation.
- Draft saves, updates, and deletes.
- Reset operations.

Scope:

- Admins see actions within their admin unit.
- Super admins see higher-level system/admin activity.

### 4.13 Web Drafts

Admin path:

```text
Drafts
```

Use Drafts to continue unfinished web dashboard forms.

Supported web drafts:

- Account creation forms.
- Official incident forms.
- Healthcare facility forms.

Steps:

1. Start filling an incident or healthcare facility form.
2. Click **Save draft**.
3. The form clears after the draft is saved.
4. Open **Drafts** from the sidebar or click **Open drafts** from the form.
5. Click **Resume** to continue the form.
6. Click **Delete** to remove an unused draft.

Notes:

- Drafts are saved to the logged-in user's account.
- Account drafts do not save temporary passwords.
- Drafts do not create official records until the user submits the actual form.
- Deleting a draft does not delete submitted records.

### 4.14 Data Export

Where export buttons are available:

1. Open the relevant dashboard section.
2. Click the export button.
3. Wait for the download to complete.
4. Open the downloaded file for review.

Exports may include:

- Casualty records.
- Responders/documenters.
- Healthcare facilities.
- Incident packages.
- System backup for super admins.

### 4.15 Profile And Password

Steps:

1. Click the profile/user area if available.
2. Review account details.
3. Edit supported account details.
4. Change password if needed.
5. Save changes.

Reset tools:

- Super admin reset clears system operational data while keeping accounts.
- Admin reset clears scoped operational data while keeping accounts.
- Reset actions require confirmation and are logged.

### 4.16 Logout

Steps:

1. Click **Logout**.
2. Confirm the logout prompt.
3. The system returns to login.

## 5. Mobile/PWA User Manual

### 5.1 Open The Mobile App

Open the mobile/PWA URL in a phone browser or installed PWA shortcut.

Recommended:

- Use a stable internet connection for first login.
- Load incident data online before relying on offline mode.
- Keep the browser/PWA updated after deployments.

### 5.2 Login

Steps:

1. Enter email and password.
2. Tap login.
3. Wait for the home screen to load.

If login fails:

- Check internet connection.
- Confirm credentials.
- Contact the admin to reset or activate the account.

### 5.3 Add Casualty

Steps:

1. Open **Add Casualty**.
2. Select an incident.
3. Complete the role-specific casualty form.
4. Add photo attachment if available or required.
5. Tap **Save Draft** if the record is not ready for submission.
6. Review entries.
7. Submit.

Role behavior:

- Field Responder sees Field Responder casualty fields.
- SAR sees SAR/Stabilization casualty fields.
- HCFD sees Healthcare Facility Documenter fields.

### 5.4 Mobile Drafts

Use Drafts to continue unfinished mobile casualty forms.

Steps:

1. Open **Add Casualty**.
2. Fill any available fields.
3. Tap **Save Draft** in the bottom action bar.
4. The Add Casualty form clears after the draft is saved.
5. Open the **Drafts** tab.
6. Tap **Resume** to continue the draft.
7. Tap **Delete** to remove a draft that is no longer needed.

Notes:

- Mobile drafts are saved locally on the device.
- A submitted or successfully queued resumed draft is removed automatically.
- Local drafts are separate from synced casualty records.

### 5.5 Add Photo Attachment

Steps:

1. Tap **Add Casualty Photo** or attachment control.
2. Choose:
   - Capture photo.
   - Import photo.
3. Confirm the image.
4. Submit the casualty record.

Notes:

- Capture photo should open the camera on supported devices.
- Import photo opens the file/gallery picker.
- Attachments are synced with the record when online.

### 5.6 Offline Submission

Offline behavior:

- If the API cannot be reached, casualty submissions can be saved locally.
- Queued records show pending or failed sync state.
- The user can retry later.

Important:

- The app must have loaded incident data online before offline incident selection can work.
- First-time offline users may not see incidents until the device has cached them.

### 5.7 Records Screen

Use the Records screen to:

- View synced casualty records.
- View locally queued records.
- Check pending or failed sync state.
- Retry a failed record.
- Retry all queued records.

### 5.8 Retry Failed Sync

Steps:

1. Open **Records**.
2. Find a failed queued record.
3. Tap retry.
4. If there are multiple queued records, use retry all if available.
5. Confirm the record changes from failed/pending to synced.

If retry fails:

- Check internet connection.
- Confirm the API is online.
- Confirm the incident still exists.
- Contact admin if the error repeats.

### 5.9 Notifications

The mobile app may show notifications related to record status or review actions. Open notifications to review updates when available.

### 5.10 Profile

Use Profile to:

- View account details.
- Confirm assigned role.
- Confirm account/session status.

For new Field Responder and SAR accounts, the operational role is assigned by the admin and cannot be switched from the device.

## 6. Common Troubleshooting

### Web dashboard calls the deployed API instead of local API

Check browser DevTools Network tab.

If requests point to Render but local testing is needed:

- Set dashboard API base URL to `http://localhost:5000/api`.
- Restart the local API.
- Refresh the dashboard.

### New FR/SAR account creation fails

Possible cause:

- The API has not been redeployed/restarted after the role separation update.
- The database role migration has not been applied.

Fix:

1. Run `api/sql/add-separated-responder-roles.sql`.
2. Restart or redeploy the API.
3. Retry account creation.

### Match Casing has no available records

Check:

- The selected incident filter.
- Whether records already belong to a matched case.
- Whether all three roles have submitted records.
- Whether the records are visible within the current admin scope.

### Cannot match case

The system requires:

- One Field Responder record.
- One SAR record.
- One HCFD record.
- Same incident for all three.
- No selected record already matched.

### Mobile offline cannot select incident

Cause:

- Incident list has not been cached yet.

Fix:

1. Go online.
2. Login/open the app.
3. Load the incident list.
4. Then test offline mode again.

### Export fails

Check:

- User role permission.
- API deployment status.
- Console/network error message.
- Whether backend migration or latest API code has been deployed.

## 7. Recommended Presentation Flow

1. Login as admin on the web dashboard.
2. Create or show an incident.
3. Show account management with FR, SAR, and HCFD roles.
4. Login on mobile as Field Responder and submit a casualty with photo.
5. Submit related SAR and HCFD records.
6. Show the records in the web dashboard.
7. Open Match Casing and fill the three role boxes.
8. Submit the matched case.
9. Open Matched Cases.
10. Open the casualty record and show combined role sections.
11. Show Verification Review.
12. Show Incident Analytics.
13. Show Action Logs.
14. Show export options.
15. Demonstrate mobile offline queue and retry if time allows.

## 8. Data Safety Notes

- Accounts are kept during reset operations.
- Destructive actions use confirmation modals.
- Match Casing does not merge or rewrite original records.
- Matched cases are locked after submission.
- Audit logs provide traceability for major actions.
