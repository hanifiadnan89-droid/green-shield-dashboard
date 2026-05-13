import { Router } from 'express';
import { readdir, stat, createReadStream } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { promisify } from 'util';
import { PDFDocument } from 'pdf-lib';
import nodemailer from 'nodemailer';

const readdirAsync = promisify(readdir);
const statAsync    = promisify(stat);
const router       = Router();

const QUOTES_DIR     = join(homedir(), 'Desktop', 'Quotes');
const PREP_GUIDE_DIR = join(homedir(), 'Desktop', 'Prep Guide');
const SUPPORTED_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

function ext(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

// ── PDF field-prefix mappings ──────────────────────────────────────────────

// Single-service PDFs: filename → AcroForm field prefix
const FILE_PREFIX = {
  'Bed Bug.pdf': 'bed_bug_insect_triannual',
};

// Service Agreements.pdf contains 5 service types across 5 pages
const SERVICE_AGREEMENTS_FILE = 'Service Agreements.pdf';

const SERVICE_TYPE_PAGE = {
  commercial_bimonthly:    0,
  commercial_monthly:      1,
  insect_quarterly:        2,
  rodent_insect_triannual: 3,
  tick_mosquito_monthly:   4,
};

const SERVICE_DISPLAY = {
  commercial_bimonthly:    'Commercial Bi-Monthly Agreement',
  commercial_monthly:      'Commercial Monthly Agreement',
  insect_quarterly:        'Insect Quarterly Agreement',
  rodent_insect_triannual: 'Rodent & Insect Triannual Agreement',
  tick_mosquito_monthly:   'Tick & Mosquito Monthly Agreement',
};

const SERVICE_LABEL = {
  bed_bug_insect_triannual: 'Bed_Bug',
  commercial_bimonthly:     'Commercial_Bimonthly',
  commercial_monthly:       'Commercial_Monthly',
  insect_quarterly:         'Insect_Quarterly',
  rodent_insect_triannual:  'Rodent_Insect_Triannual',
  tick_mosquito_monthly:    'Tick_Mosquito_Monthly',
};

// ── Directory listing ──────────────────────────────────────────────────────

async function listDir(dir) {
  try {
    const files = await readdirAsync(dir);
    const results = [];
    let si = 0; // index within supported files only — must match buildQuotePdf's supported[] array
    for (let i = 0; i < files.length; i++) {
      const name = files[i];
      const extension = ext(name);
      if (!SUPPORTED_EXTS.has(extension)) continue;
      const info = await statAsync(join(dir, name));
      const idx = si++;

      if (name === SERVICE_AGREEMENTS_FILE) {
        // Expand into one selectable entry per service type
        for (const [serviceType] of Object.entries(SERVICE_TYPE_PAGE)) {
          results.push({
            key:         `${idx}_${serviceType}`,
            index:       idx,
            name:        SERVICE_DISPLAY[serviceType],
            serviceType,
            type:        'pdf',
            size:        info.size,
            modified:    info.mtime,
          });
        }
      } else {
        results.push({
          key:      String(idx),
          index:    idx,
          name,
          type:     extension === '.pdf' ? 'pdf' : 'image',
          size:     info.size,
          modified: info.mtime,
        });
      }
    }
    return results;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// ── Routes: list ──────────────────────────────────────────────────────────

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

// ── Route: file preview ───────────────────────────────────────────────────

router.get('/file', async (req, res) => {
  const { folder, index } = req.query;
  if (!folder || index === undefined) return res.status(400).json({ error: 'folder and index required' });

  const dir = folder === 'quotes' ? QUOTES_DIR : folder === 'prep-guides' ? PREP_GUIDE_DIR : null;
  if (!dir) return res.status(400).json({ error: 'invalid folder' });

  try {
    const files    = await readdirAsync(dir);
    const supported = files.filter(f => SUPPORTED_EXTS.has(ext(f)));
    const idx       = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= supported.length) return res.status(404).json({ error: 'file not found' });

    const filePath  = join(dir, supported[idx]);
    const extension = ext(supported[idx]);
    const mimeTypes = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

    res.setHeader('Content-Type', mimeTypes[extension] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(supported[idx])}"`);
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Core PDF builder ──────────────────────────────────────────────────────
//
// Strategy (priority order):
//   1. Fill real AcroForm fields directly — no coordinate overlays needed.
//   2. form.flatten() bakes the filled values into the page content,
//      making the output look naturally filled (no visible form widgets).
//   3. For Service Agreements.pdf, extract only the selected service page
//      so the output is a clean single-page document.

async function buildQuotePdf({ index, lead = {}, pricing = {}, notes = '', address = {}, serviceType }) {
  const allFiles  = await readdirAsync(QUOTES_DIR);
  const supported = allFiles.filter(f => SUPPORTED_EXTS.has(ext(f)));
  const idx       = parseInt(index, 10);
  if (isNaN(idx) || idx < 0 || idx >= supported.length) {
    throw Object.assign(new Error('file not found'), { status: 404 });
  }

  const filename = supported[idx];

  // Determine field prefix and target page index
  let prefix, pageIndex;
  if (FILE_PREFIX[filename]) {
    prefix    = FILE_PREFIX[filename];
    pageIndex = 0;
  } else if (filename === SERVICE_AGREEMENTS_FILE) {
    if (!serviceType || SERVICE_TYPE_PAGE[serviceType] === undefined) {
      throw Object.assign(new Error('serviceType required for Service Agreements.pdf'), { status: 400 });
    }
    prefix    = serviceType;
    pageIndex = SERVICE_TYPE_PAGE[serviceType];
  } else {
    throw Object.assign(new Error(`Unrecognized template: ${filename}`), { status: 400 });
  }

  const pdfDoc = await PDFDocument.load(readFileSync(join(QUOTES_DIR, filename)));
  const form   = pdfDoc.getForm();

  // Safe field writer — skips silently if the field name doesn't exist
  function fill(name, value) {
    if (value === null || value === undefined) return;
    try { form.getTextField(`${prefix}_${name}`).setText(String(value)); } catch { /* field absent */ }
  }

  // Always clear pricing fields first — removes template sample data
  for (const f of ['initial_quote','initial_discount','initial_subtotal','initial_tax','initial_total',
                   'recurring_charge','recurring_tax','recurring_total','payment_recurring_authorized']) {
    try { form.getTextField(`${prefix}_${f}`).setText(''); } catch {}
  }

  // ── Customer / service address (top-left) ──
  const addrParts    = [lead.name, address.street, address.cityState].filter(Boolean);
  fill('service_address', addrParts.join('\n'));

  // ── Customer contact info (top-right: email then phone) ──
  const contactParts = [lead.email, lead.phone].filter(Boolean);
  fill('customer_information', contactParts.join('\n'));

  // ── Notes (below contact info) ──
  if (notes && notes.trim()) fill('service_notes', notes.trim());

  // ── Pricing ──
  const initVal  = parseFloat(String(pricing.initial    || '').replace(/[^0-9.]/g, '')) || 0;
  const discVal  = parseFloat(String(pricing.discounted || '').replace(/[^0-9.]/g, '')) || 0;
  const recurVal = parseFloat(String(pricing.recurring  || '').replace(/[^0-9.]/g, '')) || 0;
  const subtotal = Math.max(0, initVal - discVal);

  if (initVal) {
    fill('initial_quote',    initVal.toFixed(2));
    fill('initial_subtotal', subtotal.toFixed(2));
    fill('initial_tax',      '0.00');
    fill('initial_total',    subtotal.toFixed(2));
  }
  if (discVal > 0) fill('initial_discount', `-${discVal.toFixed(2)}`);

  if (recurVal) {
    fill('recurring_charge',             recurVal.toFixed(2));
    fill('recurring_tax',                '0.00');
    fill('recurring_total',              recurVal.toFixed(2));
    fill('payment_recurring_authorized', recurVal.toFixed(2));
  }

  // ── Billing info (same as service address unless billing differs) ──
  fill('billing_info', addrParts.join('\n'));

  // ── Flatten: bakes filled fields into page content, no visible widgets ──
  form.flatten();

  // ── Output ──
  let outBytes;
  if (filename === SERVICE_AGREEMENTS_FILE) {
    // Extract only the selected service type's page
    const singleDoc    = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(pdfDoc, [pageIndex]);
    singleDoc.addPage(copiedPage);
    outBytes = await singleDoc.save();
  } else {
    outBytes = await pdfDoc.save();
  }

  const safeName  = (lead.name || 'Quote').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_') || 'Quote';
  const labelPart = SERVICE_LABEL[prefix] || prefix;
  const outName   = `${safeName}_${labelPart}.pdf`;

  return { outBytes, outName };
}

// ── Route: generate & download ────────────────────────────────────────────

router.post('/generate-quote', async (req, res) => {
  try {
    const { index, lead = {}, pricing = {}, notes = '', address = {}, serviceType } = req.body;
    if (index === undefined || index === null) return res.status(400).json({ error: 'index required' });

    const { outBytes, outName } = await buildQuotePdf({ index, lead, pricing, notes, address, serviceType });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(outName)}"`);
    res.send(Buffer.from(outBytes));
  } catch (err) {
    console.error('generate-quote error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Route: generate & email directly (no n8n) ─────────────────────────────

router.post('/email-quote', async (req, res) => {
  try {
    const { index, lead = {}, pricing = {}, notes = '', address = {}, serviceType } = req.body;

    if (index === undefined || index === null) return res.status(400).json({ error: 'index required' });
    if (!lead.email) return res.status(400).json({ error: 'lead email is required to send' });

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({ error: 'Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing from server/.env)' });
    }

    const { outBytes, outName } = await buildQuotePdf({ index, lead, pricing, notes, address, serviceType });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });

    const firstName = (lead.name || '').split(' ')[0] || 'there';

    await transporter.sendMail({
      from:    `Green Shield Pest Solutions <${process.env.GMAIL_USER}>`,
      to:      lead.email,
      subject: 'Your Quote from Green Shield Pest Solutions',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;color:#1a1a1a">
          <p>Hi ${firstName},</p>
          <p>Please find your personalized quote attached to this email.</p>
          <p>If you have any questions, feel free to reply here or give us a call at
             <strong>(207) 815-1003</strong>.</p>
          <p>We look forward to working with you!</p>
          <br>
          <p style="color:#555;font-size:13px">
            Green Shield Pest Solutions<br>
            (207) 815-1003 | service@gshieldpest.com<br>
            11 Eastview Pkwy Unit 106, Saco, ME 04072
          </p>
        </div>
      `,
      attachments: [{ filename: outName, content: Buffer.from(outBytes), contentType: 'application/pdf' }]
    });

    res.json({ success: true, to: lead.email, filename: outName });
  } catch (err) {
    console.error('email-quote error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
