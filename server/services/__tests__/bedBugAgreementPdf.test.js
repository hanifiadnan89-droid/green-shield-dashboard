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
  buildSubscriptionSchedule,
  normalizeBedBugAgreementData,
  validateBedBugAgreementData,
  parseCityStateZip,
} from '../bedBugAgreementPdf.js';
import {
  BED_BUG_COMPANY,
  BED_BUG_EMAIL_DISABLED,
  BED_BUG_EMAIL_DISABLED_MESSAGE,
  BED_BUG_TEMPLATE_FILENAME,
  BED_BUG_TITLE,
} from '../bedBugAgreementContent.js';
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

describe('buildBedBugAgreementPdf', () => {
  const samplePayload = {
    lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
    address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
    pricing: { initial: '749', discounted: '150', recurring: '65' },
    agreementStartDate: '2026-06-15',
    bedBugAgreement: {
      agreementDate: '2026-06-15',
      customerInitials: 'JD',
      customerSignatureName: 'Jane Doe',
    },
  };

  it('generates a single-page vector PDF without crashing', async () => {
    const { outBytes, outName } = await buildBedBugAgreementPdf(samplePayload);
    expect(outBytes).toBeInstanceOf(Uint8Array);
    expect(outBytes.length).toBeGreaterThan(1000);
    expect(outName).toBe('Jane_Doe_Bed_Bug.pdf');
    const { pageCount } = await extractPdfText(outBytes);
    expect(pageCount).toBe(1);
  });

  it('uses landscape letter dimensions (792×612)', async () => {
    const { outBytes, pageSize } = await buildBedBugAgreementPdf(samplePayload);
    const doc = await PDFDocument.load(outBytes);
    const size = doc.getPage(0).getSize();
    expect(pageSize).toEqual(BED_BUG_PAGE_SIZE);
    expect(size.width).toBe(792);
    expect(size.height).toBe(612);
  });

  it('renders vector text with customer and company content', async () => {
    const { outBytes } = await buildBedBugAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@example.com');
    expect(text).toContain('123 Main St');
    expect(text).toContain(BED_BUG_TITLE);
    expect(text).toContain(BED_BUG_COMPANY.name);
    expect(text).toContain(BED_BUG_COMPANY.phone);
    expect(text).not.toMatch(/Aareement/i);
  });

  it('maps pricing values into the PDF', async () => {
    const { outBytes } = await buildBedBugAgreementPdf(samplePayload);
    const { text } = await extractPdfText(outBytes);
    expect(text).toContain('749.00');
    expect(text).toContain('599.00');
    expect(text).toContain('65.00');
  });

  it('buildSubscriptionSchedule returns 12 months from start date', async () => {
    const data = normalizeBedBugAgreementData(samplePayload);
    const schedule = buildSubscriptionSchedule({
      agreementStartDate: data.agreementStartDate,
      initialTotal: data.initialTotal,
      recurringCharge: data.recurringCharge,
    });
    expect(schedule.scheduleMonths).toHaveLength(12);
    expect(schedule.scheduleMonths[0].label).toBe("Jun '26");
    expect(schedule.scheduleMonths[11].label).toBe("May '27");
  });

  it('builds dynamic schedule in generated PDF', async () => {
    const { schedule, outBytes } = await buildBedBugAgreementPdf(samplePayload);
    expect(schedule.scheduleMonths).toHaveLength(12);
    expect(schedule.scheduleMonths[0].paymentText).toBe('2x(S)599.00');

    const { text } = await extractPdfText(outBytes);
    expect(text).toContain("Jun '26");
    expect(text).toContain("May '27");
    expect(text).toContain('2x(S)599.00');
  });

  it('generates Jan 27 through Dec 27 from January 2027 start', async () => {
    const { schedule } = await buildBedBugAgreementPdf({
      ...samplePayload,
      agreementStartDate: '2027-01-10',
      bedBugAgreement: { ...samplePayload.bedBugAgreement, agreementDate: '2027-01-10' },
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

  it('validates required bed bug fields', () => {
    const data = normalizeBedBugAgreementData({});
    const errors = validateBedBugAgreementData(data, {});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /customer name/i.test(e))).toBe(true);
    expect(errors.some((e) => /service address/i.test(e))).toBe(true);
  });

  it('does not use raster template background', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(join(__dirname, '..', 'bedBugAgreementPdf.js'), 'utf8'),
    );
    expect(source).not.toContain('readFileSync(TEMPLATE_PATH)');
    expect(source).toContain('PDFDocument.create');
    expect(source).toContain('generateAgreementSchedule');
  });

  it('parseCityStateZip splits combined city/state/zip strings', () => {
    expect(parseCityStateZip('Westbrook, ME 04092')).toEqual({
      city: 'Westbrook',
      state: 'ME',
      zip: '04092',
    });
    expect(parseCityStateZip('Saco, ME 04072')).toEqual({
      city: 'Saco',
      state: 'ME',
      zip: '04072',
    });
  });

  it('uses separate city, state, zip fields as source of truth', async () => {
    const { outBytes, data } = await buildBedBugAgreementPdf({
      lead: { name: 'Adnan', email: 'a@example.com', phone: '2078897999' },
      pricing: { initial: '799', discounted: '150', recurring: '65' },
      agreementStartDate: '2026-06-10',
      bedBugAgreement: {
        serviceAddress: '34B Cloudman St',
        city: 'Westbrook',
        state: 'Maine',
        zip: '04092',
        agreementDate: '2026-06-10',
        initialQuote: '799',
        recurringCharge: '65',
        initialTotal: '649',
      },
    });
    expect(data.city).toBe('Westbrook');
    expect(data.state).toBe('Maine');
    expect(data.zip).toBe('04092');

    const { text, pageCount } = await extractPdfText(outBytes);
    expect(pageCount).toBe(1);
    expect(text).toContain('34B Cloudman St');
    expect(text).toContain('Westbrook');
    expect(text).toContain('Maine');
    expect(text).toContain('04092');
    expect(text).toContain('Main pest');
    expect(text).toContain('Included');
    expect(text).not.toContain('Other included');
    expect(text).toContain('Carpenter Bees');
    expect(text).toContain('Crickets/Earwigs');
    expect(text).toContain('Yellow Jackets/Hornets');
    expect(text).toContain('Silverfish');
    expect(text).toContain('Stink Bugs');
    expect(text).not.toContain('Payment Method / Card Last Four');
    expect(text).not.toContain('Billing Info');
  });

  it('does not show zip in Billing & Payment grid', async () => {
    const { outBytes } = await buildBedBugAgreementPdf({
      lead: { name: 'Adnan' },
      bedBugAgreement: {
        serviceAddress: '34B Cloudman St',
        city: 'Westbrook',
        state: 'Maine',
        zip: '04092',
        agreementDate: '2026-06-10',
        initialQuote: '100',
        recurringCharge: '65',
        initialTotal: '100',
      },
    });
    const { text } = await extractPdfText(outBytes);
    const billingIdx = text.indexOf('Billing & Payment');
    const authIdx = text.indexOf('Cancellation and Payment Authorization');
    const billingSection = text.slice(billingIdx, authIdx);
    expect(billingSection).toContain('Customer Name');
    expect(billingSection).toContain('Westbrook');
    expect(billingSection).toContain('Maine');
    expect(billingSection).not.toMatch(/\bZip\b/);
  });

  it('passes Adnan emergency payload with readable output', async () => {
    const adnanPayload = {
      lead: {
        name: 'Adnan',
        phone: '2078897999',
        email: 'hanifi.adnan89@gmail.com',
      },
      pricing: { initial: '799', discounted: '150', recurring: '65' },
      agreementStartDate: '2026-06-15',
      address: { street: '11 Eastview Pkwy', cityState: 'Saco, ME 04072' },
      bedBugAgreement: { agreementDate: '2026-06-15' },
    };

    const { outBytes, schedule } = await buildBedBugAgreementPdf(adnanPayload);
    const { pageCount, text } = await extractPdfText(outBytes);

    expect(pageCount).toBe(1);
    expect(schedule.scheduleMonths[0].label).toBe("Jun '26");
    expect(text).toContain('649.00');
    expect(text).toContain('2078897999');
    expect(text).toContain('hanifi.adnan89@gmail.com');
    expect(text).toContain('Cancellation and Payment Authorization');
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
    expect(bedBugListed[0].templateKind).toBe('bed_bug');
  });

  it('does not list Bed Bug Agreement.pdf', async () => {
    const listed = await listQuoteDocuments(QUOTES_DIR);
    expect(listed.some((f) => f.name === 'Bed Bug Agreement.pdf')).toBe(false);
  });

  it('exposes env-configurable email disabled metadata', async () => {
    expect(typeof BED_BUG_EMAIL_DISABLED).toBe('boolean');
    expect(BED_BUG_EMAIL_DISABLED_MESSAGE).toContain('BED_BUG_EMAIL_DISABLED');

    const listed = await listQuoteDocuments(QUOTES_DIR);
    const bedBug = listed.find((f) => f.name === BED_BUG_TEMPLATE_FILENAME);
    if (BED_BUG_EMAIL_DISABLED) {
      expect(bedBug?.emailDisabled).toBe(true);
      expect(bedBug?.emailDisabledMessage).toBe(BED_BUG_EMAIL_DISABLED_MESSAGE);
    } else {
      expect(bedBug?.emailDisabled).toBeUndefined();
    }
  });
});
