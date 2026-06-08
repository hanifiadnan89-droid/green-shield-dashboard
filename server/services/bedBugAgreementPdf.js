import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { applyAgreementScheduleToPdf } from './applyAgreementScheduleToPdf.js';
import { BED_BUG_TEMPLATE_FILENAME } from './bedBugAgreementContent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', '..', 'assets', 'quotes', BED_BUG_TEMPLATE_FILENAME);

const PREFIX = 'bed_bug_insect_triannual';

const WHITE = rgb(1, 1, 1);
const TEXT = rgb(0.13, 0.13, 0.13);

/** 792×612 professional template — calibrated overlay coordinates */
const CALENDAR = {
  cols: [400, 463, 526, 589, 652, 715],
  row1MonthY: 292,
  row1PayY: 276,
  row2MonthY: 246,
  row2PayY: 230,
  cellW: 63,
};

const FIELDS = {
  service_address: { x: 22, y: 506, w: 248, h: 36, size: 8, lineH: 11 },
  customer_information: { x: 278, y: 506, w: 248, h: 36, size: 8, lineH: 11 },
  billing_info: { x: 534, y: 250, w: 248, h: 48, size: 8, lineH: 11 },
  initial_quote: { x: 155, y: 248, w: 100, h: 12, size: 8 },
  initial_discount: { x: 155, y: 234, w: 100, h: 12, size: 8 },
  initial_subtotal: { x: 155, y: 220, w: 100, h: 12, size: 8 },
  initial_tax: { x: 155, y: 206, w: 100, h: 12, size: 8 },
  initial_total: { x: 155, y: 192, w: 100, h: 12, size: 8 },
  recurring_charge: { x: 390, y: 248, w: 100, h: 12, size: 8 },
  recurring_tax: { x: 390, y: 234, w: 100, h: 12, size: 8 },
  recurring_total: { x: 390, y: 220, w: 100, h: 12, size: 8 },
  payment_recurring_authorized: { x: 390, y: 206, w: 100, h: 12, size: 8 },
  billing_recurring_authorized: { x: 620, y: 228, w: 150, h: 12, size: 8 },
  card_last_four: { x: 620, y: 210, w: 150, h: 12, size: 8 },
};

function parseMoney(value) {
  return parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 0;
}

function eraseRect(page, { x, y, w, h }) {
  page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderWidth: 0 });
}

function drawRightAligned(page, text, { x, y, w, h, size, font }) {
  if (!text) return;
  const width = font.widthOfTextAtSize(String(text), size);
  page.drawText(String(text), {
    x: x + w - width,
    y: y + (h - size) / 2,
    size,
    font,
    color: TEXT,
  });
}

function drawCentered(page, text, { x, y, w, size, font }) {
  if (!text) return;
  const width = font.widthOfTextAtSize(String(text), size);
  page.drawText(String(text), {
    x: x + (w - width) / 2,
    y,
    size,
    font,
    color: TEXT,
  });
}

