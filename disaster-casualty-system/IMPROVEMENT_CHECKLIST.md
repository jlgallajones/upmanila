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

- [x] Show affected record counts before reset.
- [x] Separate system-wide reset from admin-scoped reset visually.
- [x] Require typed confirmation before reset.
- [x] Consider requiring password confirmation before reset.
- [x] Keep accounts during reset.
- [x] Confirm attachment files are removed when related records are reset.
- [x] Add audit log entries for reset operations.
- [x] Add clear post-reset summary of deleted records.

## 4. Bulk Upload Preview

- [x] Add preview table after uploading CSV/Excel files.
- [x] Mark valid rows before import.
- [x] Mark duplicate rows before import.
- [x] Mark invalid rows before import.
- [x] Show row-level error reasons.
- [x] Let users cancel before saving imported rows.
- [x] Import only after explicit confirmation.
- [x] Allow downloading failed rows as a correction file.

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

- [x] Show a pending sync badge for locally queued casualty records.
- [x] Show a failed sync state with a retry button.
- [x] Preserve local drafts if submit fails.
- [x] Add clear sync status per casualty record.
- [x] Add offline-safe attachment handling.
- [x] Add user-facing messaging when API is unreachable.
- [x] Add retry-all queued records action.
- [ ] Test airplane mode and weak connection workflows.

## 7. UI Message Standardization

- [x] Standardize loading messages across mobile and web.
- [x] Standardize success messages across mobile and web.
- [x] Standardize error messages across mobile and web.
- [x] Replace technical errors with user-friendly messages where appropriate.
- [x] Keep detailed technical errors in console/API logs.
- [x] Use the same message patterns for forms, modals, and bulk imports.
- [x] Ensure success messages remain visible long enough to read.
- [x] Review all pages for inconsistent button labels.

## 8. Data Export And Backup

- [x] Add export for casualty records per incident.
- [x] Add export for responders/documenters.
- [x] Add export for healthcare facilities.
- [x] Add export for evacuation centers.
- [x] Add full incident package export.
- [x] Include attachments or attachment references in exports.
- [x] Add super admin system backup export.
- [x] Add clear export permissions by role.
