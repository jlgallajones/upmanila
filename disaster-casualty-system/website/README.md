# DCMS Desktop Admin Dashboard

This folder contains a standalone desktop web dashboard for admin users.

## Run Locally

Start the API first:

```powershell
cd C:\Users\jlgallajones\upmanila\disaster-casualty-system\api
npm.cmd run dev
```

Then serve this folder:

```powershell
cd C:\Users\jlgallajones\upmanila\disaster-casualty-system
npx.cmd serve website -l 5173
```

Open:

```text
http://localhost:5173
```

The desktop dashboard uses this default API URL:

```text
http://localhost:5000/api
```

## Implemented

- Login page using the existing `/api/auth/login` endpoint.
- Role-based desktop landing pages:
  - `super_admin`
  - `admin`, `administrator`, and `encoder`
- Super admin summary:
  - dashboard totals
  - incident list
  - recent mobile activity
  - account registration for `administrator` and `super_admin` accounts
  - action log placeholder panel
- Admin dashboard:
  - create official incidents
  - update incident timeline fields for EMS alerted/deployed/arrived
  - create evacuation centers
  - create healthcare facilities

## Backend Still Needed

- Persistent action/audit log endpoint.
- Dedicated incident-level EMS deployed field if it must be separate from the current timeline mapping.
