import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, PDFName, PDFDict, rgb, StandardFonts } from 'pdf-lib';
import { applyAgreementScheduleToPdf } from './applyAgreementScheduleToPdf.js';
import { drawPestIcon } from './pestIcons.js';
import { BED_BUG_SERVICE_FREQUENCY, BED_BUG_SERVICE_TYPE } from './bedBugAgreementContent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Pre-cleaned artwork: real logo, updated phone, no service-notes row, no hardcoded months. */
const TEMPLATE_PATH = join(__dirname, '..', '..', 'assets', 'quotes', 'Bed Bug Agreement.pdf');
const PREFIX = 'bed_bug_insect_triannual';
const PAGE_W = 612;
const PAGE_H = 1008;

const WHITE = rgb(1, 1, 1);
const TEXT = rgb(0.13, 0.13, 0.13);

/**
 * Calendar cells aligned to template AcroForm payment fields.
 * monthY and payY are pdf-lib baselines (bottom-origin).
 */
const MONTH_CELLS = [
  { x: 30,    w: 88.7, monthY: 564, payY: 536 },
  { x: 122.7, w: 88.7, monthY: 564, payY: 536 },
  { x: 215.3, w: 88.7, monthY: 564, payY: 536 },
  { x: 308,   w: 88.7, monthY: 564, payY: 536 },
  { x: 400.7, w: 88.7, monthY: 564, payY: 536 },
  { x: 493.3, w: 88.7, monthY: 564, payY: 536 },
  { x: 30,    w: 88.7, monthY: 536, payY: 508 },
  { x: 122.7, w: 88.7, monthY: 536, payY: 508 },
  { x: 215.3, w: 88.7, monthY: 536, payY: 508 },
  { x: 308,   w: 88.7, monthY: 536, payY: 508 },
  { x: 400.7, w: 88.7, monthY: 536, payY: 508 },
  { x: 493.3, w: 88.7, monthY: 536, payY: 508 },
];

const PEST_ICON_PLACEMENTS = [
  { type: 'bed_bug', x: 29, y: 743 }, { type: 'ant', x: 168, y: 743 },
  { type: 'ant', x: 307, y: 743 }, { type: 'ant', x: 446, y: 743 },
  { type: 'bee', x: 29, y: 729 }, { type: 'wasp', x: 168, y: 729 },
  { type: 'spider', x: 307, y: 729 }, { type: 'bug', x: 446, y: 729 },
  { type: 'flea', x: 29, y: 715 }, { type: 'centipede', x: 168, y: 715 },
  { type: 'cricket', x: 307, y: 715 }, { type: 'silverfish', x: 446, y: 715 },
  { type: 'mouse', x: 29, y: 679 }, { type: 'rat', x: 168, y: 679 },
  { type: 'tick', x: 307, y: 679 }, { type: 'cockroach', x: 446, y: 679 },
];

function parseMoney(value) {
  return parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 0;
}

function eraseRect(page, { x, y, w, h }) {
  page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderWidth: 0 });
}

function drawCenteredText(page, text, { cx, y, size, font, color = TEXT }) {
  if (!text) return;
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

function paymentFontSize(text) {
  const len = String(text).length;
  if (len > 10) return 5;
  if (len > 8) return 5.5;
  return 6.5;
}

/**
 * Build Bed Bug agreement from the professional template artwork + dynamic overlays.
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
  const pdfDoc = await PDFDocument.load(readFileSync(TEMPLATE_PATH));
  const form = pdfDoc.getForm();

  for (const field of form.getFields()) {
    try {
      field.setFontSize(10);
      for (const widget of field.acroField.getWidgets()) {
        widget.dict.set(PDFName.of('Border'), pdfDoc.context.obj([0, 0, 0]));
        widget.dict.set(PDFName.of('BS'), pdfDoc.context.obj({ W: 0 }));
        const mkRef = widget.dict.get(PDFName.of('MK'));
        if (mkRef) {
          const mk = pdfDoc.context.lookup(mkRef);
          if (mk instanceof PDFDict) mk.delete(PDFName.of('BC'));
        }
      }
      field.setText('');
    } catch { /* ignore */ }
  }

  function fill(name, value) {
    if (value === null || value === undefined || value === '') return;
    try {
      const field = form.getTextField(`${PREFIX}_${name}`);
      field.setFontSize(10);
      field.setText(String(value));
    } catch { /* field absent */ }
  }

  const addrParts = [lead.name, address.street, address.cityState].filter(Boolean);
  fill('service_address', addrParts.join('\n'));

  const contactParts = [lead.name, lead.phone, lead.email].filter(Boolean);
  fill('customer_information', contactParts.join('\n'));

  const initVal = parseMoney(pricing.initial);
  const discVal = parseMoney(pricing.discounted);
  const recurVal = parseMoney(pricing.recurring);
  const subtotal = Math.max(0, initVal - discVal);

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

  fill('billing_info', addrParts.join('\n'));

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  form.updateFieldAppearances(helvetica);
  form.flatten();

  const page = pdfDoc.getPage(0);

  // Service type / frequency values (right column — labels are baked into cleaned template)
  eraseRect(page, { x: 88, y: 792, w: 190, h: 30 });
  page.drawText(BED_BUG_SERVICE_TYPE, { x: 404, y: 812, size: 8, font: helveticaBold, color: TEXT });
  page.drawText(BED_BUG_SERVICE_FREQUENCY, { x: 404, y: 784, size: 8, font: helvetica, color: TEXT });

  const monthLabels = schedule?.scheduleMonths ?? [];

  MONTH_CELLS.forEach((cell, i) => {
    const cx = cell.x + cell.w / 2;
    const month = monthLabels[i];
    eraseRect(page, { x: cell.x + 1, y: cell.monthY - 8, w: cell.w - 2, h: 12 });
    eraseRect(page, { x: cell.x + 1, y: cell.payY - 5, w: cell.w - 2, h: 11 });

    if (month?.label) {
      drawCenteredText(page, month.label, {
        cx, y: cell.monthY, size: 7.5, font: helveticaBold,
      });
    }
    if (month?.paymentText) {
      drawCenteredText(page, month.paymentText, {
        cx, y: cell.payY, size: paymentFontSize(month.paymentText), font: helvetica,
      });
    }
  });

  for (const { type, x, y } of PEST_ICON_PLACEMENTS) {
    drawPestIcon(page, type, x, y);
  }

  const outBytes = await pdfDoc.save();
  const safeName = (lead.name || 'Quote').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_') || 'Quote';
  const outName = `${safeName}_Bed_Bug.pdf`;

  return { outBytes, outName, schedule };
}

export const BED_BUG_PAGE_SIZE = { width: PAGE_W, height: PAGE_H };
