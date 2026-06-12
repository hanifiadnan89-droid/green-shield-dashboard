import { PDFDocument, StandardFonts } from 'pdf-lib';
import { generateAgreementSchedule } from './agreementSchedule.js';
import {
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
import {
  AGREEMENT_COLORS as COLORS,
  BODY_TOP_PAD,
  BUBBLE_RADIUS,
  drawBubblePanel,
  drawCompanyLogo,
  drawInvertedBracket,
  drawPaymentTile,
  drawPestChecklistColumn,
  drawPriceRows,
  drawRoundedSection,
  drawSignatureField,
  drawStackedField,
  drawSvgRoundedRect,
  drawTwoColumnAddressBlock,
  drawUnderlinedLabel,
  drawWrappedText,
  HEADER_BAR_H,
  HEADER_GREEN,
  LABEL_SIZE,
  LABEL_TAG_HEIGHT,
  LOGO_GRAY,
  TAG_RED,
  TITLE_BUBBLE_FILL,
  bodyStartY as layoutBodyStartY,
  yFromTop as layoutYFromTop,
} from './pdf/agreementLayout.js';

const AGREEMENT_TYPE = 'bed_bug_insect_triannual';

/** Landscape letter: 11in × 8.5in */
export const BED_BUG_PAGE_SIZE = { width: 792, height: 612 };

const PAGE_W = BED_BUG_PAGE_SIZE.width;
const PAGE_H = BED_BUG_PAGE_SIZE.height;
const MARGIN_X = 18;
const MARGIN_Y = 12;
const GAP = 6;
const SECTION_PAD = 10;
const PEST_LABEL_SIZE = 6.5 * 1.15;
const VALUE_SIZE = 7.5;

/** Body paragraph sizes (+10% from prior values). */
const BODY_TEXT_SIZE_EXPECTATIONS = 6 * 1.1;
const BODY_TEXT_SIZE_AUTHORIZATION = 5.8 * 1.1;
const BODY_TEXT_SIZE_INITIALS = 5.4 * 1.1 * 1.1;

const COVERED_PESTS_SECTION_TITLE = 'Covered Pests and Upgrades';
const BED_BUG_HEADER_CONTACT_EMAIL = 'ahanifi@gshieldpest.com';

const BED_BUG_ADDON_PESTS_DISPLAY = [
  'Mice/Rats',
  'Moles/Voles',
  'Ticks/Mosquitoes',
  'Cockroaches',
];

const COMPANY_INFO_SIZE = 6.5 * 1.1;
const COMPANY_INFO_LEADING = 9.5 * 1.1;
const CALENDAR_MONTH_SIZE = 6.5 * 1.1;
const CALENDAR_PAY_SIZE = 6 * 1.1;
const CALENDAR_PAY_SIZE_LONG = 5.5 * 1.1;
const CALENDAR_TILE_H = 24 * 1.1;
const CALENDAR_TILE_GAP = 2 * 1.1;

const BED_BUG_SERVICE_DETAILS_TEXT =
  'Our bed bug service begins with a thorough inspection to confirm activity, identify affected areas, and determine the level of infestation, followed by a targeted treatment to eliminate active bed bugs and their hiding spots. A follow-up visit is scheduled two weeks after the initial service to ensure effectiveness and address any remaining activity, with continued preventative follow-ups every four months thereafter. In-between visits are available at no extra cost should any new activity arise, ensuring long-term protection and peace of mind.';

/** Reference spacing from signature/date fields (label → value gap ≈ 10). */
const SPACING_SIGNATURE = { gap: 10, fieldSpacing: 10, valueSize: 7.5 };

/** Vertical section heights (landscape one-page layout). */
const LAYOUT_HEADER_H = 50;
const LAYOUT_TOP_ROW_H = 90;
const LAYOUT_PESTS_H = 68;
const LAYOUT_MIDDLE_ROW_H = 122;
const LAYOUT_PRICING_H = 76;
const LAYOUT_AUTH_H = 80;
const LAYOUT_SIGNATURE_H = 62;

const BED_BUG_CALENDAR_TILE_STYLE = {
  monthSize: CALENDAR_MONTH_SIZE,
  paySize: CALENDAR_PAY_SIZE,
  paySizeLong: CALENDAR_PAY_SIZE_LONG,
};

function layoutTop(...segments) {
  return MARGIN_Y + LAYOUT_HEADER_H + segments.reduce((sum, n) => sum + n, 0);
}

function yFromTop(yTop, height = 0) {
  return layoutYFromTop(PAGE_H, yTop, height);
}

function bodyStartY(panelBottom, panelHeight) {
  return layoutBodyStartY(panelBottom, panelHeight, HEADER_BAR_H, BODY_TOP_PAD);
}

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
    logPrefix: '[bed-bug-pdf]',
  });

  const titleSize = 11;
  const titleWidth = fonts.bold.widthOfTextAtSize(BED_BUG_TITLE, titleSize);
  const titlePadX = 12;
  const titlePadY = 6;
  const bubbleW = titleWidth + titlePadX * 2;
  const bubbleH = titleSize + titlePadY * 2;
  const bubbleX = (PAGE_W - bubbleW) / 2;
  const bubbleBottom = y + (h - bubbleH) / 2;
  drawSvgRoundedRect(page, {
    x: bubbleX,
    y: bubbleBottom,
    w: bubbleW,
    h: bubbleH,
    radius: 6,
    fill: TITLE_BUBBLE_FILL,
    border: HEADER_GREEN,
    borderWidth: 0.75,
  });
  page.drawText(BED_BUG_TITLE, {
    x: (PAGE_W - titleWidth) / 2,
    y: bubbleBottom + (bubbleH - titleSize) / 2 + 0.5,
    size: titleSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  const rightX = PAGE_W - MARGIN_X - 170;
  const lines = [
    BED_BUG_COMPANY.name,
    BED_BUG_COMPANY.addressLine1,
    BED_BUG_COMPANY.addressLine2,
    `${BED_BUG_COMPANY.phone} | ${BED_BUG_HEADER_CONTACT_EMAIL}`,
    `License #: ${BED_BUG_COMPANY.license}`,
  ];
  let ry = y + h - 8;
  for (const line of lines) {
    page.drawText(line, { x: rightX, y: ry, size: COMPANY_INFO_SIZE, font: fonts.regular, color: COLORS.text });
    ry -= COMPANY_INFO_LEADING;
  }
}

function drawServiceAddressGridBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_SIGNATURE }) {
  const colW = (width - 10) / 2;
  const leftX = x;
  const rightX = x + colW + 10;

  const row1LeftEnd = drawStackedField(page, {
    x: leftX,
    y,
    label: 'Address:',
    value: data.serviceAddress,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
  const row1RightEnd = drawStackedField(page, {
    x: rightX,
    y,
    label: 'City:',
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
    label: 'State:',
    value: data.state,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
  drawStackedField(page, {
    x: rightX,
    y: row2Y,
    label: 'Zip:',
    value: data.zip,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
}

function drawCustomerGridBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_SIGNATURE }) {
  drawTwoColumnAddressBlock(page, {
    x,
    y,
    width,
    leftFields: [
      { label: 'Customer Name:', value: data.customerName },
      { label: 'Phone:', value: data.phone },
    ],
    rightFields: [
      { label: 'Email:', value: data.email },
    ],
    font,
    boldFont,
    spacing,
  });
}

function drawServiceDetailsBlock(page, { x, y, width, font }) {
  drawWrappedText(page, BED_BUG_SERVICE_DETAILS_TEXT, {
    x,
    y,
    w: width,
    font,
    size: 6.4,
    lineHeight: 7.2,
  });
}

function drawTopRow(page, data, fonts) {
  const top = layoutTop(GAP);
  const h = LAYOUT_TOP_ROW_H;
  const colW = (PAGE_W - MARGIN_X * 2 - GAP * 2) / 3;
  const boxes = [
    { title: 'Service Address', kind: 'address' },
    { title: 'Customer Information', kind: 'customer' },
    { title: 'Service Details', kind: 'service' },
  ];

  boxes.forEach((box, i) => {
    const x = MARGIN_X + i * (colW + GAP);
    const y = yFromTop(top, h);
    const innerW = colW - SECTION_PAD * 2;
    const innerX = x + SECTION_PAD;
    const fieldY = bodyStartY(y, h) - LABEL_SIZE;
    drawBubblePanel(page, { x, y, w: colW, h, title: box.title, font: fonts.bold });
    if (box.kind === 'address') {
      drawServiceAddressGridBlock(page, {
        x: innerX,
        y: fieldY,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.bold,
        spacing: SPACING_SIGNATURE,
      });
    } else if (box.kind === 'customer') {
      drawCustomerGridBlock(page, {
        x: innerX,
        y: fieldY,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.bold,
        spacing: SPACING_SIGNATURE,
      });
    } else {
      drawServiceDetailsBlock(page, {
        x: innerX,
        y: bodyStartY(y, h),
        width: innerW,
        font: fonts.regular,
      });
    }
  });
}

function drawPestsSection(page, data, fonts) {
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP);
  const h = LAYOUT_PESTS_H;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawBubblePanel(page, { x, y, w, h, title: COVERED_PESTS_SECTION_TITLE, font: fonts.bold });

  const innerX = x + SECTION_PAD;
  const innerW = w - SECTION_PAD * 2;
  const groupTopY = bodyStartY(y, h);
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
  const isAddonChecked = (pest) => {
    if (selected.size === 0) return false;
    const lower = pest.toLowerCase();
    if (selected.has(lower)) return true;
    return pest.split('/').some((part) => selected.has(part.toLowerCase().trim()));
  };

  const headingSize = PEST_LABEL_SIZE;
  const headingFont = fonts.bold;
  const itemsStartY = groupTopY - LABEL_TAG_HEIGHT - 5;
  const includedItemGap = 6.5;
  const checkItemHeight = 7;
  const headingBaseline = groupTopY - 2;

  drawUnderlinedLabel(page, {
    x: innerX,
    y: headingBaseline,
    text: 'Main pest',
    size: headingSize,
    font: headingFont,
    color: TAG_RED,
  });

  const cricketsLabel = BED_BUG_OTHER_INCLUDED_PESTS_C[0];
  const cricketsTextX = col4X + 10;
  const cricketsWidth = fonts.bold.widthOfTextAtSize(cricketsLabel, headingSize);
  const bracketLeft = col2X - 10;
  const bracketRight = cricketsTextX + cricketsWidth + 18;

  drawUnderlinedLabel(page, {
    x: col5X,
    y: headingBaseline,
    text: 'Add-ons',
    size: headingSize,
    font: headingFont,
    color: TAG_RED,
  });

  const bracketTop = headingBaseline - 0.5;
  const includedItemCount = BED_BUG_OTHER_INCLUDED_PESTS_A.length;
  const priorBracketBottom = itemsStartY - (includedItemCount - 1) * includedItemGap - checkItemHeight - 3;
  const priorSideHeight = (groupTopY - LABEL_TAG_HEIGHT + 1) - priorBracketBottom;
  const bracketSideDrop = priorSideHeight * 0.05;

  drawInvertedBracket(page, {
    left: bracketLeft,
    top: bracketTop,
    right: bracketRight,
    drop: bracketSideDrop,
  });

  const headerFontSize = 7.5;
  const headerTextWidth = fonts.bold.widthOfTextAtSize(COVERED_PESTS_SECTION_TITLE, headerFontSize);
  const headerTextX = x + Math.max(6, (w - headerTextWidth) / 2);
  const coveredVCenterX = headerTextX
    + fonts.bold.widthOfTextAtSize('Co', headerFontSize)
    + fonts.bold.widthOfTextAtSize('v', headerFontSize) / 2;
  const headerConnectorBottom = y + h - HEADER_BAR_H;
  const headerConnectorGap = 3;
  const headerConnectorTop = headerConnectorBottom - headerConnectorGap;
  page.drawLine({
    start: { x: coveredVCenterX, y: headerConnectorTop },
    end: { x: coveredVCenterX, y: bracketTop },
    thickness: 0.6,
    color: LOGO_GRAY,
  });

  drawPestChecklistColumn(page, {
    x: innerX,
    width: col1W,
    items: BED_BUG_MAIN_PESTS,
    startY: itemsStartY,
    itemGap: 9,
    font: fonts.bold,
  });

  drawPestChecklistColumn(page, {
    x: col2X,
    width: col2W,
    items: BED_BUG_OTHER_INCLUDED_PESTS_A,
    startY: itemsStartY,
    itemGap: includedItemGap,
    font: fonts.bold,
  });
  drawPestChecklistColumn(page, {
    x: col3X,
    width: col3W,
    items: BED_BUG_OTHER_INCLUDED_PESTS_B,
    startY: itemsStartY,
    itemGap: includedItemGap,
    font: fonts.bold,
  });
  drawPestChecklistColumn(page, {
    x: col4X,
    width: col4W,
    items: BED_BUG_OTHER_INCLUDED_PESTS_C,
    startY: itemsStartY,
    itemGap: includedItemGap,
    font: fonts.bold,
  });

  drawPestChecklistColumn(page, {
    x: col5X,
    width: col5W,
    items: BED_BUG_ADDON_PESTS_DISPLAY,
    startY: itemsStartY,
    itemGap: 7,
    font: fonts.bold,
    isChecked: isAddonChecked,
  });
}

function drawMiddleRow(page, data, schedule, fonts) {
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP, LAYOUT_PESTS_H, GAP);
  const h = LAYOUT_MIDDLE_ROW_H;
  const w = PAGE_W - MARGIN_X * 2;
  const leftW = w * 0.48;
  const rightW = w - leftW - GAP;
  const x = MARGIN_X;
  const y = yFromTop(top, h);

  drawBubblePanel(page, { x, y, w: leftW, h, title: 'Expectations / Scheduling', font: fonts.bold });
  drawWrappedText(page, BED_BUG_EXPECTATIONS_TEXT, {
    x: x + 6,
    y: bodyStartY(y, h),
    w: leftW - 12,
    font: fonts.regular,
    size: BODY_TEXT_SIZE_EXPECTATIONS,
    lineHeight: BODY_TEXT_SIZE_EXPECTATIONS * 1.25,
  });

  const rx = x + leftW + GAP;
  drawBubblePanel(page, { x: rx, y, w: rightW, h, title: 'Bed Bug Insect Triannual Subscription', font: fonts.bold });

  const tileW = (rightW - 14) / 6;
  const tileH = CALENDAR_TILE_H;
  const months = schedule?.scheduleMonths ?? [];
  months.forEach((month, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    drawPaymentTile(page, month.label, formatBedBugPaymentText(month), {
      x: rx + 4 + col * (tileW + 1),
      y: bodyStartY(y, h) - 4 - (row + 1) * (tileH + CALENDAR_TILE_GAP),
      w: tileW,
      h: tileH,
      font: fonts.regular,
      fontBold: fonts.bold,
      tileStyle: BED_BUG_CALENDAR_TILE_STYLE,
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
    label: 'Customer Name:',
    value: data.customerName,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
  const row1RightEnd = drawStackedField(page, {
    x: rightX,
    y,
    label: 'City:',
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
    label: 'Address:',
    value: data.serviceAddress,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
  drawStackedField(page, {
    x: rightX,
    y: row2Y,
    label: 'State:',
    value: data.state,
    width: colW,
    font,
    boldFont,
    ...spacing,
  });
}

function drawPricingRow(page, data, fonts) {
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP, LAYOUT_PESTS_H, GAP, LAYOUT_MIDDLE_ROW_H, GAP);
  const h = LAYOUT_PRICING_H;
  const colW = (PAGE_W - MARGIN_X * 2 - GAP * 2) / 3;
  const boxes = [
    {
      title: 'Initial Service',
      rows: [
        { label: 'Initial Quote:', value: formatCurrency(data.initialQuote) },
        { label: 'Initial Discount:', value: data.initialDiscount ? `-${formatCurrency(data.initialDiscount).replace('$', '')}` : '' },
        { label: 'Sub Total:', value: formatCurrency(data.initialSubtotal) },
      ],
    },
    {
      title: 'Recurring Services',
      rows: [
        { label: 'Service Charge:', value: formatCurrency(data.recurringCharge) },
        { label: 'Tax (0%):', value: formatCurrency(data.recurringTax) },
        { label: 'Recurring Total:', value: formatCurrency(data.recurringTotal) },
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
    drawBubblePanel(page, { x, y, w: colW, h, title: box.title, font: fonts.bold });

    if (box.billing) {
      drawBillingGridBlock(page, {
        x: x + SECTION_PAD,
        y: bodyStartY(y, h) - LABEL_SIZE,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.bold,
        spacing: SPACING_SIGNATURE,
      });
    } else {
      drawPriceRows(page, {
        x: x + SECTION_PAD,
        y: bodyStartY(y, h) - VALUE_SIZE,
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
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP, LAYOUT_PESTS_H, GAP, LAYOUT_MIDDLE_ROW_H, GAP, LAYOUT_PRICING_H, GAP);
  const h = LAYOUT_AUTH_H;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawBubblePanel(page, { x, y, w, h, title: BED_BUG_AUTHORIZATION_TITLE, font: fonts.bold });
  drawWrappedText(page, BED_BUG_AUTHORIZATION_TEXT, {
    x: x + 6,
    y: bodyStartY(y, h),
    w: w - 12,
    font: fonts.regular,
    size: BODY_TEXT_SIZE_AUTHORIZATION,
    lineHeight: BODY_TEXT_SIZE_AUTHORIZATION * 1.21,
  });
}

function drawSignatureSection(page, data, fonts) {
  const top = layoutTop(
    GAP,
    LAYOUT_TOP_ROW_H,
    GAP,
    LAYOUT_PESTS_H,
    GAP,
    LAYOUT_MIDDLE_ROW_H,
    GAP,
    LAYOUT_PRICING_H,
    GAP,
    LAYOUT_AUTH_H,
    GAP,
  );
  const h = LAYOUT_SIGNATURE_H;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawRoundedSection(page, { x, y, w, h });

  const periodSize = LABEL_SIZE;
  const periodWidth = fonts.bold.widthOfTextAtSize(BED_BUG_AGREEMENT_PERIOD_TEXT, periodSize);
  const periodX = x + (w - periodWidth) / 2;
  const periodY = y + h - SECTION_PAD - 2;
  drawUnderlinedLabel(page, {
    x: periodX,
    y: periodY,
    text: BED_BUG_AGREEMENT_PERIOD_TEXT,
    size: periodSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  drawWrappedText(page, BED_BUG_INITIALS_TEXT, {
    x: x + SECTION_PAD,
    y: y + h - SECTION_PAD - 14,
    w: w - SECTION_PAD * 2,
    font: fonts.regular,
    size: BODY_TEXT_SIZE_INITIALS,
    lineHeight: BODY_TEXT_SIZE_INITIALS * 1.11,
  });

  const fieldGap = 16;
  const fieldW = (w - SECTION_PAD * 2 - fieldGap * 2) / 3;
  const sigTopY = y + 17;
  const fields = [
    { label: 'Customer Initials:', value: data.customerInitials },
    { label: 'Customer Signature:', value: data.customerSignatureName },
    { label: 'Date:', value: data.agreementDateDisplay ? String(data.agreementDateDisplay) : '' },
  ];
  fields.forEach((field, index) => {
    drawSignatureField(page, {
      x: x + SECTION_PAD + index * (fieldW + fieldGap),
      y: sigTopY,
      label: field.label,
      value: field.value,
      width: fieldW,
      font: fonts.regular,
      boldFont: fonts.bold,
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
