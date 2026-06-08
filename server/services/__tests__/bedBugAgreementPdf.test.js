import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildBedBugAgreementPdf, BED_BUG_PAGE_SIZE } from '../bedBugAgreementPdf.js';
import { BED_BUG_COMPANY } from '../bedBugAgreementContent.js';
import { generateAgreementSchedule } from '../agreementSchedule.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function extractPdfText(bytes) {
  const doc = await PDFDocument.load(bytes);

  const pdfjs = await getDocument({
    data: Uint8Array.from(bytes),
    standardFontDataUrl: join(
      __dirname,
      '..',
      '..',
      'node_modules',
      'pdfjs-dist',
      'standard_fonts',
    ) + '/',
  }).promise;

  const page = await pdfjs.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(' ');

  return {
    pageCount: doc.getPageCount(),
    text,
  };
}

describe('buildBedBugAgreementPdf', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
    pricing: { initial: '749', discounted: '150', recurring: '65' },
    startDate: '2026-06-15',
  };

  it('generates a single-page PDF without crashing', async () => {
    const { outBytes, outName } = await buildBedBugAgreementPdf(samplePayload);

    expect(outBytes).toBeInstanceOf(Uint8Array);
    expect(outBytes.length).toBeGreaterThan(1000);
    expect(outName).toBe('Jane_Doe_Bed_Bug.pdf');

    const { pageCount } = await extractPdfText(outBytes);
    expect(pageCount).toBe(1);
  });

  it('uses the professional template content with updated phone', async () => {
    const { outBytes } = await buildBedBugAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);

    expect(text).toContain('(207) 815-2284');
    expect(text).toContain('service@gshieldpest.com');
    expect(text).toContain('BED BUG & INSECT TRIANNUAL');
    expect(text).toContain('Every 120 days');
  });

  it('uses letter-tall page dimensions', async () => {
    const { outBytes } = await buildBedBugAgreementPdf(samplePayload);
    const doc = await PDFDocument.load(outBytes);
    const page = doc.getPage(0);
    const size = page.getSize();

    expect(size.width).toBe(BED_BUG_PAGE_SIZE.width);
    expect(size.height).toBe(BED_BUG_PAGE_SIZE.height);
  });

  it('uses updated company phone number in content constants', () => {
    expect(BED_BUG_COMPANY.phone).toBe('(207) 815-2284');
  });

  it('builds dynamic schedule from agreement start date', async () => {
    const { schedule, outBytes } = await buildBedBugAgreementPdf(samplePayload);

    expect(schedule.scheduleMonths).toHaveLength(12);
    expect(schedule.scheduleMonths[0].label).toBe("Jun '26");
    expect(schedule.scheduleMonths[0].paymentText).toBe('2x(S)599.00');
    expect(schedule.scheduleMonths[4].paymentText).toBe('(S)65.00');
    expect(schedule.scheduleMonths[11].label).toBe("May '27");

    const { text } = await extractPdfText(outBytes);
    expect(text).toContain("Jun '26");
    expect(text).toContain("May '27");
    expect(text).toContain('2x(S)599.00');
  });

  it('does not use hardcoded May 26 through Apr 27 months', async () => {
    const { schedule } = await buildBedBugAgreementPdf({
      ...samplePayload,
      startDate: '2027-01-10',
    });

    expect(schedule.scheduleMonths[0].label).toBe("Jan '27");
    expect(schedule.scheduleMonths[11].label).toBe("Dec '27");
  });

  it('computes pricing fields from payload', async () => {
    const scheduleOnly = generateAgreementSchedule({
      agreementType: 'bed_bug_insect_triannual',
      startDate: '2026-06-15',
      initialPayment: 599,
      recurringPayment: 65,
    });

    expect(scheduleOnly.scheduleMonths[1].paymentText).toBe('65.00');
    expect(scheduleOnly.scheduleMonths[8].paymentText).toBe('(S)65.00');
  });
});