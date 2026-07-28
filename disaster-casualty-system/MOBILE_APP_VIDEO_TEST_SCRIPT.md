# Mobile App Video Test Script

Use this script while recording a walkthrough of the Disaster Casualty Management System mobile app. It covers the full app flow: Home, Records, Add Casualty, Incident Management, Notifications, and Profile.

## Before Recording

1. Make sure the API server is running.
2. Make sure the Expo mobile app is running.
3. Log in with a valid account.
4. If you see `Invalid or expired authentication token`, go to **Profile**, log out, then log in again.
5. Use or create one active incident named:

```text
Utstein API Test Incident
```

## Opening Line

Say:

```text
This video demonstrates the Disaster Casualty Management System mobile app. I will show the dashboard, casualty records, casualty encoding, incident management modules, notifications, and profile. I will also show that the app supports the data fields needed for the Utstein formula table.
```

## 1. Home Screen

Go to **Home**.

Show:

- Connection status
- Active disaster incident banner
- Summary cards
- Quick Actions
- Recent Activity

Point out these dashboard cards:

- Encoded Today
- Pending Review
- Verified Records
- Active Incidents

Say:

```text
The Home screen gives responders a quick overview of current disaster response activity. It shows connection status, active incidents, daily encoded records, pending reviews, verified records, and recent activity.
```

Tap these Quick Actions briefly:

- **Add Casualty**
- **View Records**
- **Refresh Data**
- **My Profile**

Say:

```text
The quick actions allow responders to immediately encode casualties, review existing records, refresh synced data, or open their profile.
```

## 2. Records Screen

Go to **Records**.

Show:

- Casualty list
- Search or filtering if available
- Record cards
- One casualty detail screen

Tap one casualty record.

Show:

- Personal details
- Incident details
- Triage information
- Transport information
- Status or treatment information

Say:

```text
The Records screen displays encoded casualty records. A responder can open a record to review personal details, incident details, triage, transport, and medical status information.
```

Return to the main Records list.

## 3. Add Casualty Flow

Go to **Add**.

Say:

```text
The Add Casualty workflow is divided into multiple steps so responders can encode structured information without one long form.
```

### Step 1: Personal

Show the personal fields.

Use this sample data:

```text
First name: Juan
Last name: Dela Cruz
Sex: Male
Date of birth: 01/15/1990
Age: 36
```

Show the date of birth picker if needed.

Say:

```text
The Personal step captures basic casualty identity information, including name, sex, date of birth, and age.
```

### Step 2: Address

Show the address fields.

Use this sample data:

```text
Street / Address: Taft Avenue
City / Municipality: Manila
Province: Metro Manila
Country: Philippines
```

Say:

```text
The Address step records where the casualty is from or where they can be associated geographically.
```

### Step 3: Incident

Show the incident fields.

Use:

```text
Incident: Utstein API Test Incident
Location found: Near main evacuation area
Disaster-related: Yes
```

Say:

```text
The Incident step links the casualty record to the active disaster incident.
```

### Step 4: Triage

Show the triage fields.

Use:

```text
Triage system: START
Actual category: T1 / Immediate
Responder category: T1 / Immediate
Triage time: 07/28/2026 08:10
```

If Appendix A fields appear, show a few symptom-based fields.

Say:

```text
The Triage step records the triage system used and the assigned triage category. These fields support Utstein indicators for on-site triage and triage accuracy.
```

### Step 5: Transport

Show the transport fields.

Use:

```text
EMS transport used: Yes
Departure from scene: 07/28/2026 08:30
Arrival at healthcare facility: 07/28/2026 08:45
Receiving facility: Test Hospital
Transport mode: Ambulance
```

Say:

```text
The Transport step records EMS use, scene departure, facility arrival, and receiving facility details. These are used for scene casualty clearance and distribution indicators.
```

### Step 6: Status

Show the Status screen sections.

Show:

- Clinical status
- On-site care
- ED and hospital care
- Surgery and imaging
- ICU and ventilation
- Outcome

Use:

