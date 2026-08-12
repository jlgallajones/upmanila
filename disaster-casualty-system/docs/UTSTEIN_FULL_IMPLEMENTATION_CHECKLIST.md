# Utstein Full Implementation Checklist

This checklist is based on `Copy of Utstein Template Formula Table [PTA III] ESPERA_July1-21 Tasks.docx` and the current DCMS mobile/API implementation.

## Overall Status

- [ ] Create a complete row-by-row Utstein traceability matrix.
- [ ] Map every Utstein data element to a mobile field, database column, API endpoint, formula function, and report/dashboard output.
- [ ] Mark each Utstein row as `Implemented`, `Partially implemented`, `Not implemented`, or `Needs validation`.
- [ ] Create test records with known expected outputs for every formula section.
- [ ] Validate all formulas with sample data before claiming full Utstein compliance.

## Role and Reporting Context

- [x] Filter triage stages by account role.
- [x] Add reporting-location context to user sessions.
- [x] Distinguish users reporting from the scene, transport/ambulance, receiving facility/ED, hospital ward, evacuation center, and command/admin context.
- [x] Update triage menu visibility using both role and reporting location.
- [x] Confirm EMT/responder users only see primary and secondary triage when appropriate.
- [x] Confirm receiving facility nurses/medical personnel only see tertiary triage when appropriate.
- [x] Add admin override behavior for super admin, administrator, and encoder roles.

## Primary Triage Systems

Implemented or partially implemented:

- [x] START
- [x] SIEVE
- [x] Care Flight
- [x] SALT
- [x] Urgent/Non-urgent

Missing or needing implementation:

- [x] STIEVE
- [x] mSTART
- [x] JumpSTART
- [x] PTT
- [x] MITT
- [x] MPTT
- [x] Homebush
- [ ] STM
- [x] Other primary triage system handling

For each missing primary system:

- [x] Add mobile assessment questions from Appendix A.
- [x] Add answer normalization in the mobile payload.
- [x] Add backend calculation logic.
- [x] Add unit tests for expected triage outputs.
- [x] Add display formatting for history/details screens.
- [ ] Validate rules with the clinical/project team.

Implementation note: STM is accepted and displayed as a primary triage
system, but the provided Appendix A extract does not include STM assessment
variables or an algorithm. It remains pending until the clinical/project team
provides the STM rule set.

## Secondary Triage Systems

Implemented or partially implemented:

- [x] SORT
- [x] SMART
- [x] Urgent/Non-urgent

Missing or needing implementation:

- [x] SAVE
- [x] META
- [ ] SwiFT
- [x] Other secondary triage system handling

For each missing secondary system:

- [x] Add mobile assessment questions from Appendix B.
- [x] Add answer normalization in the mobile payload.
- [x] Add backend calculation logic.
- [x] Add unit tests for expected triage outputs.
- [x] Add display formatting for history/details screens.
- [ ] Validate rules with the clinical/project team.

Implementation note: SAVE and META are encoded from Appendix B and now have
backend calculation logic. SwiFT is accepted and displayed as a secondary
triage system, but the provided Appendix B extract does not include SwiFT
assessment variables or an algorithm. It remains pending until the
clinical/project team provides the SwiFT rule set.

## Tertiary Triage Systems

Implemented or partially implemented:

- [x] NATO
- [x] MASS

Missing or needing implementation:

- [x] ESI
- [x] METTS
- [x] Other tertiary triage system handling

Important tertiary triage notes:

- [x] Confirm how ESI should be stored because it uses ESI 1 to ESI 5 instead of T1 to T4.
- [x] Confirm how METTS should be stored because it may include colors that do not map cleanly to T1 to T4.
- [x] Decide whether ESI/METTS should be excluded from overtriage/undertriage percentage formulas or reported separately.
- [x] Add tertiary assessment questions from Appendix C.
- [x] Add backend calculation or classification logic for supported tertiary systems.
- [x] Add validation tests for tertiary triage outputs.

