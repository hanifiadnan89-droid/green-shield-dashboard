import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2];
const outPath = process.argv[3] || join(__dirname, '..', '..', 'tmp', 'preview.png');

if (!pdfPath) {
  console.error('Usage: node render-pdf-preview.mjs <pdf> [out.png]');
  process.exit(1);
}

const pdfBase64 = readFileSync(pdfPath).toString('base64');
mkdirSync(dirname(outPath), { recursive: true });

const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #888; display: flex; justify-content: center; padding: 8px; }
  #wrap { background: white; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
  canvas { display: block; }
</style></head><body>
<div id="wrap"><canvas id="c"></canvas></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
(async () => {
  const data = atob('${pdfBase64}');
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.getElementById('c');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  window.__done = true;
})();
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__done === true, { timeout: 60000 });
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log('Wrote', outPath);