```text
Casualty status: Alive
Severity: Critical
On-site stabilization / treatment: Yes
Stabilized time: 07/28/2026 08:20
ED / similar facility care: Yes
ED admission time: 07/28/2026 08:45
ED resuscitation room time: 07/28/2026 08:50
Hospital admission time: 07/28/2026 09:30
Surgical intervention start time: 07/28/2026 09:40
Surgical intervention end time: 07/28/2026 10:10
Operating room use time: 07/28/2026 09:40
Plain X-ray required: Yes
Plain X-ray time: 07/28/2026 09:05
Ultrasound required: No
CT scan required: Yes
CT scan time: 07/28/2026 09:15
ICU admission time: 07/28/2026 10:30
Mechanical ventilation required: Yes
Ventilation start time: 07/28/2026 10:35
Ventilation end time: 07/29/2026 10:35
ICU transfer out time: 07/30/2026 10:00
Hospital discharge time: 08/01/2026 10:00
Died: No
```

Show that death fields are hidden when `Died` is `No`.

Then change `Died` to `Yes` only for demonstration, but do not submit if you do not want this casualty recorded as dead.

Show that these fields appear:

```text
Death stage
Death time
Reached hospital
Medical contact before death
Final disposition
```

Say:

```text
The Status step captures on-site care, ED care, surgery, imaging, ICU, ventilation, morbidity, and mortality-related information. Death-related fields only appear when the casualty is marked as dead.
```

Set `Died` back to `No` before continuing.

### Step 7: Remarks

Use:

```text
Remarks: Test casualty record for Utstein mobile app demonstration.
```

Say:

```text
The Remarks step allows responders to add additional notes before submitting the casualty record.
```

Submit the casualty if your Supabase database is ready.

If you do not want to create another test record, say:

```text
For this recording, I will stop before final submission because the form fields have already been demonstrated.
```

## 4. Incident Management

Go to **Incident Management**.

Show:

- Active incident cards
- Incident name
- Incident status
- Incident location or time
- Management buttons

Say:

```text
Incident Management contains the operational modules used to collect and summarize Utstein disaster response indicators.
```

### Response Timeline

Open **Response Timeline**.

Show fields such as:

```text
Disaster occurrence time
DMMP activation time
Coordinator notification time
Last staff arrival time
Triage ordered time
First on-site triage time
Last on-site triage time
EMS arrival time
First transport time
Last transport time
Deactivation times
```

Say:

```text
The Response Timeline records the main time points needed for event notification, DMMP activation, triage, transport, and deactivation formulas.
```

### DMMP Staff

Open **DMMP Staff**.

Use sample entries:

```text
Name: Dr. Reyes
Contacted: 07/28/2026 08:06
Arrived: 07/28/2026 08:12

Name: Nurse Santos
Contacted: 07/28/2026 08:06
Arrived: 07/28/2026 08:14
```

Say:

```text
The DMMP Staff module records contacted staff and arrival times. This supports the formula for the percentage of medical staff who arrived at the designated location within the required time.
```

### Coordination

Open **Coordination**.

Show ratings:

```text
On-site initial actions
On-site medical control and coordination
System-level medical coordination
Medical communications and information management
Medical resource management
```

Use sample ratings:

```text
5 - Completely Adequate
4 - Mostly Adequate
4 - Mostly Adequate
5 - Completely Adequate
4 - Mostly Adequate
```

Say:

```text
The Coordination module records adequacy ratings from 1 to 7 for disaster medical operations coordination.
```

### Responder Safety

Open **Responder Safety**.

Show:

```text
Responder safety actions
PPE decision time
Number of deployed responders
Number of injured responders
Number of killed responders
```

Say:

```text
Responder Safety captures responder protection actions and responder illness, injury, or death counts during the acute response phase.
```

### Deactivation & Continuity

Open **Deactivation & Continuity**.

Show:

```text
Scene medical responders demobilized time
Last healthcare facility deactivation time
Normal EMS call coverage disruption
Healthcare facility routine care disruption
```

Say:

```text
This module records disaster plan deactivation and continuity of care disruption for non-disaster-related patients.
```

### On-site Triage

Open **On-site Triage**.

Show:

```text
Triage system used
First and last on-site triage times
T1 and T2 triage interval summaries
Undertriage indicators
Overtriage indicators
```

