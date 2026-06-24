import { PDFDocument, StandardFonts } from 'pdf-lib';
import { generateAgreementSchedule } from './agreementSchedule.js';
import {
  formatCurrency,
  parseCityStateZip,
} from './bedBugAgreementPdf.js';
import {
  embedTmmPestImages,
  drawTmmCoverageColumn,
} from './tmmPestAssets.js';
import {
  TMM_AGREEMENT_PERIOD_TEXT,
  TMM_AUTHORIZATION_TEXT,
  TMM_AUTHORIZATION_TITLE,
  TMM_COMPANY,
  TMM_COVERED_PESTS_SECTION_TITLE,
  TMM_EXPECTATIONS_LEFT,
  TMM_EXPECTATIONS_RIGHT,
  TMM_HEADER_CONTACT_EMAIL,
  TMM_INITIALS_TEXT,
  TMM_MOSQUITO_COLUMN,
  TMM_SERVICE_DETAILS_TEXT,
  TMM_SUBSCRIPTION_TITLE,
  TMM_TICK_COLUMN,
  TMM_TITLE,
} from './tickMosquitoMonthlyAgreementContent.js';
import {
  AGREEMENT_COLORS as COLORS,
  BODY_TOP_PAD,
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
  TITLE_BUBBLE_FILL,
  bodyStartY as layoutBodyStartY,
  yFromTop as layoutYFromTop,
} from './pdf/agreementLayout.js';
import { applyCustomerFriendlyViewerPreferences } from './pdf/customerViewerPreferences.js';

const AGREEMENT_TYPE = 'tick_mosquito_monthly';

/** Landscape letter: 11in × 8.5in */
export const TMM_PAGE_SIZE = { width: 792, height: 612 };

const PAGE_W = TMM_PAGE_SIZE.width;
const PAGE_H = TMM_PAGE_SIZE.height;
const MARGIN_X = 18;
const MARGIN_Y = 10;
const GAP = 4;
const GAP_AFTER_PESTS = 0;
const SECTION_PAD = 8;
const VALUE_SIZE = 7.5;

const BODY_TEXT_SIZE_SERVICE_DETAILS = 6.4 * 1.2;
const BODY_TEXT_SIZE_SERVICE_DETAILS_LEADING = 7.2 * 1.2;
const BODY_TEXT_SIZE_EXPECTATIONS = 6 * 1.1 * 1.1 * 1.05;
const BODY_TEXT_SIZE_AUTHORIZATION = 5.8 * 1.1 * 1.1 * 1.05;
const BODY_TEXT_SIZE_INITIALS = 5.4 * 1.1 * 1.1 * 1.1 * 1.05;
const TMM_AGREEMENT_PERIOD_SIZE = LABEL_SIZE * 1.05;
const COMPANY_INFO_SIZE = 6.5 * 1.1 * 1.1;
const COMPANY_INFO_LEADING = 8.2;
const CALENDAR_MONTH_SIZE = 6.5 * 1.1 * 1.1;
const CALENDAR_PAY_SIZE = 6 * 1.1 * 1.1;
const CALENDAR_PAY_SIZE_LONG = 5.5 * 1.1 * 1.1;
const CALENDAR_TILE_H = 24 * 1.1 * 1.1;
const CALENDAR_TILE_GAP = 2 * 1.1 * 1.1;
const CALENDAR_PANEL_PAD = 2;

const SPACING_FORM_GRID = { gap: 13, fieldSpacing: 9, valueSize: 7.5 };

const LAYOUT_HEADER_H = 50;
const LAYOUT_TOP_ROW_H = 84;
const LAYOUT_PESTS_H = 158;
const LAYOUT_MIDDLE_ROW_H = 86;
const LAYOUT_PRICING_H = 72;
const LAYOUT_AUTH_H = 52;
const LAYOUT_SIGNATURE_H = 60;
const TMM_PESTS_BODY_TOP_PAD = 7;

