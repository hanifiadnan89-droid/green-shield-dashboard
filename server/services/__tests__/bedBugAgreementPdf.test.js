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
  formatBedBugPaymentText,
} from '../bedBugAgreementPdf.js';
import {
  BED_BUG_COMPANY,
  BED_BUG_EMAIL_DISABLED,
  BED_BUG_EMAIL_DISABLED_MESSAGE,
  BED_BUG_TEMPLATE_FILENAME,
} from '../bedBugAgreementContent.js';
import { listQuoteDocuments } from '../quoteDocumentsList.js';
import { readFileSync } from 'fs';

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

  it('uses stable professional template dimensions from pdf-lib', async () => {
    const templateBytes = readFileSync(join(QUOTES_DIR, BED_BUG_TEMPLATE_FILENAME));
    const templateDoc = await PDFDocument.load(templateBytes);
    const templateSize = templateDoc.getPage(0).getSize();

    const { outBytes, pageSize } = await buildBedBugAgreementPdf(samplePayload);
    const doc = await PDFDocument.load(outBytes);
    const size = doc.getPage(0).getSize();

    expect(templateSize.width).toBe(BED_BUG_PAGE_SIZE.width);
    expect(templateSize.height).toBe(BED_BUG_PAGE_SIZE.height);
    expect(pageSize).toEqual(templateSize);
    expect(size.width).toBe(BED_BUG_PAGE_SIZE.width);
    expect(size.height).toBe(BED_BUG_PAGE_SIZE.height);
  });

  it('keeps professional template artwork (static header is image-based)', async () => {
    const { outBytes } = await buildBedBugAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@example.com');
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

  it('does not import applyAgreementScheduleToPdf (manual overlay path only)', async () => {
    const source = readFileSync(join(__dirname, '..', 'bedBugAgreementPdf.js'), 'utf8');
    expect(source).not.toContain('applyAgreementScheduleToPdf');
    expect(source).toContain('generateAgreementSchedule');
  });

  it('passes Adnan emergency payload with correct regions', async () => {
    const adnanPayload = {
      lead: {
        name: 'Adnan',
        phone: '2078897999',
        email: 'hanifi.adnan89@gmail.com',
      },
      pricing: { initial: '799', discounted: '150', recurring: '65' },
      startDate: '2026-06-15',
      address: { street: '11 Eastview Pkwy', cityState: 'Saco, ME 04072' },
    };

    const { outBytes, schedule } = await buildBedBugAgreementPdf(adnanPayload);
    const { items, pageCount, text } = await extractPdfText(outBytes);

    expect(pageCount).toBe(1);
    expect(schedule.scheduleMonths[0].label).toBe("Jun '26");
    expect(schedule.scheduleMonths[11].label).toBe("May '27");
    expect(text).toContain('649.00');
    expect(text).toContain('2078897999');
    expect(text).toContain('hanifi.adnan89@gmail.com');
    expect(text).not.toMatch(/Aareement/i);

    const strayAgreementFooter = items.find((item) =>
      item.str === 'Agreement' && item.yTop > 550,
    );
    expect(strayAgreementFooter).toBeFalsy();

    expectTextNear(items, 'Adnan', { minX: 270, maxX: 540, minY: 145, maxY: 225 });
    expectTextNear(items, '2078897999', { minX: 270, maxX: 540, minY: 145, maxY: 225 });
    expectTextNear(items, 'hanifi.adnan89@gmail.com', { minX: 270, maxX: 540, minY: 145, maxY: 225 });
    expectTextNear(items, '649.00', { minX: 20, maxX: 280, minY: 470, maxY: 575 });
    expectTextNear(items, "Jun '26", { minX: 20, maxX: 180, minY: 285, maxY: 360 });

    const adnanInHeader = items.find((item) =>
      item.str.includes('Adnan') && item.yTop < 120,
    );
    expect(adnanInHeader).toBeFalsy();
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

  it('marks Bed Bug template email as disabled until layout QA', async () => {
    expect(BED_BUG_EMAIL_DISABLED).toBe(true);
    const listed = await listQuoteDocuments(QUOTES_DIR);
    const bedBug = listed.find((f) => f.name === BED_BUG_TEMPLATE_FILENAME);
    expect(bedBug?.emailDisabled).toBe(true);
    expect(bedBug?.emailDisabledMessage).toBe(BED_BUG_EMAIL_DISABLED_MESSAGE);
  });
});
