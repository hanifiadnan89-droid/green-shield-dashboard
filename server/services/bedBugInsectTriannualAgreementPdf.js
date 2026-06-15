import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  buildSubscriptionSchedule,
  formatBedBugPaymentText,
  formatCurrency,
  normalizeBedBugAgreementData,
  parseCityStateZip,
} from './bedBugAgreementPdf.js';
import {
  BIT_ADDON_PESTS,
  BIT_AGREEMENT_PERIOD_TEXT,
  BIT_AUTHORIZATION_TEXT,
  BIT_AUTHORIZATION_TITLE,
  BIT_COMPANY,
  BIT_COVERED_PESTS_SECTION_TITLE,
  BIT_EXPECTATIONS_TEXT,
  BIT_HEADER_CONTACT_EMAIL,
  BIT_INCLUDED_PESTS_COL_A,
  BIT_INCLUDED_PESTS_COL_B,
  BIT_INCLUDED_PESTS_COL_C,
  BIT_INITIALS_TEXT,
  BIT_SERVICE_DETAILS_TEXT,
  BIT_SUBSCRIPTION_TITLE,
  BIT_TITLE,
} from './bedBugInsectTriannualAgreementContent.js';
import {
  embedBitPestImages,
  drawBitAddonsColumn,
  drawBitIncludedPestColumn,
  drawBitMainPestColumn,
} from './bitPestAssets.js';
import {
  AGREEMENT_COLORS as COLORS,
  drawBubblePanel,
  drawCompanyLogo,
  drawPaymentTile,
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
import { applyCustomerFriendlyViewerPreferences } from './pdf/customerViewerPreferences.js';

/** Landscape letter: 11in × 8.5in */
export const BIT_PAGE_SIZE = { width: 792, height: 612 };

const PAGE_W = BIT_PAGE_SIZE.width;
const PAGE_H = BIT_PAGE_SIZE.height;
const MARGIN_X = 18;
const MARGIN_Y = 10;
const GAP = 4;
const GAP_AFTER_PESTS = 0;
const SECTION_PAD = 8;
const BIT_BODY_TOP_PAD = 7;

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
const CALENDAR_PANEL_PAD = 1;

/** Label-to-value and field-group spacing for form panels. */
const SPACING_TOP_ROW = { gap: 11, fieldSpacing: 9, valueSize: 7.5 };
const SPACING_FORM = { gap: 11, fieldSpacing: 9, valueSize: 7.5 };

const LAYOUT_HEADER_H = 50;
const LAYOUT_TOP_ROW_H = 84;
const LAYOUT_PESTS_H = 158;
const LAYOUT_MIDDLE_ROW_H = 86;
const LAYOUT_PRICING_H = 72;
const LAYOUT_AUTH_H = 52;
const LAYOUT_SIGNATURE_H = 60;

const BIT_CALENDAR_TILE_STYLE = {
  monthSize: CALENDAR_MONTH_SIZE,
  paySize: CALENDAR_PAY_SIZE,
  paySizeLong: CALENDAR_PAY_SIZE_LONG,
  uniformPriceSize: CALENDAR_PAY_SIZE,
};

function layoutTop(...segments) {
  return MARGIN_Y + LAYOUT_HEADER_H + segments.reduce((sum, n) => sum + n, 0);
}

function yFromTop(yTop, height = 0) {
  return layoutYFromTop(PAGE_H, yTop, height);
}

function bodyStartY(panelBottom, panelHeight) {
  return layoutBodyStartY(panelBottom, panelHeight, HEADER_BAR_H, BIT_BODY_TOP_PAD);
}

export function normalizeBedBugInsectTriannualAgreementData(input = {}) {
  return normalizeBedBugAgreementData(input);
}

export function buildBedBugInsectTriannualSchedule(params = {}) {
  return buildSubscriptionSchedule(params);
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
    logPrefix: '[bit-pdf]',
  });

  const titleSize = 11;
  const titleWidth = fonts.bold.widthOfTextAtSize(BIT_TITLE, titleSize);
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
  page.drawText(BIT_TITLE, {
    x: (PAGE_W - titleWidth) / 2,
    y: bubbleBottom + (bubbleH - titleSize) / 2 + 0.5,
    size: titleSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  const rightX = PAGE_W - MARGIN_X - 170;
  const lines = [
    BIT_COMPANY.name,
    BIT_COMPANY.addressLine1,
    BIT_COMPANY.addressLine2,
    `${BIT_COMPANY.phone} | ${BIT_HEADER_CONTACT_EMAIL}`,
    `License #: ${BIT_COMPANY.license}`,
  ];
  let ry = y + h - 6;
  for (const line of lines) {
    page.drawText(line, { x: rightX, y: ry, size: COMPANY_INFO_SIZE, font: fonts.regular, color: COLORS.text });
    ry -= COMPANY_INFO_LEADING;
  }
}

function drawServiceAddressGridBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_TOP_ROW }) {
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

  const row2Y = Math.min(row1LeftEnd, row1RightEnd) - 2;
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

function drawCustomerGridBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_TOP_ROW }) {
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
  drawWrappedText(page, BIT_SERVICE_DETAILS_TEXT, {
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
    const fieldY = bodyStartY(y, h) - LABEL_SIZE - 2;
    drawBubblePanel(page, { x, y, w: colW, h, title: box.title, font: fonts.bold });
    if (box.kind === 'address') {
      drawServiceAddressGridBlock(page, {
        x: innerX,
        y: fieldY,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.bold,
        spacing: SPACING_TOP_ROW,
      });
    } else if (box.kind === 'customer') {
      drawCustomerGridBlock(page, {
        x: innerX,
        y: fieldY,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.bold,
        spacing: SPACING_TOP_ROW,
      });
    } else {
      drawServiceDetailsBlock(page, {
        x: innerX,
        y: bodyStartY(y, h) - 5,
        width: innerW,
        font: fonts.regular,
      });
    }
  });
}

