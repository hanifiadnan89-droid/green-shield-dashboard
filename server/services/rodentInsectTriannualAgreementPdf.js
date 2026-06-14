import { PDFDocument, StandardFonts } from 'pdf-lib';
import { generateAgreementSchedule } from './agreementSchedule.js';
import {
  formatCurrency,
  parseCityStateZip,
} from './bedBugAgreementPdf.js';
import {
  RIT_AGREEMENT_PERIOD_TEXT,
  RIT_AUTHORIZATION_TEXT,
  RIT_AUTHORIZATION_TITLE,
  RIT_COMPANY,
  RIT_ADDON_PESTS,
  RIT_COVERED_PESTS_SECTION_TITLE,
  RIT_EXPECTATIONS_LEFT,
  RIT_EXPECTATIONS_RIGHT,
  RIT_HEADER_CONTACT_EMAIL,
  RIT_INCLUDED_PESTS_COL_A,
  RIT_INCLUDED_PESTS_COL_B,
  RIT_INCLUDED_PESTS_COL_C,
  RIT_INCLUDED_PESTS_COL_D,
  RIT_INITIALS_TEXT,
  RIT_RED_RODENT_PESTS,
  RIT_SERVICE_DETAILS_TEXT,
  RIT_SUBSCRIPTION_TITLE,
  RIT_TITLE,
} from './rodentInsectTriannualAgreementContent.js';
import {
  AGREEMENT_COLORS as COLORS,
  BODY_TOP_PAD,
  drawBubblePanel,
  drawCompanyLogo,
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
  TAG_RED,
  TITLE_BUBBLE_FILL,
  bodyStartY as layoutBodyStartY,
  yFromTop as layoutYFromTop,
} from './pdf/agreementLayout.js';

const RIT_RED_RODENT_PEST_SET = new Set(RIT_RED_RODENT_PESTS);

const AGREEMENT_TYPE = 'rodent_insect_triannual';


/** Landscape letter: 11in × 8.5in — same as Bed Bug / IQ. */
export const RIT_PAGE_SIZE = { width: 792, height: 612 };

const PAGE_W = RIT_PAGE_SIZE.width;
const PAGE_H = RIT_PAGE_SIZE.height;
const MARGIN_X = 18;
const MARGIN_Y = 12;
const GAP = 6;
const SECTION_PAD = 10;
const PEST_LABEL_SIZE = 6.5 * 1.15;
const VALUE_SIZE = 7.5;

const BODY_TEXT_SIZE_EXPECTATIONS = 6 * 1.1 * 1.1;
const BODY_TEXT_SIZE_AUTHORIZATION = 5.8 * 1.1 * 1.1;
const BODY_TEXT_SIZE_INITIALS = 5.4 * 1.1 * 1.1 * 1.1;
const COMPANY_INFO_SIZE = 6.5 * 1.1 * 1.1;
const COMPANY_INFO_LEADING = 8.2;
const CALENDAR_MONTH_SIZE = 6.5 * 1.1 * 1.1;
const CALENDAR_PAY_SIZE = 6 * 1.1 * 1.1;
const CALENDAR_PAY_SIZE_LONG = 5.5 * 1.1 * 1.1;
const CALENDAR_TILE_H = 24 * 1.1 * 1.1;
const CALENDAR_TILE_GAP = 2 * 1.1 * 1.1;
const CALENDAR_PANEL_PAD = 2;

const SPACING_SIGNATURE = { gap: 10, fieldSpacing: 10, valueSize: 7.5 };

const LAYOUT_HEADER_H = 50;
const LAYOUT_TOP_ROW_H = 90;
const LAYOUT_PESTS_H = 68;
const LAYOUT_MIDDLE_ROW_H = 122;
const LAYOUT_PRICING_H = 76;
const LAYOUT_AUTH_H = 80;
const LAYOUT_SIGNATURE_H = 62;

