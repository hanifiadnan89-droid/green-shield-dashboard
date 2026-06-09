import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateAgreementSchedule } from './agreementSchedule.js';
import { BED_BUG_TEMPLATE_FILENAME } from './bedBugAgreementContent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', '..', 'assets', 'quotes', BED_BUG_TEMPLATE_FILENAME);

const AGREEMENT_TYPE = 'bed_bug_insect_triannual';

/** Layout calibrated against the professional Bed Bug.pdf artwork (792×612 landscape). */
const REFERENCE_PAGE = { width: 792, height: 612 };

const WHITE = rgb(1, 1, 1);
const TEXT = rgb(0.13, 0.13, 0.13);

/**
 * Build overlay layout for the loaded template page size.
 * Coordinates are authored for REFERENCE_PAGE and scaled when sizes differ.
 */
function buildLayout(pageW, pageH) {
  const sx = pageW / REFERENCE_PAGE.width;
  const sy = pageH / REFERENCE_PAGE.height;
  const scaleX = (x) => x * sx;
  const scaleY = (yTop) => yTop * sy;
  const scaleW = (w) => w * sx;
  const scaleH = (h) => h * sy;

  function fromTop(yTop, height = 12) {
    return pageH - scaleY(yTop) - scaleH(height);
  }

  const WIPE_REGIONS = [
    { x: scaleX(22), y: fromTop(186, 42), w: scaleW(252), h: scaleH(42) },
    { x: scaleX(276), y: fromTop(186, 42), w: scaleW(252), h: scaleH(42) },
    { x: scaleX(22), y: fromTop(352, 88), w: scaleW(748), h: scaleH(88) },
    { x: scaleX(198), y: fromTop(410, 72), w: scaleW(88), h: scaleH(72) },
    { x: scaleX(22), y: fromTop(562, 88), w: scaleW(248), h: scaleH(88) },
    { x: scaleX(278), y: fromTop(562, 88), w: scaleW(248), h: scaleH(88) },
    { x: scaleX(532), y: fromTop(562, 88), w: scaleW(248), h: scaleH(88) },
  ];

  const CALENDAR = {
    cols: [26, 148, 270, 392, 514, 636].map(scaleX),
    row1MonthY: fromTop(298, 11),
    row1PayY: fromTop(314, 11),
    row2MonthY: fromTop(330, 11),
    row2PayY: fromTop(346, 11),
    cellW: scaleW(118),
  };

  const FIELDS = {
    service_address: { x: scaleX(26), y: fromTop(182, 38), w: scaleW(246), h: scaleH(38), size: 8, lineH: 11 * sy },
    customer_information: { x: scaleX(280), y: fromTop(182, 38), w: scaleW(246), h: scaleH(38), size: 8, lineH: 11 * sy },
    billing_info: { x: scaleX(536), y: fromTop(548, 52), w: scaleW(240), h: scaleH(52), size: 8, lineH: 11 * sy },
    initial_quote: { x: scaleX(42), y: fromTop(494, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    initial_discount: { x: scaleX(42), y: fromTop(508, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    initial_subtotal: { x: scaleX(42), y: fromTop(522, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    initial_tax: { x: scaleX(42), y: fromTop(536, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    initial_total: { x: scaleX(42), y: fromTop(550, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    recurring_charge: { x: scaleX(308), y: fromTop(494, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    recurring_tax: { x: scaleX(308), y: fromTop(508, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    recurring_total: { x: scaleX(308), y: fromTop(522, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    payment_recurring_authorized: { x: scaleX(308), y: fromTop(536, 12), w: scaleW(130), h: scaleH(12), size: 8 },
    billing_recurring_authorized: { x: scaleX(580), y: fromTop(550, 12), w: scaleW(180), h: scaleH(12), size: 8 },
    card_last_four: { x: scaleX(580), y: fromTop(536, 12), w: scaleW(180), h: scaleH(12), size: 8 },
  };

  return { WIPE_REGIONS, CALENDAR, FIELDS, fromTop };
}

function parseMoney(value) {
  return parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 0;
}

function eraseRect(page, { x, y, w, h }) {
  page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderWidth: 0 });
}

function wipeTemplateSampleData(page, wipeRegions) {
  for (const region of wipeRegions) {
    eraseRect(page, region);
  }
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

function overlayCalendar(page, scheduleMonths, font, fontBold, calendar) {
  scheduleMonths.forEach((month, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    const x = calendar.cols[col];
    const monthY = row === 0 ? calendar.row1MonthY : calendar.row2MonthY;
    const payY = row === 0 ? calendar.row1PayY : calendar.row2PayY;

    eraseRect(page, { x: x + 1, y: monthY - 2, w: calendar.cellW - 2, h: 13 });
    eraseRect(page, { x: x + 1, y: payY - 2, w: calendar.cellW - 2, h: 11 });

    if (month.label) {
      drawCentered(page, month.label, {
        x,
        y: monthY,
        w: calendar.cellW,
        size: 7,
        font: fontBold,
      });
    }

    const payment = formatBedBugPaymentText(month);
    if (payment) {
      drawCentered(page, payment, {
        x,
        y: payY,
        w: calendar.cellW,
        size: paymentFontSize(payment),
        font,
      });
    }
  });
}

function overlayPricing(page, values, font, fields) {
  for (const [key, rect] of Object.entries(fields)) {
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
 * Build Bed Bug agreement from the professional template artwork + manual overlays only.
 * Schedule data comes from generateAgreementSchedule — no AcroForm field fills.
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
  const { width: pageW, height: pageH } = page.getSize();
  console.log('[bed-bug-pdf] template page size:', { width: pageW, height: pageH });

  const layout = buildLayout(pageW, pageH);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  wipeTemplateSampleData(page, layout.WIPE_REGIONS);

  const initVal = parseMoney(pricing.initial);
  const discVal = parseMoney(pricing.discounted);
  const recurVal = parseMoney(pricing.recurring);
  const subtotal = Math.max(0, initVal - discVal);

  const serviceLines = [address.street, address.cityState].filter(Boolean);
  const contactLines = [lead.name, lead.phone, lead.email].filter(Boolean);
  const billingLines = [lead.name, address.street, address.cityState].filter(Boolean);

  drawMultiline(page, serviceLines, { ...layout.FIELDS.service_address, font });
  drawMultiline(page, contactLines, { ...layout.FIELDS.customer_information, font });
  drawMultiline(page, billingLines, { ...layout.FIELDS.billing_info, font });

  const pricingValues = {};
  if (initVal) {
    pricingValues.initial_quote = initVal.toFixed(2);
    pricingValues.initial_subtotal = subtotal.toFixed(2);
    pricingValues.initial_tax = '0.00';
    pricingValues.initial_total = subtotal.toFixed(2);
  }
  if (discVal > 0) pricingValues.initial_discount = `-${discVal.toFixed(2)}`;

  if (recurVal) {
    pricingValues.recurring_charge = recurVal.toFixed(2);
    pricingValues.recurring_tax = '0.00';
    pricingValues.recurring_total = recurVal.toFixed(2);
    pricingValues.payment_recurring_authorized = recurVal.toFixed(2);
    pricingValues.billing_recurring_authorized = recurVal.toFixed(2);
  }
  if (cardLastFour) pricingValues.card_last_four = cardLastFour;

  let schedule = null;
  if (subtotal > 0 || recurVal > 0) {
    schedule = generateAgreementSchedule({
      agreementType: AGREEMENT_TYPE,
      startDate,
      agreementStartDate,
      serviceStartDate,
      initialServiceDate,
      selectedStartDate,
      initialPayment: subtotal,
      recurringPayment: recurVal,
    });
    if (schedule.warning) {
      console.warn(`[bed-bug-pdf] ${schedule.warning}`);
    }
  }

  overlayPricing(page, pricingValues, font, layout.FIELDS);

  if (schedule?.scheduleMonths) {
    overlayCalendar(page, schedule.scheduleMonths, font, fontBold, layout.CALENDAR);
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
    pageSize: { width: pageW, height: pageH },
  };
}

/** Expected dimensions for the professional Bed Bug template (verified via pdf-lib). */
export const BED_BUG_PAGE_SIZE = { ...REFERENCE_PAGE };

/** @internal test helper — expose layout builder for position assertions */
export const BED_BUG_FIELD_LAYOUT = { buildLayout, REFERENCE_PAGE };
