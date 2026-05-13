import { Router } from 'express';
import { readdir, stat, createReadStream } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { promisify } from 'util';
import { PDFDocument, PDFName, PDFDict, rgb } from 'pdf-lib';
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

const FILE_PREFIX = {
  'Bed Bug.pdf': 'bed_bug_insect_triannual',
};

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
  bed_bug_insect_triannual: [
    // Included Pests row 1
    {type:'bed_bug',   x:29,  y:743}, {type:'ant',       x:168, y:743},
    {type:'ant',       x:307, y:743}, {type:'ant',       x:446, y:743},
    // Included Pests row 2
    {type:'bee',       x:29,  y:729}, {type:'wasp',      x:168, y:729},
    {type:'spider',    x:307, y:729}, {type:'bug',       x:446, y:729},
    // Included Pests row 3
    {type:'flea',      x:29,  y:715}, {type:'centipede', x:168, y:715},
    {type:'cricket',   x:307, y:715}, {type:'silverfish',x:446, y:715},
    // Add-ons
    {type:'mouse',     x:29,  y:679}, {type:'rat',       x:168, y:679},
    {type:'tick',      x:307, y:679}, {type:'cockroach', x:446, y:679},
  ],
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
    {type:'mosquito',  x:29,  y:743}, {type:'tick',      x:185, y:743},
  ],
  commercial_bimonthly: [],
  commercial_monthly:   [],
};

// ── Directory listing ──────────────────────────────────────────────────────

async function listDir(dir) {
  try {
    const files = await readdirAsync(dir);
    const results = [];
    let si = 0;
    for (let i = 0; i < files.length; i++) {
      const name = files[i];
      const extension = ext(name);
      if (!SUPPORTED_EXTS.has(extension)) continue;
      const info = await statAsync(join(dir, name));
      const idx = si++;

      if (name === SERVICE_AGREEMENTS_FILE) {
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

async function buildQuotePdf({ index, lead = {}, pricing = {}, notes = '', address = {}, serviceType }) {
  const allFiles  = await readdirAsync(QUOTES_DIR);
  const supported = allFiles.filter(f => SUPPORTED_EXTS.has(ext(f)));
  const idx       = parseInt(index, 10);
  if (isNaN(idx) || idx < 0 || idx >= supported.length) {
    throw Object.assign(new Error('file not found'), { status: 404 });
  }

  const filename = supported[idx];

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

  // ── Configure ALL fields: font-size 12, no visible border, clear to empty ──
  for (const field of form.getFields()) {
    try {
      field.setFontSize(12);
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

  // Safe field writer
  function fill(name, value) {
    if (value === null || value === undefined) return;
    try {
      const field = form.getTextField(`${prefix}_${name}`);
      field.setFontSize(12);
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

  // ── 12-month payment schedule ──
  if (subtotal > 0 || recurVal > 0) {
    fill('payment_1', subtotal > 0 ? `$${subtotal.toFixed(2)}` : '');
    for (let m = 2; m <= 12; m++) {
      fill(`payment_${m}`, recurVal > 0 ? `$${recurVal.toFixed(2)}` : '');
    }
  }

  // ── Billing info ──
  fill('billing_info', addrParts.join('\n'));

  // ── Flatten: bakes fields into page content ──
  form.flatten();

  // ── Draw pest icons on the target page (after flatten, so icons appear on top) ──
  const icons = PEST_ICONS_MAP[prefix] || [];
  if (icons.length > 0) {
    const iconPage = pdfDoc.getPage(pageIndex);
    for (const { type, x, y } of icons) {
      drawPestIcon(iconPage, type, x, y);
    }
  }

  // ── Output ──
  let outBytes;
  if (filename === SERVICE_AGREEMENTS_FILE) {
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
             <strong>(207) 815-2234</strong>.</p>
          <p>We look forward to working with you!</p>
          <br>
          <p style="color:#555;font-size:13px">
            Green Shield Pest Solutions<br>
            (207) 815-2234 | ahanifi@gshieldpest.com<br>
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
