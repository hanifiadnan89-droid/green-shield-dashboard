import cron from 'node-cron';
import { preloadNextSixWorkingDays } from './fieldRoutesPreloader.js';
import { checkAuthHealth } from './fieldRoutesAuth.js';
import {
  hasFieldRoutesCredentials,
  refreshFieldRoutesSessionWithCredentials,
} from './fieldRoutesHeadlessLogin.js';

export function startCron() {
  cron.schedule('0 21 * * *', async () => {
    console.log('[cron] Nightly route preload starting...');

    // Check auth before attempting any scraping
    let authResult = await checkAuthHealth();
    if (authResult !== 'ok' && hasFieldRoutesCredentials()) {
      try {
        console.log('[cron] Attempting headless FieldRoutes login...');
        await refreshFieldRoutesSessionWithCredentials();
        authResult = await checkAuthHealth();
      } catch (err) {
        console.warn('[cron] Headless login failed:', err.message);
      }
    }
    if (authResult !== 'ok') {
      console.warn(
        `[cron] Nightly preload skipped — FieldRoutes auth status: ${authResult}. ` +
        'Refresh session in Route Finder or set FIELDROUTES_USERNAME/PASSWORD.',
      );
      return;
    }

    try {
      await preloadNextSixWorkingDays();
      console.log('[cron] Nightly route preload complete');
    } catch (err) {
      console.error('[cron] Nightly route preload failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  console.log('[cron] Scheduled nightly route preload at 9 PM ET');
}
