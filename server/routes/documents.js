import { Router } from 'express';
import { readdir, stat, createReadStream } from 'fs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { PDFDocument, PDFName, PDFDict, rgb, StandardFonts } from 'pdf-lib';
import nodemailer from 'nodemailer';
import { applyAgreementScheduleToPdf } from '../services/applyAgreementScheduleToPdf.js';
import {
  normalizeBedBugAgreementData,
  validateBedBugAgreementData,
} from '../services/bedBugAgreementPdf.js';
import { buildInsectQuarterlyAgreementPdf } from '../services/insectQuarterlyAgreementPdf.js';
import { isInsectQuarterlyVectorPdfEnabled } from '../services/insectQuarterlyVectorPdfFlag.js';
import { buildBedBugInsectTriannualAgreementPdf } from '../services/bedBugInsectTriannualAgreementPdf.js';
import { buildRodentInsectTriannualAgreementPdf } from '../services/rodentInsectTriannualAgreementPdf.js';
import { isRodentInsectTriannualVectorPdfEnabled } from '../services/rodentInsectTriannualVectorPdfFlag.js';
import { buildTickMosquitoMonthlyAgreementPdf } from '../services/tickMosquitoMonthlyAgreementPdf.js';
import { isTickMosquitoMonthlyVectorPdfEnabled } from '../services/tickMosquitoMonthlyVectorPdfFlag.js';
import { createAgreementSigningSession, getAgreementTypeLabel, resolveAgreementType } from '../services/agreementSigning/agreementSigning.js';
import { sendSigningRequestEmail } from '../services/agreementSigning/email.js';
import { readPreviewPng, updateSigningSession, publicSigningBaseUrl } from '../services/agreementSigning/storage.js';
import { appendLog } from '../services/activity.js';
import { updateLead } from '../services/sheets.js';
import {
  BED_BUG_EMAIL_DISABLED,
  BED_BUG_EMAIL_DISABLED_MESSAGE,
} from '../services/bedBugAgreementContent.js';
import {
  buildBedBugPreviewInlineAttachment,
  buildBedBugQuoteEmailHtml,
  buildQuotePreviewInlineAttachment,
  buildStandardQuoteEmailHtml,
} from '../services/bedBugAgreementEmail.js';
import { tryRenderAgreementPreviewPng } from '../services/bedBugAgreementEmailPreview.js';
import {
  BED_BUG_TEMPLATE_FILENAME,
  listQuoteDocuments,
  resolveQuoteTemplateFilename,
} from '../services/quoteDocumentsList.js';
import { applyCustomerFriendlyViewerPreferences } from '../services/pdf/customerViewerPreferences.js';
import { generateIcs } from '../services/icsGenerator.js';
import twilio from 'twilio';
import { appendMessage } from '../services/conversationMessages.js';

const readdirAsync = promisify(readdir);
const statAsync    = promisify(stat);
const router       = Router();

const __dirname      = dirname(fileURLToPath(import.meta.url));
const QUOTES_DIR     = join(__dirname, '..', '..', 'assets', 'quotes');
const PREP_GUIDE_DIR = join(__dirname, '..', '..', 'assets', 'prep-guides');
const SUPPORTED_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

