import { rgb } from 'pdf-lib';

const GREEN = rgb(0.18, 0.45, 0.28);
const T = 0.3;

function drawAnt(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy - 1.8, xScale: 1.4, yScale: 1.1, color });
  page.drawEllipse({ x: cx, y: cy, xScale: 0.9, yScale: 0.8, color });
  page.drawEllipse({ x: cx, y: cy + 1.9, xScale: 0.9, yScale: 0.9, color });
  page.drawLine({ start: { x: cx - 0.3, y: cy + 2.8 }, end: { x: cx - 1.8, y: cy + 4.2 }, thickness: T, color });
  page.drawLine({ start: { x: cx + 0.3, y: cy + 2.8 }, end: { x: cx + 1.8, y: cy + 4.2 }, thickness: T, color });
  for (const [sx, sy, ex, ey] of [
    [-0.8, 0.4, -2.8, 1.2], [-0.8, 0, -2.8, -0.4], [-0.8, -0.4, -2.8, -1.4],
    [0.8, 0.4, 2.8, 1.2], [0.8, 0, 2.8, -0.4], [0.8, -0.4, 2.8, -1.4],
  ]) page.drawLine({ start: { x: cx + sx, y: cy + sy }, end: { x: cx + ex, y: cy + ey }, thickness: T, color });
}

function drawSpider(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 2.2, yScale: 2.0, color });
  for (const [sx, sy, ex, ey] of [
    [-2.2, 1.2, -4.5, 2.5], [-2.2, 0.4, -4.5, 0.4], [-2.2, -0.4, -4.5, -0.8], [-2.2, -1.2, -4.5, -2.5],
    [2.2, 1.2, 4.5, 2.5], [2.2, 0.4, 4.5, 0.4], [2.2, -0.4, 4.5, -0.8], [2.2, -1.2, 4.5, -2.5],
  ]) page.drawLine({ start: { x: cx + sx, y: cy + sy }, end: { x: cx + ex, y: cy + ey }, thickness: T, color });
}

function drawBedBug(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 3.2, yScale: 2.0, color });
  for (const [sx, sy, ex, ey] of [
    [-3.2, 0.8, -4.8, 1.6], [-3.2, 0, -4.8, 0], [-3.2, -0.8, -4.8, -1.6],
    [3.2, 0.8, 4.8, 1.6], [3.2, 0, 4.8, 0], [3.2, -0.8, 4.8, -1.6],
  ]) page.drawLine({ start: { x: cx + sx, y: cy + sy }, end: { x: cx + ex, y: cy + ey }, thickness: T, color });
}

function drawBee(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 1.5, yScale: 2.8, color });
  page.drawEllipse({ x: cx - 2.2, y: cy + 2.0, xScale: 1.8, yScale: 1.0, borderColor: color, borderWidth: 0.4 });
  page.drawEllipse({ x: cx + 2.2, y: cy + 2.0, xScale: 1.8, yScale: 1.0, borderColor: color, borderWidth: 0.4 });
}

function drawWasp(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy + 0.5, xScale: 1.0, yScale: 2.0, color });
  page.drawEllipse({ x: cx, y: cy - 1.5, xScale: 0.6, yScale: 0.7, color });
  page.drawEllipse({ x: cx, y: cy - 2.8, xScale: 0.9, yScale: 0.9, color });
  page.drawEllipse({ x: cx - 2.0, y: cy + 2.0, xScale: 1.5, yScale: 0.8, borderColor: color, borderWidth: 0.4 });
  page.drawEllipse({ x: cx + 2.0, y: cy + 2.0, xScale: 1.5, yScale: 0.8, borderColor: color, borderWidth: 0.4 });
}

function drawFlea(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 1.5, yScale: 2.0, color });
  for (const [sx, sy, ex, ey] of [
    [-1.5, 0.5, -3.0, 1.5], [-1.5, -0.5, -3.0, -1.5],
    [1.5, 0.5, 3.0, 1.5], [1.5, -0.5, 3.0, -1.5],
  ]) page.drawLine({ start: { x: cx + sx, y: cy + sy }, end: { x: cx + ex, y: cy + ey }, thickness: T, color });
}

function drawCentipede(page, cx, cy, color) {
  for (let i = 0; i < 5; i++) {
    const sx = cx - 4 + i * 2;
    page.drawEllipse({ x: sx, y: cy, xScale: 0.9, yScale: 0.9, color });
    page.drawLine({ start: { x: sx, y: cy + 0.9 }, end: { x: sx, y: cy + 2.2 }, thickness: T, color });
    page.drawLine({ start: { x: sx, y: cy - 0.9 }, end: { x: sx, y: cy - 2.2 }, thickness: T, color });
  }
}

function drawCricket(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 2.5, yScale: 1.5, color });
  page.drawLine({ start: { x: cx - 2.0, y: cy + 1.5 }, end: { x: cx - 4.5, y: cy + 4.0 }, thickness: T, color });
  page.drawLine({ start: { x: cx - 1.5, y: cy + 1.5 }, end: { x: cx - 3.5, y: cy + 4.5 }, thickness: T, color });
  for (const [sx, sy, ex, ey] of [
    [-2.5, 0.5, -4.0, 1.5], [-2.5, 0, -4.0, 0], [-2.5, -0.5, -4.0, -1.5],
    [2.5, 0.5, 4.0, 1.5], [2.5, 0, 4.0, 0], [2.5, -0.5, 4.0, -1.5],
  ]) page.drawLine({ start: { x: cx + sx, y: cy + sy }, end: { x: cx + ex, y: cy + ey }, thickness: T, color });
}

