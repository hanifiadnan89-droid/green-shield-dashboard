import { Router } from 'express';
import { readdir, stat, createReadStream } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { promisify } from 'util';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const readdirAsync = promisify(readdir);
const statAsync    = promisify(stat);
const router = Router();

const QUOTES_DIR     = join(homedir(), 'Desktop', 'Quotes');
const PREP_GUIDE_DIR = join(homedir(), 'Desktop', 'Prep Guide');

const SUPPORTED_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

function ext(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

async function listDir(dir) {
  try {
    const files = await readdirAsync(dir);
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const name = files[i];
      const extension = ext(name);
      if (!SUPPORTED_EXTS.has(extension)) continue;
      const filePath = join(dir, name);
      const info = await statAsync(filePath);
      results.push({
        index: i,
        name,
        type: extension === '.pdf' ? 'pdf' : 'image',
        size: info.size,
        modified: info.mtime
      });
    }
    return results;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

router.get('/quotes', async (req, res) => {
  try {
    const files = await listDir(QUOTES_DIR);
    if (files === null) return res.json({ quotes: [], missing: true, path: QUOTES_DIR });
    res.json({ quotes: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/prep-guides', async (req, res) => {
  try {
    const files = await listDir(PREP_GUIDE_DIR);
    if (files === null) return res.json({ prepGuides: [], missing: true, path: PREP_GUIDE_DIR });
    res.json({ prepGuides: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Serve a file for preview by folder type + original index */
router.get('/file', async (req, res) => {
  const { folder, index } = req.query;
  if (!folder || index === undefined) return res.status(400).json({ error: 'folder and index required' });

  const dir = folder === 'quotes' ? QUOTES_DIR : folder === 'prep-guides' ? PREP_GUIDE_DIR : null;
  if (!dir) return res.status(400).json({ error: 'invalid folder' });

  try {
    const files = await readdirAsync(dir);
    const supported = files.filter(f => SUPPORTED_EXTS.has(ext(f)));
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= supported.length) return res.status(404).json({ error: 'file not found' });

    const filePath = join(dir, supported[idx]);
    const extension = ext(supported[idx]);
    const mimeTypes = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

    res.setHeader('Content-Type', mimeTypes[extension] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(supported[idx])}"`);
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── PDF Quote Generation ── */

// Confirmed coordinates from ruler probe (RIT.pdf, 612×1008 pt page)
// All y values are from bottom of page (PDF user space)

const TOP = {
  // Service Address left column
  name:  { x: 15,  y: 921, cw: 270 },
  addr1: { x: 15,  y: 909, cw: 270 },
  addr2: { x: 15,  y: 897, cw: 270 },
  // Customer Information right column
  email: { x: 315, y: 921, cw: 280 },
  phone: { x: 315, y: 909, cw: 220 },
  notes: { x: 315, y: 897, cw: 280 },
};

// Pricing section base-y (Initial Quote row) varies by PDF template
const PRICING_BASE = {
  'Commercial Bimonthly.pdf': 553,
  'Commercial Monthly.pdf':  700,
  'T:M.pdf':                 690,
};
const PRICING_BASE_DEFAULT = 453;

// Row offsets from base-y (spacing ~16-17pt between rows)
const ROW = { quote: 0, discount: -16, subtotal: -32, tax: -49, total: -65 };

// Per-template pricing value column x positions.
// T:M uses narrower columns (values sit just right of labels, not center-right)
const PRICING_COL = {
  'T:M.pdf': { leftX: 100, leftCW: 80, rightX: 465, rightCW: 75 },
};
const PRICING_COL_DEFAULT = { leftX: 248, leftCW: 68, rightX: 540, rightCW: 65 };

// Billing Info base-y (name row)
// Commercial Monthly has a wider layout — billing name confirmed at y=572
const BILLING_BASE = {
  'Commercial Bimonthly.pdf': 490,
  'Commercial Monthly.pdf':  572,
  'T:M.pdf':                 545,
};
const BILLING_BASE_DEFAULT = 390;

// Commercial Monthly has non-standard billing spacing and right-col payment name x position
// Use broad white-out blocks instead of per-row strips for this template
const BILLING_BROAD = new Set(['Commercial Monthly.pdf']);

function fmt(val) {
  if (!val && val !== 0) return '';
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return String(val);
  return '$' + n.toFixed(2);
}
function fmtNeg(val) {
  if (!val && val !== 0) return '';
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return String(val);
  return '($' + n.toFixed(2) + ')';
}

function whiteOut(page, x, y, w, h = 12) {
  page.drawRectangle({ x, y: y - 2, width: w, height: h + 2, color: rgb(1, 1, 1), opacity: 1 });
}

function drawField(page, font, x, y, text, size = 8) {
  if (!text) return;
  page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
}

router.post('/generate-quote', async (req, res) => {
  try {
    const { index, lead = {}, pricing = {}, notes = '', address = {} } = req.body;

    if (index === undefined || index === null) return res.status(400).json({ error: 'index required' });

    // Load template
    const allFiles = await readdirAsync(QUOTES_DIR);
    const supported = allFiles.filter(f => SUPPORTED_EXTS.has(ext(f)));
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= supported.length) return res.status(404).json({ error: 'file not found' });

    const filename  = supported[idx];
    const pdfBytes  = readFileSync(join(QUOTES_DIR, filename));
    const pdfDoc    = await PDFDocument.load(pdfBytes);
    const font      = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page      = pdfDoc.getPages()[0];

    const pricingBase  = PRICING_BASE[filename]  ?? PRICING_BASE_DEFAULT;
    const billingBase  = BILLING_BASE[filename]  ?? BILLING_BASE_DEFAULT;

    // ── Top section: Service Address ──
    // Name
    whiteOut(page, TOP.name.x - 2, TOP.name.y, TOP.name.cw, 13);
    drawField(page, boldFont, TOP.name.x, TOP.name.y, lead.name, 9);

    // Address lines (if provided via UI)
    if (address.street) {
      whiteOut(page, TOP.addr1.x - 2, TOP.addr1.y, TOP.addr1.cw, 12);
      drawField(page, font, TOP.addr1.x, TOP.addr1.y, address.street, 8);
    }
    if (address.cityState) {
      whiteOut(page, TOP.addr2.x - 2, TOP.addr2.y, TOP.addr2.cw, 12);
      drawField(page, font, TOP.addr2.x, TOP.addr2.y, address.cityState, 8);
    }

    // ── Top section: Customer Information ──
    if (lead.email) {
      whiteOut(page, TOP.email.x - 2, TOP.email.y, TOP.email.cw, 12);
      drawField(page, font, TOP.email.x, TOP.email.y, lead.email, 8);
    }
    if (lead.phone) {
      whiteOut(page, TOP.phone.x - 2, TOP.phone.y, TOP.phone.cw, 12);
      drawField(page, font, TOP.phone.x, TOP.phone.y, lead.phone, 8);
    }
    if (notes !== undefined) {
      whiteOut(page, TOP.notes.x - 2, TOP.notes.y, TOP.notes.cw, 12);
      drawField(page, font, TOP.notes.x, TOP.notes.y, `Notes: ${notes || ''}`, 8);
    }

    // ── Pricing section ──
    const py = (row) => pricingBase + ROW[row];

    const initialVal  = parseFloat(String(pricing.initial   || '').replace(/[^0-9.]/g, '')) || 0;
    const discountVal = parseFloat(String(pricing.discounted || '').replace(/[^0-9.]/g, '')) || 0;
    const recurringVal= parseFloat(String(pricing.recurring  || '').replace(/[^0-9.]/g, '')) || 0;
    const subTotal    = initialVal - discountVal;
    const initialTotal= subTotal;
    const recurTotal  = recurringVal;

    const { leftX: LEFT_X, leftCW: LEFT_CW, rightX: RIGHT_X, rightCW: RIGHT_CW } =
      PRICING_COL[filename] ?? PRICING_COL_DEFAULT;

    // Erase template pricing values — broad block for CM (non-standard spacing), per-row for others
    if (BILLING_BROAD.has(filename)) {
      page.drawRectangle({ x: LEFT_X - 4,  y: py('total') - 4, width: LEFT_CW,  height: 90, color: rgb(1, 1, 1), opacity: 1 });
      page.drawRectangle({ x: RIGHT_X - 4, y: py('total') - 4, width: RIGHT_CW, height: 90, color: rgb(1, 1, 1), opacity: 1 });
    } else {
      if (initialVal)  whiteOut(page, LEFT_X - 4,  py('quote'),    LEFT_CW,  12);
      if (discountVal) whiteOut(page, LEFT_X - 4,  py('discount'), LEFT_CW,  12);
      if (initialVal)  whiteOut(page, LEFT_X - 4,  py('subtotal'), LEFT_CW,  12);
      if (initialVal)  whiteOut(page, LEFT_X - 4,  py('tax'),      LEFT_CW,  12);
      if (initialVal)  whiteOut(page, LEFT_X - 4,  py('total'),    LEFT_CW,  12);
      if (recurringVal) whiteOut(page, RIGHT_X - 4, py('quote'),    RIGHT_CW, 12);
      if (recurringVal) whiteOut(page, RIGHT_X - 4, py('discount'), RIGHT_CW, 12);
      if (recurringVal) whiteOut(page, RIGHT_X - 4, py('subtotal'), RIGHT_CW, 12);
    }

    if (initialVal)  drawField(page, font,     LEFT_X, py('quote'),    fmt(initialVal), 8);
    if (discountVal) drawField(page, font,     LEFT_X, py('discount'), fmtNeg(discountVal), 8);
    if (initialVal)  drawField(page, font,     LEFT_X, py('subtotal'), fmt(subTotal), 8);
    if (initialVal)  drawField(page, font,     LEFT_X, py('tax'),      '$0.00', 8);
    if (initialVal)  drawField(page, boldFont, LEFT_X, py('total'),    fmt(initialTotal), 8);
    if (recurringVal) drawField(page, font,     RIGHT_X, py('quote'),    fmt(recurringVal), 8);
    if (recurringVal) drawField(page, font,     RIGHT_X, py('discount'), '$0.00', 8);
    if (recurringVal) drawField(page, boldFont, RIGHT_X, py('subtotal'), fmt(recurTotal), 8);

    // ── Billing Info section ──
    if (BILLING_BROAD.has(filename)) {
      // Commercial Monthly: broader blocks — template has non-standard row spacing
      // and payment name starts at x<313 so right block must start at x=275
      page.drawRectangle({ x: 11,  y: billingBase - 55, width: 272, height: 70, color: rgb(1, 1, 1), opacity: 1 });
      page.drawRectangle({ x: 275, y: billingBase - 20, width: 250, height: 35, color: rgb(1, 1, 1), opacity: 1 });
    } else {
      if (lead.name)         whiteOut(page, 13, billingBase,      270, 13);
      if (address.street)    whiteOut(page, 13, billingBase - 12, 270, 12);
      if (address.cityState) whiteOut(page, 13, billingBase - 25, 270, 12);
    }
    if (lead.name)         drawField(page, boldFont, 15,  billingBase,      lead.name, 9);
    if (address.street)    drawField(page, font,     15,  billingBase - 12, address.street, 8);
    if (address.cityState) drawField(page, font,     15,  billingBase - 25, address.cityState, 8);

    // Payment Info name (right column) — BILLING_BROAD already erased via broad block above
    if (lead.name && !BILLING_BROAD.has(filename)) {
      whiteOut(page, 313, billingBase, 200, 13);
    }
    if (lead.name) {
      drawField(page, boldFont, 315, billingBase, lead.name, 9);
    }

    // Output
    const outBytes = await pdfDoc.save();
    const safeName = lead.name
      ? lead.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_')
      : 'Quote';
    const baseFile = filename.replace('.pdf', '');
    const outName  = `${safeName}_${baseFile}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(outName)}"`);
    res.send(Buffer.from(outBytes));
  } catch (err) {
    console.error('generate-quote error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
