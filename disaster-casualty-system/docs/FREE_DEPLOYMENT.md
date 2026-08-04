# Free Deployment Guide

This project has two deployable parts:

- `api`: the public backend used by the mobile app.
- `mobile`: the Expo web/PWA build that creates `mobile/dist`.

Deploy the API first, then deploy the PWA with `EXPO_PUBLIC_API_URL` set to the API URL plus `/api`.

## 1. Deploy the API on Render

Use the root `render.yaml` file.

Render service settings:

- Root directory: `api`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Instance type: Free

Environment variables to add in Render:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not add these secret values to Git.

After deploy, test:

```powershell
curl.exe https://YOUR-RENDER-API.onrender.com/api/health
```

Expected result: a JSON response with `status: "healthy"`.

## 2. Deploy the PWA on Netlify

Use the root `netlify.toml` file.

Netlify settings:

- Base directory: `mobile`
- Build command: `npm ci && npm run build:web`
- Publish directory: `dist`

Environment variables to add in Netlify:

- `EXPO_PUBLIC_API_URL=https://YOUR-RENDER-API.onrender.com/api`
- `EXPO_PUBLIC_TEST_USER_ID=...` if still needed by the app

The `/api` at the end is required because the mobile app calls routes like `/incidents`, `/casualties`, and `/auth/login`.

## 3. Local build commands

Use `npm.cmd` in PowerShell on Windows:

```powershell
cd C:\Users\jlgallajones\upmanila\disaster-casualty-system\api
npm.cmd run build

cd C:\Users\jlgallajones\upmanila\disaster-casualty-system\mobile
npm.cmd run build:web
```

## Important Free Hosting Notes

- Free API hosting may sleep after inactivity, so the first app request can be slow.
- The PWA must be rebuilt after changing `EXPO_PUBLIC_API_URL`.
- The API must be public before users outside your network can use the app.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in the mobile app or frontend hosting variables.