function drawSilverfish(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy + 0.5, xScale: 2.0, yScale: 2.5, color });
  page.drawLine({ start: { x: cx - 0.5, y: cy - 2.0 }, end: { x: cx - 1.5, y: cy - 4.0 }, thickness: T, color });
  page.drawLine({ start: { x: cx, y: cy - 2.0 }, end: { x: cx, y: cy - 4.5 }, thickness: T, color });
  page.drawLine({ start: { x: cx + 0.5, y: cy - 2.0 }, end: { x: cx + 1.5, y: cy - 4.0 }, thickness: T, color });
}

function drawMouse(page, cx, cy, color) {
  page.drawEllipse({ x: cx - 0.5, y: cy, xScale: 2.5, yScale: 2.0, color });
  page.drawEllipse({ x: cx + 2.2, y: cy + 0.5, xScale: 1.5, yScale: 1.5, color });
  page.drawEllipse({ x: cx + 1.5, y: cy + 2.2, xScale: 0.9, yScale: 0.9, color });
  page.drawLine({ start: { x: cx - 3.0, y: cy - 0.5 }, end: { x: cx - 5.5, y: cy - 1.5 }, thickness: 0.35, color });
}

function drawRat(page, cx, cy, color) {
  page.drawEllipse({ x: cx - 0.5, y: cy, xScale: 2.8, yScale: 2.0, color });
  page.drawEllipse({ x: cx + 2.5, y: cy + 0.3, xScale: 1.6, yScale: 1.5, color });
  page.drawEllipse({ x: cx + 2.0, y: cy + 2.2, xScale: 1.1, yScale: 1.1, color });
  page.drawLine({ start: { x: cx - 3.2, y: cy - 0.3 }, end: { x: cx - 5.5, y: cy - 2.0 }, thickness: 0.45, color });
}

function drawTick(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 2.5, yScale: 2.5, color });
  for (const [sx, sy, ex, ey] of [
    [-2.5, 1.5, -4.5, 2.5], [-2.5, 0.5, -4.5, 0.5], [-2.5, -0.5, -4.5, -0.5], [-2.5, -1.5, -4.5, -2.5],
    [2.5, 1.5, 4.5, 2.5], [2.5, 0.5, 4.5, 0.5], [2.5, -0.5, 4.5, -0.5], [2.5, -1.5, 4.5, -2.5],
  ]) page.drawLine({ start: { x: cx + sx, y: cy + sy }, end: { x: cx + ex, y: cy + ey }, thickness: T, color });
}

function drawMosquito(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 0.9, yScale: 2.8, color });
  page.drawEllipse({ x: cx - 2.2, y: cy + 1.5, xScale: 2.0, yScale: 1.0, borderColor: color, borderWidth: 0.4 });
  page.drawEllipse({ x: cx + 2.2, y: cy + 1.5, xScale: 2.0, yScale: 1.0, borderColor: color, borderWidth: 0.4 });
}

function drawCockroach(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 2.2, yScale: 2.6, color });
  page.drawEllipse({ x: cx, y: cy + 3.1, xScale: 1.1, yScale: 0.8, color });
  for (const [sx, sy, ex, ey] of [
    [-2.2, 1.3, -4.0, 2.2], [-2.2, 0, -4.0, 0], [-2.2, -1.3, -4.0, -2.2],
    [2.2, 1.3, 4.0, 2.2], [2.2, 0, 4.0, 0], [2.2, -1.3, 4.0, -2.2],
  ]) page.drawLine({ start: { x: cx + sx, y: cy + sy }, end: { x: cx + ex, y: cy + ey }, thickness: T, color });
}

function drawBug(page, cx, cy, color) {
  page.drawEllipse({ x: cx, y: cy, xScale: 2.2, yScale: 2.8, color });
  page.drawLine({ start: { x: cx - 0.4, y: cy + 2.8 }, end: { x: cx - 2.0, y: cy + 4.5 }, thickness: T, color });
  page.drawLine({ start: { x: cx + 0.4, y: cy + 2.8 }, end: { x: cx + 2.0, y: cy + 4.5 }, thickness: T, color });
}

const DRAWERS = {
  ant: drawAnt,
  spider: drawSpider,
  bed_bug: drawBedBug,
  bee: drawBee,
  wasp: drawWasp,
  flea: drawFlea,
  centipede: drawCentipede,
  cricket: drawCricket,
  silverfish: drawSilverfish,
  mouse: drawMouse,
  rat: drawRat,
  tick: drawTick,
  mosquito: drawMosquito,
  cockroach: drawCockroach,
  bug: drawBug,
};

export function drawPestIcon(page, type, cx, cy, color = GREEN) {
  try {
    DRAWERS[type]?.(page, cx, cy, color);
  } catch { /* skip on draw error */ }
}

export const BED_BUG_PEST_ICONS = [
  { type: 'bed_bug', label: 'Bed Bugs' },
  { type: 'ant', label: 'Odorous Ants' },
  { type: 'ant', label: 'Pavement Ants' },
  { type: 'ant', label: 'Carpenter Ants' },
  { type: 'bee', label: 'Carpenter Bees' },
  { type: 'wasp', label: 'Wasps' },
  { type: 'spider', label: 'Spiders' },
  { type: 'bug', label: 'Fall Invaders' },
  { type: 'flea', label: 'Fleas' },
  { type: 'centipede', label: 'Centi/Millipedes' },
  { type: 'cricket', label: 'Crickets/Earwigs' },
  { type: 'silverfish', label: 'Springtails/Silverfish' },
];

export const BED_BUG_ADDON_ICONS = [
  { type: 'mouse', label: 'Mice' },
  { type: 'rat', label: 'Rats' },
  { type: 'tick', label: 'Ticks/Mosquitoes' },
  { type: 'cockroach', label: 'Cockroaches' },
];