Implementation note: ESI and METTS raw final triage values are stored in
`assessment_answers`, but `triage_category` and `calculated_category` remain
`unknown` for those systems. This keeps ESI/METTS out of T1-T4
overtriage/undertriage calculations until the clinical/project team approves a
separate reporting method.

## Triage Result and Accuracy Logic

- [x] Store user/responder final triage separately from system-calculated triage.
- [x] Calculate triage category from assessment answers for supported systems.
- [x] Hide overtriage/undertriage summaries from normal mobile data entry.
- [x] Validate overtriage and undertriage logic for every supported triage system.
- [x] Define rules for comparisons involving `expectant`.
- [x] Define rules for comparisons involving `unknown`.
- [x] Confirm whether black/expectant should be included in overtriage/undertriage calculations.
- [x] Confirm whether ESI/METTS are excluded from T1/T2/T3/T4 accuracy calculations.
- [x] Add test cases for undertriaged T1, undertriaged T2, overtriaged T2, and overtriaged T3.
- [x] Add tests for primary, secondary, and tertiary accuracy summaries.

Implementation note: `expectant` is treated as T4/black in T1-T4
comparisons. Assigning T4 to true T1/T2 cases counts as undertriage, and
assigning T1/T2/T3 to true T4 cases counts as overtriage at the record level.
`unknown` is excluded from overtriage/undertriage comparisons. ESI and METTS
currently resolve to `unknown` for T1-T4 reporting, so they are excluded from
these accuracy metrics until a separate reporting method is approved.

## Event Notification and DMMP Activation

- [ ] Validate disaster occurrence time field against the Utstein row.
- [ ] Validate DMMP activation trigger field.
- [ ] Validate DMMP activation time field.
- [ ] Validate medical coordinator notification time field.
- [ ] Validate last notified staff arrival/reporting time.
- [ ] Validate percentage of medical staff who reported within the predetermined time.
- [ ] Add test cases for DMMP staff call-down summary calculations.

## Disaster Medical Operations Coordination

- [ ] Validate on-scene initial actions rating scale.
- [ ] Validate on-scene medical control and coordination rating scale.
- [ ] Validate system-level medical coordination rating scale.
- [ ] Validate medical communications and information management rating scale.
- [ ] Validate medical resource management rating scale.
- [ ] Confirm rating options match the template: Not Done, Inadequate, Somewhat Adequate, Mostly Adequate, Completely Adequate, N/S, N/D.
- [ ] Add summary/report output for coordination ratings.

## On-Site Triage Formula Validation

- [ ] Validate primary triage system used.
- [ ] Validate secondary triage system used.
- [ ] Validate triage ordered time.
- [ ] Validate first primary triage time on site.
- [ ] Validate first secondary triage time on site.
- [ ] Validate last primary triage time on site.
- [ ] Validate last secondary triage time on site.
- [ ] Validate T1 primary triaged by time interval.
- [ ] Validate T1 secondary triaged by time interval.
- [ ] Validate T2 primary triaged by time interval.
- [ ] Validate T2 secondary triaged by time interval.
- [ ] Validate all on-site overtriage/undertriage formulas.
- [ ] Confirm denominator rules for total survivors on site.

## On-Site Medical Care

- [x] Capture on-site stabilization/treatment option.
- [x] Capture treatment area.
- [x] Capture stabilization start time.
- [x] Capture stabilized time.
- [ ] Consider making on-site care a separate wizard step if required by stakeholders.
- [ ] Validate percentage of T1 survivors stabilized by time interval.
- [ ] Validate percentage of T2 survivors stabilized by time interval.
- [ ] Confirm denominator rules for on-site care summaries.

## Scene Casualty Clearance

