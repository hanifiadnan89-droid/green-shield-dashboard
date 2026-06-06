/**
 * Headless FieldRoutes login using FIELDROUTES_USERNAME / FIELDROUTES_PASSWORD.
 * Used on Render when interactive Chromium is not available.
 */

import { launchFieldRoutesChromium } from './playwrightRuntime.js';
import { savePersistedAuthState, getFieldRoutesBaseUrl } from './fieldRoutesAuth.js';
import { withFieldRoutesScrapeLock } from './fieldRoutesScrapeLock.js';

const LOGIN_TIMEOUT_MS = 90 * 1000;

export function hasFieldRoutesCredentials() {
  const user = (process.env.FIELDROUTES_USERNAME || '').trim();
  const pass = (process.env.FIELDROUTES_PASSWORD || '').trim();
  return !!(user && pass);
}

async function fillLoginForm(page, username, password) {
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 30000 });

  const usernameInput = page.locator(
    'input[name="username"], input[name="email"], input[type="email"]',
  ).first();
  if (await usernameInput.count()) {
    await usernameInput.fill(username);
  }

  await passwordInput.fill(password);
}

async function clickLoginSubmit(page) {
  const namedSubmit = page.getByRole('button', { name: /log\s*in|sign\s*in/i }).first();
  if (await namedSubmit.count()) {
    await namedSubmit.click();
    return;
  }

  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  if (await submit.count()) {
    await submit.click();
    return;
  }

  await page.keyboard.press('Enter');
}

async function waitForLoginSuccess(page) {
  await page.waitForFunction(
    () => {
      if (document.readyState !== 'complete') return false;
      return !document.querySelector('input[type="password"]');
    },
    { timeout: LOGIN_TIMEOUT_MS, polling: 2000 },
  );

  const stillOnLogin = await page.locator('input[type="password"]').count();
  if (stillOnLogin > 0) {
    throw new Error('Login form still visible after submit — check username/password or 2FA.');
  }
}

export async function refreshFieldRoutesSessionWithCredentials() {
  if (!hasFieldRoutesCredentials()) {
    throw new Error('FIELDROUTES_USERNAME and FIELDROUTES_PASSWORD must be set in the environment.');
  }

  return withFieldRoutesScrapeLock('headlessLogin', async () => {
    const username = process.env.FIELDROUTES_USERNAME.trim();
    const password = process.env.FIELDROUTES_PASSWORD.trim();
    const baseUrl = getFieldRoutesBaseUrl();

    const browser = await launchFieldRoutesChromium();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      await fillLoginForm(page, username, password);
      await clickLoginSubmit(page);
      await waitForLoginSuccess(page);

      const state = await context.storageState();
      await savePersistedAuthState(state);
      console.log('[auth] Headless FieldRoutes login succeeded — session saved on server');
      return state;
    } catch (err) {
      const msg = err.message || String(err);
      throw new Error(`FieldRoutes headless login failed: ${msg}`);
    } finally {
      await browser.close();
    }
  });
}
