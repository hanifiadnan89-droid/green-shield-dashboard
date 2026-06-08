import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateAgreementSchedule } from './agreementSchedule.js';
import {
  BED_BUG_ADDON_ICONS,
  BED_BUG_PEST_ICONS,
  drawPestIcon,
} from './pestIcons.js';
import {
  BED_BUG_AGREEMENT_STATEMENT,
  BED_BUG_CANCELLATION_PARAGRAPHS,
  BED_BUG_COMPANY,
  BED_BUG_ELECTRONIC_AGREEMENT,
  BED_BUG_EXPECTATIONS_LEFT,
  BED_BUG_EXPECTATIONS_RIGHT,
  BED_BUG_SERVICE_FREQUENCY,
  BED_BUG_SERVICE_TYPE,
  BED_BUG_TITLE,
} from './bedBugAgreementContent.js';

const PAGE_W = 612;
const PAGE_H = 1008;
const MARGIN = 24;

const GREEN_DARK = rgb(0.14, 0.38, 0.24);
const GREEN_MID = rgb(0.22, 0.50, 0.32);
const TEXT = rgb(0.13, 0.13, 0.13);
const MUTED = rgb(0.35, 0.35, 0.35);
const BORDER = rgb(0.78, 0.78, 0.78);
const WHITE = rgb(1, 1, 1);
const LINE = rgb(0.55, 0.55, 0.55);

function parseMoney(value) {
  return parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 0;
}

function drawSection(page, { x, y, w, h, title, font, fontBold }) {
  page.drawRectangle({
    x, y, width: w, height: h,
    borderColor: BORDER,
    borderWidth: 0.75,
    color: WHITE,
  });
  if (title) {
    page.drawRectangle({ x, y: y + h - 18, width: w, height: 18, color: GREEN_DARK });
    page.drawText(title, {
      x: x + 8,
      y: y + h - 14,
      size: 8.5,
      font: fontBold,
      color: WHITE,
    });
  }
}

function drawWrappedText(page, text, { x, y, maxWidth, size, font, color = TEXT, lineHeight = 11 }) {
  const words = String(text).split(/\s+/);
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: cy, size, font, color });
      cy -= lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x, y: cy, size, font, color });
  return cy;
}

function drawLines(page, lines, { x, y, size, font, color = TEXT, lineHeight = 11 }) {
  let cy = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cy, size, font, color });
    cy -= lineHeight;
  }
  return cy;
}

function drawFieldLine(page, label, value, { x, y, labelW, valueX, font, fontBold, size = 8.5 }) {
  page.drawText(label, { x, y, size, font: fontBold, color: MUTED });
  if (value) {
    page.drawText(String(value), { x: valueX ?? x + labelW, y, size, font, color: TEXT });
  }
  page.drawLine({
    start: { x: valueX ?? x + labelW, y: y - 2 },
    end: { x: x + 160, y: y - 2 },
    thickness: 0.5,
    color: LINE,
  });
}

