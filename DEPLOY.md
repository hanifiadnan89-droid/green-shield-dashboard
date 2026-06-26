# Green Shield Dashboard Deployment

This project is ready to deploy as one Render Web Service.

## What this deployment does

- Builds the Vite client from `client/`
- Starts the Express server from `server/`
- Serves the built dashboard UI from `client/dist`
- Keeps the API available under `/api`
- Requires browser username/password protection with `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`

## Render setup

1. Go to Render.
2. Create a new Web Service.
3. Connect this GitHub repository.
4. Use these settings:

```txt
Runtime: Node
Branch: main
Build Command: npm run render:build
Start Command: npm start
```

`render:build` runs `install:all`, builds the client, then installs Playwright Chromium into `server/node_modules` (`PLAYWRIGHT_BROWSERS_PATH=0`, no `--with-deps` — Render cannot run root package installs).

After changing the build command, use **Clear build cache & deploy** once so Chromium is installed fresh.

## Environment variables

Add these in Render under the service Environment tab.

Required for login. The server refuses to start unless both values are set to non-empty strings:

```txt
DASHBOARD_USERNAME=adnan
DASHBOARD_PASSWORD=choose-a-strong-password
NODE_ENV=production
```

Required for dashboard data:

```txt
TEST_MODE=false
SHEET_ID=your-google-sheet-id
N8N_BASE_URL=your-n8n-base-url
GOOGLE_SERVICE_ACCOUNT_JSON=your-full-service-account-json
```

Optional, depending on your existing integrations:

```txt
GMAIL_USER=
GMAIL_APP_PASSWORD=
FIELDROUTES_USERNAME=
FIELDROUTES_PASSWORD=
FIELDROUTES_BASE_URL=
FIELDROUTES_AUTH_STATE_JSON=
```

For Route Finder on Render:

- **Recommended:** set `FIELDROUTES_USERNAME` and `FIELDROUTES_PASSWORD` once, then use **Refresh on server** in Route Finder when the session expires (no redeploy).
- **Or:** on your Mac run `node scripts/fieldRoutesLogin.mjs` and `npm run fieldroutes:export-auth`, then **paste the JSON in Route Finder → Apply Session** (no redeploy).
- **Optional bootstrap:** `FIELDROUTES_AUTH_STATE_JSON` in Render env (only needed if you prefer env over dashboard paste).

Use the same values from your local `server/.env`, but do not commit that `.env` file to GitHub.

## Google service account note

If you use `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the entire JSON value into Render as one environment variable. Make sure the Google Sheet is shared with the service account email.

## After deployment

Render will give you a URL like:

```txt
https://green-shield-dashboard.onrender.com
```

Open that URL. The browser should ask for the username and password you set in Render.

Expired public agreement signing links return HTTP `410 Gone`. Missing or invalid signing links return HTTP `404 Not Found`.

## Local development still works

For local development, continue using:

```bash
npm run install:all
npm run dev
```

Local development also requires `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` in `server/.env` or the shell environment. The server fails closed when either value is missing or blank.