- [x] Capture EMS scene arrival time.
- [x] Capture departed scene time.
- [x] Capture arrived facility time.
- [x] Capture EMS unit type.
- [x] Capture receiving facility.
- [ ] Validate first EMS vehicle on scene.
- [ ] Validate first casualty transported from scene by EMS.
- [ ] Validate last casualty transported from scene by EMS.
- [ ] Validate T1 transported by time interval.
- [ ] Validate T2 transported by time interval.
- [ ] Validate BLS ambulance count by time interval.
- [ ] Validate ALS ambulance count by time interval.

## Distribution of Ill/Injured Survivors

- [ ] Validate arrivals to primary healthcare facilities independent of EMS.
- [ ] Validate arrivals to secondary healthcare facilities independent of EMS.
- [ ] Validate arrivals to tertiary healthcare facilities independent of EMS.
- [ ] Validate arrivals to specialized healthcare facilities independent of EMS.
- [ ] Validate arrivals to primary healthcare facilities transported by EMS.
- [ ] Validate arrivals to secondary healthcare facilities transported by EMS.
- [ ] Validate arrivals to tertiary healthcare facilities transported by EMS.
- [ ] Validate arrivals to specialized healthcare facilities transported by EMS.
- [ ] Validate ED arrival by time interval after DMMP activation.
- [ ] Validate interhospital transfer percentage.
- [ ] Confirm facility level values are standardized.
- [ ] Confirm EMS vs non-EMS transport values are standardized.

## Triage Upon Arrival at Healthcare Facility

- [x] Add tertiary triage stage.
- [x] Validate tertiary triage system used.
- [x] Add/complete ESI support.
- [x] Add/complete METTS support.
- [ ] Validate first facility triage time.
- [ ] Validate last facility triage time.
- [ ] Validate facility undertriage and overtriage formulas.
- [ ] Confirm whether facility accuracy metrics use calculated category, user-entered category, or both.

## Responder Safety and Health

- [x] Capture responder safety actions.
- [x] Capture PPE decision time.
- [x] Capture deployed responders.
- [x] Capture injured responders.
- [x] Capture ill responders.
- [x] Capture deceased responders.
- [ ] Validate percentage of killed responders during the acute response phase.
- [ ] Validate percentage of ill/injured responders seeking medical care during the acute response phase.
- [ ] Confirm acute response phase boundaries: DMMP activation to last healthcare facility deactivation.
- [ ] Add test cases for responder safety formulas.

## Deactivation and Continuity of Care

- [x] Capture scene medical responders demobilized time.
- [x] Capture last healthcare facility deactivation time.
- [x] Capture EMS call coverage disruption.
- [x] Capture healthcare facility routine care disruption.
- [x] Capture assessed at time.
- [ ] Validate scene demobilization formula/output.
- [ ] Validate last facility deactivation formula/output.
- [ ] Validate EMS coverage disruption reporting.
- [ ] Validate facility care disruption reporting.

## Emergency Department Resources

- [x] Capture ED/similar facility care use.
- [x] Capture admitted after ED/similar care.
- [x] Capture discharged home after ED/similar care.
- [x] Capture ED admission time.
- [x] Capture ED transfer out time.
- [x] Capture ED resuscitation room time.
- [ ] Validate ED care percentage categorized by triage category.
- [ ] Validate ED admission percentage categorized by triage category.
- [ ] Validate ED discharge percentage categorized by triage category.
- [ ] Validate median disaster onset to ED arrival by triage category.
- [ ] Validate T1 survivors in ED resuscitation rooms at 15-minute intervals.
- [ ] Validate percentage of ED resuscitation rooms used simultaneously at 15-minute intervals.
- [ ] Confirm total ED resuscitation room capacity source.

## Hospital Resources

