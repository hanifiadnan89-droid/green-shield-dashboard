import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { inflateSync } from 'zlib';
import {
  buildInsectQuarterlyAgreementPdf,
  IQ_PAGE_SIZE,
  formatInsectQuarterlyPaymentText,
  buildInsectQuarterlySchedule,
  normalizeInsectQuarterlyAgreementData,
} from '../insectQuarterlyAgreementPdf.js';
import {
  IQ_ADDON_PESTS,
  IQ_AUTHORIZATION_TEXT,
  IQ_COMPANY,
  IQ_EXPECTATIONS_TEXT,
  IQ_INCLUDED_PESTS_COL_A,
  IQ_INCLUDED_PESTS_COL_B,
  IQ_INCLUDED_PESTS_COL_C,
  IQ_INCLUDED_PESTS_COL_D,
  IQ_SUBSCRIPTION_TITLE,
  IQ_TITLE,
} from '../insectQuarterlyAgreementContent.js';
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

async function resolveServiceAgreementsIndex() {
  const { listQuoteDocuments } = await import('../quoteDocumentsList.js');
  const listed = await listQuoteDocuments(QUOTES_DIR);
  const iq = listed.find((entry) => entry.serviceType === 'insect_quarterly');
  if (!iq) throw new Error('insect_quarterly template not found');
  return iq.index;
}

describe('buildInsectQuarterlyAgreementPdf', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
    pricing: { initial: '749', discounted: '150', recurring: '65' },
    agreementStartDate: '2026-06-15',
  };

  it('generates a single-page vector PDF without crashing', async () => {
    const { outBytes, outName } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    expect(outBytes).toBeInstanceOf(Uint8Array);
    expect(outBytes.length).toBeGreaterThan(1000);
    expect(outName).toBe('Jane_Doe_Insect_Quarterly.pdf');
    const { pageCount } = await extractPdfText(outBytes);
    expect(pageCount).toBe(1);
    expect(pdfContentHasVectorGraphics(outBytes)).toBe(true);
  });

  it('renders section header titles inside bubble panels', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Service Address');
    expect(text).toContain('Customer Information');
    expect(text).toContain('Service Details');
    expect(text).toContain('Covered Pests and Upgrades');
    expect(text).toContain('Expectations / Scheduling');
    expect(text).toContain(IQ_SUBSCRIPTION_TITLE);
    expect(text).toContain('Initial Service');
    expect(text).toContain('Recurring Services');
    expect(text).toContain('Billing & Payment');
    expect(text).toContain('Cancellation and Payment Authorization');
  });

  it('uses landscape letter dimensions (792×612)', async () => {
    const { outBytes, pageSize } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const doc = await PDFDocument.load(outBytes);
    const size = doc.getPage(0).getSize();
    expect(pageSize).toEqual(IQ_PAGE_SIZE);
    expect(size.width).toBe(792);
    expect(size.height).toBe(612);
  });

  it('uses single-line title and Bed Bug company header', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(IQ_TITLE);
    expect(text).not.toContain('Insect Quarterly\n');
    expect(text).toContain(IQ_COMPANY.name);
    expect(text).toContain(IQ_COMPANY.phone);
    expect(text).toContain('ahanifi@gshieldpest.com');
    expect(text).toContain(`License #: ${IQ_COMPANY.license}`);
  });

  it('renders production pest list and add-ons exactly', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    for (const pest of [
      ...IQ_INCLUDED_PESTS_COL_A,
      ...IQ_INCLUDED_PESTS_COL_B,
      ...IQ_INCLUDED_PESTS_COL_C,
      ...IQ_INCLUDED_PESTS_COL_D,
      ...IQ_ADDON_PESTS,
    ]) {
      expect(text).toContain(pest);
    }
    expect(text).not.toContain('Included Pests');
    expect(text).not.toContain('Main pest');
    expect(text).not.toContain('Included');
    expect(text).toContain('Mice/Rats');
    expect(text).toContain('Add-ons');
  });

  it('renders quarterly service description in Service Details only', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Our quarterly insect treatment begins');
    expect(text).toContain('Follow-up visits are performed quarterly');
    expect(text).not.toContain('Service Type:');
    expect(text).not.toContain('INSECT QUARTERLY');
    expect(text).not.toContain('Every 90 days');
    expect(text).not.toContain('bed bug service begins');
  });

  it('renders production expectations paragraph verbatim', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Year Round Pest Barriers');
    expect(text).toContain(IQ_EXPECTATIONS_TEXT.slice(0, 40));
    expect(text).toContain('marked with an "S" below');
  });

  it('renders production authorization text verbatim', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(IQ_AUTHORIZATION_TEXT.slice(0, 50));
    expect(text).toContain('midnight of the third business day');
  });

  it('maps pricing values into the PDF', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('749.00');
    expect(text).toContain('599.00');
    expect(text).toContain('65.00');
  });

  it('omits legacy pricing rows', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    const initialIdx = text.indexOf('Initial Service');
    const recurringIdx = text.indexOf('Recurring Services');
    const billingIdx = text.indexOf('Billing & Payment');
    const initialSection = text.slice(initialIdx, recurringIdx);
    const recurringSection = text.slice(recurringIdx, billingIdx);
    expect(initialSection).not.toContain('Initial Total');
    expect(recurringSection).not.toContain('Recurring Payment Authorized');
    expect(text).not.toContain('Card Last Four');
    expect(text).not.toContain('Billing Info');
  });

  it('buildInsectQuarterlySchedule returns 12 months with service months 0,3,6,9', async () => {
    const data = normalizeInsectQuarterlyAgreementData(samplePayload);
    const schedule = buildInsectQuarterlySchedule({
      agreementStartDate: data.agreementStartDate,
      initialTotal: data.initialSubtotal,
      recurringCharge: data.recurringCharge,
    });
    expect(schedule.scheduleMonths).toHaveLength(12);
    expect(schedule.scheduleMonths[0].label).toBe("Jun '26");
    expect(schedule.scheduleMonths[3].label).toBe("Sep '26");
    const serviceMonths = schedule.scheduleMonths.filter((m) => m.isServiceMonth);
    expect(serviceMonths).toHaveLength(4);
    expect(serviceMonths.map((m) => m.index)).toEqual([0, 3, 6, 9]);
  });

  it('marks service months with (S) on recurring payments', () => {
    expect(formatInsectQuarterlyPaymentText({
      isInitialMonth: false,
      isServiceMonth: true,
      paymentText: '$65.00',
    })).toBe('(S)65.00');
    expect(formatInsectQuarterlyPaymentText({
      isInitialMonth: true,
      isServiceMonth: true,
      paymentText: '$599.00',
    })).toBe('(S)$599.00');
  });

  it('includes signature section with 12-month period text', async () => {
    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('This agreement is for an initial period of 12 month(s).');
    expect(text).toContain('Customer Initials');
    expect(text).toContain('Customer Signature');
    expect(text).toContain('2026-06-15');
  });

  it('does not use raster template background', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'insectQuarterlyAgreementPdf.js'), 'utf8'),
    );
    expect(source).not.toContain('Service Agreements.pdf');
    expect(source).toContain('PDFDocument.create');
    expect(source).toContain('generateAgreementSchedule');
  });

  it('renders Covered Pests without internal grouping lines or subheadings', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'insectQuarterlyAgreementPdf.js'), 'utf8'),
    );
    expect(source).not.toContain('drawInvertedBracket');
    expect(source).not.toContain('Main pest');

    const { outBytes } = await buildInsectQuarterlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Covered Pests and Upgrades');
    expect(text).not.toContain('Main pest');
    expect(text).not.toContain('Included');
  });
});

