import 'dotenv/config';
import express from 'express';
import twilio from 'twilio';
import { createHelmetMiddleware } from './security/contentSecurityPolicy.js';
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
import activityErrorsRouter from './routes/activityErrors.js';
import driveRouter from './routes/drive.js';
import documentsRouter from './routes/documents.js';
import { signingPublicRouter, signingStaffRouter } from './routes/signing.js';
import { validateSigningSession } from './services/agreementSigning/storage.js';
import routesRouter from './routes/routes.js';
import aiRouter from './routes/ai.js';
import kbRouter from './routes/knowledgeBase.js';
import geocodeRouter from './routes/geocode.js';
import intakeRouter from './routes/intake.js';
import messagesRouter from './routes/messages.js';
import { appendMessage } from './services/conversationMessages.js';
import { startCron } from './services/fieldRoutesCron.js';
import {
  loadAuthStatus,
  checkAuthHealth,
  startAuthKeepalive,
  getAuthConfigDiagnostics,
  isAuthStatusFresh,
} from './services/fieldRoutesAuth.js';
import { logPlaywrightChromiumDiagnostics } from './services/playwrightRuntime.js';
import { getGoogleCredentialsDiagnostics } from './services/googleCredentials.js';
import { getSheetsStartupCheck, runSheetsStartupCheck } from './services/sheetsStartupCheck.js';
import { isInsectQuarterlyVectorPdfEnabled } from './services/insectQuarterlyVectorPdfFlag.js';
import { escapeHtml } from './security/htmlEscape.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const clientDistPath = path.resolve(__dirname, '../client/dist');

function isInvalidDashboardCredential(value) {
  if (value == null) return true;
  const trimmed = String(value).trim();
  return trimmed === '' || trimmed.toLowerCase() === 'null';
}

function validateDashboardAuthConfig() {
  const missing = [];
  if (isInvalidDashboardCredential(process.env.DASHBOARD_USERNAME)) {
    missing.push('DASHBOARD_USERNAME');
  }
  if (isInvalidDashboardCredential(process.env.DASHBOARD_PASSWORD)) {
    missing.push('DASHBOARD_PASSWORD');
  }

  if (missing.length > 0) {
    console.error(
      `[startup] Dashboard authentication is required. Missing or invalid environment variable(s): ${missing.join(', ')}. ` +
      'Set both DASHBOARD_USERNAME and DASHBOARD_PASSWORD to non-empty values before starting the server.',
    );
    process.exit(1);
  }
}

validateDashboardAuthConfig();

const app = express();

function requireDashboardLogin(req, res, next) {
  const expectedUsername = process.env.DASHBOARD_USERNAME;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  // Startup validation guarantees both credentials are present before Express starts.
  if (!expectedUsername || !expectedPassword) {
    return next();
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
    'https://gshieldpest.com',
    'https://www.gshieldpest.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]
}));
app.use(createHelmetMiddleware());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err && req.path.startsWith('/api/ai')) {
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }
  return next(err);
});

// Customer e-sign routes (no dashboard login)
app.use('/api/signing/public', signingPublicRouter);

// PDF.js-based agreement viewer — iOS-friendly full-screen, all pages, fit-to-width.
// Must stay before requireDashboardLogin so customers can open it without credentials.
//
// CSP NOTE: script-src lacks 'unsafe-inline', so all JavaScript must be in external
// files served from 'self'. /sign-view.js and /calendar-redirect.js handle this.
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

function sendPublicSigningPageError(res, err) {
  if (err?.status === 410) {
    return res.status(410).send('Signing link expired');
  }
  if (err?.status === 404) {
    return res.status(404).send('Signing link not found');
  }
  return res.status(500).send('Server error');
}

