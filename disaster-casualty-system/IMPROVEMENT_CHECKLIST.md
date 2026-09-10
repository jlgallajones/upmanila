# DCMS Improvement Checklist

Use this checklist to track system polish, reliability, and presentation-readiness improvements.

## 1. Destructive Action Confirmation

- [x] Replace remaining browser `confirm()` dialogs with in-app confirmation modals.
- [x] Replace remaining browser `alert()` messages with dashboard/mobile styled feedback.
- [x] Use consistent danger styling for delete, reset, close incident, and archive actions.
- [x] Add clear consequence text before destructive actions.
- [x] Show success confirmation after each destructive action completes.
- [x] Show failure messages with the exact reason from the API.

## 2. Audit Logs

- [x] Add an `audit_logs` table in the database.
- [x] Log account creation, account edit, and account delete/deactivation.
- [x] Log casualty approval, rejection, deletion, and resubmission.
- [x] Log incident creation, edit, close, and reset actions.
- [x] Log healthcare facility and evacuation center creation/imports.
- [x] Log bulk import results with created, skipped, and failed counts.
- [x] Add an admin/super admin Audit Logs tab that reads from the audit log table.
- [x] Scope audit log visibility by role.

## 3. Reset And Delete Safety

- [ ] Show affected record counts before reset.
- [ ] Separate system-wide reset from admin-scoped reset visually.
- [ ] Require typed confirmation before reset.
- [ ] Consider requiring password confirmation before reset.
- [ ] Keep accounts during reset.
- [ ] Confirm attachment files are removed when related records are reset.
- [ ] Add audit log entries for reset operations.
- [ ] Add clear post-reset summary of deleted records.

## 4. Bulk Upload Preview

- [ ] Add preview table after uploading CSV/Excel files.
- [ ] Mark valid rows before import.
- [ ] Mark duplicate rows before import.
- [ ] Mark invalid rows before import.
- [ ] Show row-level error reasons.
- [ ] Let users cancel before saving imported rows.
- [ ] Import only after explicit confirmation.
- [ ] Allow downloading failed rows as a correction file.

## 5. Test Coverage

- [ ] Add API tests for account creation and account update.
- [ ] Add API tests for role-scoped incident visibility.
- [ ] Add API tests for casualty submit, edit, reject, approve, and delete.
- [ ] Add API tests for healthcare facility and evacuation center bulk imports.
- [ ] Add API tests for attachment upload and retrieval.
- [ ] Add tests for incident analytics calculations.
- [ ] Add mobile TypeScript checks to the regular verification workflow.
- [ ] Add a simple manual QA checklist for presentation day.

## 6. Mobile Offline And Retry Behavior

- [ ] Show a pending sync badge for locally queued casualty records.
- [ ] Show a failed sync state with a retry button.
- [ ] Preserve local drafts if submit fails.
- [ ] Add clear sync status per casualty record.
- [ ] Add offline-safe attachment handling.
- [ ] Add user-facing messaging when API is unreachable.
- [ ] Add retry-all queued records action.
- [ ] Test airplane mode and weak connection workflows.

## 7. UI Message Standardization

- [ ] Standardize loading messages across mobile and web.
- [ ] Standardize success messages across mobile and web.
- [ ] Standardize error messages across mobile and web.
- [ ] Replace technical errors with user-friendly messages where appropriate.
- [ ] Keep detailed technical errors in console/API logs.
- [ ] Use the same message patterns for forms, modals, and bulk imports.
- [ ] Ensure success messages remain visible long enough to read.
- [ ] Review all pages for inconsistent button labels.

## 8. Data Export And Backup

- [ ] Add export for casualty records per incident.
- [ ] Add export for responders/documenters.
- [ ] Add export for healthcare facilities.
- [ ] Add export for evacuation centers.
- [ ] Add full incident package export.
- [ ] Include attachments or attachment references in exports.
- [ ] Add super admin system backup export.
- [ ] Add clear export permissions by role.