function drawPestsSection(page, fonts, pestImages) {
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP);
  const h = LAYOUT_PESTS_H;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawBubblePanel(page, { x, y, w, h, title: BIT_COVERED_PESTS_SECTION_TITLE, font: fonts.bold });

  const innerX = x + SECTION_PAD;
  const innerW = w - SECTION_PAD * 2;
  const bodyTopY = bodyStartY(y, h);
  const bodyBottomY = y + SECTION_PAD;
  const colGap = 4;

  const col1W = innerW * 0.15;
  const col5W = innerW * 0.155;
  const colMidW = (innerW - col1W - col5W - colGap * 4) / 3;
  const col5X = innerX + innerW - col5W;
  const col4X = col5X - colGap - colMidW;
  const col3X = col4X - colGap - colMidW;
  const col2X = col3X - colGap - colMidW;
  const col1X = innerX;

  drawBitMainPestColumn(page, {
    x: col1X,
    width: col1W,
    bodyTopY,
    bodyBottomY,
    pestImages,
    font: fonts.regular,
    boldFont: fonts.bold,
  });

  drawBitIncludedPestColumn(page, {
    x: col2X,
    width: colMidW,
    bodyTopY,
    bodyBottomY,
    items: BIT_INCLUDED_PESTS_COL_A,
    pestImages,
    font: fonts.regular,
    boldFont: fonts.bold,
    showLeftDivider: true,
  });
  drawBitIncludedPestColumn(page, {
    x: col3X,
    width: colMidW,
    bodyTopY,
    bodyBottomY,
    items: BIT_INCLUDED_PESTS_COL_B,
    pestImages,
    font: fonts.regular,
    boldFont: fonts.bold,
    showLeftDivider: true,
  });
  drawBitIncludedPestColumn(page, {
    x: col4X,
    width: colMidW,
    bodyTopY,
    bodyBottomY,
    items: BIT_INCLUDED_PESTS_COL_C,
    pestImages,
    font: fonts.regular,
    boldFont: fonts.bold,
    showLeftDivider: true,
  });

  drawBitAddonsColumn(page, {
    x: col5X,
    width: col5W,
    bodyTopY,
    bodyBottomY,
    items: BIT_ADDON_PESTS,
    pestImages,
    font: fonts.regular,
    boldFont: fonts.bold,
  });
}

