import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';
import { join as pathJoin } from 'path';
import {
  buildBedBugAgreementPdf,
  BED_BUG_PAGE_SIZE,
  BED_BUG_FIELD_LAYOUT,
  formatBedBugPaymentText,
} from '../bedBugAgreementPdf.js';
import { BED_BUG_COMPANY, BED_BUG_TEMPLATE_FILENAME } from '../bedBugAgreementContent.js';
import { listQuoteDocuments } from '../quoteDocumentsList.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUOTES_DIR = pathJoin(__dirname, '..', '..', '..', 'assets', 'quotes');

async function extractPdfText(bytes) {
  const doc = await PDFDocument.load(bytes);
  const pdfjs = await getDocument({
    data: Uint8Array.from(bytes),
    standardFontDataUrl: join(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/',
  }).promise;
  const page = await pdfjs.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items
    .filter((item) => item.str && item.str.trim())
    .map((item) => ({
      str: item.str.trim(),
      x: item.transform[4],
      yTop: vp.height - item.transform[5],
    }));
  return {
    pageCount: doc.getPageCount(),
    text: items.map((item) => item.str).join(' '),
    items,
  };
}

function expectTextNear(items, text, { minX, maxX, minY, maxY }) {
  const hit = items.find((item) => item.str.includes(text)
    && item.x >= minX && item.x <= maxX
    && item.yTop >= minY && item.yTop <= maxY);
  expect(hit, `Expected "${text}" near x[${minX}-${maxX}] yTop[${minY}-${maxY}]`).toBeTruthy();
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

  it('uses professional template dimensions', async () => {
    const { outBytes } = await buildBedBugAgreementPdf(samplePayload);
    const doc = await PDFDocument.load(outBytes);
    const size = doc.getPage(0).getSize();
    expect(size.width).toBe(BED_BUG_PAGE_SIZE.width);
    expect(size.height).toBe(BED_BUG_PAGE_SIZE.height);
  });

  it('keeps professional template artwork (static header is image-based)', async () => {
    const { outBytes } = await buildBedBugAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@example.com');
    expect(text).toContain('Agreement');
    expect(text).not.toMatch(/Aareement/i);
    expect(BED_BUG_COMPANY.phone).toBe('(207) 815-2284');
    expect(outBytes.length).toBeGreaterThan(300_000);
  });

  it('places customer, pricing, and calendar text in calibrated regions', async () => {
    const { outBytes } = await buildBedBugAgreementPdf(samplePayload);
    const { items } = await extractPdfText(outBytes);

    expectTextNear(items, 'Jane Doe', { minX: 270, maxX: 540, minY: 145, maxY: 200 });
    expectTextNear(items, '123 Main St', { minX: 20, maxX: 280, minY: 145, maxY: 200 });
    expectTextNear(items, '599.00', { minX: 20, maxX: 280, minY: 470, maxY: 575 });
    expectTextNear(items, "Jun '26", { minX: 20, maxX: 180, minY: 285, maxY: 360 });
    expectTextNear(items, '2x(S)599.00', { minX: 20, maxX: 180, minY: 285, maxY: 360 });

    const strayBillingInCalendar = items.find((item) =>
      item.str.includes('Saco') && item.x > 500 && item.yTop > 250 && item.yTop < 380,
    );
    expect(strayBillingInCalendar).toBeFalsy();
  });

  it('builds dynamic schedule from agreement start date', async () => {
    const { schedule, outBytes } = await buildBedBugAgreementPdf(samplePayload);
    expect(schedule.scheduleMonths).toHaveLength(12);
    expect(schedule.scheduleMonths[0].label).toBe("Jun '26");
    expect(schedule.scheduleMonths[0].paymentText).toBe('2x(S)599.00');
    expect(schedule.scheduleMonths[11].label).toBe("May '27");

    const { text } = await extractPdfText(outBytes);
    expect(text).toContain("Jun '26");
    expect(text).toContain("May '27");
    expect(text).toContain('2x(S)599.00');
  });

  it('generates Jan 27 through Dec 27 from January 2027 start', async () => {
    const { schedule } = await buildBedBugAgreementPdf({
      ...samplePayload,
      startDate: '2027-01-10',
    });
    expect(schedule.scheduleMonths[0].label).toBe("Jan '27");
    expect(schedule.scheduleMonths[11].label).toBe("Dec '27");
  });

  it('marks service months with (S) on recurring payments', () => {
    expect(formatBedBugPaymentText({
      isInitialMonth: false,
      isServiceMonth: true,
      paymentText: '$65.00',
    })).toBe('(S)65.00');
  });

  it('does not hardcode May 26 through Apr 27', async () => {
    const { schedule } = await buildBedBugAgreementPdf({
      ...samplePayload,
      startDate: '2027-01-10',
    });
    expect(schedule.scheduleMonths[0].label).not.toBe("May '26");
    expect(schedule.scheduleMonths[11].label).not.toBe("Apr '27");
  });
});

describe('quote documents list', () => {
  it('contains only one Bed Bug entry', async () => {
    const files = await readdir(QUOTES_DIR);
    const bedBugFiles = files.filter((f) => /bed\s*bug/i.test(f) && f.endsWith('.pdf'));
    expect(bedBugFiles).toEqual([BED_BUG_TEMPLATE_FILENAME]);

    const listed = await listQuoteDocuments(QUOTES_DIR);
    const bedBugListed = listed.filter((f) => /bed\s*bug/i.test(f.name));
    expect(bedBugListed).toHaveLength(1);
    expect(bedBugListed[0].name).toBe(BED_BUG_TEMPLATE_FILENAME);
  });

  it('does not list Bed Bug Agreement.pdf', async () => {
    const listed = await listQuoteDocuments(QUOTES_DIR);
    expect(listed.some((f) => f.name === 'Bed Bug Agreement.pdf')).toBe(false);
  });
});
