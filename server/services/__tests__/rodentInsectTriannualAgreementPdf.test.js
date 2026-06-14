import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { inflateSync } from 'zlib';
import {
  buildRodentInsectTriannualAgreementPdf,
  RIT_PAGE_SIZE,
  formatRodentInsectTriannualPaymentText,
  buildRodentInsectTriannualSchedule,
  normalizeRodentInsectTriannualAgreementData,
} from '../rodentInsectTriannualAgreementPdf.js';
import {
  RIT_ADDON_PESTS,
  RIT_AUTHORIZATION_TEXT,
  RIT_COMPANY,
  RIT_COVERED_PESTS_SECTION_TITLE,
  RIT_EXPECTATIONS_LEFT,
  RIT_EXPECTATIONS_RIGHT,
  RIT_INCLUDED_PESTS_COL_A,
  RIT_INCLUDED_PESTS_COL_B,
  RIT_INCLUDED_PESTS_COL_C,
  RIT_INCLUDED_PESTS_COL_D,
  RIT_SERVICE_DETAILS_TEXT,
  RIT_SUBSCRIPTION_TITLE,
  RIT_TITLE,
} from '../rodentInsectTriannualAgreementContent.js';
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
  const rit = listed.find((entry) => entry.serviceType === 'rodent_insect_triannual');
  if (!rit) throw new Error('rodent_insect_triannual template not found');
  return rit.index;
}