function drawLogo(page, x, y, w, h) {
  const shieldGray = rgb(0.55, 0.55, 0.55);
  const leafGreen = rgb(0.25, 0.58, 0.32);
  const cx = x + w * 0.42;
  const baseY = y + h * 0.12;

  page.drawRectangle({ x, y, width: w, height: h, color: WHITE });

  // Shield outline
  page.drawLine({ start: { x: cx, y: baseY + h * 0.78 }, end: { x: cx - w * 0.34, y: baseY + h * 0.48 }, thickness: 1.2, color: shieldGray });
  page.drawLine({ start: { x: cx - w * 0.34, y: baseY + h * 0.48 }, end: { x: cx - w * 0.34, y: baseY + h * 0.18 }, thickness: 1.2, color: shieldGray });
  page.drawLine({ start: { x: cx - w * 0.34, y: baseY + h * 0.18 }, end: { x: cx, y: baseY }, thickness: 1.2, color: shieldGray });
  page.drawLine({ start: { x: cx, y: baseY }, end: { x: cx + w * 0.34, y: baseY + h * 0.18 }, thickness: 1.2, color: shieldGray });
  page.drawLine({ start: { x: cx + w * 0.34, y: baseY + h * 0.18 }, end: { x: cx + w * 0.34, y: baseY + h * 0.48 }, thickness: 1.2, color: shieldGray });
  page.drawLine({ start: { x: cx + w * 0.34, y: baseY + h * 0.48 }, end: { x: cx, y: baseY + h * 0.78 }, thickness: 1.2, color: shieldGray });

  // House silhouette
  const hx = cx - w * 0.12;
  const hy = baseY + h * 0.22;
  page.drawRectangle({ x: hx, y: hy, width: w * 0.24, height: h * 0.22, color: shieldGray });
  page.drawLine({ start: { x: hx - w * 0.04, y: hy + h * 0.22 }, end: { x: hx + w * 0.12, y: hy + h * 0.34 }, thickness: 1, color: shieldGray });
  page.drawLine({ start: { x: hx + w * 0.12, y: hy + h * 0.34 }, end: { x: hx + w * 0.28, y: hy + h * 0.22 }, thickness: 1, color: shieldGray });

  // Leaf
  page.drawEllipse({ x: cx + w * 0.18, y: baseY + h * 0.52, xScale: w * 0.09, yScale: h * 0.14, color: leafGreen });
  page.drawLine({
    start: { x: cx + w * 0.18, y: baseY + h * 0.42 },
    end: { x: cx + w * 0.18, y: baseY + h * 0.62 },
    thickness: 0.6,
    color: leafGreen,
  });
}

function drawHeader(page, fonts) {
  const { regular, bold } = fonts;
  const logoW = 92;
  const logoH = 72;
  const logoY = PAGE_H - MARGIN - logoH - 8;

  drawLogo(page, MARGIN, logoY, logoW, logoH);

  const title = BED_BUG_TITLE.toUpperCase();
  const titleSize = 13;
  const titleW = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (PAGE_W - titleW) / 2,
    y: logoY + logoH - 28,
    size: titleSize,
    font: bold,
    color: TEXT,
  });

  const infoX = PAGE_W - MARGIN - 168;
  let infoY = logoY + logoH - 12;
  const infoLines = [
    { text: BED_BUG_COMPANY.name, font: bold, size: 9 },
    { text: BED_BUG_COMPANY.address, font: regular, size: 7.5 },
    { text: `Phone: ${BED_BUG_COMPANY.phone}`, font: regular, size: 7.5 },
    { text: `Email: ${BED_BUG_COMPANY.email}`, font: regular, size: 7.5 },
    { text: `License #: ${BED_BUG_COMPANY.license}`, font: regular, size: 7.5 },
  ];
  for (const line of infoLines) {
    page.drawText(line.text, { x: infoX, y: infoY, size: line.size, font: line.font, color: TEXT });
    infoY -= line.size + 3;
  }
}

function drawTopRow(page, fonts, data) {
  const y = 818;
  const h = 78;
  const colW = (PAGE_W - MARGIN * 2 - 16) / 3;
  const cols = [MARGIN, MARGIN + colW + 8, MARGIN + (colW + 8) * 2];

  drawSection(page, { x: cols[0], y, w: colW, h, title: 'Service Address', font: fonts.regular, fontBold: fonts.bold });
  drawSection(page, { x: cols[1], y, w: colW, h, title: 'Customer Information', font: fonts.regular, fontBold: fonts.bold });
  drawSection(page, { x: cols[2], y, w: colW, h, title: 'Service Details', font: fonts.regular, fontBold: fonts.bold });

  const addrLines = [data.customerName, data.street, data.cityState].filter(Boolean);
  drawLines(page, addrLines, { x: cols[0] + 8, y: y + h - 32, size: 8.5, font: fonts.regular, lineHeight: 12 });

  const contactLines = [data.customerName, data.phone, data.email].filter(Boolean);
  drawLines(page, contactLines, { x: cols[1] + 8, y: y + h - 32, size: 8.5, font: fonts.regular, lineHeight: 12 });

  page.drawText('Service Type:', { x: cols[2] + 8, y: y + h - 32, size: 8, font: fonts.bold, color: MUTED });
  page.drawText(BED_BUG_SERVICE_TYPE, { x: cols[2] + 8, y: y + h - 44, size: 8, font: fonts.bold, color: TEXT });
  page.drawText('Frequency:', { x: cols[2] + 8, y: y + h - 58, size: 8, font: fonts.bold, color: MUTED });
  page.drawText(BED_BUG_SERVICE_FREQUENCY, { x: cols[2] + 8, y: y + h - 70, size: 8, font: fonts.regular, color: TEXT });
}

