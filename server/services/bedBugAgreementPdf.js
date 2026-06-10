import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateAgreementSchedule } from './agreementSchedule.js';
import {
  BED_BUG_ADDON_PESTS,
  BED_BUG_AGREEMENT_PERIOD_TEXT,
  BED_BUG_AUTHORIZATION_TEXT,
  BED_BUG_AUTHORIZATION_TITLE,
  BED_BUG_COMPANY,
  BED_BUG_EXPECTATIONS_TEXT,
  BED_BUG_INCLUDED_PESTS,
  BED_BUG_INITIALS_TEXT,
  BED_BUG_SERVICE_FREQUENCY,
  BED_BUG_SERVICE_TYPE,
  BED_BUG_TITLE,
} from './bedBugAgreementContent.js';

const AGREEMENT_TYPE = 'bed_bug_insect_triannual';

/** Landscape letter: 11in × 8.5in */
export const BED_BUG_PAGE_SIZE = { width: 792, height: 612 };

const PAGE_W = BED_BUG_PAGE_SIZE.width;
const PAGE_H = BED_BUG_PAGE_SIZE.height;
const MARGIN_X = 18;
const MARGIN_Y = 12;
const GAP = 6;

const COLORS = {
  headerBg: rgb(15 / 255, 42 / 255, 20 / 255),
  accent: rgb(22 / 255, 163 / 255, 74 / 255),
  border: rgb(220 / 255, 231 / 255, 219 / 255),
  text: rgb(15 / 255, 23 / 255, 42 / 255),
  muted: rgb(100 / 255, 116 / 255, 139 / 255),
  white: rgb(1, 1, 1),
  tileBg: rgb(248 / 255, 251 / 255, 247 / 255),
};