describe('buildRodentInsectTriannualAgreementPdf', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
    pricing: { initial: '749', discounted: '150', recurring: '65' },
    agreementStartDate: '2026-06-15',
  };

  const ritSamplePayload = {
    ...samplePayload,
    pricing: { initial: '449', discounted: '0', recurring: '65' },
  };

  it('generates a single-page vector PDF without crashing', async () => {
    const { outBytes, outName } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    expect(outBytes).toBeInstanceOf(Uint8Array);
    expect(outBytes.length).toBeGreaterThan(1000);
    expect(outName).toBe('Jane_Doe_Rodent_Insect_Triannual.pdf');
    const { pageCount } = await extractPdfText(outBytes);
    expect(pageCount).toBe(1);
    expect(pdfContentHasVectorGraphics(outBytes)).toBe(true);
  });

  it('renders section header titles inside bubble panels', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Service Address');
    expect(text).toContain('Customer Information');
    expect(text).toContain('Service Details');
    expect(text).toContain(RIT_COVERED_PESTS_SECTION_TITLE);
    expect(text).toContain('Expectations / Scheduling');
    expect(text).toContain(RIT_SUBSCRIPTION_TITLE);
    expect(text).toContain('Initial Service');
    expect(text).toContain('Recurring Services');
    expect(text).toContain('Billing & Payment');
    expect(text).toContain('Cancellation and Payment Authorization');
  });

  it('uses landscape letter dimensions (792×612)', async () => {
    const { outBytes, pageSize } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const doc = await PDFDocument.load(outBytes);
    const size = doc.getPage(0).getSize();
    expect(pageSize).toEqual(RIT_PAGE_SIZE);
    expect(size.width).toBe(792);
    expect(size.height).toBe(612);
  });

  it('uses single-line title and modern company header', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(RIT_TITLE);
    expect(text).not.toContain('RODENT & INSECT TRIANNUAL SERVICE AGREEMENT');
    expect(text).toContain(RIT_COMPANY.name);
    expect(text).toContain(RIT_COMPANY.phone);
    expect(text).toContain('ahanifi@gshieldpest.com');
    expect(text).toContain(`License #: ${RIT_COMPANY.license}`);
  });

  it('renders production pest list with add-ons column', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    for (const pest of [
      ...RIT_INCLUDED_PESTS_COL_A,
      ...RIT_INCLUDED_PESTS_COL_B,
      ...RIT_INCLUDED_PESTS_COL_C,
      ...RIT_INCLUDED_PESTS_COL_D,
      ...RIT_ADDON_PESTS,
    ]) {
      expect(text).toContain(pest);
    }
    expect(text).toContain('Mice');
    expect(text).toContain('Rats');
    expect(text).not.toContain('Mice/Rats');
    expect(text).not.toContain('Included Rodents');
    expect(text).not.toContain('Included Insects');
    expect(text).toContain('Add-ons');
    expect(text).toContain('Ticks/Mosquitoes');
  });

  it('renders rodent pests (Mice, Rats, Moles, Voles) with red labels', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'rodentInsectTriannualAgreementPdf.js'), 'utf8'),
    );
    expect(source).toContain('RIT_RED_RODENT_PEST_SET');
    expect(source).toContain('getLabelColor');
    expect(source).toContain('TAG_RED');
  });

  it('renders rodent & insect service description in Service Details', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(RIT_SERVICE_DETAILS_TEXT.slice(0, 40));
    expect(text).toContain('one-month visit after the initial service');
    expect(text).toContain('ensuring long-term protection for your property.');
    expect(text).not.toContain('from both rodents and insects');
    expect(text).not.toContain('Service Type:');
    expect(text).not.toContain('Frequency:');
    expect(text).not.toContain('Our quarterly insect treatment begins');
    expect(RIT_SERVICE_DETAILS_TEXT.endsWith('ensuring long-term protection for your property.')).toBe(true);
  });

  it('renders production expectations verbatim without subheading', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).not.toContain('Year Round Pest Barriers');
    expect(text).toContain(RIT_EXPECTATIONS_LEFT.slice(0, 40));
    expect(text).toContain(RIT_EXPECTATIONS_RIGHT.slice(0, 40));
    expect(text).toContain('marked with an "S" below');
    expect(text).toContain('every 120 days for one year');
  });

  it('renders production authorization text verbatim', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(RIT_AUTHORIZATION_TEXT.slice(0, 50));
    expect(text).toContain('midnight of the third business day');
  });

  it('maps pricing values into the PDF', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('449.00');
    expect(text).toContain('65.00');
  });

  it('omits legacy pricing rows', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
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

  it('buildRodentInsectTriannualSchedule returns 12 months with service months 0,1,5,9', async () => {
    const data = normalizeRodentInsectTriannualAgreementData(ritSamplePayload);
    const schedule = buildRodentInsectTriannualSchedule({
      agreementStartDate: data.agreementStartDate,
      initialTotal: data.initialSubtotal,
      recurringCharge: data.recurringCharge,
    });
    expect(schedule.scheduleMonths).toHaveLength(12);
    expect(schedule.scheduleMonths[0].label).toBe("Jun '26");
    expect(schedule.scheduleMonths[1].label).toBe("Jul '26");
    expect(schedule.scheduleMonths[5].label).toBe("Nov '26");
    expect(schedule.scheduleMonths[9].label).toBe("Mar '27");
    const serviceMonths = schedule.scheduleMonths.filter((m) => m.isServiceMonth);
    expect(serviceMonths).toHaveLength(4);
    expect(serviceMonths.map((m) => m.index)).toEqual([0, 1, 5, 9]);
  });

  it('marks initial and one-month follow-up with (S) on the calendar', async () => {
    const data = normalizeRodentInsectTriannualAgreementData(ritSamplePayload);
    const schedule = buildRodentInsectTriannualSchedule({
      agreementStartDate: data.agreementStartDate,
      initialTotal: data.initialSubtotal,
      recurringCharge: data.recurringCharge,
    });
    expect(formatRodentInsectTriannualPaymentText(schedule.scheduleMonths[0])).toBe('(S)$449.00');
    expect(formatRodentInsectTriannualPaymentText(schedule.scheduleMonths[1])).toBe('(S)65.00');
    expect(formatRodentInsectTriannualPaymentText(schedule.scheduleMonths[2])).toBe('$65.00');
    expect(formatRodentInsectTriannualPaymentText(schedule.scheduleMonths[5])).toBe('(S)65.00');
    expect(formatRodentInsectTriannualPaymentText(schedule.scheduleMonths[9])).toBe('(S)65.00');
  });

  it('marks service months with (S) on recurring payments, not 2x(S)', () => {
    expect(formatRodentInsectTriannualPaymentText({
      isInitialMonth: false,
      isServiceMonth: true,
      paymentText: '$65.00',
    })).toBe('(S)65.00');
    expect(formatRodentInsectTriannualPaymentText({
      isInitialMonth: true,
      isServiceMonth: true,
      paymentText: '$449.00',
    })).toBe('(S)$449.00');
    expect(formatRodentInsectTriannualPaymentText({
      isInitialMonth: false,
      isServiceMonth: false,
      paymentText: '$65.00',
    })).toBe('$65.00');
  });

  it('uses exact calendar title without ampersand', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(RIT_SUBSCRIPTION_TITLE);
    expect(text).not.toContain('Rodent & Insect Triannual Subscription');
  });

  it('includes signature section with 12-month period text', async () => {
    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('This agreement is for an initial period of 12 month(s).');
    expect(text).toContain('Customer Initials');
    expect(text).toContain('Customer Signature');
    expect(text).toContain('2026-06-15');
  });

  it('does not use raster template background', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'rodentInsectTriannualAgreementPdf.js'), 'utf8'),
    );
    expect(source).not.toContain('Service Agreements.pdf');
    expect(source).toContain('PDFDocument.create');
    expect(source).toContain('generateAgreementSchedule');
  });

  it('renders Covered Pests and Upgrades with five-column layout', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'rodentInsectTriannualAgreementPdf.js'), 'utf8'),
    );
    expect(source).not.toContain('drawInvertedBracket');
    expect(source).toContain('drawUnderlinedLabel');
    expect(source).toContain('RIT_ADDON_PESTS');
    expect(source).toContain('drawCheckItem');
    expect(source).toContain('contentInsetX');
    expect(source).toContain('pestGridHeight');

    const { outBytes } = await buildRodentInsectTriannualAgreementPdf(ritSamplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(RIT_COVERED_PESTS_SECTION_TITLE);
    expect(text).toContain('Add-ons');
    expect(text).not.toContain('Included Rodents');
    expect(text).not.toContain('Included Insects');
  });
});

