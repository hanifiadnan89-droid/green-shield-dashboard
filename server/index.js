import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import leadsRouter from './routes/leads.js';
import sendRouter from './routes/send.js';
import workflowsRouter from './routes/workflows.js';
import activityRouter from './routes/activity.js';
import driveRouter from './routes/drive.js';
import documentsRouter from './routes/documents.js';
import routesRouter from './routes/routes.js';
import { startCron } from './services/fieldRoutesCron.js';
import { loadAuthStatus, checkAuthHealth, startAuthKeepalive } from './services/fieldRoutesAuth.js';
import { logPlaywrightChromiumDiagnostics } from './services/playwrightRuntime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    testMode: process.env.TEST_MODE === 'true',
    sheetId: process.env.SHEET_ID,
    n8nBase: process.env.N8N_BASE_URL,
    hasGoogleCreds: !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/leads', leadsRouter);
app.use('/api/send', sendRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/drive', driveRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/routes', routesRouter);

startCron();

// Startup: restore last known auth status from disk, then run an immediate
// health check in the background and start the 45-minute keepalive.
loadAuthStatus();
checkAuthHealth()
  .then(s => console.log(`[auth] Startup check: FieldRoutes auth is ${s}`))
  .catch(err => console.warn('[auth] Startup check failed:', err.message));
logPlaywrightChromiumDiagnostics()
  .catch(err => console.warn('[playwright] Startup diagnostic failed:', err.message));
startAuthKeepalive();

app.listen(PORT, () => {
  const mode = process.env.TEST_MODE === 'true' ? '🔒 TEST MODE' : '🔴 LIVE MODE';
  console.log(`\n✅ Green Shield API running on http://localhost:${PORT}`);
  console.log(`   Mode: ${mode}`);
  console.log(`   Google Sheets: ${process.env.SHEET_ID ? 'configured' : '⚠️  SHEET_ID missing'}`);
  console.log(`   n8n: ${process.env.N8N_BASE_URL || '⚠️  N8N_BASE_URL missing'}`);
  console.log(`   Credentials: ${process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE ? '✓' : '⚠️  GOOGLE_SERVICE_ACCOUNT missing'}\n`);
});