function drawPestsSection(page, fonts) {
  const y = 688;
  const h = 118;
  const w = PAGE_W - MARGIN * 2;
  drawSection(page, { x: MARGIN, y, w, h, title: 'Included Pests & Add-ons', font: fonts.regular, fontBold: fonts.bold });

  const contentY = y + h - 34;
  const colW = (w - 120) / 4;
  const iconXOffset = 10;

  BED_BUG_PEST_ICONS.forEach((pest, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const px = MARGIN + 10 + col * colW;
    const py = contentY - row * 22;
    drawPestIcon(page, pest.type, px + iconXOffset, py + 4);
    page.drawText(pest.label, { x: px + 22, y: py, size: 7.5, font: fonts.regular, color: TEXT });
  });

  const addonX = PAGE_W - MARGIN - 108;
  const addonY = y + 12;
  const addonW = 100;
  const addonH = h - 24;
  page.drawRectangle({
    x: addonX, y: addonY, width: addonW, height: addonH,
    borderColor: BORDER, borderWidth: 0.6, color: WHITE,
  });
  page.drawText('Add-ons', {
    x: addonX + 8, y: addonY + addonH - 14, size: 8, font: fonts.bold, color: GREEN_MID,
  });

  BED_BUG_ADDON_ICONS.forEach((pest, i) => {
    const py = addonY + addonH - 30 - i * 20;
    drawPestIcon(page, pest.type, addonX + 12, py + 4);
    page.drawText(pest.label, { x: addonX + 24, y: py, size: 7.5, font: fonts.regular, color: TEXT });
  });
}

function drawExpectationsAndCalendar(page, fonts, scheduleMonths) {
  const y = 518;
  const h = 158;
  const leftW = 276;
  const rightW = PAGE_W - MARGIN * 2 - leftW - 8;

  drawSection(page, { x: MARGIN, y, w: leftW, h, title: 'Expectations / Scheduling', font: fonts.regular, fontBold: fonts.bold });
  drawSection(page, { x: MARGIN + leftW + 8, y, w: rightW, h, title: 'Bed Bug Insect Triannual Subscription', font: fonts.regular, fontBold: fonts.bold });

  const colGap = 6;
  const midX = MARGIN + leftW / 2 - 4;
  drawLines(page, BED_BUG_EXPECTATIONS_LEFT, {
    x: MARGIN + 8, y: y + h - 34, size: 7.2, font: fonts.regular, lineHeight: 10.5,
  });
  drawLines(page, BED_BUG_EXPECTATIONS_RIGHT, {
    x: midX, y: y + h - 34, size: 7.2, font: fonts.regular, lineHeight: 10.5,
  });

  const calX = MARGIN + leftW + 8;
  const cellW = (rightW - colGap * 5) / 6;
  const cellH = 52;
  const row1Y = y + h - 34 - cellH;
  const row2Y = row1Y - cellH - 6;

  scheduleMonths.forEach((month, i) => {
    const row = Math.floor(i / 6);
    const col = i % 6;
    const cx = calX + 6 + col * (cellW + colGap);
    const cy = row === 0 ? row1Y : row2Y;

    page.drawRectangle({
      x: cx, y: cy, width: cellW, height: cellH,
      borderColor: BORDER, borderWidth: 0.5, color: WHITE,
    });

    const monthSize = 7;
    const monthW = fonts.bold.widthOfTextAtSize(month.label, monthSize);
    page.drawText(month.label, {
      x: cx + (cellW - monthW) / 2,
      y: cy + cellH - 14,
      size: monthSize,
      font: fonts.bold,
      color: TEXT,
    });

    if (month.paymentText) {
      const paySize = 7;
      const payW = fonts.regular.widthOfTextAtSize(month.paymentText, paySize);
      page.drawText(month.paymentText, {
        x: cx + (cellW - payW) / 2,
        y: cy + 8,
        size: paySize,
        font: fonts.regular,
        color: TEXT,
      });
    }
  });
}