function ext(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

// ── PDF field-prefix mappings ──────────────────────────────────────────────

const BED_BUG_TEMPLATE = BED_BUG_TEMPLATE_FILENAME;

const FILE_PREFIX = {};

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

// Service types that have no prep guide — prep guide attachment is skipped entirely.
const NO_PREP_GUIDE = new Set([
  'tick_mosquito_monthly',
]);

// ── Pest icon drawing ──────────────────────────────────────────────────────

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const T     = 0.35; // default line thickness

function drawAnt(page, cx, cy) {
  page.drawEllipse({ x: cx,  y: cy - 1.8, xScale: 1.4, yScale: 1.1, color: BLACK });
  page.drawEllipse({ x: cx,  y: cy,        xScale: 0.9, yScale: 0.8, color: BLACK });
  page.drawEllipse({ x: cx,  y: cy + 1.9,  xScale: 0.9, yScale: 0.9, color: BLACK });
  page.drawLine({ start:{x:cx-0.3, y:cy+2.8}, end:{x:cx-1.8, y:cy+4.2}, thickness:T, color:BLACK });
  page.drawLine({ start:{x:cx+0.3, y:cy+2.8}, end:{x:cx+1.8, y:cy+4.2}, thickness:T, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-0.8, 0.4,-2.8, 1.2],[-0.8, 0,-2.8,-0.4],[-0.8,-0.4,-2.8,-1.4],
    [ 0.8, 0.4, 2.8, 1.2],[ 0.8, 0, 2.8,-0.4],[ 0.8,-0.4, 2.8,-1.4],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawSpider(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy, xScale:2.2, yScale:2.0, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-2.2, 1.2,-4.5, 2.5],[-2.2, 0.4,-4.5, 0.4],[-2.2,-0.4,-4.5,-0.8],[-2.2,-1.2,-4.5,-2.5],
    [ 2.2, 1.2, 4.5, 2.5],[ 2.2, 0.4, 4.5, 0.4],[ 2.2,-0.4, 4.5,-0.8],[ 2.2,-1.2, 4.5,-2.5],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawBedBug(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy, xScale:3.2, yScale:2.0, color:BLACK });
  page.drawLine({ start:{x:cx-2.5,y:cy+0.7}, end:{x:cx+2.5,y:cy+0.7}, thickness:0.3, color:WHITE });
  page.drawLine({ start:{x:cx-2.5,y:cy-0.7}, end:{x:cx+2.5,y:cy-0.7}, thickness:0.3, color:WHITE });
  for (const [sx,sy,ex,ey] of [
    [-3.2, 0.8,-4.8, 1.6],[-3.2, 0,-4.8, 0],[-3.2,-0.8,-4.8,-1.6],
    [ 3.2, 0.8, 4.8, 1.6],[ 3.2, 0, 4.8, 0],[ 3.2,-0.8, 4.8,-1.6],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawBee(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy, xScale:1.5, yScale:2.8, color:BLACK });
  page.drawEllipse({ x:cx-2.2, y:cy+2.0, xScale:1.8, yScale:1.0, borderColor:BLACK, borderWidth:0.4 });
  page.drawEllipse({ x:cx+2.2, y:cy+2.0, xScale:1.8, yScale:1.0, borderColor:BLACK, borderWidth:0.4 });
  page.drawLine({ start:{x:cx,y:cy-2.8}, end:{x:cx,y:cy-4.0}, thickness:0.5, color:BLACK });
}

function drawWasp(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy+0.5, xScale:1.0, yScale:2.0, color:BLACK });
  page.drawEllipse({ x:cx, y:cy-1.5, xScale:0.6, yScale:0.7, color:BLACK });
  page.drawEllipse({ x:cx, y:cy-2.8, xScale:0.9, yScale:0.9, color:BLACK });
  page.drawEllipse({ x:cx-2.0, y:cy+2.0, xScale:1.5, yScale:0.8, borderColor:BLACK, borderWidth:0.4 });
  page.drawEllipse({ x:cx+2.0, y:cy+2.0, xScale:1.5, yScale:0.8, borderColor:BLACK, borderWidth:0.4 });
  page.drawLine({ start:{x:cx,y:cy-3.7}, end:{x:cx,y:cy-4.5}, thickness:0.4, color:BLACK });
}

function drawFlea(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy, xScale:1.5, yScale:2.0, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-1.5, 0.5,-3.0, 1.5],[-1.5,-0.5,-3.0,-1.5],
    [ 1.5, 0.5, 3.0, 1.5],[ 1.5,-0.5, 3.0,-1.5],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawCentipede(page, cx, cy) {
  for (let i = 0; i < 5; i++) {
    const sx = cx - 4 + i * 2;
    page.drawEllipse({ x:sx, y:cy, xScale:0.9, yScale:0.9, color:BLACK });
    page.drawLine({ start:{x:sx,y:cy+0.9}, end:{x:sx,y:cy+2.2}, thickness:T, color:BLACK });
    page.drawLine({ start:{x:sx,y:cy-0.9}, end:{x:sx,y:cy-2.2}, thickness:T, color:BLACK });
  }
}

function drawCricket(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy, xScale:2.5, yScale:1.5, color:BLACK });
  page.drawLine({ start:{x:cx-2.0,y:cy+1.5}, end:{x:cx-4.5,y:cy+4.0}, thickness:T, color:BLACK });
  page.drawLine({ start:{x:cx-1.5,y:cy+1.5}, end:{x:cx-3.5,y:cy+4.5}, thickness:T, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-2.5, 0.5,-4.0, 1.5],[-2.5, 0,-4.0, 0],[-2.5,-0.5,-4.0,-1.5],
    [ 2.5, 0.5, 4.0, 1.5],[ 2.5, 0, 4.0, 0],[ 2.5,-0.5, 4.0,-1.5],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawSilverfish(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy+0.5, xScale:2.0, yScale:2.5, color:BLACK });
  page.drawLine({ start:{x:cx-0.5,y:cy-2.0}, end:{x:cx-1.5,y:cy-4.0}, thickness:T, color:BLACK });
  page.drawLine({ start:{x:cx,     y:cy-2.0}, end:{x:cx,     y:cy-4.5}, thickness:T, color:BLACK });
  page.drawLine({ start:{x:cx+0.5, y:cy-2.0}, end:{x:cx+1.5, y:cy-4.0}, thickness:T, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-2.0, 1.5,-3.5, 2.5],[-2.0, 0.5,-3.5, 0.5],[-2.0,-0.5,-3.5,-0.5],
    [ 2.0, 1.5, 3.5, 2.5],[ 2.0, 0.5, 3.5, 0.5],[ 2.0,-0.5, 3.5,-0.5],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawMouse(page, cx, cy) {
  page.drawEllipse({ x:cx-0.5, y:cy,     xScale:2.5, yScale:2.0, color:BLACK });
  page.drawEllipse({ x:cx+2.2, y:cy+0.5, xScale:1.5, yScale:1.5, color:BLACK });
  page.drawEllipse({ x:cx+1.5, y:cy+2.2, xScale:0.9, yScale:0.9, color:BLACK });
  page.drawLine({ start:{x:cx-3.0,y:cy-0.5}, end:{x:cx-5.5,y:cy-1.5}, thickness:0.4, color:BLACK });
  page.drawEllipse({ x:cx+3.0, y:cy+0.9, xScale:0.4, yScale:0.4, color:WHITE });
}

function drawRat(page, cx, cy) {
  page.drawEllipse({ x:cx-0.5, y:cy,     xScale:2.8, yScale:2.0, color:BLACK });
  page.drawEllipse({ x:cx+2.5, y:cy+0.3, xScale:1.6, yScale:1.5, color:BLACK });
  page.drawEllipse({ x:cx+2.0, y:cy+2.2, xScale:1.1, yScale:1.1, color:BLACK });
  page.drawLine({ start:{x:cx-3.2,y:cy-0.3}, end:{x:cx-5.5,y:cy-2.0}, thickness:0.5, color:BLACK });
  page.drawEllipse({ x:cx+3.2, y:cy+0.8, xScale:0.4, yScale:0.4, color:WHITE });
}

function drawMole(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy,     xScale:2.5, yScale:2.5, color:BLACK });
  page.drawEllipse({ x:cx, y:cy+2.8, xScale:0.7, yScale:0.6, color:BLACK });
  page.drawLine({ start:{x:cx-2.5,y:cy-1.0}, end:{x:cx-3.5,y:cy-2.5}, thickness:0.5, color:BLACK });
  page.drawLine({ start:{x:cx-2.5,y:cy-1.5}, end:{x:cx-4.0,y:cy-2.5}, thickness:0.5, color:BLACK });
  page.drawLine({ start:{x:cx+2.5,y:cy-1.0}, end:{x:cx+3.5,y:cy-2.5}, thickness:0.5, color:BLACK });
  page.drawLine({ start:{x:cx+2.5,y:cy-1.5}, end:{x:cx+4.0,y:cy-2.5}, thickness:0.5, color:BLACK });
}

