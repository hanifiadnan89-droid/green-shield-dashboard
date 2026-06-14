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
  return renderAgreementPreviewPng(pdfBytes, { scale });
}

/**
 * Render the first page of any agreement PDF to a high-resolution PNG buffer.
 */
export async function renderAgreementPreviewPng(pdfBytes, { scale = DEFAULT_RENDER_SCALE } = {}) {
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
  return tryRenderAgreementPreviewPng(pdfBytes, options);
}

/**
 * Best-effort preview render for any agreement PDF.
 */
export async function tryRenderAgreementPreviewPng(pdfBytes, options = {}) {
  try {
    const pngBuffer = await renderAgreementPreviewPng(pdfBytes, options);
    return { ok: true, pngBuffer };
  } catch (err) {
    console.warn('[agreement-email-preview] Inline preview unavailable:', err.message);
    return { ok: false, error: err.message };
  }
}
