import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { inflateSync } from 'zlib';
import {
  buildBedBugInsectTriannualAgreementPdf,
  BIT_PAGE_SIZE,
  buildBedBugInsectTriannualSchedule,
  normalizeBedBugInsectTriannualAgreementData,
} from '../bedBugInsectTriannualAgreementPdf.js';
import { formatBedBugPaymentText } from '../bedBugAgreementPdf.js';
import {
  BIT_ADDON_PESTS,
  BIT_COVERED_PESTS_SECTION_TITLE,
  BIT_INCLUDED_PESTS_COL_A,
  BIT_INCLUDED_PESTS_COL_B,
  BIT_INCLUDED_PESTS_COL_C,
  BIT_SUBSCRIPTION_TITLE,
  BIT_TITLE,
} from '../bedBugInsectTriannualAgreementContent.js';
import { buildQuotePdf } from '../../routes/documents.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUOTES_DIR = join(__dirname, '..', '..', '..', 'assets', 'quotes');

function pdfContentHasVectorGraphics(bytes) {
  const raw = Buffer.from(bytes);
  const streamMarker = Buffer.from('stream\n');
  let pos = 0;
  while (pos < raw.length) {
    const idx = raw.indexOf(streamMarker, pos);
    if (idx === -1) break;
    const endIdx = raw.indexOf('endstream', idx);
    if (endIdx === -1) break;
    const streamBytes = raw.subarray(idx + streamMarker.length, endIdx);
    try {
      const decoded = streamBytes[0] === 0x78 ? inflateSync(streamBytes) : streamBytes;
      const text = decoded.toString('latin1');
      if (/\bf\b|\bf\*/.test(text) && /\bm\b|\bc\b/.test(text)) return true;
    } catch {
      // ignore non-deflate streams
    }
    pos = endIdx + 9;
  }
  return false;
}

async function extractPdfText(bytes) {
  const doc = await PDFDocument.load(bytes);
  const pdfjs = await getDocument({
    data: Uint8Array.from(bytes),
    standardFontDataUrl: join(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/',
  }).promise;
  const page = await pdfjs.getPage(1);
  const content = await page.getTextContent();
  const items = content.items
    .filter((item) => item.str && item.str.trim())
    .map((item) => ({ str: item.str.trim() }));
  return {
    pageCount: doc.getPageCount(),
    text: items.map((item) => item.str).join(' '),
    items,
  };
}

async function resolveBedBugTemplateIndex() {
  const { listQuoteDocuments } = await import('../quoteDocumentsList.js');
  const listed = await listQuoteDocuments(QUOTES_DIR);
  const bedBug = listed.find((entry) => entry.templateKind === 'bed_bug');
  if (!bedBug) throw new Error('bed_bug template not found');
  return bedBug.index;
}

describe('buildBedBugInsectTriannualAgreementPdf', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
    pricing: { initial: '749', discounted: '150', recurring: '123' },
    agreementStartDate: '2026-06-14',
    bedBugAgreement: { agreementDate: '2026-06-14', customerSignatureName: 'Adnan' },
  };

  it('generates a single-page vector PDF without crashing', async () => {
    const { outBytes, outName } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);
    expect(outBytes).toBeInstanceOf(Uint8Array);
    expect(outBytes.length).toBeGreaterThan(1000);
    expect(outName).toBe('Jane_Doe_Bed_Bug_Insect_Triannual.pdf');
    const { pageCount } = await extractPdfText(outBytes);
    expect(pageCount).toBe(1);
    expect(pdfContentHasVectorGraphics(outBytes)).toBe(true);
  });

  it('uses landscape letter dimensions (792×612)', async () => {
    const { outBytes, pageSize } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);
    const doc = await PDFDocument.load(outBytes);
    const size = doc.getPage(0).getSize();
    expect(pageSize).toEqual(BIT_PAGE_SIZE);
    expect(size.width).toBe(792);
    expect(size.height).toBe(612);
  });

  it('renders document title and covered pests section', async () => {
    const { outBytes } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(BIT_TITLE);
    expect(text).toContain(BIT_COVERED_PESTS_SECTION_TITLE);
    expect(text).toContain('Bed Bugs');
    expect(text).not.toContain('Main pest');
    expect(text).not.toContain('Included pests');
    expect(text).toContain('Add-ons');
  });

  it('renders all included pests', async () => {
    const { outBytes } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    for (const pest of [
      ...BIT_INCLUDED_PESTS_COL_A,
      ...BIT_INCLUDED_PESTS_COL_B,
      ...BIT_INCLUDED_PESTS_COL_C,
    ]) {
      expect(text).toContain(pest.label);
    }
  });

  it('renders all add-on pests', async () => {
    const { outBytes } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    for (const pest of BIT_ADDON_PESTS) {
      expect(text).toContain(pest.label);
    }
  });

  it('renders subscription title and section headers', async () => {
    const { outBytes } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(BIT_SUBSCRIPTION_TITLE);
    expect(text).toContain('Expectations / Scheduling');
    expect(text).toContain('Initial Service');
    expect(text).toContain('Recurring Services');
    expect(text).toContain('Billing & Payment');
    expect(text).toContain('Cancellation and Payment Authorization');
  });

  it('maps pricing values into the PDF', async () => {
    const { outBytes } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('599.00');
    expect(text).toContain('123.00');
  });

  it('marks initial month with 2x(S) on the calendar', async () => {
    const data = normalizeBedBugInsectTriannualAgreementData(samplePayload);
    const schedule = buildBedBugInsectTriannualSchedule({
      agreementStartDate: data.agreementStartDate,
      initialTotal: data.initialSubtotal,
      recurringCharge: data.recurringCharge,
    });
    expect(formatBedBugPaymentText(schedule.scheduleMonths[0])).toBe('2x(S)599.00');
    expect(formatBedBugPaymentText(schedule.scheduleMonths[1])).toBe('123.00');
  });

  it('uses illustrated main-pest layout with pest assets module', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'bedBugInsectTriannualAgreementPdf.js'), 'utf8'),
    );
    expect(source).toContain('embedBitPestImages');
    expect(source).toContain('drawBitMainPestColumn');
    expect(source).not.toContain('drawInvertedBracket');
    expect(source).toContain('LAYOUT_PESTS_H = 158');
    expect(source).not.toContain('drawRitPestColumn');
  });

  it('does not use raster template background', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'bedBugInsectTriannualAgreementPdf.js'), 'utf8'),
    );
    expect(source).not.toContain('Bed Bug.pdf');
    expect(source).toContain('PDFDocument.create');
  });
});

describe('buildQuotePdf bed_bug routing', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
    pricing: { initial: '749', discounted: '150', recurring: '123' },
    agreementStartDate: '2026-06-14',
    bedBugAgreement: { agreementDate: '2026-06-14' },
  };

  it('uses vector Bed Bug & Insect Triannual builder for Bed Bug.pdf', async () => {
    const index = await resolveBedBugTemplateIndex();
    const { outBytes, outName } = await buildQuotePdf({ index, ...samplePayload });
    expect(outName).toBe('Jane_Doe_Bed_Bug_Insect_Triannual.pdf');
    expect(pdfContentHasVectorGraphics(outBytes)).toBe(true);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(BIT_TITLE);
    expect(text).toContain(BIT_COVERED_PESTS_SECTION_TITLE);
    expect(text).toContain(BIT_SUBSCRIPTION_TITLE);
  });
});