const TMM_CALENDAR_TILE_STYLE = {
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

function pestsBodyStartY(panelBottom, panelHeight) {
  return layoutBodyStartY(panelBottom, panelHeight, HEADER_BAR_H, TMM_PESTS_BODY_TOP_PAD);
}

function parseMoney(value) {
  return parseFloat(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0;
}

/** Format calendar tile text — seasonal months show (S) price; off-season shows em dash. */
export function formatTickMosquitoMonthlyPaymentText(month) {
  if (!month?.paymentText) return '—';
  const text = month.paymentText;
  if (month.isServiceMonth && !text.includes('(S)')) {
    return `(S)${text.replace(/^\$/, '')}`;
  }
  return text;
}

export function buildTickMosquitoMonthlySchedule(params = {}) {
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

function formatBillingMethod(cardLastFour) {
  const digits = String(cardLastFour ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return `Card ending ${digits.slice(-4)}`;
}

export function normalizeTickMosquitoMonthlyAgreementData(input = {}) {
  const {
    lead = {},
    pricing = {},
    address = {},
    cardLastFour = '',
    startDate,
    agreementStartDate,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
    tmmOverrides = {},
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
    billingMethod: formatBillingMethod(cardLastFour),
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
    serviceDetailsText: tmmOverrides.serviceDetailsText || null,
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
    logPrefix: '[tmm-pdf]',
  });

  const titleSize = 11;
  const titleWidth = fonts.bold.widthOfTextAtSize(TMM_TITLE, titleSize);
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
  page.drawText(TMM_TITLE, {
    x: (PAGE_W - titleWidth) / 2,
    y: bubbleBottom + (bubbleH - titleSize) / 2 + 0.5,
    size: titleSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  const rightX = PAGE_W - MARGIN_X - 170;
  const lines = [
    TMM_COMPANY.name,
    TMM_COMPANY.addressLine1,
    TMM_COMPANY.addressLine2,
    TMM_COMPANY.phone,
    TMM_HEADER_CONTACT_EMAIL,
    `License #: ${TMM_COMPANY.license}`,
  ];
  let ry = y + h - 6;
  for (const line of lines) {
    page.drawText(line, { x: rightX, y: ry, size: COMPANY_INFO_SIZE, font: fonts.regular, color: COLORS.text });
    ry -= COMPANY_INFO_LEADING;
  }
}

function drawServiceAddressGridBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_FORM_GRID }) {
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

function drawCustomerGridBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_FORM_GRID }) {
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
        spacing: SPACING_FORM_GRID,
      });
    } else if (box.kind === 'customer') {
      drawCustomerGridBlock(page, {
        x: innerX,
        y: fieldY,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.bold,
        spacing: SPACING_FORM_GRID,
      });
    } else {
      drawWrappedText(page, data.serviceDetailsText ?? TMM_SERVICE_DETAILS_TEXT, {
        x: innerX,
        y: bodyStartY(y, h),
        w: innerW,
        font: fonts.regular,
        size: BODY_TEXT_SIZE_SERVICE_DETAILS,
        lineHeight: BODY_TEXT_SIZE_SERVICE_DETAILS_LEADING,
      });
    }
  });
}