// External JS for the PDF viewer — avoids CSP inline-script violation.
// The PDF URL is passed via <meta name="pdf-src"> in the HTML.
app.get('/sign-view.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`
document.getElementById('back').addEventListener('click', () => history.back());

const pdfSrc = document.querySelector('meta[name="pdf-src"]').content;
const workerSrc = document.querySelector('meta[name="pdfjs-worker"]').content;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

(async () => {
  const status = document.getElementById('status');
  const container = document.getElementById('pages');
  try {
    const pdf = await pdfjsLib.getDocument(pdfSrc).promise;
    status.remove();

    const dpr = window.devicePixelRatio || 1;
    const barH = document.getElementById('bar').offsetHeight;
    // Available dimensions for a single page to fill.
    const availW = document.documentElement.clientWidth - 12;
    const availH = window.innerHeight - barH - 12;

    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const vp0 = page.getViewport({ scale: 1 });
      const isLandscape = vp0.width > vp0.height;

      // Scale strategy:
      //  Portrait page  → fit to available width (fills left-right, scrolls down)
      //  Landscape page → fit to available height so text fills the screen
      //                   (the page will be wider than the phone; horizontal scroll reveals full width)
      const scaleW = availW / vp0.width;
      const scaleH = availH / vp0.height;
      const displayScale = isLandscape ? Math.max(scaleW, scaleH) : scaleW;

      // Render at physical (HiDPI) resolution, but set CSS size to logical pixels.
      const vp = page.getViewport({ scale: displayScale * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width  = Math.round(vp0.width  * displayScale) + 'px';
      canvas.style.height = Math.round(vp0.height * displayScale) + 'px';
      canvas.style.display = 'block';

      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

      const wrap = document.createElement('div');
      wrap.className = 'page-wrap';
      wrap.appendChild(canvas);
      container.appendChild(wrap);
    }
  } catch (e) {
    status.textContent = 'Could not load the agreement. Please try again.';
  }
})();
`);
});

// External JS for the calendar redirect page — avoids CSP inline-script violation.
app.get('/calendar-redirect.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`
const icsUrl = document.querySelector('meta[name="ics-src"]').content;
window.addEventListener('load', () => setTimeout(() => { window.location.href = icsUrl; }, 600));
`);
});

app.get('/sign-view/:token', async (req, res) => {
  const { token } = req.params;
  try {
    await validateSigningSession(token, { requireFile: 'documentPdf' });
  } catch (err) {
    return sendPublicSigningPageError(res, err);
  }

  const pdfPath = `/api/signing/public/${encodeURIComponent(token)}/document.pdf`;
  const escapedPdfPath = escapeHtml(pdfPath);
  const escapedPdfWorker = escapeHtml(`${PDFJS_CDN}/pdf.worker.min.js`);
  const escapedPdfScript = escapeHtml(`${PDFJS_CDN}/pdf.min.js`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes">
  <meta name="robots" content="noindex, nofollow">
  <meta name="pdf-src" content="${escapedPdfPath}">
  <meta name="pdfjs-worker" content="${escapedPdfWorker}">
  <title>Green Shield Agreement</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a1a; font-family: -apple-system, sans-serif;
      /* Allow horizontal scroll when a landscape page is wider than the screen */
      overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    #bar {
      position: sticky; top: 0; left: 0; z-index: 10;
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: #148a43; color: #fff;
      min-width: 100vw; /* stays full-width even when body scrolls horizontally */
    }
    #bar-title { font-size: 0.95rem; font-weight: 700; }
    #back { background: none; border: none; color: rgba(255,255,255,0.85); font-size: 0.9rem; cursor: pointer; padding: 4px 0; }
    #pages { padding: 6px; }
    .page-wrap { margin-bottom: 6px; }
    /* Canvas size is set per-page by JS; do not override with CSS percentages */
    #status { color: rgba(255,255,255,0.6); text-align: center; padding: 40px 16px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div id="bar">
    <span id="bar-title">Green Shield Agreement</span>
    <button id="back">&#8592; Back</button>
  </div>
  <div id="status">Loading agreement…</div>
  <div id="pages"></div>
  <script src="${escapedPdfScript}"></script>
  <script src="/sign-view.js"></script>
</body>
</html>`);
});

