import { existsSync } from 'fs';

const RENDER_INSTALL_HINT =
  'Chromium not installed/found. Set Render Build Command to: npm run render:build, then Clear build cache & deploy.';

function ensurePlaywrightBrowserPath() {
  // Matches npm run playwright:install (local + Render render:build).
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
  }
}

async function loadChromium() {
  ensurePlaywrightBrowserPath();
  let playwrightMod;
  try {
    playwrightMod = await import('playwright');
  } catch {
    throw new Error(
      'Playwright not installed — run: npm install --prefix server'
    );
  }

  const chromium = playwrightMod.default?.chromium ?? playwrightMod.chromium;
  if (!chromium) {
    throw new Error('Playwright loaded, but Chromium was not available.');
  }
  return chromium;
}

export async function getPlaywrightChromiumDiagnostics() {
  try {
    const chromium = await loadChromium();
    const executablePath = chromium.executablePath();
    return {
      ok: existsSync(executablePath),
      executablePath,
      browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || null,
      render: !!process.env.RENDER,
      nodeEnv: process.env.NODE_ENV || null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || null,
      render: !!process.env.RENDER,
      nodeEnv: process.env.NODE_ENV || null,
    };
  }
}

export async function logPlaywrightChromiumDiagnostics() {
  const diag = await getPlaywrightChromiumDiagnostics();
  if (diag.ok) {
    console.log(`[playwright] Chromium ready: ${diag.executablePath}`);
    console.log(`[playwright] PLAYWRIGHT_BROWSERS_PATH=${diag.browsersPath ?? '(default)'}`);
    return;
  }

  console.warn(`[playwright] Chromium unavailable: ${diag.error || 'executable missing'}`);
  if (diag.executablePath) {
    console.warn(`[playwright] Expected executable: ${diag.executablePath}`);
  }
  console.warn(`[playwright] ${RENDER_INSTALL_HINT}`);
}

export async function launchFieldRoutesChromium() {
  const chromium = await loadChromium();
  const executablePath = chromium.executablePath();

  if (!existsSync(executablePath)) {
    throw new Error(`${RENDER_INSTALL_HINT} Expected executable: ${executablePath}`);
  }

  try {
    return await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Executable') || msg.includes('executable')) {
      throw new Error(`${RENDER_INSTALL_HINT} ${msg}`);
    }
    throw err;
  }
}