function drawPricingRow(page, fonts, pricing) {
  const y = 358;
  const h = 148;
  const colW = (PAGE_W - MARGIN * 2 - 16) / 3;
  const cols = [MARGIN, MARGIN + colW + 8, MARGIN + (colW + 8) * 2];

  drawSection(page, { x: cols[0], y, w: colW, h, title: 'Initial Service / Warranties', font: fonts.regular, fontBold: fonts.bold });
  drawSection(page, { x: cols[1], y, w: colW, h, title: 'Recurring Services', font: fonts.regular, fontBold: fonts.bold });
  drawSection(page, { x: cols[2], y, w: colW, h, title: 'Billing & Payment', font: fonts.regular, fontBold: fonts.bold });

  const leftX = cols[0] + 8;
  let ly = y + h - 34;
  const fields = [
    ['Initial Quote:', pricing.initialQuote],
    ['Initial Discount:', pricing.initialDiscount],
    ['Sub Total:', pricing.subtotal],
    ['Tax (0%):', pricing.initialTax],
    ['Initial Total:', pricing.initialTotal],
  ];
  for (const [label, value] of fields) {
    drawFieldLine(page, label, value, { x: leftX, y: ly, labelW: 72, valueX: leftX + 78, font: fonts.regular, fontBold: fonts.bold });
    ly -= 18;
  }

  const midX = cols[1] + 8;
  let my = y + h - 34;
  for (const [label, value] of [
    ['Service Charge:', pricing.recurringCharge],
    ['Tax (0%):', pricing.recurringTax],
    ['Recurring Total:', pricing.recurringTotal],
    ['Recurring Payment Authorized:', pricing.recurringAuthorized],
  ]) {
    drawFieldLine(page, label, value, { x: midX, y: my, labelW: 92, valueX: midX + 98, font: fonts.regular, fontBold: fonts.bold });
    my -= 18;
  }

  const rightX = cols[2] + 8;
  page.drawText('Billing Info', { x: rightX, y: y + h - 30, size: 8, font: fonts.bold, color: MUTED });
  drawLines(page, pricing.billingLines, { x: rightX, y: y + h - 44, size: 8, font: fonts.regular, lineHeight: 11 });
  page.drawText('Payment Method / Card Last Four:', { x: rightX, y: y + 44, size: 7.5, font: fonts.bold, color: MUTED });
  page.drawLine({ start: { x: rightX, y: y + 38 }, end: { x: cols[2] + colW - 8, y: y + 38 }, thickness: 0.5, color: LINE });
  page.drawText('Recurring Payment Authorized:', { x: rightX, y: y + 24, size: 7.5, font: fonts.bold, color: MUTED });
  if (pricing.recurringAuthorized) {
    page.drawText(pricing.recurringAuthorized, { x: rightX + 118, y: y + 24, size: 8, font: fonts.regular, color: TEXT });
  }
}

