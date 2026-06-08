/**
 * One-shot utility: bake white-out masks + static header fixes into a clean template.
 * Run: node server/scripts/prepare-bed-bug-template.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { BED_BUG_COMPANY, BED_BUG_SERVICE_FREQUENCY, BED_BUG_SERVICE_TYPE } from '../services/bedBugAgreementContent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '..', 'assets', 'quotes', 'Bed Bug.pdf');
const DST = join(__dirname, '..', '..', 'assets', 'quotes', 'Bed Bug Agreement.pdf');

const WHITE = rgb(1, 1, 1);
const TEXT = rgb(0.13, 0.13, 0.13);
const MUTED = rgb(0.35, 0.35, 0.35);

function erase(page, x, y, w, h) {
  page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderWidth: 0 });
}

const bytes = readFileSync(SRC);
const pdfDoc = await PDFDocument.load(bytes);
const page = pdfDoc.getPage(0);
const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

// Legacy combined phone/email line (artwork y≈52 from top) — erase generously
erase(page, 378, 938, 228, 24);
page.drawText(`Phone: ${BED_BUG_COMPANY.phone}`, { x: 416, y: 954, size: 7.5, font: regular, color: TEXT });
page.drawText(`Email: ${BED_BUG_COMPANY.email}`, { x: 416, y: 944, size: 7.5, font: regular, color: TEXT });

// Service Notes row + legacy left-side service labels/fields
erase(page, 20, 792, 572, 52);

// Service Details block (right column) — static labels; values filled at runtime
const dx = 404;
page.drawText('Service Type:', { x: dx, y: 828, size: 8, font: bold, color: MUTED });
page.drawText('Frequency:', { x: dx, y: 800, size: 8, font: bold, color: MUTED });

// Hardcoded month labels (two calendar rows)
const monthCells = [
  { x: 30, w: 88.7 }, { x: 122.7, w: 88.7 }, { x: 215.3, w: 88.7 },
  { x: 308, w: 88.7 }, { x: 400.7, w: 88.7 }, { x: 493.3, w: 88.7 },
  { x: 30, w: 88.7 }, { x: 122.7, w: 88.7 }, { x: 215.3, w: 88.7 },
  { x: 308, w: 88.7 }, { x: 400.7, w: 88.7 }, { x: 493.3, w: 88.7 },
];
for (let i = 0; i < 6; i++) {
  erase(page, monthCells[i].x, 545, monthCells[i].w, 18);
  erase(page, monthCells[i + 6].x, 517, monthCells[i + 6].w, 18);
}

const out = await pdfDoc.save();
writeFileSync(DST, out);
console.log('Wrote', DST, out.length, 'bytes');