function drawVole(page, cx, cy) {
  page.drawEllipse({ x:cx,     y:cy,     xScale:2.5, yScale:1.8, color:BLACK });
  page.drawEllipse({ x:cx+2.3, y:cy+0.3, xScale:1.4, yScale:1.4, color:BLACK });
  page.drawEllipse({ x:cx+1.8, y:cy+1.8, xScale:0.7, yScale:0.7, color:BLACK });
  page.drawLine({ start:{x:cx-2.5,y:cy-0.3}, end:{x:cx-4.0,y:cy-0.8}, thickness:0.4, color:BLACK });
}

function drawTick(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy, xScale:2.5, yScale:2.5, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-2.5, 1.5,-4.5, 2.5],[-2.5, 0.5,-4.5, 0.5],[-2.5,-0.5,-4.5,-0.5],[-2.5,-1.5,-4.5,-2.5],
    [ 2.5, 1.5, 4.5, 2.5],[ 2.5, 0.5, 4.5, 0.5],[ 2.5,-0.5, 4.5,-0.5],[ 2.5,-1.5, 4.5,-2.5],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawMosquito(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy, xScale:0.9, yScale:2.8, color:BLACK });
  page.drawEllipse({ x:cx-2.2, y:cy+1.5, xScale:2.0, yScale:1.0, borderColor:BLACK, borderWidth:0.4 });
  page.drawEllipse({ x:cx+2.2, y:cy+1.5, xScale:2.0, yScale:1.0, borderColor:BLACK, borderWidth:0.4 });
  page.drawLine({ start:{x:cx,y:cy+2.8}, end:{x:cx,y:cy+5.5}, thickness:0.4, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-0.9, 0.5,-3.0, 1.5],[-0.9,-0.5,-3.0,-1.5],[-0.9,-1.5,-3.0,-3.0],
    [ 0.9, 0.5, 3.0, 1.5],[ 0.9,-0.5, 3.0,-1.5],[ 0.9,-1.5, 3.0,-3.0],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawCockroach(page, cx, cy) {
  page.drawEllipse({ x:cx, y:cy,     xScale:2.2, yScale:2.6, color:BLACK });
  page.drawEllipse({ x:cx, y:cy+3.1, xScale:1.1, yScale:0.8, color:BLACK });
  page.drawLine({ start:{x:cx-0.5,y:cy+3.9}, end:{x:cx-2.2,y:cy+5.8}, thickness:T, color:BLACK });
  page.drawLine({ start:{x:cx+0.5,y:cy+3.9}, end:{x:cx+2.2,y:cy+5.8}, thickness:T, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-2.2, 1.3,-4.0, 2.2],[-2.2, 0,-4.0, 0],[-2.2,-1.3,-4.0,-2.2],
    [ 2.2, 1.3, 4.0, 2.2],[ 2.2, 0, 4.0, 0],[ 2.2,-1.3, 4.0,-2.2],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawBug(page, cx, cy) {
  // Generic fall-invader / stink-bug shape
  page.drawEllipse({ x:cx, y:cy, xScale:2.2, yScale:2.8, color:BLACK });
  page.drawLine({ start:{x:cx-0.4,y:cy+2.8}, end:{x:cx-2.0,y:cy+4.5}, thickness:T, color:BLACK });
  page.drawLine({ start:{x:cx+0.4,y:cy+2.8}, end:{x:cx+2.0,y:cy+4.5}, thickness:T, color:BLACK });
  for (const [sx,sy,ex,ey] of [
    [-2.2, 1.0,-3.8, 1.8],[-2.2, 0,-3.8, 0],[-2.2,-1.0,-3.8,-1.8],
    [ 2.2, 1.0, 3.8, 1.8],[ 2.2, 0, 3.8, 0],[ 2.2,-1.0, 3.8,-1.8],
  ]) page.drawLine({ start:{x:cx+sx,y:cy+sy}, end:{x:cx+ex,y:cy+ey}, thickness:T, color:BLACK });
}

function drawPestIcon(page, type, cx, cy) {
  try {
    switch (type) {
      case 'ant':        drawAnt(page, cx, cy);        break;
      case 'spider':     drawSpider(page, cx, cy);     break;
      case 'bed_bug':    drawBedBug(page, cx, cy);     break;
      case 'bee':        drawBee(page, cx, cy);        break;
      case 'wasp':       drawWasp(page, cx, cy);       break;
      case 'flea':       drawFlea(page, cx, cy);       break;
      case 'centipede':  drawCentipede(page, cx, cy);  break;
      case 'cricket':    drawCricket(page, cx, cy);    break;
      case 'silverfish': drawSilverfish(page, cx, cy); break;
      case 'mouse':      drawMouse(page, cx, cy);      break;
      case 'rat':        drawRat(page, cx, cy);        break;
      case 'mole':       drawMole(page, cx, cy);       break;
      case 'vole':       drawVole(page, cx, cy);       break;
      case 'tick':       drawTick(page, cx, cy);       break;
      case 'mosquito':   drawMosquito(page, cx, cy);   break;
      case 'cockroach':  drawCockroach(page, cx, cy);  break;
      case 'bug':        drawBug(page, cx, cy);        break;
    }
  } catch { /* silently skip on draw error */ }
}

// Pest icon placements per service-type prefix.
// Coordinates derived from pdftotext bbox output on the actual PDF pages.
// PDF y = 1008 − pdftotext_y_mid  (pages are 612×1008 pts).
// Icon center x = pest_name_xMin − 7.
const PEST_ICONS_MAP = {
  insect_quarterly: [
    // Included Pests row 1
    {type:'ant',       x:29,  y:743}, {type:'ant',       x:168, y:743},
    {type:'ant',       x:307, y:743}, {type:'wasp',      x:446, y:743},
    // Included Pests row 2
    {type:'bee',       x:29,  y:729}, {type:'flea',      x:168, y:729},
    {type:'spider',    x:307, y:729}, {type:'bug',       x:446, y:729},
    // Included Pests row 3
    {type:'cockroach', x:29,  y:715}, {type:'centipede', x:168, y:715},
    {type:'cricket',   x:307, y:715}, {type:'silverfish',x:446, y:715},
    // Add-ons
    {type:'mouse',     x:29,  y:679}, {type:'rat',       x:168, y:679},
    {type:'mole',      x:307, y:679}, {type:'tick',      x:446, y:679},
  ],
  rodent_insect_triannual: [
    // Included Rodents
    {type:'mouse',     x:29,  y:739}, {type:'rat',       x:168, y:739},
    {type:'mole',      x:307, y:739}, {type:'vole',      x:446, y:739},
    // Included Insects row 1
    {type:'ant',       x:29,  y:705}, {type:'ant',       x:168, y:705},
    {type:'ant',       x:307, y:705}, {type:'wasp',      x:446, y:705},
    // Included Insects row 2
    {type:'bee',       x:29,  y:691}, {type:'flea',      x:168, y:691},
    {type:'spider',    x:307, y:691},
    // Included Insects row 3
    {type:'cockroach', x:29,  y:677}, {type:'centipede', x:168, y:677},
    {type:'cricket',   x:307, y:677}, {type:'silverfish',x:446, y:677},
  ],
  tick_mosquito_monthly: [
    {type:'mosquito',  x:29,  y:743},
    {type:'tick',      x:168, y:743},
    {type:'tick',      x:307, y:743},
  ],
  commercial_bimonthly: [],
  commercial_monthly:   [],
};

// ── Directory listing ──────────────────────────────────────────────────────

async function listDir(dir) {
  return listQuoteDocuments(dir);
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

async function buildQuotePdf({
  index,
  lead = {},
  pricing = {},
  notes = '',
  address = {},
  serviceType,
  startDate,
  agreementStartDate,
  serviceStartDate,
  initialServiceDate,
  selectedStartDate,
  bedBugAgreement = {},
  cardLastFour = '',
  tmmOverrides = {},
}) {
  const allFiles  = await readdirAsync(QUOTES_DIR);
  const supported = allFiles.filter(f => SUPPORTED_EXTS.has(ext(f)));
  const idx       = parseInt(index, 10);
  if (isNaN(idx) || idx < 0 || idx >= supported.length) {
    throw Object.assign(new Error('file not found'), { status: 404 });
  }

  const filename = supported[idx];

  if (filename === BED_BUG_TEMPLATE) {
    const bedBugPayload = {
      lead,
      pricing,
      address,
      cardLastFour,
      bedBugAgreement,
      startDate,
      agreementStartDate,
      serviceStartDate,
      initialServiceDate,
      selectedStartDate,
    };
    return buildBedBugInsectTriannualAgreementPdf(bedBugPayload);
  }

  let prefix, pageIndex;
  if (FILE_PREFIX[filename]) {
    prefix    = FILE_PREFIX[filename];
    pageIndex = 0;
  } else if (filename === SERVICE_AGREEMENTS_FILE) {
    if (!serviceType || SERVICE_TYPE_PAGE[serviceType] === undefined) {
      throw Object.assign(new Error('serviceType required for Service Agreements.pdf'), { status: 400 });
    }
if (serviceType === 'insect_quarterly' && isInsectQuarterlyVectorPdfEnabled()) {
      return buildInsectQuarterlyAgreementPdf({
        lead,
        pricing,
        address,
        startDate,
        agreementStartDate,
        serviceStartDate,
        initialServiceDate,
        selectedStartDate,
      });
    }
    if (serviceType === 'rodent_insect_triannual' && isRodentInsectTriannualVectorPdfEnabled()) {
      return buildRodentInsectTriannualAgreementPdf({
        lead,
        pricing,
        address,
        startDate,
        agreementStartDate,
        serviceStartDate,
        initialServiceDate,
        selectedStartDate,
      });
    }
    if (serviceType === 'tick_mosquito_monthly' && isTickMosquitoMonthlyVectorPdfEnabled()) {
      return buildTickMosquitoMonthlyAgreementPdf({
        lead,
        pricing,
        address,
        cardLastFour,
        startDate,
        agreementStartDate,
        serviceStartDate,
        initialServiceDate,
        selectedStartDate,
        tmmOverrides,
      });
    }
    prefix    = serviceType;
    pageIndex = SERVICE_TYPE_PAGE[serviceType];
  } else {
    throw Object.assign(new Error(`Unrecognized template: ${filename}`), { status: 400 });
  }

  const pdfDoc = await PDFDocument.load(readFileSync(join(QUOTES_DIR, filename)));
  const form   = pdfDoc.getForm();

  // ── For Service Agreements: build field position map BEFORE flatten ──
  // pdf-lib cannot regenerate AcroForm appearances for this template (pre-rendered /AP streams
  // with custom font encodings prevent updateFieldAppearances from working). We bypass it by
  // reading every field's widget rect now, then drawing text directly after flatten.
  let saPos = null;
  if (filename === SERVICE_AGREEMENTS_FILE) {
    saPos = {};
    for (const field of form.getFields()) {
      const fname = field.getName();
      if (!fname.startsWith(prefix + '_')) continue;
      try {
        const rect = field.acroField.getWidgets()[0].getRectangle();
        saPos[fname.slice(prefix.length + 1)] = rect;
      } catch {}
    }
  }

  // ── Configure ALL fields: font-size 10, no visible border, clear to empty ──
  for (const field of form.getFields()) {
    try {
      field.setFontSize(10);
      for (const widget of field.acroField.getWidgets()) {
        widget.dict.set(PDFName.of('Border'), pdfDoc.context.obj([0, 0, 0]));
        widget.dict.set(PDFName.of('BS'), pdfDoc.context.obj({ W: 0 }));
        const mkRef = widget.dict.get(PDFName.of('MK'));
        if (mkRef) {
          const mk = pdfDoc.context.lookup(mkRef);
          if (mk instanceof PDFDict) mk.delete(PDFName.of('BC'));
        }
      }
      field.setText('');
    } catch {}
  }

  // Safe field writer (Service Agreements only — Bed Bug uses buildBedBugInsectTriannualAgreementPdf)
  function fill(name, value) {
    if (value === null || value === undefined) return;
    try {
      const field = form.getTextField(`${prefix}_${name}`);
      field.setFontSize(10);
      field.setText(String(value));
    } catch { /* field absent */ }
  }

  // ── Customer / service address (top-left) ──
  const addrParts = [lead.name, address.street, address.cityState].filter(Boolean);
  fill('service_address', addrParts.join('\n'));

  // ── Customer contact info (top-right: email then phone) ──
  const contactParts = [lead.email, lead.phone].filter(Boolean);
  fill('customer_information', contactParts.join('\n'));

  // ── Notes ──
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

  // ── 12-month schedule (months, payments, service markers, contract dates) ──
  applyAgreementScheduleToPdf({
    prefix,
    agreementType: prefix,
    pricing: { initial: initVal, discounted: discVal, recurring: recurVal },
    startDate,
    agreementStartDate,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
    fill,
  });

  // ── Billing info ──
  fill('billing_info', addrParts.join('\n'));

  // ── Embed font ──
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ── Regenerate AcroForm appearances (Service Agreements skip — broken template) ──
  if (filename !== SERVICE_AGREEMENTS_FILE) {
    form.updateFieldAppearances(helvetica);
  }

  // ── Flatten: bakes fields into page content ──
  form.flatten();

  const targetPage = pdfDoc.getPage(pageIndex);

  // ── Service Agreements: draw all text directly onto the page ──
  // AcroForm appearance regeneration fails for this template (pre-rendered /AP streams
  // with non-standard font encoding). Strategy: erase each field's area with a white
  // rectangle (covers baked /AP content), then draw the correct value on top.
  // Fields service_type / service_frequency are intentionally left alone so their
  // pre-printed template text (e.g. "INSECT QUARTERLY", "Every 90 days") remains visible.
  if (saPos) {
    const sz = 10;
    const lineH = 13;
    const textColor = rgb(0.13, 0.13, 0.13);
    const white     = rgb(1, 1, 1);

    function eraseField(fname) {
      const r = saPos[fname];
      if (!r) return;
      targetPage.drawRectangle({ x: r.x - 0.5, y: r.y - 0.5, width: r.width + 1, height: r.height + 1, color: white, borderWidth: 0 });
    }

    function drawField(fname, text) {
      const r = saPos[fname];
      if (!r) return;
      targetPage.drawRectangle({ x: r.x - 0.5, y: r.y - 0.5, width: r.width + 1, height: r.height + 1, color: white, borderWidth: 0 });
      if (text) targetPage.drawText(String(text), { x: r.x + 3, y: r.y + 2, size: sz, font: helvetica, color: textColor });
    }

    function drawMultiField(fname, lines) {
      const r = saPos[fname];
      if (!r) return;
      targetPage.drawRectangle({ x: r.x - 0.5, y: r.y - 0.5, width: r.width + 1, height: r.height + 1, color: white, borderWidth: 0 });
      let y = r.y + r.height - sz - 4;
      for (const line of lines.filter(Boolean)) {
        if (y < r.y) break;
        targetPage.drawText(line, { x: r.x + 4, y, size: sz, font: helvetica, color: textColor });
        y -= lineH;
      }
    }

    // Customer / address data
    drawMultiField('service_address',       addrParts);
    drawMultiField('customer_information',  contactParts);
    drawMultiField('service_notes',         notes?.trim() ? notes.trim().split('\n') : []);
    drawMultiField('billing_info',          addrParts);

    // Pricing
    drawField('initial_quote',    initVal  ? initVal.toFixed(2)  : '');
    drawField('initial_discount', discVal  ? `-${discVal.toFixed(2)}` : '');
    drawField('initial_subtotal', initVal  ? subtotal.toFixed(2) : '');
    drawField('initial_tax',      initVal  ? '0.00' : '');
    drawField('initial_total',    initVal  ? subtotal.toFixed(2) : '');
    drawField('recurring_charge', recurVal ? recurVal.toFixed(2) : '');
    drawField('recurring_tax',    recurVal ? '0.00' : '');
    drawField('recurring_total',  recurVal ? recurVal.toFixed(2) : '');
    drawField('payment_recurring_authorized', recurVal ? recurVal.toFixed(2) : '');

    // 12-month schedule (months, payments, service markers, contract dates)
    applyAgreementScheduleToPdf({
      prefix,
      agreementType: prefix,
      pricing: { initial: initVal, discounted: discVal, recurring: recurVal },
      startDate,
      agreementStartDate,
      serviceStartDate,
      initialServiceDate,
      selectedStartDate,
      fill: drawField,
    });

    // Erase signature / card fields (removes any template outlines, leaves blank for customer)
    for (const fname of ['card_last_four', 'customer_initials', 'customer_signature', 'signature_date']) {
      eraseField(fname);
    }
  }

  // ── Draw pest icons last so they sit on top of all drawn content ──
  const icons = PEST_ICONS_MAP[prefix] || [];
  for (const { type, x, y } of icons) drawPestIcon(targetPage, type, x, y);

  // ── Output ──
  let outBytes;
  if (filename === SERVICE_AGREEMENTS_FILE) {
    const singleDoc    = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(pdfDoc, [pageIndex]);
    singleDoc.addPage(copiedPage);
    applyCustomerFriendlyViewerPreferences(singleDoc);
    outBytes = await singleDoc.save();
  } else {
    applyCustomerFriendlyViewerPreferences(pdfDoc);
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
    const {
      index,
      lead = {},
      pricing = {},
      notes = '',
      address = {},
      serviceType,
      startDate,
      agreementStartDate,
      serviceStartDate,
      initialServiceDate,
      selectedStartDate,
      bedBugAgreement = {},
      cardLastFour = '',
      tmmOverrides = {},
      preview = false,
    } = req.body;
    if (index === undefined || index === null) return res.status(400).json({ error: 'index required' });

    const templateName = await resolveQuoteTemplateFilename(QUOTES_DIR, index);
    if (templateName === BED_BUG_TEMPLATE) {
      const normalized = normalizeBedBugAgreementData(req.body);
      const validationErrors = validateBedBugAgreementData(normalized, req.body);
      if (validationErrors.length) {
        return res.status(400).json({ error: validationErrors.join('; ') });
      }
    }

    const { outBytes, outName } = await buildQuotePdf({
      index,
      lead,
      pricing,
      notes,
      address,
      serviceType,
      startDate,
      agreementStartDate,
      serviceStartDate,
      initialServiceDate,
      selectedStartDate,
      bedBugAgreement,
      cardLastFour,
      tmmOverrides,
    });

    res.setHeader('Content-Type', 'application/pdf');
    const disposition = preview ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(outName)}"`);
    res.send(Buffer.from(outBytes));
  } catch (err) {
    console.error('generate-quote error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Route: generate & email directly (no n8n) ─────────────────────────────

router.post('/email-quote', async (req, res) => {
  try {
    const {
      index,
      lead = {},
      pricing = {},
      notes = '',
      address = {},
      serviceType,
      prepGuideIndices = [],
      startDate,
      agreementStartDate,
      serviceStartDate,
      initialServiceDate,
      selectedStartDate,
      bedBugAgreement = {},
      cardLastFour = '',
      tmmOverrides = {},
      previewVerified = false,
      calendarInvite = false,
      appointmentDate = '',
      appointmentWindow = '',
    } = req.body;

    if (index === undefined || index === null) return res.status(400).json({ error: 'index required' });
    if (!lead.email && !lead.phone) return res.status(400).json({ error: 'lead email or phone is required to send' });

    const templateName = await resolveQuoteTemplateFilename(QUOTES_DIR, index);
    if (templateName === BED_BUG_TEMPLATE && BED_BUG_EMAIL_DISABLED) {
      return res.status(503).json({ error: BED_BUG_EMAIL_DISABLED_MESSAGE });
    }

    if (templateName === BED_BUG_TEMPLATE) {
      const normalized = normalizeBedBugAgreementData(req.body);
      const validationErrors = validateBedBugAgreementData(normalized, req.body, { forEmail: true });
      if (validationErrors.length) {
        return res.status(400).json({ error: validationErrors.join('; ') });
      }
      if (!previewVerified) {
        return res.status(400).json({ error: 'Preview the Bed Bug agreement PDF before emailing.' });
      }
    }

    if (lead.email && (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)) {
      return res.status(500).json({ error: 'Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing from server/.env)' });
    }
    if (lead.phone && !lead.email && (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER)) {
      return res.status(500).json({ error: 'Twilio credentials not configured for SMS-only delivery' });
    }

    const { outBytes, outName } = await buildQuotePdf({
      index,
      lead,
      pricing,
      notes,
      address,
      serviceType,
      startDate,
      agreementStartDate,
      serviceStartDate,
      initialServiceDate,
      selectedStartDate,
      bedBugAgreement,
      cardLastFour,
      tmmOverrides,
    });

    const MIME_MAP = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
    const prepGuideAttached = [];
    const prepGuideAttachments = [];

    const prepGuidesAllowed = !NO_PREP_GUIDE.has(serviceType);
    if (prepGuidesAllowed && prepGuideIndices.length > 0) {
      let supportedPrepFiles = [];
      try {
        const allPrepFiles = await readdirAsync(PREP_GUIDE_DIR);
        supportedPrepFiles = allPrepFiles.filter(f => SUPPORTED_EXTS.has(ext(f)));
      } catch (err) {
        console.error('[email-quote] Cannot read Prep Guide folder:', PREP_GUIDE_DIR, err.message);
      }

      for (const pgIdx of prepGuideIndices) {
        const idx = parseInt(pgIdx, 10);
        if (isNaN(idx) || idx < 0 || idx >= supportedPrepFiles.length) {
          console.error(`[email-quote] Prep guide index ${pgIdx} out of range (${supportedPrepFiles.length} files available in ${PREP_GUIDE_DIR})`);
          continue;
        }
        const pgFilename = supportedPrepFiles[idx];
        const pgPath = join(PREP_GUIDE_DIR, pgFilename);
        try {
          const pgContent = readFileSync(pgPath);
          const pgAttachment = {
            filename: pgFilename,
            content: pgContent,
            contentType: MIME_MAP[ext(pgFilename)] || 'application/octet-stream',
          };
          prepGuideAttachments.push(pgAttachment);
          prepGuideAttached.push(pgFilename);
        } catch (err) {
          console.error(`[email-quote] Failed to attach prep guide "${pgFilename}": ${err.message}`);
        }
      }
    }

    const agreementType = resolveAgreementType({ templateName, serviceType });
    const useSigningFlow = Boolean(lead.email || lead.phone);

    let calendarParams = null;
    if (calendarInvite && appointmentDate) {
      const location = [address.street, address.cityState].filter(Boolean).join(', ');
      calendarParams = {
        appointmentDate,
        appointmentWindow,
        location: location || undefined,
        uid: lead.row_number || 'treatment',
      };
    }

    if (useSigningFlow) {
      const quotePayload = {
        index,
        lead,
        pricing,
        notes,
        address,
        serviceType,
        startDate,
        agreementStartDate,
        serviceStartDate,
        initialServiceDate,
        selectedStartDate,
        bedBugAgreement,
        cardLastFour,
      };

      const { session, signUrl } = await createAgreementSigningSession({
        agreementType,
        quotePayload,
        lead,
        outBytes,
        outName,
        req,
      });

      let previewPngBuffer = null;
      try {
        previewPngBuffer = await readPreviewPng(session.token);
      } catch {
        previewPngBuffer = null;
      }

      // Email uses the direct .ics URL — no redirect overhead, works in all email clients.
      // SMS uses the short /cal/:token path (gshieldpest.com/cal/TOKEN) so iMessage shows
      // a rich OG preview card and customers never see the long Render hostname.
      let calendarUrl = null;
      let smsCalendarUrl = null;
      if (calendarParams) {
        await updateSigningSession(session.token, { calendarParams });
        const base = publicSigningBaseUrl(req);
        calendarUrl = `${base}/api/signing/public/${session.token}/calendar.ics`;
        smsCalendarUrl = `${base}/cal/${session.token}`;
      }

      const firstName = (lead.name || '').split(' ')[0] || 'there';
      const agreementLabel = getAgreementTypeLabel(agreementType);

      const channels = { email: false, sms: false, smsError: null };

      if (lead.email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        await sendSigningRequestEmail({
          to: lead.email,
          firstName,
          signUrl,
          agreementLabel,
          hasPrepGuide: prepGuideAttached.length > 0,
          previewPngBuffer,
          prepGuideAttachments,
          calendarUrl,
        });
        channels.email = true;
      }

      const hasTwilioCreds = Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER,
      );
      console.log('[email-quote] SMS check:', {
        hasPhone: Boolean(lead.phone),
        phoneRaw: lead.phone ? `***${String(lead.phone).slice(-4)}` : null,
        hasTwilioSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
        hasTwilioToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
        hasTwilioFrom: Boolean(process.env.TWILIO_PHONE_NUMBER),
      });

      if (lead.phone && hasTwilioCreds) {
        try {
          const cleanPhone = String(lead.phone).replace(/\D/g, '');
          const toNumber = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;
          const smsBody = smsCalendarUrl
            ? `Hi ${firstName},\n\nYour Green Shield agreement is ready to review and sign.\n\nSign Agreement:\n${signUrl}\n\nAdd Appointment:\n${smsCalendarUrl}\n\nQuestions? (207) 815-2234`
            : `Hi ${firstName},\n\nYour Green Shield agreement is ready to review and sign.\n\nSign Agreement:\n${signUrl}\n\nQuestions? (207) 815-2234`;
          console.log(`[email-quote] Sending SMS to ${toNumber}`);
          const twilioSms = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const sent = await twilioSms.messages.create({ body: smsBody, from: process.env.TWILIO_PHONE_NUMBER, to: toNumber });
          channels.sms = true;
          console.log(`[email-quote] SMS sent — sid=${sent.sid} status=${sent.status}`);
          if (lead.row_number) {
            try {
              appendMessage(lead.row_number, {
                direction: 'outbound',
                channel: 'sms',
                body: smsBody,
                ts: new Date().toISOString(),
                sender: 'You',
                status: sent.status || 'sent',
                meta: { twilioSid: sent.sid },
              });
            } catch (err) {
              console.warn('[email-quote] SMS persist failed:', err.message);
            }
          }
        } catch (err) {
          channels.smsError = err.message;
          console.error('[email-quote] SMS send failed:', err.message);
        }
      } else if (lead.phone && !hasTwilioCreds) {
        channels.smsError = 'Twilio credentials not configured on server';
        console.warn('[email-quote] SMS skipped — Twilio env vars missing');
      }

      appendLog({
        type: 'agreement_signing_sent',
        action: 'agreement_signing_sent',
        agreementType,
        token: session.token,
        signUrl,
        customerName: lead.name ?? '',
        customerEmail: lead.email ?? '',
        leadRowNumber: lead.row_number ?? null,
        channels,
      });

      if (lead.row_number) {
        try {
          await updateLead(lead.row_number, { status: 'agreement_sent' });
        } catch (err) {
          console.warn('[email-quote] Lead status update failed:', err.message);
        }
      }

      console.log(`[email-quote] Signing link sent (${agreementType}) email=${channels.email} sms=${channels.sms}${channels.smsError ? ` smsError="${channels.smsError}"` : ''} — ${signUrl}`);

      return res.json({
        success: true,
        to: lead.email || lead.phone,
        filename: outName,
        prepGuides: prepGuideAttached,
        channels,
        signing: {
          token: session.token,
          signUrl,
          status: session.status,
          expiresAt: session.expiresAt,
        },
      });
    }

    const attachments = [{ filename: outName, content: Buffer.from(outBytes), contentType: 'application/pdf' }];
    for (const pgAttachment of prepGuideAttachments) {
      attachments.push(pgAttachment);
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });

    const firstName = (lead.name || '').split(' ')[0] || 'there';
    const hasPrepGuide = prepGuideAttached.length > 0;
    const isBedBugTemplate = templateName === BED_BUG_TEMPLATE;

    const preview = await tryRenderAgreementPreviewPng(outBytes);

    let emailHtml;
    if (isBedBugTemplate) {
      if (preview.ok) {
        attachments.push(buildBedBugPreviewInlineAttachment(preview.pngBuffer));
      }
      emailHtml = buildBedBugQuoteEmailHtml({
        firstName,
        hasPrepGuide,
        includePreview: preview.ok,
      });
    } else {
      if (preview.ok) {
        attachments.push(buildQuotePreviewInlineAttachment(preview.pngBuffer));
      }
      emailHtml = buildStandardQuoteEmailHtml({
        firstName,
        hasPrepGuide,
        includePreview: preview.ok,
      });
    }

    await transporter.sendMail({
      from:    `Green Shield Pest Solutions <${process.env.GMAIL_USER}>`,
      to:      lead.email,
      subject: 'Your Quote from Green Shield Pest Solutions',
      html:    emailHtml,
      attachments
    });

    const logSuffix = prepGuideAttached.length > 0
      ? `+ prep guides: ${prepGuideAttached.join(', ')}`
      : 'quote only (no prep guide)';
    const previewSuffix = preview.ok ? ' + inline preview' : '';
    console.log(`[email-quote] Sent to ${lead.email} — ${outName} — ${logSuffix}${previewSuffix}`);

    res.json({ success: true, to: lead.email, filename: outName, prepGuides: prepGuideAttached });
  } catch (err) {
    console.error('email-quote error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

export { buildQuotePdf };
export default router;