function drawLegalSection(page, fonts) {
  const y = 148;
  const h = 196;
  const w = PAGE_W - MARGIN * 2;
  drawSection(page, { x: MARGIN, y, w, h, title: 'Cancellation and Payment Authorization', font: fonts.regular, fontBold: fonts.bold });

  let cy = y + h - 32;
  for (const paragraph of BED_BUG_CANCELLATION_PARAGRAPHS) {
    cy = drawWrappedText(page, paragraph, {
      x: MARGIN + 8,
      y: cy,
      maxWidth: w - 16,
      size: 7.2,
      font: fonts.regular,
      lineHeight: 10,
    }) - 6;
  }

  page.drawText(BED_BUG_AGREEMENT_STATEMENT, {
    x: MARGIN + 8,
    y: cy - 4,
    size: 7.5,
    font: fonts.bold,
    color: TEXT,
  });

  drawWrappedText(page, BED_BUG_ELECTRONIC_AGREEMENT, {
    x: MARGIN + 8,
    y: cy - 18,
    maxWidth: w - 16,
    size: 7.2,
    font: fonts.regular,
    lineHeight: 10,
  });
}

function drawSignatureRow(page, fonts) {
  const y = 96;
  const labels = [
    { label: 'Customer Initials:', x: MARGIN, lineW: 100 },
    { label: 'Customer Signature:', x: 230, lineW: 180 },
    { label: 'Date:', x: PAGE_W - MARGIN - 90, lineW: 90 },
  ];

  for (const { label, x, lineW } of labels) {
    page.drawText(label, { x, y: y + 14, size: 8, font: fonts.bold, color: MUTED });
    page.drawLine({ start: { x, y }, end: { x: x + lineW, y }, thickness: 0.6, color: LINE });
  }
}

/**
 * Build the Bed Bug & Insect Triannual agreement PDF programmatically.
 */
export async function buildBedBugAgreementPdf({
  lead = {},
  pricing = {},
  address = {},
  startDate,
  agreementStartDate,
  serviceStartDate,
  initialServiceDate,
  selectedStartDate,
}) {
  const initVal = parseMoney(pricing.initial);
  const discVal = parseMoney(pricing.discounted);
  const recurVal = parseMoney(pricing.recurring);
  const subtotal = Math.max(0, initVal - discVal);

  const schedule = generateAgreementSchedule({
    agreementType: 'bed_bug_insect_triannual',
    startDate,
    agreementStartDate,
    serviceStartDate,
    initialServiceDate,
    selectedStartDate,
    initialPayment: subtotal,
    recurringPayment: recurVal,
  });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  const customerName = lead.name || '';
  const street = address.street || '';
  const cityState = address.cityState || '';
  const billingLines = [customerName, street, cityState].filter(Boolean);

  const pricingData = {
    initialQuote: initVal ? initVal.toFixed(2) : '',
    initialDiscount: discVal > 0 ? `-${discVal.toFixed(2)}` : '',
    subtotal: initVal ? subtotal.toFixed(2) : '',
    initialTax: initVal ? '0.00' : '',
    initialTotal: initVal ? subtotal.toFixed(2) : '',
    recurringCharge: recurVal ? recurVal.toFixed(2) : '',
    recurringTax: recurVal ? '0.00' : '',
    recurringTotal: recurVal ? recurVal.toFixed(2) : '',
    recurringAuthorized: recurVal ? recurVal.toFixed(2) : '',
    billingLines,
  };

  drawHeader(page, fonts);
  drawTopRow(page, fonts, {
    customerName,
    street,
    cityState,
    phone: lead.phone || '',
    email: lead.email || '',
  });
  drawPestsSection(page, fonts);
  drawExpectationsAndCalendar(page, fonts, schedule.scheduleMonths);
  drawPricingRow(page, fonts, pricingData);
  drawLegalSection(page, fonts);
  drawSignatureRow(page, fonts);

  const outBytes = await pdfDoc.save();
  const safeName = (lead.name || 'Quote').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_') || 'Quote';
  const outName = `${safeName}_Bed_Bug.pdf`;

  return { outBytes, outName, schedule };
}

export const BED_BUG_PAGE_SIZE = { width: PAGE_W, height: PAGE_H };
