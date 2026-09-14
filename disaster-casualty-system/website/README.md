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

The desktop dashboard uses this local API URL on localhost:

```text
http://localhost:5000/api
```

When deployed, it uses the Render API:

```text
https://dcms-api-ljco.onrender.com/api
```

## Runtime Configuration And Security

Do not place Supabase service-role keys or other private secrets in this folder.
Anything in `website` can be viewed from browser DevTools after deployment.

The dashboard can read optional runtime config from `window.DCMS_CONFIG`.
Use `website/config.example.js` as the template for a local/deployment-only
`website/config.js` file if Realtime needs to be enabled. `website/config.js`
is ignored by Git. If you use `config.js`, load it before `app.js` in the
deployed `index.html` or inject the same `window.DCMS_CONFIG` object through
the hosting provider.

The Supabase publishable key is not a server secret, but it is intentionally no
longer hardcoded in `app.js` to avoid a penetration testing finding for
hardcoded keys in client source.

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