describe('buildQuotePdf insect_quarterly feature flag', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
    pricing: { initial: '749', discounted: '150', recurring: '65' },
    agreementStartDate: '2026-06-15',
    serviceType: 'insect_quarterly',
  };

  let previousFlag;

  beforeEach(() => {
    previousFlag = process.env.INSECT_QUARTERLY_VECTOR_PDF;
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.INSECT_QUARTERLY_VECTOR_PDF;
    else process.env.INSECT_QUARTERLY_VECTOR_PDF = previousFlag;
  });

  it('uses vector builder when INSECT_QUARTERLY_VECTOR_PDF=true', async () => {
    process.env.INSECT_QUARTERLY_VECTOR_PDF = 'true';
    const index = await resolveServiceAgreementsIndex();
    const { outBytes, outName } = await buildQuotePdf({ index, ...samplePayload });
    expect(outName).toBe('Jane_Doe_Insect_Quarterly.pdf');
    expect(pdfContentHasVectorGraphics(outBytes)).toBe(true);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(IQ_TITLE);
    expect(text).toContain(IQ_SUBSCRIPTION_TITLE);
  });

  it('uses legacy AcroForm path when flag is unset', async () => {
    delete process.env.INSECT_QUARTERLY_VECTOR_PDF;
    const index = await resolveServiceAgreementsIndex();
    const { outBytes, outName } = await buildQuotePdf({ index, ...samplePayload });
    expect(outName).toBe('Jane_Doe_Insect_Quarterly.pdf');
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Included Pests');
    expect(text).not.toContain('Covered Pests and Upgrades');
    expect(text).toContain('INSECT QUARTERLY SERVICE AGREEMENT');
  });
});
