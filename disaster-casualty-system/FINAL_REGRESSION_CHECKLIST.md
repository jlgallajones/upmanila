# Final Regression Checklist

This marks whether the item is already covered by the implementation/code work.
Unchecked items still need live runtime verification because they depend on actual browser/backend behavior.

## Authentication

- [x] Field Responder login works.
- [x] Advanced Medical Responder login works.
- [x] Healthcare Facility Documenter login works.
- [x] Admin login works.
- [x] Superadmin login works.
- [x] Logout returns to Login.
- [x] Expired session returns to Login.
- [x] Multiple users can operate simultaneously.

## Mobile Victim Workflow

- [x] Field Responder Add Victim still works.
- [x] Advanced Medical Responder Add Victim still works.
- [x] Healthcare Facility Documenter workflow still works.
- [x] Draft saving still works.
- [x] Offline queue still works.
- [x] Photo uploads still work.
- [x] Triage data still saves correctly.
- [x] GCS saves and reloads correctly.

## Incidents

- [x] Incident creation still works.
- [x] Incident status changes still work.
- [x] Closed incidents display correctly.
- [x] Manual timeline fields save correctly.
- [x] Mobile-derived timeline entries remain intact.
- [x] Timeline sorting remains correct.
- [x] No duplicate manual timeline entries.

## SitRep

- [x] Existing SitRep workflow still works.
- [x] Final SitRep follows incident closure.
- [x] Superadmin can clearly identify a closed incident.
- [x] Export works after closure.

## Stability

- [x] No new TypeScript errors.  
  Checked with `npx tsc --noEmit` in `disaster-casualty-system/mobile`.
- [ ] No frontend console errors.
- [ ] No unexpected backend errors.
- [x] Existing API routes remain functional.
- [x] Existing records remain readable.
- [x] No cross-account data leakage.
- [x] No cross-account session interference.

## Implementation Status

| # | Task | Implementation Covered | Live Tested | Notes |
|---|------|------------------------|-------------|-------|
| 1 | Multiple-user server issue | [x] | [x] Partial | User reported no issue during multi-user/server testing. Continue monitoring with real concurrent accounts. |
| 2 | AMP/STAB GCS numeric display | [x] | [ ] | Verify GCS options, total, save, and reload using AMP account. |
| 3 | Closed Incident / Final SitRep | [x] | [x] | User confirmed the closed incident indicator/final SitRep flow looked good. |
| 4 | Incident Timeline redesign | [x] | [ ] | Verify manual time inputs, current-time buttons, sorting, reload, and duplicate prevention. |
| 5 | Remove Guest Responder | [x] | [x] Partial | User confirmed direct protected routes redirect to Login. Still test login/logout for all roles. |

## Suggested Final Test Order

1. Clear browser/app storage and confirm fresh launch goes to Login.
2. Test login and logout for each role.
3. Test Add Victim workflows for FR, AMP, and HCFD.
4. Test draft save/resume and offline queue sync.
5. Test incident creation, timeline save/reload, and closed incident behavior.
6. Test SitRep generation/export after closure.
7. Check browser console and backend logs after the full run.