function drawMiddleRow(page, schedule, fonts) {
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP, LAYOUT_PESTS_H, GAP_AFTER_PESTS);
  const h = LAYOUT_MIDDLE_ROW_H;
  const w = PAGE_W - MARGIN_X * 2;
  const leftW = w * 0.48;
  const rightW = w - leftW - GAP;
  const x = MARGIN_X;
  const y = yFromTop(top, h);

  drawBubblePanel(page, { x, y, w: leftW, h, title: 'Expectations / Scheduling', font: fonts.bold });
  drawWrappedText(page, BIT_EXPECTATIONS_TEXT, {
    x: x + 6,
    y: bodyStartY(y, h),
    w: leftW - 12,
    font: fonts.regular,
    size: BODY_TEXT_SIZE_EXPECTATIONS,
    lineHeight: BODY_TEXT_SIZE_EXPECTATIONS * 1.2,
  });

  const rx = x + leftW + GAP;
  drawBubblePanel(page, { x: rx, y, w: rightW, h, title: BIT_SUBSCRIPTION_TITLE, font: fonts.bold });

  const tileGap = 1;
  const tileW = (rightW - 14) / 6;
  const tileH = CALENDAR_TILE_H;
  const months = schedule?.scheduleMonths ?? [];
  const calendarBodyTop = bodyStartY(y, h);
  const firstRowBottomY = calendarBodyTop - CALENDAR_PANEL_PAD - tileH;
  months.forEach((month, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    drawPaymentTile(page, month.label, formatBedBugPaymentText(month), {
      x: rx + 4 + col * (tileW + tileGap),
      y: firstRowBottomY - row * (tileH + CALENDAR_TILE_GAP),
      w: tileW,
      h: tileH,
      font: fonts.regular,
      fontBold: fonts.bold,
      tileStyle: BIT_CALENDAR_TILE_STYLE,
    });
  });
}

function drawBillingGridBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_FORM }) {
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

  const row2Y = Math.min(row1LeftEnd, row1RightEnd) - 3;
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
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP, LAYOUT_PESTS_H, GAP_AFTER_PESTS, LAYOUT_MIDDLE_ROW_H, GAP);
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
    { title: 'Billing & Payment', billing: true },
  ];

  boxes.forEach((box, i) => {
    const bx = MARGIN_X + i * (colW + GAP);
    const by = yFromTop(top, h);
    const innerW = colW - SECTION_PAD * 2;
    drawBubblePanel(page, { x: bx, y: by, w: colW, h, title: box.title, font: fonts.bold });

    if (box.billing) {
      drawBillingGridBlock(page, {
        x: bx + SECTION_PAD,
        y: bodyStartY(by, h) - LABEL_SIZE,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.bold,
        spacing: SPACING_FORM,
      });
    } else {
      drawPriceRows(page, {
        x: bx + SECTION_PAD,
        y: bodyStartY(by, h) - 6,
        width: innerW,
        rows: box.rows,
        rowHeight: 12,
        font: fonts.regular,
        boldFont: fonts.bold,
      });
    }
  });
}

function drawAuthorizationSection(page, fonts) {
  const top = layoutTop(
    GAP,
    LAYOUT_TOP_ROW_H,
    GAP,
    LAYOUT_PESTS_H,
    GAP_AFTER_PESTS,
    LAYOUT_MIDDLE_ROW_H,
    GAP,
    LAYOUT_PRICING_H,
    GAP,
  );
  const h = LAYOUT_AUTH_H;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawBubblePanel(page, { x, y, w, h, title: BIT_AUTHORIZATION_TITLE, font: fonts.bold });
  drawWrappedText(page, BIT_AUTHORIZATION_TEXT, {
    x: x + 6,
    y: bodyStartY(y, h),
    w: w - 12,
    font: fonts.regular,
    size: BODY_TEXT_SIZE_AUTHORIZATION,
    lineHeight: BODY_TEXT_SIZE_AUTHORIZATION * 1.18,
  });
}