const RIT_CALENDAR_TILE_STYLE = {
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

/**
 * Format payment text for RIT calendar tiles (red (S) on service months).
 */
export function formatRodentInsectTriannualPaymentText(month) {
  if (!month?.paymentText) return '';
  const text = month.paymentText;
  if (!month.isServiceMonth || text.includes('(S)')) return text;
  if (month.isInitialMonth) return `(S)${text}`;
  return `(S)${text.replace(/^\$/, '')}`;
}

export function buildRodentInsectTriannualSchedule(params = {}) {
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

export function normalizeRodentInsectTriannualAgreementData(input = {}) {
  const {
    lead = {},
    pricing = {},
    address = {},
    startDate,
    agreementStartDate,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
  } = input;

  const initialQuote = parseMoney(pricing.initial);
  const initialDiscount = parseMoney(pricing.discounted);
  const initialSubtotal = Math.max(0, initialQuote - initialDiscount);
  const recurringCharge = parseMoney(pricing.recurring);
  const recurringTax = 0;
  const recurringTotal = recurringCharge + recurringTax;

  const resolvedStart = agreementStartDate || startDate || '';
  const fallbackLocation = parseCityStateZip(address.cityState ?? '');

  return {
    customerName: lead.name ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    serviceAddress: address.street ?? '',
    city: address.city ?? fallbackLocation.city,
    state: address.state ?? fallbackLocation.state,
    zip: address.zip ?? fallbackLocation.zip,
    initialQuote,
    initialDiscount,
    initialSubtotal,
    recurringCharge,
    recurringTax,
    recurringTotal,
    agreementDateDisplay: resolvedStart,
    startDate: resolvedStart,
    agreementStartDate: agreementStartDate ?? resolvedStart,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
    selectedAddOns: [],
  };
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
    logPrefix: '[rit-pdf]',
  });

  const titleSize = 11;
  const titleWidth = fonts.bold.widthOfTextAtSize(RIT_TITLE, titleSize);
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
  page.drawText(RIT_TITLE, {
    x: (PAGE_W - titleWidth) / 2,
    y: bubbleBottom + (bubbleH - titleSize) / 2 + 0.5,
    size: titleSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  const rightX = PAGE_W - MARGIN_X - 170;
  const lines = [
    RIT_COMPANY.name,
    RIT_COMPANY.addressLine1,
    RIT_COMPANY.addressLine2,
    RIT_COMPANY.phone,
    RIT_HEADER_CONTACT_EMAIL,
    `License #: ${RIT_COMPANY.license}`,
  ];
  let ry = y + h - 6;
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
  drawWrappedText(page, RIT_SERVICE_DETAILS_TEXT, {
    x: x + 2,
    y,
    w: width - 4,
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

function drawPestsSection(page, fonts) {
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP);
  const h = LAYOUT_PESTS_H;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawBubblePanel(page, { x, y, w, h, title: RIT_COVERED_PESTS_SECTION_TITLE, font: fonts.bold });

  const innerX = x + SECTION_PAD;
  const innerW = w - SECTION_PAD * 2;
  const groupTopY = bodyStartY(y, h);
  const bodyBottomY = y + SECTION_PAD;

  const contentInsetX = 4;
  const layoutX = innerX + contentInsetX;
  const layoutW = innerW - contentInsetX * 2;
  const colGap = 6;
  const col5W = Math.max(layoutW * 0.16, 92);
  const col4W = layoutW * 0.20;
  const col3W = layoutW * 0.20;
  const col2W = layoutW * 0.20;
  const col1W = layoutW - col2W - col3W - col4W - col5W - colGap * 4;
  const col5X = layoutX + layoutW - col5W;
  const col4X = col5X - colGap - col4W;
  const col3X = col4X - colGap - col3W;
  const col2X = col3X - colGap - col2W;
  const col1X = layoutX;

  const includedItemGap = 6.5;
  const pestCheckboxH = 6;
  const pestRowCount = 4;
  const headingToCheckboxGap = 9;
  const headingRowHeight = PEST_LABEL_SIZE + headingToCheckboxGap;
  const pestGridHeight = (pestRowCount - 1) * includedItemGap + pestCheckboxH;
  const totalBlockHeight = headingRowHeight + pestGridHeight;
  const blockTopY = groupTopY - (groupTopY - bodyBottomY - totalBlockHeight) / 2;
  const addonsHeadingY = blockTopY - 2;
  const checkboxStartY = blockTopY - headingRowHeight;

  drawUnderlinedLabel(page, {
    x: col5X,
    y: addonsHeadingY,
    text: 'Add-ons',
    size: PEST_LABEL_SIZE,
    font: fonts.bold,
    color: TAG_RED,
  });

  const includedColumns = [
    { x: col1X, width: col1W, items: RIT_INCLUDED_PESTS_COL_A },
    { x: col2X, width: col2W, items: RIT_INCLUDED_PESTS_COL_B },
    { x: col3X, width: col3W, items: RIT_INCLUDED_PESTS_COL_C },
    { x: col4X, width: col4W, items: RIT_INCLUDED_PESTS_COL_D },
  ];

  for (const col of includedColumns) {
    drawPestChecklistColumn(page, {
      x: col.x,
      width: col.width,
      items: col.items,
      startY: checkboxStartY,
      itemGap: includedItemGap,
      font: fonts.bold,
      getLabelColor: (item) => (RIT_RED_RODENT_PEST_SET.has(item) ? TAG_RED : undefined),
    });
  }

  drawPestChecklistColumn(page, {
    x: col5X,
    width: col5W,
    items: RIT_ADDON_PESTS,
    startY: checkboxStartY,
    itemGap: includedItemGap,
    font: fonts.bold,
    isChecked: () => false,
  });
}

function drawMiddleRow(page, schedule, fonts) {
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP, LAYOUT_PESTS_H, GAP);
  const h = LAYOUT_MIDDLE_ROW_H;
  const w = PAGE_W - MARGIN_X * 2;
  const leftW = w * 0.48;
  const rightW = w - leftW - GAP;
  const x = MARGIN_X;
  const y = yFromTop(top, h);

  drawBubblePanel(page, { x, y, w: leftW, h, title: 'Expectations / Scheduling', font: fonts.bold });

  const contentTop = bodyStartY(y, h);
  const expectPad = 6;
  const expectGap = 8;
  const expectColW = (leftW - expectPad * 2 - expectGap) / 2;
  const leftTextX = x + expectPad;
  const rightTextX = leftTextX + expectColW + expectGap;
  const textOpts = {
    font: fonts.regular,
    size: BODY_TEXT_SIZE_EXPECTATIONS,
    lineHeight: BODY_TEXT_SIZE_EXPECTATIONS * 1.25,
  };

  drawWrappedText(page, RIT_EXPECTATIONS_LEFT, {
    x: leftTextX,
    y: contentTop,
    w: expectColW,
    ...textOpts,
  });
  drawWrappedText(page, RIT_EXPECTATIONS_RIGHT, {
    x: rightTextX,
    y: contentTop,
    w: expectColW,
    ...textOpts,
  });

  const rx = x + leftW + GAP;
  drawBubblePanel(page, { x: rx, y, w: rightW, h, title: RIT_SUBSCRIPTION_TITLE, font: fonts.bold });

  const tileGap = 1;
  const tileW = (rightW - 14) / 6;
  const tileH = CALENDAR_TILE_H;
  const months = schedule?.scheduleMonths ?? [];
  const calendarBodyTop = bodyStartY(y, h);
  const firstRowBottomY = calendarBodyTop - CALENDAR_PANEL_PAD - tileH;
  months.forEach((month, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    drawPaymentTile(page, month.label, formatRodentInsectTriannualPaymentText(month), {
      x: rx + 4 + col * (tileW + tileGap),
      y: firstRowBottomY - row * (tileH + CALENDAR_TILE_GAP),
      w: tileW,
      h: tileH,
      font: fonts.regular,
      fontBold: fonts.bold,
      tileStyle: RIT_CALENDAR_TILE_STYLE,
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
  drawBubblePanel(page, { x, y, w, h, title: RIT_AUTHORIZATION_TITLE, font: fonts.bold });
  drawWrappedText(page, RIT_AUTHORIZATION_TEXT, {
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
  const periodWidth = fonts.bold.widthOfTextAtSize(RIT_AGREEMENT_PERIOD_TEXT, periodSize);
  const periodX = x + (w - periodWidth) / 2;
  const periodY = y + h - SECTION_PAD - 2;
  drawUnderlinedLabel(page, {
    x: periodX,
    y: periodY,
    text: RIT_AGREEMENT_PERIOD_TEXT,
    size: periodSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  drawWrappedText(page, RIT_INITIALS_TEXT, {
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
    { label: 'Customer Initials:', value: '' },
    { label: 'Customer Signature:', value: '' },
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
 * Build a vector Rodent & Insect Triannual agreement PDF (Bed Bug design system).
 */
export async function buildRodentInsectTriannualAgreementPdf(input = {}) {
  const data = normalizeRodentInsectTriannualAgreementData(input);
  console.log('[rit-pdf] building vector agreement for', data.customerName || '(no name)');

  const schedule = buildRodentInsectTriannualSchedule({
    startDate: data.startDate,
    agreementStartDate: data.agreementStartDate,
    serviceStartDate: data.serviceStartDate,
    initialServiceDate: data.initialServiceDate,
    selectedStartDate: data.selectedStartDate,
    initialTotal: data.initialSubtotal,
    recurringCharge: data.recurringCharge,
  });
  if (schedule.warning) {
    console.warn(`[rit-pdf] ${schedule.warning}`);
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: font, bold: fontBold };

  await drawHeader(pdfDoc, page, fonts);
  drawTopRow(page, data, fonts);
  drawPestsSection(page, fonts);
  drawMiddleRow(page, schedule, fonts);
  drawPricingRow(page, data, fonts);
  drawAuthorizationSection(page, fonts);
  drawSignatureSection(page, data, fonts);

  const outBytes = await pdfDoc.save();
  console.log('[rit-pdf] generated', outBytes.length, 'bytes, schedule months:', schedule.scheduleMonths?.length ?? 0);

  const safeName = (data.customerName || 'Quote')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Quote';

  return {
    outBytes,
    outName: `${safeName}_Rodent_Insect_Triannual.pdf`,
    schedule,
    pageSize: { ...RIT_PAGE_SIZE },
    data,
  };
}
