import { launchFieldRoutesChromium } from './playwrightRuntime.js';

const PDFJS_VERSION = '3.11.174';
const DEFAULT_RENDER_SCALE = 2.5;

function buildPdfPreviewHtml(pdfBase64, scale) {
  return `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }
  #wrap { background: white; display: inline-block; }
  canvas { display: block; }
</style></head><body>
<div id="wrap"><canvas id="c"></canvas></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js';
(async () => {
  const data = atob('${pdfBase64}');
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: ${scale} });
  const canvas = document.getElementById('c');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  window.__done = true;
})();
</script></body></html>`;
}

/**
 * Render the first page of a Bed Bug agreement PDF to a high-resolution PNG buffer.
 * Uses Playwright + pdf.js (same approach as server/scripts/render-pdf-preview.mjs).
 */
export async function renderBedBugAgreementPreviewPng(pdfBytes, { scale = DEFAULT_RENDER_SCALE } = {}) {
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  const html = buildPdfPreviewHtml(pdfBase64, scale);

  const browser = await launchFieldRoutesChromium();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__done === true, { timeout: 60000 });
    return await page.locator('#wrap').screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

/**
 * Best-effort preview render — returns null instead of throwing when Chromium is unavailable.
 */
export async function tryRenderBedBugAgreementPreviewPng(pdfBytes, options = {}) {
  try {
    const pngBuffer = await renderBedBugAgreementPreviewPng(pdfBytes, options);
    return { ok: true, pngBuffer };
  } catch (err) {
    console.warn('[bed-bug-email-preview] Inline preview unavailable:', err.message);
    return { ok: false, error: err.message };
  }
}

/** Generic alias — works for any single-page agreement PDF. */
export const tryRenderAgreementPreviewPng = tryRenderBedBugAgreementPreviewPng;
export const renderAgreementPreviewPng = renderBedBugAgreementPreviewPng;

function buildOgCardHtml(customerName) {
  const firstName = customerName ? customerName.trim().split(/\s+/)[0] : '';
  const headline = firstName
    ? `${firstName}, your agreement is ready to sign`
    : 'Your agreement is ready to sign';
  return `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #f0faf4; display: flex; align-items: center; justify-content: center; font-family: -apple-system, 'Helvetica Neue', Helvetica, sans-serif; }
  .card { background: #fff; border-radius: 28px; padding: 70px 80px; width: 1040px; box-shadow: 0 12px 60px rgba(0,0,0,0.08); }
  .brand { display: flex; align-items: center; gap: 18px; margin-bottom: 44px; }
  .logo { width: 64px; height: 64px; background: #148a43; border-radius: 16px; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 26px; }
  .brand-name { font-size: 22px; font-weight: 700; color: #102018; }
  .brand-sub { font-size: 15px; color: #6b7280; margin-top: 4px; }
  h1 { font-size: 50px; font-weight: 800; color: #102018; line-height: 1.15; margin-bottom: 18px; }
  .desc { font-size: 21px; color: #4b5563; margin-bottom: 44px; line-height: 1.4; }
  .btn { display: inline-block; background: #148a43; color: #fff; padding: 20px 48px; border-radius: 14px; font-size: 21px; font-weight: 700; }
</style></head>
<body>
  <div class="card">
    <div class="brand">
      <div class="logo">GS</div>
      <div>
        <div class="brand-name">Green Shield Pest Solutions</div>
        <div class="brand-sub">Service Agreement</div>
      </div>
    </div>
    <h1>${headline}</h1>
    <div class="desc">Review and electronically sign your pest control service agreement.</div>
    <div class="btn">Review &amp; Sign Agreement &rarr;</div>
  </div>
</body></html>`;
}

export async function generateSigningOgCard(customerName) {
  const html = buildOgCardHtml(customerName || '');
  const browser = await launchFieldRoutesChromium();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

export async function tryGenerateSigningOgCard(customerName) {
  try {
    const pngBuffer = await generateSigningOgCard(customerName);
    return { ok: true, pngBuffer };
  } catch (err) {
    console.warn('[signing-og-card] OG card generation unavailable:', err.message);
    return { ok: false, error: err.message };
  }
}