function truncateToWidth(text, font, size, maxWidth) {
  let value = String(text);
  while (value.length > 0 && font.widthOfTextAtSize(value, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return value;
}

function drawMultiline(page, lines, { x, y, w, h, size, font, lineH }) {
  eraseRect(page, { x, y, w, h });
  let cy = y + h - size - 4;
  const maxWidth = w - 8;
  for (const line of lines.filter(Boolean)) {
    if (cy < y) break;
    page.drawText(truncateToWidth(line, font, size, maxWidth), {
      x: x + 4,
      y: cy,
      size,
      font,
      color: TEXT,
    });
    cy -= lineH;
  }
}

/**
 * Format payment text to match the professional template artwork.
 */
export function formatBedBugPaymentText(month) {
  if (!month?.paymentText) return '';

  let text = month.paymentText;
  if (month.isInitialMonth) return text;

  text = text.replace(/^\$/, '');

  if (month.isServiceMonth && !text.includes('(S)')) {
    text = `(S)${text}`;
  }

  return text;
}

function paymentFontSize(text) {
  const len = String(text || '').length;
  if (len > 12) return 5;
  if (len > 9) return 5.5;
  return 6.5;
}

function overlayCalendar(page, scheduleMonths, font, fontBold) {
  scheduleMonths.forEach((month, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    const x = CALENDAR.cols[col];
    const monthY = row === 0 ? CALENDAR.row1MonthY : CALENDAR.row2MonthY;
    const payY = row === 0 ? CALENDAR.row1PayY : CALENDAR.row2PayY;

    eraseRect(page, { x: x + 1, y: monthY - 2, w: CALENDAR.cellW - 2, h: 13 });
    eraseRect(page, { x: x + 1, y: payY - 2, w: CALENDAR.cellW - 2, h: 11 });

    if (month.label) {
      drawCentered(page, month.label, {
        x,
        y: monthY,
        w: CALENDAR.cellW,
        size: 7,
        font: fontBold,
      });
    }

    const payment = formatBedBugPaymentText(month);
    if (payment) {
      drawCentered(page, payment, {
        x,
        y: payY,
        w: CALENDAR.cellW,
        size: paymentFontSize(payment),
        font,
      });
    }
  });
}

function overlayPricing(page, values, font) {
  for (const [key, rect] of Object.entries(FIELDS)) {
    if (!key.startsWith('initial_') && !key.startsWith('recurring_')
      && key !== 'payment_recurring_authorized' && key !== 'billing_recurring_authorized'
      && key !== 'card_last_four') {
      continue;
    }
    const value = values[key];
    if (!value) continue;
    eraseRect(page, { x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    drawRightAligned(page, value, { ...rect, font });
  }
}

/**
 * Build Bed Bug agreement from the professional template artwork + dynamic overlays.
 */
export async function buildBedBugAgreementPdf({
  lead = {},
  pricing = {},
  address = {},
  cardLastFour = '',
  startDate,
  agreementStartDate,
  serviceStartDate,
  initialServiceDate,
  selectedStartDate,
}) {
  const pdfDoc = await PDFDocument.load(readFileSync(TEMPLATE_PATH));
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const initVal = parseMoney(pricing.initial);
  const discVal = parseMoney(pricing.discounted);
  const recurVal = parseMoney(pricing.recurring);
  const subtotal = Math.max(0, initVal - discVal);

  const addrParts = [lead.name, address.street, address.cityState].filter(Boolean);
  const contactLines = [lead.name, lead.phone, lead.email].filter(Boolean);

  drawMultiline(page, addrParts, { ...FIELDS.service_address, font });
  drawMultiline(page, contactLines, { ...FIELDS.customer_information, font });
  drawMultiline(page, addrParts, { ...FIELDS.billing_info, font });

  const filled = {};
  const fill = (name, value) => { filled[name] = value; };

  if (initVal) {
    fill('initial_quote', initVal.toFixed(2));
    fill('initial_subtotal', subtotal.toFixed(2));
    fill('initial_tax', '0.00');
    fill('initial_total', subtotal.toFixed(2));
  }
  if (discVal > 0) fill('initial_discount', `-${discVal.toFixed(2)}`);

  if (recurVal) {
    fill('recurring_charge', recurVal.toFixed(2));
    fill('recurring_tax', '0.00');
    fill('recurring_total', recurVal.toFixed(2));
    fill('payment_recurring_authorized', recurVal.toFixed(2));
  }

  const schedule = applyAgreementScheduleToPdf({
    prefix: PREFIX,
    agreementType: PREFIX,
    pricing: { initial: initVal, discounted: discVal, recurring: recurVal },
    startDate,
    agreementStartDate,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
    fill,
  });

  overlayPricing(page, {
    initial_quote: filled.initial_quote,
    initial_discount: filled.initial_discount,
    initial_subtotal: filled.initial_subtotal,
    initial_tax: filled.initial_tax,
    initial_total: filled.initial_total,
    recurring_charge: filled.recurring_charge,
    recurring_tax: filled.recurring_tax,
    recurring_total: filled.recurring_total,
    payment_recurring_authorized: filled.payment_recurring_authorized,
    billing_recurring_authorized: filled.payment_recurring_authorized,
    card_last_four: cardLastFour || '',
  }, font);

  if (schedule?.scheduleMonths) {
    overlayCalendar(page, schedule.scheduleMonths, font, fontBold);
  }

  const outBytes = await pdfDoc.save();
  const safeName = (lead.name || 'Quote')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Quote';

  return {
    outBytes,
    outName: `${safeName}_Bed_Bug.pdf`,
    schedule,
  };
}

export const BED_BUG_PAGE_SIZE = { width: 792, height: 612 };