describe('buildQuotePdf rodent_insect_triannual feature flag', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
    pricing: { initial: '449', discounted: '0', recurring: '65' },
    agreementStartDate: '2026-06-15',
    serviceType: 'rodent_insect_triannual',
  };

  let previousFlag;

  beforeEach(() => {
    previousFlag = process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF;
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF;
    else process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF = previousFlag;
  });

  it('uses vector builder when RODENT_INSECT_TRIANNUAL_VECTOR_PDF=true', async () => {
    process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF = 'true';
    const index = await resolveServiceAgreementsIndex();
    const { outBytes, outName } = await buildQuotePdf({ index, ...samplePayload });
    expect(outName).toBe('Jane_Doe_Rodent_Insect_Triannual.pdf');
    expect(pdfContentHasVectorGraphics(outBytes)).toBe(true);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(RIT_TITLE);
    expect(text).toContain(RIT_SUBSCRIPTION_TITLE);
  });

  it('uses legacy AcroForm path when flag is unset', async () => {
    delete process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF;
    const index = await resolveServiceAgreementsIndex();
    const { outBytes, outName } = await buildQuotePdf({ index, ...samplePayload });
    expect(outName).toBe('Jane_Doe_Rodent_Insect_Triannual.pdf');
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Included Rodents');
    expect(text).not.toContain('Covered Pests');
    expect(text).toContain('RODENT & INSECT TRIANNUAL SERVICE');
  });
});