// Calendar invite landing page — gives iMessage a rich OG preview card for the calendar link.
// /cal/:token is the short branded form used in SMS (gshieldpest.com/cal/TOKEN).
// /calendar-invite/:token is kept as a backwards-compatible alias.
// Auto-triggers the .ics download so the user is taken straight to their calendar app.
app.get(['/cal/:token', '/calendar-invite/:token'], async (req, res) => {
  const { token } = req.params;
  const icsUrl = `/api/signing/public/${encodeURIComponent(token)}/calendar.ics`;
  const appUrl = process.env.PUBLIC_APP_URL
    || process.env.RENDER_EXTERNAL_URL
    || `${req.protocol}://${req.get('host')}`;

  let session;
  try {
    session = await validateSigningSession(token, { requireCalendar: true });
  } catch (err) {
    return sendPublicSigningPageError(res, err);
  }

  let ogImageTag = '';
  if (session.hasOgCard) {
    const imgUrl = `${appUrl}/api/signing/public/${encodeURIComponent(token)}/og-card.png`;
    const escapedImgUrl = escapeHtml(imgUrl);
    ogImageTag = `<meta property="og:image" content="${escapedImgUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:image" content="${escapedImgUrl}">`;
  }
  const escapedIcsUrl = escapeHtml(icsUrl);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="ics-src" content="${escapedIcsUrl}">
  <title>Add Green Shield Appointment</title>
  <meta property="og:title" content="Add to Calendar — Green Shield Appointment">
  <meta property="og:description" content="Tap to add your Green Shield pest control appointment to your calendar.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Green Shield Pest Solutions">
  <meta name="twitter:card" content="${ogImageTag ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="Add to Calendar — Green Shield Appointment">
  <meta name="twitter:description" content="Tap to add your Green Shield pest control appointment to your calendar.">
  ${ogImageTag}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; background: #f0faf4; display: flex; align-items: center; justify-content: center; font-family: -apple-system, sans-serif; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 36px 28px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 3rem; margin-bottom: 16px; }
    h1 { font-size: 1.25rem; font-weight: 700; color: #102018; margin-bottom: 10px; }
    p { color: #4b5563; font-size: 0.95rem; margin-bottom: 24px; line-height: 1.5; }
    a.btn { display: block; background: #3b82f6; color: #fff; padding: 14px 24px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 1rem; }
  </style>
  <script src="/calendar-redirect.js"></script>
</head>
<body>
  <div class="card">
    <div class="icon">&#128197;</div>
    <h1>Add to Calendar</h1>
    <p>Adding your Green Shield appointment to your calendar&hellip;</p>
    <a href="${escapedIcsUrl}" class="btn">Tap here if it doesn&rsquo;t open</a>
  </div>
</body>
</html>`);
});

// Serve static assets and the signing page BEFORE the dashboard auth wall.
// Static bundles (JS/CSS) contain no sensitive data — API responses are what's protected.
// /sign/:token must be reachable by customers who have no dashboard credentials.
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // Cached index.html read — the file is immutable between deployments.
  let _indexHtml = null;
  async function getIndexHtml() {
    if (!_indexHtml) {
      _indexHtml = await fs.promises.readFile(path.join(clientDistPath, 'index.html'), 'utf8');
    }
    return _indexHtml;
  }

  // Public signing page — injects Open Graph meta tags so SMS/iMessage link
  // previews show "Green Shield Agreement" instead of the raw dashboard URL.
  // noindex prevents search engines from crawling customer-specific pages.
  app.get('/sign/:token', async (req, res) => {
    const { token } = req.params;
    const appUrl = process.env.PUBLIC_APP_URL
      || process.env.RENDER_EXTERNAL_URL
      || `${req.protocol}://${req.get('host')}`;

    let html;
    try {
      html = await getIndexHtml();
    } catch (err) {
      console.error('[sign-route] Failed to read index.html:', err.message);
      return res.status(500).send('Server error');
    }

    let title = 'Green Shield — Sign Agreement';
    const description = 'Review and electronically sign your Green Shield Pest Solutions service agreement.';
    let ogImageTag = '';

    try {
      const session = await validateSigningSession(token);
      const firstName = (session?.lead?.name || '').trim().split(/\s+/)[0];
      if (firstName) title = `${firstName}, your agreement is ready to sign`;

      if (session?.hasOgCard) {
        const imgUrl = `${appUrl}/api/signing/public/${encodeURIComponent(token)}/og-card.png`;
        const escapedImgUrl = escapeHtml(imgUrl);
        ogImageTag = [
          `<meta property="og:image" content="${escapedImgUrl}">`,
          `<meta property="og:image:width" content="1200">`,
          `<meta property="og:image:height" content="630">`,
          `<meta name="twitter:image" content="${escapedImgUrl}">`,
        ].join('\n    ');
      } else if (session?.hasPreview) {
        const imgUrl = `${appUrl}/api/signing/public/${encodeURIComponent(token)}/preview.png`;
        const escapedImgUrl = escapeHtml(imgUrl);
        ogImageTag = [
          `<meta property="og:image" content="${escapedImgUrl}">`,
          `<meta name="twitter:image" content="${escapedImgUrl}">`,
        ].join('\n    ');
      }
    } catch (err) {
      return sendPublicSigningPageError(res, err);
    }

    const escapedTitle = escapeHtml(title);
    const escapedDescription = escapeHtml(description);

    const injected = `<title>${escapedTitle}</title>
    <meta name="robots" content="noindex, nofollow">
    <meta property="og:title" content="${escapedTitle}">
    <meta property="og:description" content="${escapedDescription}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Green Shield Pest Solutions">
    ${ogImageTag}
    <meta name="twitter:card" content="${ogImageTag ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${escapedTitle}">
    <meta name="twitter:description" content="${escapedDescription}">`;

    html = html
      .replace(/<title>[^<]*<\/title>/, '')         // remove generic dashboard title
      .replace('</head>', `  ${injected}\n  </head>`); // inject signing-specific tags

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
}

// /api/health is public — must be before requireDashboardLogin so iOS Safari
// doesn't trigger a Basic Auth popup when App.jsx calls it on the signing page.
app.get('/api/health', (req, res) => {
  const googleCreds = getGoogleCredentialsDiagnostics();
  const sheetsCheck = getSheetsStartupCheck();
  res.json({
    status: 'ok',
    testMode: process.env.TEST_MODE === 'true',
    sheetId: process.env.SHEET_ID ? 'configured' : 'missing',
    hasGoogleCreds: googleCreds.ok,
    googleCreds: {
      status: googleCreds.status,
      source: googleCreds.source,
      message: googleCreds.message,
      parseError: googleCreds.parseError,
    },
    sheets: sheetsCheck,
    timestamp: new Date().toISOString(),
  });
});

app.use(requireDashboardLogin);

app.use('/api/leads', leadsRouter);
app.use('/api/send', sendRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/activity-errors', activityErrorsRouter);
app.use('/api/drive', driveRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/signing', signingStaffRouter);
app.use('/api/routes', routesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/kb', kbRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/intake', intakeRouter);
app.use('/api/messages', messagesRouter);

// Dashboard SPA catch-all — after auth, so direct navigation to /leads etc. requires login.
if (fs.existsSync(clientDistPath)) {
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
  if (isAuthStatusFresh()) {
    console.log('[auth] Startup: using fresh persisted ok status (skipping immediate health check)');
    return 'ok';
  }
  return checkAuthHealth({ force: true });
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

    let persistedMessage = null;
    if (row_number) {
      try {
        persistedMessage = appendMessage(row_number, {
          direction: 'outbound',
          channel: 'sms',
          body: message,
          ts: new Date().toISOString(),
          sender: 'You',
          status: sentMessage.status || 'sent',
          meta: { twilioSid: sentMessage.sid },
        });
      } catch (persistErr) {
        console.error('[send-sms] Failed to persist message history:', persistErr.message);
      }
    }

    res.json({
      success: true,
      sid: sentMessage.sid,
      phone: toNumber,
      message,
      row_number,
      name,
      persistedMessage,
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
  console.log('   Login: enabled');
  console.log('Google creds loaded:', !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  console.log('Sheet ID:', process.env.SHEET_ID || '(not set — using default in sheets.js)');
  console.log(`   Google Sheets SHEET_ID env: ${process.env.SHEET_ID ? 'configured' : '⚠️  SHEET_ID missing (default ID used)'}`);
  console.log(`   n8n: ${process.env.N8N_BASE_URL || '⚠️  N8N_BASE_URL missing'}`);
  console.log(`   Insect Quarterly vector PDF: ${isInsectQuarterlyVectorPdfEnabled() ? 'enabled' : 'disabled (legacy AcroForm)'}`);
  const g = getGoogleCredentialsDiagnostics();
  if (g.ok) {
    console.log(`   Google credentials: ✓ (${g.source})`);
  } else {
    console.log(`   Google credentials: ⚠️  ${g.status} — ${g.message}`);
  }
  console.log('');
  runSheetsStartupCheck().catch(err => {
    console.error('[sheets] Startup check unexpected error:', err.message);
  });
});