function drawCoveredPestsSection(page, fonts, pestImages) {
  const top = layoutTop(GAP, LAYOUT_TOP_ROW_H, GAP);
  const h = LAYOUT_PESTS_H;
  const w = PAGE_W - MARGIN_X * 2;
  const x = MARGIN_X;
  const y = yFromTop(top, h);
  drawBubblePanel(page, { x, y, w, h, title: TMM_COVERED_PESTS_SECTION_TITLE, font: fonts.bold });

  const innerX = x + SECTION_PAD;
  const innerW = w - SECTION_PAD * 2;
  const bodyTopY = pestsBodyStartY(y, h);
  const bodyBottomY = y + SECTION_PAD;
  const colGap = 4;
  const colW = (innerW - colGap) / 2;
  const col1X = innerX;
  const col2X = innerX + colW + colGap;

  drawTmmCoverageColumn(page, {
    x: col1X,
    width: colW,
    bodyTopY,
    bodyBottomY,
    assetKey: TMM_TICK_COLUMN.assetKey,
    pestImages,
    showLeftDivider: false,
  });
  drawTmmCoverageColumn(page, {
    x: col2X,
    width: colW,
    bodyTopY,
    bodyBottomY,
    assetKey: TMM_MOSQUITO_COLUMN.assetKey,
    pestImages,
    showLeftDivider: true,
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

  drawWrappedText(page, TMM_EXPECTATIONS_LEFT, {
    x: leftTextX,
    y: contentTop,
    w: expectColW,
    ...textOpts,
  });
  drawWrappedText(page, TMM_EXPECTATIONS_RIGHT, {
    x: rightTextX,
    y: contentTop,
    w: expectColW,
    ...textOpts,
  });

  const rx = x + leftW + GAP;
  drawBubblePanel(page, { x: rx, y, w: rightW, h, title: TMM_SUBSCRIPTION_TITLE, font: fonts.bold });

  const tileGap = 1;
  const tileW = (rightW - 14) / 6;
  const tileH = CALENDAR_TILE_H;
  const months = schedule?.scheduleMonths ?? [];
  const calendarBodyTop = bodyStartY(y, h);
  const firstRowBottomY = calendarBodyTop - CALENDAR_PANEL_PAD - tileH;
  months.forEach((month, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    drawPaymentTile(page, month.label, formatTickMosquitoMonthlyPaymentText(month), {
      x: rx + 4 + col * (tileW + tileGap),
      y: firstRowBottomY - row * (tileH + CALENDAR_TILE_GAP),
      w: tileW,
      h: tileH,
      font: fonts.regular,
      fontBold: fonts.bold,
      tileStyle: TMM_CALENDAR_TILE_STYLE,
    });
  });
}

function drawTmmBillingBlock(page, { x, y, width, data, font, boldFont, spacing = SPACING_FORM_GRID }) {
  let fieldY = y;
  fieldY = drawStackedField(page, {
    x,
    y: fieldY,
    label: 'Customer Name:',
    value: data.customerName,
    width,
    font,
    boldFont,
    ...spacing,
  });

  const addressGap = spacing.gap ?? 13;
  const valueSize = spacing.valueSize ?? VALUE_SIZE;
  drawUnderlinedLabel(page, {
    x,
    y: fieldY,
    text: 'Address:',
    size: LABEL_SIZE,
    font: boldFont,
    color: COLORS.text,
  });
  const streetY = fieldY - addressGap;
  const cityLine = [data.city, data.state, data.zip].filter(Boolean).join(' ');
  if (data.serviceAddress) {
    page.drawText(data.serviceAddress, {
      x,
      y: streetY,
      size: valueSize,
      font,
      color: COLORS.text,
    });
  }
  if (cityLine) {
    page.drawText(cityLine, {
      x,
      y: streetY - valueSize - 2,
      size: valueSize,
      font,
      color: COLORS.text,
    });
  }
  fieldY = streetY - (cityLine ? valueSize * 2 + 4 : valueSize) - (spacing.fieldSpacing ?? 9);

  drawStackedField(page, {
    x,
    y: fieldY,
    label: 'Billing Method:',
    value: data.billingMethod,
    width,
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
        { label: 'Service Charge (per visit):', value: formatCurrency(data.recurringCharge) },
        { label: 'Tax (0%):', value: formatCurrency(data.recurringTax) },
        { label: 'Recurring Total (per visit):', value: formatCurrency(data.recurringTotal) },
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
      drawTmmBillingBlock(page, {
        x: x + SECTION_PAD,
        y: bodyStartY(y, h) - LABEL_SIZE,
        width: innerW,
        data,
        font: fonts.regular,
        boldFont: fonts.bold,
        spacing: SPACING_FORM_GRID,
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
  drawBubblePanel(page, { x, y, w, h, title: TMM_AUTHORIZATION_TITLE, font: fonts.bold });
  drawWrappedText(page, TMM_AUTHORIZATION_TEXT, {
    x: x + 6,
    y: bodyStartY(y, h),
    w: w - 12,
    font: fonts.regular,
    size: BODY_TEXT_SIZE_AUTHORIZATION,
    lineHeight: BODY_TEXT_SIZE_AUTHORIZATION * 1.12,
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

  const periodSize = TMM_AGREEMENT_PERIOD_SIZE;
  const periodWidth = fonts.bold.widthOfTextAtSize(TMM_AGREEMENT_PERIOD_TEXT, periodSize);
  const periodX = x + (w - periodWidth) / 2;
  const periodY = y + h - SECTION_PAD - 2;
  drawUnderlinedLabel(page, {
    x: periodX,
    y: periodY,
    text: TMM_AGREEMENT_PERIOD_TEXT,
    size: periodSize,
    font: fonts.bold,
    color: COLORS.headerBg,
  });

  drawWrappedText(page, TMM_INITIALS_TEXT, {
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

export async function buildTickMosquitoMonthlyAgreementPdf(input = {}, options = {}) {
  const { signatures = null } = options;
  const data = normalizeTickMosquitoMonthlyAgreementData(input);
  console.log('[tmm-pdf] building vector agreement for', data.customerName || '(no name)');

  const schedule = buildTickMosquitoMonthlySchedule({
    startDate: data.startDate,
    agreementStartDate: data.agreementStartDate,
    serviceStartDate: data.serviceStartDate,
    initialServiceDate: data.initialServiceDate,
    selectedStartDate: data.selectedStartDate,
    initialTotal: data.initialSubtotal,
    recurringCharge: data.recurringCharge,
  });
  if (schedule.warning) {
    console.warn(`[tmm-pdf] ${schedule.warning}`);
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: font, bold: fontBold };

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

  const pestImages = await embedTmmPestImages(pdfDoc);

  await drawHeader(pdfDoc, page, fonts);
  drawTopRow(page, data, fonts);
  drawCoveredPestsSection(page, fonts, pestImages);
  drawMiddleRow(page, schedule, fonts);
  drawPricingRow(page, data, fonts);
  drawAuthorizationSection(page, fonts);
  drawSignatureSection(page, data, fonts, signatureAssets);

  applyCustomerFriendlyViewerPreferences(pdfDoc);
  const outBytes = await pdfDoc.save();
  console.log('[tmm-pdf] generated', outBytes.length, 'bytes, schedule months:', schedule.scheduleMonths?.length ?? 0);

  const safeName = (data.customerName || 'Quote')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Quote';

  return {
    outBytes,
    outName: `${safeName}_Tick_Mosquito_Monthly.pdf`,
    schedule,
    pageSize: { ...TMM_PAGE_SIZE },
    data,
  };
}