Say:

```text
The On-site Triage summary shows triage timing and triage accuracy indicators based on casualty triage records.
```

### On-site Care

Open **On-site Care**.

Show:

```text
On-site stabilization or treatment type
T1 stabilization percentage
T2 stabilization percentage
```

Say:

```text
The On-site Care module summarizes stabilization and treatment provided on scene.
```

### Scene Clearance

Open **Scene Clearance**.

Show:

```text
First EMS vehicle arrival
First survivor transported from scene
Last survivor transported from scene
T1 and T2 transport percentages
EMS BLS ambulance counts
EMS ALS ambulance counts
```

Say:

```text
Scene Clearance summarizes transport out of the scene and EMS resource arrival.
```

### Distribution

Open **Distribution**.

Show:

```text
Primary facility arrivals
Secondary facility arrivals
Tertiary facility arrivals
Specialized facility arrivals
EMS versus non-EMS transport
Emergency department arrivals
Interhospital transfer
```

Say:

```text
Distribution shows where casualties arrived and whether they arrived through EMS or independently.
```

### Facility Triage

Open **Facility Triage**.

Show:

```text
Healthcare facility triage system
First facility triage time
Last facility triage time
Undertriage indicators
Overtriage indicators
```

Say:

```text
Facility Triage compares the actual triage category with the category assigned at the healthcare facility.
```

### ED Resources

Open **ED Resources**.

Show:

```text
ED care by triage category
ED admission percentages
ED discharge percentages
Median arrival times
ED resuscitation room use
```

Say:

```text
ED Resources summarizes emergency department use, admission, discharge, arrival timing, and resuscitation room use for immediate category survivors.
```

### Hospital Resources

Open **Hospital Resources**.

Show:

```text
Mean surgical intervention duration
Operating room use
X-ray use
Ultrasound use
CT scan use
ICU admissions
Mechanical ventilation
Alternative ICU use
```

Say:

```text
Hospital Resources summarizes surgical care, operating room use, imaging, ICU use, ventilation, and alternative ICU use.
```

### Morbidity & Mortality

Open **Morbidity & Mortality**.

Show:

```text
ED length of stay
ICU length of stay
Ventilator days
Hospital length of stay
Deaths before medical contact
Deaths before hospital arrival
In-hospital deaths
Deaths by triage category
```

Say:

```text
Morbidity and Mortality summarizes patient outcomes, length of stay, ventilation days, and death indicators from the Utstein table.
```

## 5. Notifications

Go to **Notifications**.

Show:

- Notification list, or
- Empty state if there are no notifications

Say:

```text
The Notifications screen displays system updates, alerts, and activity messages for the responder.
```

## 6. Profile

Go to **Profile**.

Show:

- User name
- Role
- Account information
- Logout button

Say:

```text
The Profile screen shows the logged-in user, account role, and logout controls.
```

## Closing Line

Say:

```text
This completes the full mobile app walkthrough. The app supports dashboard monitoring, casualty encoding, record review, incident operations management, notifications, profile access, and the Utstein formula table data collection and summaries.
```

## Quick Checklist

Use this checklist while recording:

- [ ] Login works
- [ ] Home dashboard loads
- [ ] Summary cards are visible
- [ ] Quick Actions work
- [ ] Records list opens
- [ ] Record details open
- [ ] Add Casualty form opens
- [ ] Personal step works
- [ ] Address step works
- [ ] Incident step works
- [ ] Triage step works
- [ ] Transport step works
- [ ] Status step works
- [ ] Death fields show only when `Died = Yes`
- [ ] Remarks step works
- [ ] Incident Management opens
- [ ] Response Timeline opens
- [ ] DMMP Staff opens
- [ ] Coordination opens
- [ ] Responder Safety opens
- [ ] Deactivation & Continuity opens
- [ ] On-site Triage opens
- [ ] On-site Care opens
- [ ] Scene Clearance opens
- [ ] Distribution opens
- [ ] Facility Triage opens
- [ ] ED Resources opens
- [ ] Hospital Resources opens
- [ ] Morbidity & Mortality opens
- [ ] Notifications opens
- [ ] Profile opens
