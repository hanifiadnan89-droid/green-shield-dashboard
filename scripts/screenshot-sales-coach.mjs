/**
 * Playwright screenshot script for the redesigned Sales Coach.
 * Run: node scripts/screenshot-sales-coach.mjs
 */
import pkg from '../server/node_modules/playwright/index.js';
const { chromium } = pkg;
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../screenshots/sales-coach-redesign');
mkdirSync(OUT, { recursive: true });

const MOCK_RESULT = {
  recommendedResponse:
    "I hear you — and I get it. $119 a month is a real number, and you should feel good about what you're getting for it. Here's what makes this work: that price covers monthly outdoor tick and mosquito treatments from May through October, plus our re-service guarantee, so if anything comes back between visits we're back out at no charge. The way most of my Maine families think about it — it's about $4 a day to keep your yard a place your kids and pets can actually enjoy all summer without bug spray. If I locked in your first visit this week, would Tuesday or Thursday morning work better for you?",
  whyThisWorks:
    "Acknowledges the price concern without flinching, so the customer feels heard. Reframes the monthly cost into a daily number that feels small. Anchors value around the outcome they actually care about — kids and pets enjoying the yard.",
  salesStrategy:
    "This customer is weighing cost vs. value. Don't discount — translate cost into daily use. Surface the guarantee so the financial risk is gone.",
  softerVersion:
    "Totally fair to want to think about the price. Most families I work with end up feeling like it pays for itself the first time they can sit outside without getting bitten. If it would help, I can hold a spot for this week so you've got the option — no pressure either way.",
  bestClosingQuestion:
    "If I locked in your first visit this week, would Tuesday or Thursday morning work better for you?",
  thingsToAvoid: [
    "Don't apologize for the price",
    "Don't immediately discount",
    "Don't ramble about company history",
    "Don't ask 'does that sound good?'",
  ],
  knowledgeSources: [
    { id: 'k1', title: 'T/M Pricing Sheet 2026',     fileName: 'TM-pricing-2026.pdf', sourceType: 'pdf',  similarity: 0.92 },
    { id: 'k2', title: 'Objection: Price playbook',  fileName: 'price-playbook.md',   sourceType: 'note', similarity: 0.86 },
    { id: 'k3', title: 'Maine seasonal positioning', fileName: 'seasonal-notes.docx', sourceType: 'docx', similarity: 0.74 },
  ],
  confidence: 92,
  sessionId: null,
};

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── 1) Desktop @ 1440 ─────────────────────────────────────────────────────
  console.log('▶ Desktop (1440×900)');
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  let page = await ctx.newPage();

  await page.route('**/api/ai/sales-coach/module', async (route) => {
    await new Promise(r => setTimeout(r, 350));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RESULT) });
  });
  await page.route('**/api/ai/objection-feedback', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"id":"mock"}' }));

  await page.goto('http://localhost:5173/sales-coach', { waitUntil: 'networkidle' });
  await page.waitForSelector('.oc-composer__textarea', { timeout: 15000 });
  await page.waitForTimeout(900);

  await shot(page, '01-empty-state');

  // Open the Service dropdown
  const firstTrigger = page.locator('.pds__trigger').first();
  await firstTrigger.click();
  await page.waitForTimeout(220);
  await shot(page, '02-dropdown-open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // Type objection, select service + type + personality
  await page.locator('.oc-composer__textarea').fill(
    "Honestly, $119 a month feels really expensive. I've never paid that much for pest control before, and I don't know if my yard is bad enough to need it every month."
  );
  await page.waitForTimeout(150);
  await shot(page, '03-composer-filled');

  // Pick service: Mosquito (option index 0)
  await page.locator('.pds__trigger').nth(0).click();
  await page.waitForTimeout(150);
  await page.locator('.pds__option').first().click();

  // Pick objection type: search "price"
  await page.locator('.pds__trigger').nth(1).click();
  await page.waitForTimeout(150);
  await page.locator('.pds__search input').fill('price');
  await page.waitForTimeout(120);
  await page.locator('.pds__option').first().click();

  // Pick personality: Price-Focused (last option)
  await page.locator('.pds__trigger').nth(2).click();
  await page.waitForTimeout(150);
  await page.locator('.pds__option').last().click();
  await page.waitForTimeout(150);
  await shot(page, '04-composer-all-filled');

  // Submit and wait for response
  await page.locator('.oc-composer__cta').click();
  await page.waitForSelector('.oc-answer__textarea', { timeout: 10000 });
  await page.waitForTimeout(800);
  await shot(page, '05-response-loaded');

  // Scroll down to see insights bento + recent objections
  await page.evaluate(() => {
    const stack = document.querySelector('.oc-stack');
    if (stack) stack.scrollIntoView({ block: 'end' });
  });
  await page.waitForTimeout(300);
  await shot(page, '06-response-scrolled');

  // Hover the Copy button
  await page.locator('.oc-action').first().hover();
  await page.waitForTimeout(200);

  // Click Copy
  await page.locator('.oc-action').first().click();
  await page.waitForTimeout(200);
  await shot(page, '07-copy-clicked');

  // Click thumbs up
  await page.locator('.oc-action').nth(2).click();
  await page.waitForTimeout(200);
  await shot(page, '08-thumbs-up');

  await ctx.close();

  // ── 2) Tablet @ 900 ────────────────────────────────────────────────────────
  console.log('▶ Tablet (900×1100)');
  ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 2 });
  page = await ctx.newPage();
  await page.route('**/api/ai/sales-coach/module', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RESULT) }));
  await page.goto('http://localhost:5173/sales-coach', { waitUntil: 'networkidle' });
  await page.waitForSelector('.oc-composer__textarea');
  await page.waitForTimeout(900);
  await shot(page, '09-tablet-empty');

  await page.locator('.oc-composer__textarea').fill('$119 a month is too expensive for me.');
  await page.locator('.oc-composer__cta').click();
  await page.waitForSelector('.oc-answer__textarea');
  await page.waitForTimeout(700);
  await shot(page, '10-tablet-response');
  await ctx.close();

  // ── 3) Mobile @ 390 ───────────────────────────────────────────────────────
  console.log('▶ Mobile (390×844)');
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page = await ctx.newPage();
  await page.route('**/api/ai/sales-coach/module', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RESULT) }));
  await page.goto('http://localhost:5173/sales-coach', { waitUntil: 'networkidle' });
  await page.waitForSelector('.oc-composer__textarea');
  await page.waitForTimeout(900);
  await shot(page, '11-mobile-empty');

  await page.locator('.oc-composer__textarea').fill('$119 a month is too expensive for me.');
  await page.waitForTimeout(150);
  await shot(page, '12-mobile-composer-filled');

  await page.locator('.oc-composer__cta').click();
  await page.waitForSelector('.oc-answer__textarea');
  await page.waitForTimeout(700);
  await shot(page, '13-mobile-response');
  await ctx.close();

  await browser.close();
  console.log(`\n✓ Done — ${OUT}`);
})().catch((err) => {
  console.error('✗ Screenshot script failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
