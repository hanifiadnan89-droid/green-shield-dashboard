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

Required for Training Center Knowledge Base persistence:

1. Add a Render persistent disk to the Web Service.
2. Set the disk mount path to `/var/data`.
3. Set these environment variables exactly:

```txt
KNOWLEDGE_STORAGE_BACKEND=persistent_disk
KNOWLEDGE_DATA_DIR=/var/data/knowledge-base
ERROR_LOG_STORAGE_BACKEND=persistent_disk
ERROR_LOG_DATA_DIR=/var/data/error-center
```

The server refuses production Knowledge Base writes on Render unless those values
are configured exactly. Knowledge Base items, chunks, embeddings, and uploaded
original files are stored under `/var/data/knowledge-base`.

The Error Center uses durable JSON storage for CRM error history. Configure
`ERROR_LOG_DATA_DIR` on a Render persistent disk, or omit it to store errors
under the durable Knowledge Base directory when `KNOWLEDGE_DATA_DIR` is already
configured.

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
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
AI_RATE_LIMIT_MAX=20
AI_RATE_LIMIT_WINDOW_MS=60000
AI_MAX_PROMPT_CHARS=60000
AI_MAX_RESPONSE_CHARS=6000
AI_TIMEOUT_MS=60000
AI_MAX_OUTPUT_TOKENS=
AI_METRICS_MAX_EVENTS=500
MEDIA_TRANSCRIPTION_MAX_BYTES=24000000
```

AI-powered dashboard endpoints are authenticated and rate limited per authenticated user. The `AI_*` defaults above can be lowered or raised per environment; oversized prompts return HTTP `413`, rate-limited requests return HTTP `429`, and timed-out provider requests return HTTP `504`.

Knowledge Base audio/video uploads larger than `MEDIA_TRANSCRIPTION_MAX_BYTES`
are automatically compressed and split into ordered transcription chunks before
being sent to the transcription provider. The server uses the bundled
`ffmpeg-static` binary for splitting; if ffmpeg is unavailable, oversized media
keeps its original upload and returns a clear extraction error.

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