- [x] Capture hospital admission time.
- [x] Capture hospital discharge time.
- [x] Capture surgical intervention start time.
- [x] Capture surgical intervention end time.
- [x] Capture operating room use time.
- [x] Capture X-ray required and X-ray time.
- [x] Capture ultrasound required and ultrasound time.
- [x] Capture CT scan required and CT scan time.
- [x] Capture ICU admission time.
- [x] Capture ICU transfer out time.
- [x] Capture mechanical ventilation required.
- [x] Capture ventilation start time.
- [x] Capture ventilation end time.
- [x] Capture alternative ICU use.
- [ ] Validate first surgical intervention time.
- [ ] Validate last surgical intervention time.
- [ ] Validate mean surgical intervention duration.
- [ ] Validate T1 operating room use by 30-minute interval.
- [ ] Validate simultaneous operating room use percentage by 30-minute interval.
- [ ] Validate X-ray requirement counts by 30-minute interval for T1 and T2.
- [ ] Validate ultrasound requirement counts by 30-minute interval for T1 and T2.
- [ ] Validate CT requirement counts by 30-minute interval for T1 and T2.
- [ ] Validate ICU admissions by 30-minute interval.
- [ ] Validate percentage of ICU-admitted survivors requiring artificial ventilation.
- [ ] Validate mean disaster onset to ICU admission time.
- [ ] Validate mean ED admission to ICU admission time.
- [ ] Confirm total operating room capacity source.
- [ ] Confirm ICU capacity and alternative ICU reporting source.

## Morbidity

- [x] Capture ED admission and transfer out times.
- [x] Capture ICU admission and transfer out times.
- [x] Capture ventilation start and end times.
- [x] Capture hospital admission and discharge times.
- [ ] Validate mean ED length of stay for T1 survivors.
- [ ] Validate median ED length of stay for T1 survivors.
- [ ] Validate mean ED length of stay for T2 survivors.
- [ ] Validate median ED length of stay for T2 survivors.
- [ ] Validate mean ICU length of stay for T1 survivors.
- [ ] Validate median ICU length of stay for T1 survivors.
- [ ] Validate mean ventilator patient-days.
- [ ] Validate median ventilator patient-days.
- [ ] Validate mean hospital stay in days.
- [ ] Validate median hospital stay in days.

## Mortality

- [x] Capture died status.
- [x] Capture death stage.
- [x] Capture death time.
- [x] Capture reached hospital.
- [x] Capture medical contact before death.
- [x] Capture final disposition.
- [ ] Validate percentage of impact deaths.
- [ ] Validate percentage of pre-hospital deaths.
- [ ] Validate in-hospital deaths.
- [ ] Validate immediate-category deaths.
- [ ] Confirm mortality denominator rules for total disaster victims.
- [ ] Confirm whether missing death stage should be excluded or counted as unknown.

## Data Quality and Validation

- [ ] Add required-field validation per Utstein section.
- [ ] Add date/time sequence validation for all relevant workflows.
- [ ] Add standard unknown/not specified/not documented handling.
- [ ] Add controlled vocabularies for all categorical values.
- [ ] Add backend validation for triage stage and triage system combinations.
- [ ] Add backend validation for role/reporting-location permissions.
- [ ] Add audit trail for changes to triage, outcome, and verification-sensitive fields.
- [ ] Add test fixtures for complete patient journey scenarios.

## Reporting and Export

- [ ] Build a complete Utstein report export per incident.
- [ ] Add report output for every formula row.
- [ ] Add CSV or spreadsheet export for Utstein metrics.
- [ ] Add report metadata showing algorithm version and calculation date.
- [ ] Add warning markers for formulas that cannot be computed due to missing data.
- [ ] Add separate handling for unsupported/non-T1-T4 systems such as ESI and METTS.

## Documentation

- [ ] Document each supported triage algorithm.
- [ ] Document each unsupported triage system and reason.
- [ ] Document formula assumptions and denominator rules.
- [ ] Document how overtriage and undertriage are calculated.
- [ ] Document role and reporting-location behavior.
- [ ] Document deployment/testing requirements for PWA and API URLs.
- [ ] Document Supabase account setup for each testing role.