function parseMoney(value) {
  return parseFloat(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0;
}

export function formatCurrency(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `$${n.toFixed(2)}`;
}

/**
 * @param {{
 *   startDate?: string | Date | null,
 *   agreementStartDate?: string | Date | null,
 *   serviceStartDate?: string | Date | null,
 *   initialServiceDate?: string | Date | null,
 *   selectedStartDate?: string | Date | null,
 *   initialTotal?: number,
 *   recurringCharge?: number,
 * }} params
 */
export function buildSubscriptionSchedule(params = {}) {
  return generateAgreementSchedule({
    agreementType: AGREEMENT_TYPE,
    startDate: params.startDate,
    agreementStartDate: params.agreementStartDate,
    serviceStartDate: params.serviceStartDate,
    initialServiceDate: params.initialServiceDate,
    selectedStartDate: params.selectedStartDate,
    initialPayment: params.initialTotal ?? 0,
    recurringPayment: params.recurringCharge ?? 0,
  });
}

/**
 * Format payment text for Bed Bug calendar tiles.
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

/**
 * Normalize legacy + explicit bed bug payloads into one object.
 */
export function normalizeBedBugAgreementData(input = {}) {
  const {
    lead = {},
    pricing = {},
    address = {},
    bedBugAgreement = {},
    cardLastFour = '',
    startDate,
    agreementStartDate,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
  } = input;

  const initialQuote = parseMoney(bedBugAgreement.initialQuote ?? pricing.initial);
  const initialDiscount = parseMoney(bedBugAgreement.initialDiscount ?? pricing.discounted);
  const computedSubtotal = Math.max(0, initialQuote - initialDiscount);
  const initialSubtotal = bedBugAgreement.initialSubtotal != null
    ? parseMoney(bedBugAgreement.initialSubtotal)
    : computedSubtotal;
  const tax = parseMoney(bedBugAgreement.tax ?? 0);
  const initialTotal = bedBugAgreement.initialTotal != null
    ? parseMoney(bedBugAgreement.initialTotal)
    : initialSubtotal + tax;
  const recurringCharge = parseMoney(bedBugAgreement.recurringCharge ?? pricing.recurring);
  const recurringTax = parseMoney(bedBugAgreement.recurringTax ?? 0);
  const recurringTotal = bedBugAgreement.recurringTotal != null
    ? parseMoney(bedBugAgreement.recurringTotal)
    : recurringCharge + recurringTax;
  const recurringPaymentAuthorized = bedBugAgreement.recurringPaymentAuthorized != null
    ? parseMoney(bedBugAgreement.recurringPaymentAuthorized)
    : recurringTotal;

  const resolvedStart = agreementStartDate || startDate || bedBugAgreement.agreementDate || '';

  return {
    customerName: bedBugAgreement.customerName ?? lead.name ?? '',
    phone: bedBugAgreement.phone ?? lead.phone ?? '',
    email: bedBugAgreement.email ?? lead.email ?? '',
    serviceAddress: bedBugAgreement.serviceAddress ?? address.street ?? '',
    cityStateZip: bedBugAgreement.cityStateZip ?? address.cityState ?? '',
    serviceType: bedBugAgreement.serviceType ?? BED_BUG_SERVICE_TYPE,
    frequency: bedBugAgreement.frequency ?? BED_BUG_SERVICE_FREQUENCY,
    startMonth: bedBugAgreement.startMonth ?? '',
    startYear: bedBugAgreement.startYear ?? '',
    agreementDate: bedBugAgreement.agreementDate ?? resolvedStart,
    initialQuote,
    initialDiscount,
    initialSubtotal,
    tax,
    initialTotal,
    recurringCharge,
    recurringTax,
    recurringTotal,
    recurringPaymentAuthorized,
    billingInfo: bedBugAgreement.billingInfo ?? lead.name ?? '',
    paymentMethod: bedBugAgreement.paymentMethod ?? '',
    cardLastFour: bedBugAgreement.cardLastFour ?? cardLastFour ?? '',
    customerInitials: bedBugAgreement.customerInitials ?? '',
    customerSignatureName: bedBugAgreement.customerSignatureName ?? lead.name ?? '',
    agreementDateDisplay: bedBugAgreement.agreementDate ?? resolvedStart,
    selectedAddOns: bedBugAgreement.selectedAddOns ?? [],
    serviceMonths: bedBugAgreement.serviceMonths ?? [],
    startDate: resolvedStart,
    agreementStartDate: agreementStartDate ?? resolvedStart,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
  };
}

/**
 * @param {ReturnType<typeof normalizeBedBugAgreementData>} data
 * @param {{ forEmail?: boolean }} [opts]
 */
export function validateBedBugAgreementData(data, raw = {}, opts = {}) {
  const errors = [];
  const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';

  if (!String(data.customerName || '').trim()) errors.push('Customer name is required');
  if (!String(data.serviceAddress || '').trim()) errors.push('Service address is required');

  const initialQuoteRaw = raw.bedBugAgreement?.initialQuote ?? raw.pricing?.initial;
  const initialTotalRaw = raw.bedBugAgreement?.initialTotal
    ?? (hasValue(initialQuoteRaw) ? null : undefined);
  const recurringRaw = raw.bedBugAgreement?.recurringCharge ?? raw.pricing?.recurring;
  const agreementDateRaw = raw.bedBugAgreement?.agreementDate
    ?? raw.agreementStartDate
    ?? raw.startDate;

  if (!hasValue(initialQuoteRaw)) errors.push('Initial quote is required');
  if (!hasValue(initialTotalRaw) && !hasValue(initialQuoteRaw)) errors.push('Initial total is required');
  if (!hasValue(recurringRaw)) errors.push('Recurring charge is required');
  if (!hasValue(agreementDateRaw)) errors.push('Agreement date is required');
  if (opts.forEmail && !String(data.email || '').trim()) errors.push('Email is required before sending');
  return errors;
}

function yFromTop(yTop, height = 0) {
  return PAGE_H - yTop - height;
}

function truncateText(text, font, size, maxWidth) {
  let value = String(text ?? '');
  while (value.length > 1 && font.widthOfTextAtSize(value, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return value;
}

function drawRoundedSection(page, { x, y, w, h, fill = COLORS.white, border = COLORS.border, borderWidth = 0.75 }) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: border, borderWidth });
}

