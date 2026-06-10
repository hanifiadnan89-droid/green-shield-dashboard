import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateAgreementSchedule } from './agreementSchedule.js';
import {
  BED_BUG_ADDON_PESTS,
  BED_BUG_AGREEMENT_PERIOD_TEXT,
  BED_BUG_AUTHORIZATION_TEXT,
  BED_BUG_AUTHORIZATION_TITLE,
  BED_BUG_COMPANY,
  BED_BUG_EXPECTATIONS_TEXT,
  BED_BUG_INITIALS_TEXT,
  BED_BUG_MAIN_PESTS,
  BED_BUG_OTHER_INCLUDED_PESTS_A,
  BED_BUG_OTHER_INCLUDED_PESTS_B,
  BED_BUG_OTHER_INCLUDED_PESTS_C,
  BED_BUG_SERVICE_FREQUENCY,
  BED_BUG_SERVICE_TYPE,
  BED_BUG_TITLE,
} from './bedBugAgreementContent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AGREEMENT_TYPE = 'bed_bug_insect_triannual';

/** Landscape letter: 11in × 8.5in */
export const BED_BUG_PAGE_SIZE = { width: 792, height: 612 };

const PAGE_W = BED_BUG_PAGE_SIZE.width;
const PAGE_H = BED_BUG_PAGE_SIZE.height;
const MARGIN_X = 18;
const MARGIN_Y = 12;
const GAP = 6;
const SECTION_PAD = 10;
const HEADER_BAR_H = 14;
const LABEL_SIZE = 7;
const VALUE_SIZE = 7.5;
const LABEL_VALUE_GAP = 6;
const FIELD_SPACING = 8;

/** Reference spacing from signature/date fields (label → value gap ≈ 10). */
const SPACING_SIGNATURE = { gap: 10, fieldSpacing: 10, valueSize: 7.5 };
/** Same label/value gap as Customer Information; tighter block spacing for four fields. */
const SPACING_ADDRESS = { gap: 10, fieldSpacing: 2, valueSize: 7 };

/** Green Shield section header bar (#148A43). */
const HEADER_GREEN = rgb(20 / 255, 138 / 255, 67 / 255);

const LOGO_CANDIDATE_PATHS = [
  join(__dirname, '..', 'assets', 'green-shield-logo.png'),
  join(__dirname, '..', '..', 'assets', 'logos', 'green-shield-logo.png'),
];