function drawSignatureSection(page, data, fonts, signatureAssets = {}) {
  const top = layoutTop(
    GAP,
    LAYOUT_TOP_ROW_H,
    GAP,
    LAYOUT_PESTS_H,
    GAP_AFTER_PESTS,
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
  const periodWidth = fonts.bold.widthOfTextAtSize(BIT_AGREEMENT_PERIOD_TEXT, periodSize);
  const periodX = x + (w - periodWidth) / 2;
  const periodY = y + h - SECTION_PAD;
  drawUnderlinedLabel(page, {
    x: periodX,
    y: periodY,
    text: BIT_AGREEMENT_PERIOD_TEXT,
    size: periodSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  drawWrappedText(page, BIT_INITIALS_TEXT, {
    x: x + SECTION_PAD,
    y: y + h - SECTION_PAD - 12,
    w: w - SECTION_PAD * 2,
    font: fonts.regular,
    size: BODY_TEXT_SIZE_INITIALS,
    lineHeight: BODY_TEXT_SIZE_INITIALS * 1.08,
  });

  const fieldGap = 14;
  const fieldW = (w - SECTION_PAD * 2 - fieldGap * 2) / 3;
  const sigTopY = y + 14;
  const dateValue = signatureAssets.signatureDateDisplay
    ? String(signatureAssets.signatureDateDisplay)
    : (data.agreementDateDisplay ? String(data.agreementDateDisplay) : '');

  const fields = [
    { label: 'Customer Initials:', value: '', kind: 'initials' },
    { label: 'Customer Signature:', value: '', kind: 'signature' },
    { label: 'Date:', value: dateValue, kind: 'date' },
  ];

  fields.forEach((field, index) => {
    const fieldX = x + SECTION_PAD + index * (fieldW + fieldGap);
    const lineY = drawSignatureField(page, {
      x: fieldX,
      y: sigTopY,
      label: field.label,
      value: field.kind === 'date' ? field.value : '',
      width: fieldW,
      font: fonts.regular,
      boldFont: fonts.bold,
    });

    const imageTop = lineY + 2;
    const imageHeight = 20;
    if (field.kind === 'initials' && signatureAssets.initialsImage) {
      page.drawImage(signatureAssets.initialsImage, {
        x: fieldX + 2,
        y: imageTop,
        width: fieldW - 4,
        height: imageHeight,
      });
    }
    if (field.kind === 'signature' && signatureAssets.signatureImage) {
      page.drawImage(signatureAssets.signatureImage, {
        x: fieldX + 2,
        y: imageTop,
        width: fieldW - 4,
        height: imageHeight,
      });
    }
  });
}

/**
 * Build a vector Bed Bug & Insect Triannual agreement PDF matching the production reference layout.
 */
export async function buildBedBugInsectTriannualAgreementPdf(input = {}, options = {}) {
  const { signatures = null } = options;
  const data = normalizeBedBugInsectTriannualAgreementData(input);
  console.log('[bit-pdf] building vector agreement for', data.customerName || '(no name)');

  const schedule = buildBedBugInsectTriannualSchedule({
    startDate: data.startDate,
    agreementStartDate: data.agreementStartDate,
    serviceStartDate: data.serviceStartDate,
    initialServiceDate: data.initialServiceDate,
    selectedStartDate: data.selectedStartDate,
    initialTotal: data.initialSubtotal,
    recurringCharge: data.recurringCharge,
  });
  if (schedule.warning) {
    console.warn(`[bit-pdf] ${schedule.warning}`);
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: font, bold: fontBold };

  const pestImages = await embedBitPestImages(pdfDoc);

  const signatureAssets = {};
  if (signatures?.initialsPng) {
    signatureAssets.initialsImage = await pdfDoc.embedPng(signatures.initialsPng);
  }
  if (signatures?.signaturePng) {
    signatureAssets.signatureImage = await pdfDoc.embedPng(signatures.signaturePng);
  }
  if (signatures?.signatureDate) {
    signatureAssets.signatureDateDisplay = signatures.signatureDate;
  }

  await drawHeader(pdfDoc, page, fonts);
  drawTopRow(page, data, fonts);
  drawPestsSection(page, fonts, pestImages);
  drawMiddleRow(page, schedule, fonts);
  drawPricingRow(page, data, fonts);
  drawAuthorizationSection(page, fonts);
  drawSignatureSection(page, data, fonts, signatureAssets);

  applyCustomerFriendlyViewerPreferences(pdfDoc);
  const outBytes = await pdfDoc.save();
  console.log('[bit-pdf] generated', outBytes.length, 'bytes, schedule months:', schedule.scheduleMonths?.length ?? 0);

  const safeName = (data.customerName || 'Quote')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Quote';

  return {
    outBytes,
    outName: `${safeName}_Bed_Bug_Insect_Triannual.pdf`,
    schedule,
    pageSize: { ...BIT_PAGE_SIZE },
    data,
  };
}

export { parseCityStateZip };
