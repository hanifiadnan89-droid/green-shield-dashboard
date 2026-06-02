import 'dotenv/config';
import express from 'express';
import twilio from 'twilio';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import leadsRouter from './routes/leads.js';
import sendRouter from './routes/send.js';
import workflowsRouter from './routes/workflows.js';
import activityRouter from './routes/activity.js';
import driveRouter from './routes/drive.js';
import documentsRouter from './routes/documents.js';
import routesRouter from './routes/routes.js';
import aiRouter from './routes/ai.js';
import geocodeRouter from './routes/geocode.js';
import { startCron } from './services/fieldRoutesCron.js';
import {
  loadAuthStatus,
  checkAuthHealth,
  startAuthKeepalive,
  getAuthConfigDiagnostics,
} from './services/fieldRoutesAuth.js';
import { logPlaywrightChromiumDiagnostics } from './services/playwrightRuntime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const clientDistPath = path.resolve(__dirname, '../client/dist');

function requireDashboardLogin(req, res, next) {
  const expectedUsername = process.env.DASHBOARD_USERNAME;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return res.status(500).send('Dashboard login is not configured');
  }

  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Green Shield Dashboard"');
    return res.status(401).send('Authentication required');
  }

  const credentials = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
  const separatorIndex = credentials.indexOf(':');
  const username = separatorIndex >= 0 ? credentials.slice(0, separatorIndex) : '';
  const password = separatorIndex >= 0 ? credentials.slice(separatorIndex + 1) : '';

  if (username === expectedUsername && password === expectedPassword) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Green Shield Dashboard"');
  return res.status(401).send('Invalid credentials');
}

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(cors({
  origin: [
    'https://green-shield-dashboard.onrender.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]
}));
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json());
app.use(requireDashboardLogin);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    testMode: process.env.TEST_MODE === 'true',
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
app.use('/api/ai', aiRouter);
app.use('/api/geocode', geocodeRouter);

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).send('Green Shield API is running. Build the client to serve the dashboard UI.');
  });
}

startCron();

if (process.env.RENDER) {
  logPlaywrightChromiumDiagnostics().catch((err) => {
    console.warn('[playwright] Startup diagnostics failed:', err.message);
  });
}

// Startup: restore last known auth status from disk, then run an immediate
// health check in the background and start the 45-minute keepalive.
loadAuthStatus().then(() => {
  const diag = getAuthConfigDiagnostics();
  if (process.env.RENDER) {
    const ev = diag.envVar;
    console.log(
      `[auth] Render startup — FIELDROUTES_AUTH_STATE_JSON: ${ev.configured ? 'set' : 'MISSING'}`
      + (ev.configured ? ` (${ev.length} chars, parseOk=${ev.parseOk}, frCookies=${ev.fieldRoutesCookieCount})` : ''),
    );
    if (ev.configured && !ev.parseOk) {
      console.error(`[auth] FIELDROUTES_AUTH_STATE_JSON parse error: ${ev.parseError}`);
    }
    if (diag.recommendation) {
      console.log(`[auth] ${diag.recommendation}`);
    }
  }
  return checkAuthHealth();
})
  .then(s => console.log(`[auth] Startup check: FieldRoutes auth is ${s}`))
  .catch(err => console.warn('[auth] Startup check failed:', err.message));
startAuthKeepalive();

app.post('/api/send-sms', async (req, res) => {
  try {
    const { phone, message, row_number, name } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const toNumber = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;

    const sentMessage = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toNumber
    });

    res.json({
      success: true,
      sid: sentMessage.sid,
      phone: toNumber,
      message,
      row_number,
      name
    });
  } catch (error) {
    console.error('SMS send error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});    

app.listen(PORT, () => {
  const mode = process.env.TEST_MODE === 'true' ? '🔒 TEST MODE' : '🔴 LIVE MODE';
  console.log(`\n✅ Green Shield API running on port ${PORT}`);
  console.log(`   Mode: ${mode}`);
  console.log(`   Dashboard UI: ${fs.existsSync(clientDistPath) ? 'served from client/dist' : 'not built yet'}`);
  console.log(`   Login: ${process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD ? 'enabled' : 'disabled'}`);
  console.log(`   Google Sheets: ${process.env.SHEET_ID ? 'configured' : '⚠️  SHEET_ID missing'}`);
  console.log(`   n8n: ${process.env.N8N_BASE_URL || '⚠️  N8N_BASE_URL missing'}`);
  console.log(`   Credentials: ${process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE ? '✓' : '⚠️  GOOGLE_SERVICE_ACCOUNT missing'}\n`);
});