const COLORS = {
  headerBg: HEADER_GREEN,
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
/**
 * Split a combined "City, ST 04072" string into parts for PDF layout.
 */
export function parseCityStateZip(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { city: '', state: '', zip: '' };

  const commaMatch = raw.match(/^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (commaMatch) {
    return {
      city: commaMatch[1].trim(),
      state: commaMatch[2].toUpperCase(),
      zip: commaMatch[3],
    };
  }

  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const city = parts[0];
    const rest = parts.slice(1).join(', ');
    const stateZip = rest.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (stateZip) {
      return { city, state: stateZip[1].toUpperCase(), zip: stateZip[2] };
    }
    return { city, state: rest, zip: '' };
  }

  return { city: raw, state: '', zip: '' };
}

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
  const hasSeparateLocation = ['city', 'state', 'zip'].some((key) => {
    const val = bedBugAgreement[key];
    return val !== undefined && val !== null && String(val).trim() !== '';
  });
  const fallbackLocation = hasSeparateLocation
    ? { city: '', state: '', zip: '' }
    : parseCityStateZip(bedBugAgreement.cityStateZip ?? address.cityState ?? '');

  const city = bedBugAgreement.city ?? fallbackLocation.city;
  const state = bedBugAgreement.state ?? fallbackLocation.state;
  const zip = bedBugAgreement.zip ?? fallbackLocation.zip;
  const street = bedBugAgreement.serviceAddress
    ?? bedBugAgreement.address
    ?? address.street
    ?? '';

  return {
    customerName: bedBugAgreement.customerName ?? lead.name ?? '',
    phone: bedBugAgreement.phone ?? lead.phone ?? '',
    email: bedBugAgreement.email ?? lead.email ?? '',
    serviceAddress: street,
    address: street,
    city,
    state,
    zip,
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

function drawSectionHeader(page, text, { x, y, w, h = HEADER_BAR_H, font }) {
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

/**
 * Draw a label with the value clearly below it. Returns the next y position for stacking.
 */
function drawStackedField(page, {
  x,
  y,
  label,
  value,
  width,
  labelSize = LABEL_SIZE,
  valueSize = VALUE_SIZE,
  gap = LABEL_VALUE_GAP,
  fieldSpacing = FIELD_SPACING,
  labelColor = COLORS.muted,
  valueColor = COLORS.text,
  font,
  boldFont,
}) {
  const valueFont = boldFont ?? font;
  page.drawText(String(label), { x, y, size: labelSize, font, color: labelColor });
  const valueY = y - gap;
  const text = String(value ?? '').trim();
  if (text) {
    const clipped = truncateText(text, valueFont, valueSize, width - 2);
    page.drawText(clipped, { x, y: valueY, size: valueSize, font: valueFont, color: valueColor });
  }
  return valueY - valueSize - fieldSpacing;
}

function drawStackedFields(page, {
  x,
  y,
  width,
  fields,
  font,
  boldFont,
  gap = LABEL_VALUE_GAP,
  fieldSpacing = FIELD_SPACING,
  valueSize = VALUE_SIZE,
}) {
  let fieldY = y;
  for (const field of fields) {
    fieldY = drawStackedField(page, {
      x,
      y: fieldY,
      label: field.label,
      value: field.value,
      width,
      gap: field.gap ?? gap,
      fieldSpacing: field.fieldSpacing ?? fieldSpacing,
      valueSize: field.valueSize ?? valueSize,
      font,
      boldFont,
    });
  }
  return fieldY;
}

function drawTwoColumnAddressBlock(page, {
  x,
  y,
  width,
  leftFields,
  rightFields,
  font,
  boldFont,
  columnGap = 8,
  spacing = SPACING_SIGNATURE,
}) {
  const colW = (width - columnGap) / 2;
  const leftX = x;
  const rightX = x + colW + columnGap;
  const leftEnd = drawStackedFields(page, {
    x: leftX,
    y,
    width: colW,
    fields: leftFields,
    font,
    boldFont,
    ...spacing,
  });
  const rightEnd = drawStackedFields(page, {
    x: rightX,
    y,
    width: colW,
    fields: rightFields,
    font,
    boldFont,
    ...spacing,
  });
  return Math.min(leftEnd, rightEnd);
}

function drawChecklistGroup(page, {
  x,
  y,
  width,
  title,
  items,
  itemGap = 8.5,
  font,
  boldFont,
  isChecked = () => true,
}) {
  const titleSize = 6.5;
  page.drawText(title, { x, y, size: titleSize, font: boldFont, color: COLORS.text });
  const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
  page.drawLine({
    start: { x, y: y - 1.5 },
    end: { x: x + titleWidth, y: y - 1.5 },
    thickness: 0.5,
    color: COLORS.text,
  });
  let itemY = y - 11;
  for (const item of items) {
    drawCheckItem(page, item, {
      x,
      y: itemY,
      font: boldFont,
      checked: isChecked(item),
      labelSize: 6.5,
      maxWidth: width - 10,
    });
    itemY -= itemGap;
  }
  return itemY;
}

function drawPriceRows(page, {
  x,
  y,
  width,
  rows,
  rowHeight = 14,
  labelSize = VALUE_SIZE,
  valueSize = VALUE_SIZE,
  font,
  boldFont,
}) {
  let rowY = y;
  for (const row of rows) {
    const isTotal = /total|authorized/i.test(row.label);
    const rowFont = isTotal ? boldFont : font;
    page.drawText(String(row.label), {
      x,
      y: rowY,
      size: labelSize,
      font,
      color: COLORS.muted,
    });
    const value = String(row.value ?? '').trim();
    if (value) {
      const clipped = truncateText(value, rowFont, valueSize, width * 0.45);
      const valueWidth = rowFont.widthOfTextAtSize(clipped, valueSize);
      page.drawText(clipped, {
        x: x + width - valueWidth,
        y: rowY,
        size: valueSize,
        font: rowFont,
        color: COLORS.text,
      });
    }
    rowY -= rowHeight;
  }
  return rowY;
}

function drawSignatureField(page, {
  x,
  y,
  label,
  value,
  width,
  font,
  boldFont,
}) {
  page.drawText(String(label), { x, y, size: LABEL_SIZE, font, color: COLORS.muted });
  const valueY = y - 10;
  const text = String(value ?? '').trim();
  if (text) {
    const clipped = truncateText(text, boldFont ?? font, VALUE_SIZE, width - 4);
    page.drawText(clipped, { x, y: valueY, size: VALUE_SIZE, font: boldFont ?? font, color: COLORS.text });
  }
  const lineY = valueY - 6;
  page.drawLine({
    start: { x, y: lineY },
    end: { x: x + width, y: lineY },
    thickness: 0.5,
    color: COLORS.border,
  });
  return lineY - 4;
}

function drawValue(page, value, { x, y, w, font, size = VALUE_SIZE, align = 'left' }) {
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

function drawCheckItem(page, label, { x, y, font, checked = true, labelSize = 6.5, maxWidth }) {
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
  const labelText = maxWidth
    ? truncateText(label, font, labelSize, maxWidth - box - 4)
    : String(label);
  page.drawText(labelText, { x: x + box + 4, y: y + 0.5, size: labelSize, font, color: COLORS.text });
}

function detectImageKind(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  return null;
}

function drawShieldLogoFallback(page, x, y, size, fontBold) {
  const cx = x + size / 2;
  const top = y + size;
  page.drawRectangle({ x: cx - size * 0.34, y: y + size * 0.12, width: size * 0.68, height: size * 0.72, color: COLORS.accent, borderWidth: 0 });
  page.drawLine({ start: { x: cx - size * 0.34, y: top - size * 0.12 }, end: { x: cx, y: y }, thickness: 1.2, color: COLORS.accent });
  page.drawLine({ start: { x: cx + size * 0.34, y: top - size * 0.12 }, end: { x: cx, y: y }, thickness: 1.2, color: COLORS.accent });
  page.drawText('GS', {
    x: cx - size * 0.14,
    y: y + size * 0.28,
    size: size * 0.28,
    font: fontBold,
    color: COLORS.white,
  });
}

async function drawCompanyLogo(pdfDoc, page, { x, y, maxWidth, maxHeight, fontBold }) {
  for (const logoPath of LOGO_CANDIDATE_PATHS) {
    if (!existsSync(logoPath)) continue;
    try {
      const bytes = readFileSync(logoPath);
      const kind = detectImageKind(bytes);
      const image = kind === 'jpg'
        ? await pdfDoc.embedJpg(bytes)
        : kind === 'png'
          ? await pdfDoc.embedPng(bytes)
          : null;
      if (!image) continue;

      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const drawX = x;
      const drawY = y + (maxHeight - drawH) / 2;
      page.drawImage(image, { x: drawX, y: drawY, width: drawW, height: drawH });
      return true;
    } catch (err) {
      console.warn('[bed-bug-pdf] logo embed failed:', logoPath, err.message);
    }
  }
  drawShieldLogoFallback(page, x, y, Math.min(maxWidth, maxHeight), fontBold);
  return false;
}

async function drawHeader(pdfDoc, page, fonts) {
  const top = MARGIN_Y;
  const h = 50;
  const y = yFromTop(top, h);

  await drawCompanyLogo(pdfDoc, page, {
    x: MARGIN_X,
    y,
    maxWidth: 118,
    maxHeight: h - 4,
    fontBold: fonts.bold,
  });

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
    ry -= 9.5;
  }
}

function drawTopRow(page, data, fonts) {
  const top = MARGIN_Y + 50 + GAP;
  const h = 128;
  const colW = (PAGE_W - MARGIN_X * 2 - GAP * 2) / 3;
  const boxes = [
    {
      title: 'Service Address',
      fields: [
        { label: 'Address', value: data.serviceAddress },
        { label: 'City', value: data.city },
        { label: 'State', value: data.state },
        { label: 'Zip', value: data.zip },
      ],
      spacing: SPACING_ADDRESS,
    },
    {
      title: 'Customer Information',
      fields: [
        { label: 'Customer Name', value: data.customerName },
        { label: 'Phone', value: data.phone },
        { label: 'Email', value: data.email, valueSize: 7.5 },
      ],
      spacing: SPACING_SIGNATURE,
    },
    {
      title: 'Service Details',
      fields: [
        { label: 'Service Type', value: data.serviceType },
        { label: 'Frequency', value: data.frequency },
      ],
      spacing: { ...SPACING_SIGNATURE, fieldSpacing: 12 },
    },
  ];

  boxes.forEach((box, i) => {
    const x = MARGIN_X + i * (colW + GAP);
    const y = yFromTop(top, h);
    const innerW = colW - SECTION_PAD * 2;
    drawRoundedSection(page, { x, y, w: colW, h });
    drawSectionHeader(page, box.title, { x, y: y + h - HEADER_BAR_H, w: colW, font: fonts.bold });
    const fieldY = y + h - HEADER_BAR_H - SECTION_PAD - LABEL_SIZE;
    drawStackedFields(page, {
      x: x + SECTION_PAD,
      y: fieldY,
      width: innerW,
      fields: box.fields,
      font: fonts.regular,
      boldFont: fonts.regular,
      ...box.spacing,
    });
  });
}

function drawPestsSection(page, data, fonts) {
  const top = MARGIN_Y + 50 + GAP + 128 + GAP;
  const h = 68;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawRoundedSection(page, { x, y, w, h });
  drawSectionHeader(page, 'Included Pests & Add-ons', { x, y: y + h - HEADER_BAR_H, w, font: fonts.bold });

  const innerX = x + SECTION_PAD;
  const innerW = w - SECTION_PAD * 2;
  const groupTopY = y + h - HEADER_BAR_H - SECTION_PAD - 4;
  const colGap = 4;
  const col1W = innerW * 0.16;
  const col2W = innerW * 0.24;
  const col3W = innerW * 0.24;
  const col4W = innerW * 0.22;
  const col5W = innerW * 0.14;
  const col5X = innerX + innerW - col5W;
  const col4X = col5X - colGap - col4W;
  const col3X = col4X - colGap - col3W;
  const col2X = col3X - colGap - col2W;

  const selected = new Set((data.selectedAddOns || []).map((s) => String(s).toLowerCase()));
  const isAddonChecked = (pest) => selected.size > 0 && (
    selected.has(pest.toLowerCase()) || selected.has(pest.split('/')[0].toLowerCase())
  );

  const groups = [
    { x: innerX, width: col1W, title: 'Main pests', items: BED_BUG_MAIN_PESTS, itemGap: 9 },
    { x: col2X, width: col2W, title: 'Other included', items: BED_BUG_OTHER_INCLUDED_PESTS_A, itemGap: 6.5 },
    { x: col3X, width: col3W, title: 'Other included', items: BED_BUG_OTHER_INCLUDED_PESTS_B, itemGap: 6.5 },
    { x: col4X, width: col4W, title: 'Other included', items: BED_BUG_OTHER_INCLUDED_PESTS_C, itemGap: 6.5 },
    { x: col5X, width: col5W, title: 'Add-ons', items: BED_BUG_ADDON_PESTS, itemGap: 7, isAddon: true },
  ];

  for (const group of groups) {
    drawChecklistGroup(page, {
      x: group.x,
      y: groupTopY,
      width: group.width,
      title: group.title,
      items: group.items,
      itemGap: group.itemGap,
      font: fonts.regular,
      boldFont: fonts.bold,
      isChecked: group.isAddon ? isAddonChecked : () => true,
    });
  }
}

function drawMiddleRow(page, data, schedule, fonts) {
  const top = MARGIN_Y + 50 + GAP + 128 + GAP + 68 + GAP;
  const h = 100;
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

function drawBillingGridBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_SIGNATURE }) {
  const colW = (width - 10) / 2;
  const leftX = x;
  const rightX = x + colW + 10;

  const row1LeftEnd = drawStackedField(page, {
    x: leftX,
    y,
    label: 'Customer Name',
    value: data.customerName,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
  const row1RightEnd = drawStackedField(page, {
    x: rightX,
    y,
    label: 'City',
    value: data.city,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });

  const row2Y = Math.min(row1LeftEnd, row1RightEnd) - 4;
  drawStackedField(page, {
    x: leftX,
    y: row2Y,
    label: 'Address',
    value: data.serviceAddress,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
  drawStackedField(page, {
    x: rightX,
    y: row2Y,
    label: 'State',
    value: data.state,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
}

function drawPricingRow(page, data, fonts) {
  const top = MARGIN_Y + 50 + GAP + 128 + GAP + 68 + GAP + 100 + GAP;
  const h = 76;
  const colW = (PAGE_W - MARGIN_X * 2 - GAP * 2) / 3;
  const boxes = [
    {
      title: 'Initial Service / Warranties',
      rows: [
        { label: 'Initial Quote', value: formatCurrency(data.initialQuote) },
        { label: 'Initial Discount', value: data.initialDiscount ? `-${formatCurrency(data.initialDiscount).replace('$', '')}` : '' },
        { label: 'Sub Total', value: formatCurrency(data.initialSubtotal) },
        { label: 'Tax (0%)', value: formatCurrency(data.tax) },
        { label: 'Initial Total', value: formatCurrency(data.initialTotal) },
      ],
    },
    {
      title: 'Recurring Services',
      rows: [
        { label: 'Service Charge', value: formatCurrency(data.recurringCharge) },
        { label: 'Tax (0%)', value: formatCurrency(data.recurringTax) },
        { label: 'Recurring Total', value: formatCurrency(data.recurringTotal) },
        { label: 'Recurring Payment Authorized', value: formatCurrency(data.recurringPaymentAuthorized) },
      ],
    },
    {
      title: 'Billing & Payment',
      billing: true,
    },
  ];

  boxes.forEach((box, i) => {
    const x = MARGIN_X + i * (colW + GAP);
    const y = yFromTop(top, h);
    const innerW = colW - SECTION_PAD * 2;
    drawRoundedSection(page, { x, y, w: colW, h });
    drawSectionHeader(page, box.title, { x, y: y + h - HEADER_BAR_H, w: colW, font: fonts.bold });

    if (box.billing) {
      drawBillingGridBlock(page, {
        x: x + SECTION_PAD,
        y: y + h - HEADER_BAR_H - SECTION_PAD - LABEL_SIZE,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.regular,
        spacing: SPACING_SIGNATURE,
      });
    } else {
      drawPriceRows(page, {
        x: x + SECTION_PAD,
        y: y + h - HEADER_BAR_H - SECTION_PAD - VALUE_SIZE,
        width: innerW,
        rows: box.rows,
        rowHeight: 14,
        font: fonts.regular,
        boldFont: fonts.bold,
      });
    }
  });
}

function drawAuthorizationSection(page, fonts) {
  const top = MARGIN_Y + 50 + GAP + 128 + GAP + 68 + GAP + 100 + GAP + 76 + GAP;
  const h = 74;
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
  const top = MARGIN_Y + 50 + GAP + 128 + GAP + 68 + GAP + 100 + GAP + 76 + GAP + 74 + GAP;
  const h = 56;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawRoundedSection(page, { x, y, w, h });

  page.drawText(BED_BUG_AGREEMENT_PERIOD_TEXT, {
    x: x + SECTION_PAD,
    y: y + h - SECTION_PAD - 2,
    size: 7,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  drawWrappedText(page, BED_BUG_INITIALS_TEXT, {
    x: x + SECTION_PAD,
    y: y + h - SECTION_PAD - 12,
    w: w - SECTION_PAD * 2,
    font: fonts.regular,
    size: 5.4,
    lineHeight: 6,
  });

  const fieldW = (w - SECTION_PAD * 2 - 24) / 3;
  const sigTopY = y + 20;
  const fields = [
    { label: 'Customer Initials', value: data.customerInitials },
    { label: 'Customer Signature', value: data.customerSignatureName },
    { label: 'Date', value: data.agreementDateDisplay ? String(data.agreementDateDisplay) : '' },
  ];
  fields.forEach((field, index) => {
    drawSignatureField(page, {
      x: x + SECTION_PAD + index * (fieldW + 12),
      y: sigTopY,
      label: field.label,
      value: field.value,
      width: fieldW,
      font: fonts.regular,
      boldFont: fonts.regular,
    });
  });
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
  const fonts = { regular: font, bold: fontBold };

  await drawHeader(pdfDoc, page, fonts);
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
