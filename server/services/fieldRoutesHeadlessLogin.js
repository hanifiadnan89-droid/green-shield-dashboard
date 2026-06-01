/**
 * Headless FieldRoutes login using FIELDROUTES_USERNAME / FIELDROUTES_PASSWORD.
 * Used on Render when interactive Chromium is not available.
 */

import { launchFieldRoutesChromium } from './playwrightRuntime.js';
import { savePersistedAuthState, getFieldRoutesBaseUrl } from './fieldRoutesAuth.js';

const LOGIN_TIMEOUT_MS = 90 * 1000;

export function hasFieldRoutesCredentials() {
  const user = (process.env.FIELDROUTES_USERNAME || '').trim();
  const pass = (process.env.FIELDROUTES_PASSWORD || '').trim();
  return !!(user && pass);
}

export async function refreshFieldRoutesSessionWithCredentials() {
  if (!hasFieldRoutesCredentials()) {
    throw new Error('FIELDROUTES_USERNAME and FIELDROUTES_PASSWORD must be set in the environment.');
  }

  const username = process.env.FIELDROUTES_USERNAME.trim();
  const password = process.env.FIELDROUTES_PASSWORD.trim();
  const baseUrl = getFieldRoutesBaseUrl();

  const browser = await launchFieldRoutesChromium();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const userSelector = 'input[name="username"], input[name="email"], input[type="email"], #username, #email';
    const passSelector = 'input[type="password"], #password';
    await page.waitForSelector(passSelector, { timeout: 30000 });
    const userField = await page.$(userSelector);
    if (userField) {
      await userField.fill(username);
    }
    await page.fill(passSelector, password);

    const submit = page.locator('button[type="submit"], input[type="submit"]').first();
    if (await submit.count()) {
      await submit.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await page.waitForFunction(
      () => {
        if (document.readyState !== 'complete') return false;
        return !document.querySelector('input[type="password"]');
      },
      { timeout: LOGIN_TIMEOUT_MS, polling: 2000 },
    );

    const state = await context.storageState();
    await savePersistedAuthState(state);
    console.log('[auth] Headless FieldRoutes login succeeded — session saved on server');
    return state;
  } finally {
    await browser.close();
  }
}
