import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { inflateSync } from 'zlib';
import {
  buildTickMosquitoMonthlyAgreementPdf,
  TMM_PAGE_SIZE,
  formatTickMosquitoMonthlyPaymentText,
  buildTickMosquitoMonthlySchedule,
} from '../tickMosquitoMonthlyAgreementPdf.js';
import {
  TMM_COVERED_PESTS_SECTION_TITLE,
  TMM_EXPECTATIONS_LEFT,
  TMM_EXPECTATIONS_RIGHT,
  TMM_SERVICE_DETAILS_TEXT,
  TMM_SUBSCRIPTION_TITLE,
  TMM_TICK_COLUMN,
  TMM_MOSQUITO_COLUMN,
  TMM_TITLE,
} from '../tickMosquitoMonthlyAgreementContent.js';
import { buildQuotePdf } from '../../routes/documents.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
      // ignore
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
  };
}

describe('buildTickMosquitoMonthlyAgreementPdf', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Greenway Drive', cityState: 'Saco, ME 04072' },
    pricing: { initial: '75', discounted: '0', recurring: '75' },
    agreementStartDate: '2026-06-15',
    cardLastFour: '4242',
  };

  it('generates a single-page vector PDF without crashing', async () => {
    const { outBytes, outName } = await buildTickMosquitoMonthlyAgreementPdf(samplePayload);
    expect(outBytes).toBeInstanceOf(Uint8Array);
    expect(outBytes.length).toBeGreaterThan(1000);
    expect(outName).toBe('Jane_Doe_Tick_Mosquito_Monthly.pdf');
    const { pageCount } = await extractPdfText(outBytes);
    expect(pageCount).toBe(1);
    expect(pdfContentHasVectorGraphics(outBytes)).toBe(true);
  });

  it('uses landscape letter dimensions (792×612)', async () => {
    expect(TMM_PAGE_SIZE).toEqual({ width: 792, height: 612 });
  });

  it('renders tick and mosquito coverage section content', async () => {
    const { outBytes } = await buildTickMosquitoMonthlyAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(TMM_TITLE);
    expect(text).toContain(TMM_COVERED_PESTS_SECTION_TITLE);
    expect(text).not.toContain('Perimeter vegetation');
    expect(text).not.toContain('Shrubs & ornamentals');
    expect(text).not.toContain('Ticks');
    expect(text).not.toContain('Mosquitoes');
    expect(text).toContain(TMM_SUBSCRIPTION_TITLE);
    expect(text).toContain('Billing Method:');
    expect(text).toContain('Service Charge (per visit):');
    expect(text).toContain(TMM_SERVICE_DETAILS_TEXT.slice(0, 40));
    expect(text).toContain(TMM_EXPECTATIONS_LEFT.slice(0, 40));
    expect(text).toContain('(207) 815-1003');
    expect(text).toContain(TMM_EXPECTATIONS_RIGHT.slice(0, 40));
    expect(text).toContain('visits are indicated below');
  });

  it('marks seasonal off-months with em dash on calendar tiles', () => {
    const schedule = buildTickMosquitoMonthlySchedule({
      agreementStartDate: '2026-06-15',
      initialTotal: 75,
      recurringCharge: 75,
    });
    const offMonth = schedule.scheduleMonths.find((month) => !month.paymentText && !month.isInitialMonth);
    expect(offMonth).toBeTruthy();
    expect(formatTickMosquitoMonthlyPaymentText(offMonth)).toBe('—');
  });

  it('does not use raster template background', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'tickMosquitoMonthlyAgreementPdf.js'), 'utf8'),
    );
    expect(source).not.toContain('Service Agreements.pdf');
    expect(source).toContain('PDFDocument.create');
    expect(source).toContain('drawTmmCoverageColumn');
  });
});

describe('buildQuotePdf tick_mosquito_monthly feature flag', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Greenway Drive', cityState: 'Saco, ME 04072' },
    pricing: { initial: '75', discounted: '0', recurring: '75' },
    agreementStartDate: '2026-06-15',
    serviceType: 'tick_mosquito_monthly',
    cardLastFour: '4242',
  };

  let previousFlag;

  beforeEach(() => {
    previousFlag = process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF;
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF;
    else process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF = previousFlag;
  });

  it('uses vector builder when TICK_MOSQUITO_MONTHLY_VECTOR_PDF=true', async () => {
    process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF = 'true';
    const { listQuoteDocuments } = await import('../quoteDocumentsList.js');
    const listed = await listQuoteDocuments(join(__dirname, '..', '..', '..', 'assets', 'quotes'));
    const tmm = listed.find((entry) => entry.serviceType === 'tick_mosquito_monthly');
    if (!tmm) return;
    const { outBytes, outName } = await buildQuotePdf({ index: tmm.index, ...samplePayload });
    expect(outName).toBe('Jane_Doe_Tick_Mosquito_Monthly.pdf');
    expect(pdfContentHasVectorGraphics(outBytes)).toBe(true);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain(TMM_TITLE);
  });
});