function drawSectionHeader(page, text, { x, y, w, h, font }) {
  page.drawRectangle({ x, y, width: w, height: h, color: COLORS.headerBg, borderWidth: 0 });
  const size = 7.5;
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + Math.max(6, (w - textWidth) / 2),
    y: y + (h - size) / 2 + 0.5,
    size,
    font,
    color: COLORS.white,
  });
}

function drawLabelLine(page, label, value, { x, y, w, labelFont, valueFont, labelSize = 6.5, valueSize = 8 }) {
  page.drawText(label, { x, y: y + 10, size: labelSize, font: labelFont, color: COLORS.muted });
  drawValue(page, value, { x, y, w, font: valueFont, size: valueSize });
}

function drawValue(page, value, { x, y, w, font, size = 8, align = 'left' }) {
  const text = String(value ?? '').trim();
  if (!text) return;
  const clipped = truncateText(text, font, size, w - 4);
  const textWidth = font.widthOfTextAtSize(clipped, size);
  const drawX = align === 'right' ? x + w - textWidth - 2 : x + 2;
  page.drawText(clipped, { x: drawX, y, size, font, color: COLORS.text });
}

function drawWrappedText(page, text, { x, y, w, font, size = 6.5, lineHeight = 8, color = COLORS.text }) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= w - 4) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  let cy = y;
  for (const line of lines) {
    page.drawText(line, { x: x + 2, y: cy, size, font, color });
    cy -= lineHeight;
  }
  return cy;
}

function drawPaymentTile(page, monthLabel, paymentText, { x, y, w, h, font, fontBold }) {
  page.drawRectangle({ x, y, width: w, height: h, color: COLORS.tileBg, borderColor: COLORS.border, borderWidth: 0.5 });
  const monthSize = 6.5;
  const paySize = paymentText.length > 10 ? 5.5 : 6;
  const monthWidth = fontBold.widthOfTextAtSize(monthLabel, monthSize);
  page.drawText(monthLabel, {
    x: x + (w - monthWidth) / 2,
    y: y + h - monthSize - 3,
    size: monthSize,
    font: fontBold,
    color: COLORS.text,
  });
  if (paymentText) {
    const payWidth = font.widthOfTextAtSize(paymentText, paySize);
    page.drawText(truncateText(paymentText, font, paySize, w - 4), {
      x: x + (w - payWidth) / 2,
      y: y + 3,
      size: paySize,
      font,
      color: COLORS.accent,
    });
  }
}

function drawCheckItem(page, label, { x, y, font, checked = true }) {
  const box = 6;
  page.drawRectangle({
    x,
    y,
    width: box,
    height: box,
    borderColor: COLORS.accent,
    borderWidth: 0.75,
    color: checked ? COLORS.accent : COLORS.white,
  });
  if (checked) {
    page.drawLine({ start: { x: x + 1.2, y: y + 2.8 }, end: { x: x + 2.6, y: y + 1.4 }, thickness: 0.8, color: COLORS.white });
    page.drawLine({ start: { x: x + 2.6, y: y + 1.4 }, end: { x: x + 4.8, y: y + 4.8 }, thickness: 0.8, color: COLORS.white });
  }
  page.drawText(label, { x: x + box + 4, y: y + 0.5, size: 6.5, font, color: COLORS.text });
}

function drawShieldLogo(page, x, y, size) {
  const cx = x + size / 2;
  const top = y + size;
  page.drawRectangle({ x: cx - size * 0.34, y: y + size * 0.12, width: size * 0.68, height: size * 0.72, color: COLORS.accent, borderWidth: 0 });
  page.drawLine({ start: { x: cx - size * 0.34, y: top - size * 0.12 }, end: { x: cx, y: y }, thickness: 1.2, color: COLORS.accent });
  page.drawLine({ start: { x: cx + size * 0.34, y: top - size * 0.12 }, end: { x: cx, y: y }, thickness: 1.2, color: COLORS.accent });
  page.drawText('GS', {
    x: cx - size * 0.14,
    y: y + size * 0.28,
    size: size * 0.28,
    font: page.__logoFont,
    color: COLORS.white,
  });
}

