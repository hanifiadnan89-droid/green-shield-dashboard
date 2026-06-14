# AGENTS.md

## Cursor Cloud specific instructions

### Product

Green Shield Control Center — Node/Express API (`server/`, port **3001**) + React/Vite UI (`client/`, port **5173**). See `SETUP.md` for full setup and `package.json` scripts for commands.

### Dev servers

From repo root:

- **Both:** `npm run dev` (or `bash start.sh`) — runs server and Vite via `concurrently`
- **API only:** `npm run dev --prefix server`
- **UI only:** `npm run dev --prefix client`

Vite proxies `/api` → `http://localhost:3001`. Open **http://localhost:5173** for the dashboard.

`dotenv` loads **`server/.env`** when the server process cwd is `server/` (normal for `--prefix server` and `npm run dev`). Copy `.env.example` → `server/.env` and set credentials there.

### Lint

No ESLint/Prettier scripts are configured. Use `npm test --prefix client` for automated checks.

### Tests

```bash
npm test --prefix client          # Vitest (fieldRoutesScorer unit tests)
npm run test:watch --prefix client
```

### Build / production

```bash
npm run build                     # client → client/dist
npm start                         # Express only; serves client/dist if built
```

### Environment / integrations

| Variable | Purpose |
|----------|---------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_FILE` | **Required** for `/api/leads` and sheet-backed flows |
| `TEST_MODE=true` | Safe default: mocks n8n sends and skips real sheet writes |
| `N8N_*` | Webhooks; workflow catalog works without `N8N_API_KEY` |
| `FIELDROUTES_AUTH_STATE_JSON` | Route scrape/auth (optional; needs Playwright Chromium) |
| `ANTHROPIC_API_KEY`, `GMAIL_*`, `TWILIO_*` | Optional feature-specific APIs |

Without Google credentials, the UI still loads but CRM/lead pages show the expected configuration error. Workflows and Activity Log work without Sheets.

### Playwright (route scraping only)

```bash
npm run playwright:install --prefix server
```

Not needed for UI/API smoke tests unless exercising FieldRoutes scrape/login.

### Port conflicts

```bash
lsof -ti :3001 | xargs kill -9 2>/dev/null; lsof -ti :5173 | xargs kill -9 2>/dev/null
```

### Long-running dev

Use a tmux session (e.g. `green-shield-dev`) when starting `npm run dev` in the background.
