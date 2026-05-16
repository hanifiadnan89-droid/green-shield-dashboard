import cron from 'node-cron';
import { preloadNextThreeDays } from './fieldRoutesPreloader.js';

export function startCron() {
  cron.schedule('0 21 * * *', async () => {
    console.log('[cron] Starting nightly route preload...');
    try {
      await preloadNextThreeDays();
      console.log('[cron] Nightly route preload complete');
    } catch (err) {
      console.error('[cron] Nightly route preload failed:', err.message);
    }
  }, { timezone: 'America/New_York' });
  console.log('[cron] Scheduled nightly route preload at 9 PM ET');
}