function drawHeader(page, fonts) {
  const top = MARGIN_Y;
  const h = 48;
  const y = yFromTop(top, h);

  drawShieldLogo(page, MARGIN_X, y + 8, 32);

  const titleSize = 11;
  const titleWidth = fonts.bold.widthOfTextAtSize(BED_BUG_TITLE, titleSize);
  page.drawText(BED_BUG_TITLE, {
    x: (PAGE_W - titleWidth) / 2,
    y: y + 18,
    size: titleSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  const rightX = PAGE_W - MARGIN_X - 170;
  const lines = [
    BED_BUG_COMPANY.name,
    BED_BUG_COMPANY.addressLine1,
    BED_BUG_COMPANY.addressLine2,
    `${BED_BUG_COMPANY.phone} | ${BED_BUG_COMPANY.email}`,
    `License #: ${BED_BUG_COMPANY.license}`,
  ];
  let ry = y + h - 8;
  for (const line of lines) {
    page.drawText(line, { x: rightX, y: ry, size: 6.5, font: fonts.regular, color: COLORS.text });
    ry -= 8;
  }
}

function drawTopRow(page, data, fonts) {
  const top = MARGIN_Y + 48 + GAP;
  const h = 58;
  const colW = (PAGE_W - MARGIN_X * 2 - GAP * 2) / 3;
  const boxes = [
    {
      title: 'Service Address',
      lines: [
        ['Address', data.serviceAddress],
        ['City / State / Zip', data.cityStateZip],
      ],
    },
    {
      title: 'Customer Information',
      lines: [
        ['Customer Name', data.customerName],
        ['Phone', data.phone],
        ['Email', data.email],
      ],
    },
    {
      title: 'Service Details',
      lines: [
        ['Service Type', data.serviceType],
        ['Frequency', data.frequency],
      ],
    },
  ];

  boxes.forEach((box, i) => {
    const x = MARGIN_X + i * (colW + GAP);
    const y = yFromTop(top, h);
    drawRoundedSection(page, { x, y, w: colW, h });
    drawSectionHeader(page, box.title, { x, y: y + h - 14, w: colW, h: 14, font: fonts.bold });
    let ly = y + h - 28;
    for (const [label, value] of box.lines) {
      drawLabelLine(page, label, value, { x: x + 6, y: ly, w: colW - 12, labelFont: fonts.regular, valueFont: fonts.regular });
      ly -= 18;
    }
  });
}

function drawPestsSection(page, data, fonts) {
  const top = MARGIN_Y + 48 + GAP + 58 + GAP;
  const h = 68;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawRoundedSection(page, { x, y, w, h });
  drawSectionHeader(page, 'Included Pests & Add-ons', { x, y: y + h - 14, w, h: 14, font: fonts.bold });

  const colW = (w - 24) / 2;
  const selected = new Set((data.selectedAddOns || []).map((s) => String(s).toLowerCase()));
  let leftY = y + h - 28;
  let rightY = y + h - 28;

  page.drawText('Main pests', { x: x + 8, y: leftY + 10, size: 6.5, font: fonts.bold, color: COLORS.muted });
  page.drawText('Add-ons', { x: x + colW + 16, y: rightY + 10, size: 6.5, font: fonts.bold, color: COLORS.muted });
  leftY -= 4;
  rightY -= 4;

  const pestsPerCol = 6;
  BED_BUG_INCLUDED_PESTS.forEach((pest, idx) => {
    const row = idx % pestsPerCol;
    const col = Math.floor(idx / pestsPerCol);
    const px = x + 8 + col * (colW / 2);
    const py = leftY - row * 10;
    drawCheckItem(page, pest, { x: px, y: py, font: fonts.bold, checked: true });
  });

  BED_BUG_ADDON_PESTS.forEach((pest, idx) => {
    const checked = selected.size === 0
      ? false
      : selected.has(pest.toLowerCase()) || selected.has(pest.split('/')[0].toLowerCase());
    drawCheckItem(page, pest, {
      x: x + colW + 16,
      y: rightY - idx * 10,
      font: fonts.bold,
      checked,
    });
  });
}

function drawMiddleRow(page, data, schedule, fonts) {
  const top = MARGIN_Y + 48 + GAP + 58 + GAP + 68 + GAP;
  const h = 124;
  const w = PAGE_W - MARGIN_X * 2;
  const leftW = w * 0.48;
  const rightW = w - leftW - GAP;
  const x = MARGIN_X;
  const y = yFromTop(top, h);

  drawRoundedSection(page, { x, y, w: leftW, h });
  drawSectionHeader(page, 'Expectations / Scheduling', { x, y: y + h - 14, w: leftW, h: 14, font: fonts.bold });
  drawWrappedText(page, BED_BUG_EXPECTATIONS_TEXT, {
    x: x + 4,
    y: y + h - 28,
    w: leftW - 8,
    font: fonts.regular,
    size: 6,
    lineHeight: 7.5,
  });

  const rx = x + leftW + GAP;
  drawRoundedSection(page, { x: rx, y, w: rightW, h });
  drawSectionHeader(page, 'Bed Bug Insect Triannual Subscription', { x: rx, y: y + h - 14, w: rightW, h: 14, font: fonts.bold });

  const tileW = (rightW - 14) / 6;
  const tileH = 22;
  const months = schedule?.scheduleMonths ?? [];
  months.forEach((month, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    drawPaymentTile(page, month.label, formatBedBugPaymentText(month), {
      x: rx + 4 + col * (tileW + 1),
      y: y + h - 30 - (row + 1) * (tileH + 2),
      w: tileW,
      h: tileH,
      font: fonts.regular,
      fontBold: fonts.bold,
    });
  });
}

function drawPricingRow(page, data, fonts) {
  const top = MARGIN_Y + 48 + GAP + 58 + GAP + 68 + GAP + 124 + GAP;
  const h = 72;
  const colW = (PAGE_W - MARGIN_X * 2 - GAP * 2) / 3;
  const boxes = [
    {
      title: 'Initial Service / Warranties',
      rows: [
        ['Initial Quote', formatCurrency(data.initialQuote)],
        ['Initial Discount', data.initialDiscount ? `-${formatCurrency(data.initialDiscount).replace('$', '')}` : ''],
        ['Sub Total', formatCurrency(data.initialSubtotal)],
        ['Tax (0%)', formatCurrency(data.tax)],
        ['Initial Total', formatCurrency(data.initialTotal)],
      ],
    },
    {
      title: 'Recurring Services',
      rows: [
        ['Service Charge', formatCurrency(data.recurringCharge)],
        ['Tax (0%)', formatCurrency(data.recurringTax)],
        ['Recurring Total', formatCurrency(data.recurringTotal)],
        ['Recurring Payment Authorized', formatCurrency(data.recurringPaymentAuthorized)],
      ],
    },
    {
      title: 'Billing & Payment',
      rows: [
        ['Billing Info', data.billingInfo],
        ['Payment Method / Card Last Four', [data.paymentMethod, data.cardLastFour].filter(Boolean).join(' • ')],
        ['Recurring Payment Authorized', formatCurrency(data.recurringPaymentAuthorized)],
      ],
    },
  ];

  boxes.forEach((box, i) => {
    const x = MARGIN_X + i * (colW + GAP);
    const y = yFromTop(top, h);
    drawRoundedSection(page, { x, y, w: colW, h });
    drawSectionHeader(page, box.title, { x, y: y + h - 14, w: colW, h: 14, font: fonts.bold });
    let ly = y + h - 28;
    for (const [label, value] of box.rows) {
      page.drawText(label, { x: x + 6, y: ly + 9, size: 6, font: fonts.regular, color: COLORS.muted });
      drawValue(page, value, { x: x + 6, y: ly, w: colW - 12, font: fonts.regular, size: 7.5 });
      ly -= 13;
    }
  });
}

function drawAuthorizationSection(page, fonts) {
  const top = MARGIN_Y + 48 + GAP + 58 + GAP + 68 + GAP + 124 + GAP + 72 + GAP;
  const h = 88;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawRoundedSection(page, { x, y, w, h });
  drawSectionHeader(page, BED_BUG_AUTHORIZATION_TITLE, { x, y: y + h - 14, w, h: 14, font: fonts.bold });
  drawWrappedText(page, BED_BUG_AUTHORIZATION_TEXT, {
    x: x + 4,
    y: y + h - 28,
    w: w - 8,
    font: fonts.regular,
    size: 5.8,
    lineHeight: 7,
  });
}

function drawSignatureSection(page, data, fonts) {
  const top = MARGIN_Y + 48 + GAP + 58 + GAP + 68 + GAP + 124 + GAP + 72 + GAP + 88 + GAP;
  const h = 58;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawRoundedSection(page, { x, y, w, h });

  page.drawText(BED_BUG_AGREEMENT_PERIOD_TEXT, {
    x: x + 8,
    y: y + h - 14,
    size: 7,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  drawWrappedText(page, BED_BUG_INITIALS_TEXT, {
    x: x + 4,
    y: y + h - 28,
    w: w - 8,
    font: fonts.regular,
    size: 5.8,
    lineHeight: 7,
  });

  const sigY = y + 6;
  const fields = [
    ['Customer Initials:', data.customerInitials],
    ['Customer Signature:', data.customerSignatureName],
    ['Date:', data.agreementDateDisplay ? String(data.agreementDateDisplay) : ''],
  ];
  let fx = x + 8;
  for (const [label, value] of fields) {
    page.drawText(label, { x: fx, y: sigY + 10, size: 6, font: fonts.regular, color: COLORS.muted });
    const lineW = 140;
    page.drawLine({ start: { x: fx, y: sigY + 4 }, end: { x: fx + lineW, y: sigY + 4 }, thickness: 0.5, color: COLORS.border });
    if (value) {
      drawValue(page, value, { x: fx, y: sigY + 6, w: lineW, font: fonts.regular, size: 7.5 });
    }
    fx += lineW + 16;
  }
}

/**
 * Build a clean vector Bed Bug agreement PDF (no raster template background).
 */
export async function buildBedBugAgreementPdf(input = {}) {
  const data = normalizeBedBugAgreementData(input);
  console.log('[bed-bug-pdf] building vector agreement for', data.customerName || '(no name)');

  const schedule = buildSubscriptionSchedule({
    startDate: data.startDate,
    agreementStartDate: data.agreementStartDate,
    serviceStartDate: data.serviceStartDate,
    initialServiceDate: data.initialServiceDate,
    selectedStartDate: data.selectedStartDate,
    initialTotal: data.initialTotal,
    recurringCharge: data.recurringCharge,
  });
  if (schedule.warning) {
    console.warn(`[bed-bug-pdf] ${schedule.warning}`);
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.__logoFont = fontBold;
  const fonts = { regular: font, bold: fontBold };

  drawHeader(page, fonts);
  drawTopRow(page, data, fonts);
  drawPestsSection(page, data, fonts);
  drawMiddleRow(page, data, schedule, fonts);
  drawPricingRow(page, data, fonts);
  drawAuthorizationSection(page, fonts);
  drawSignatureSection(page, data, fonts);

  const outBytes = await pdfDoc.save();
  console.log('[bed-bug-pdf] generated', outBytes.length, 'bytes, schedule months:', schedule.scheduleMonths?.length ?? 0);

  const safeName = (data.customerName || 'Quote')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Quote';

  return {
    outBytes,
    outName: `${safeName}_Bed_Bug.pdf`,
    schedule,
    pageSize: { ...BED_BUG_PAGE_SIZE },
    data,
  };
}

/** @internal test helper */
export const BED_BUG_FIELD_LAYOUT = { PAGE_W, PAGE_H, MARGIN_X, MARGIN_Y };
