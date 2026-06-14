import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  buildSignedRitAgreementPdf,
  formatSignatureDate,
  parseSigningSubmissionBody,
} from '../ritSigning.js';

const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const samplePayload = {
  lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
  pricing: { initial: '749', discounted: '150', recurring: '65' },
  address: { street: '123 Main St', cityState: 'Saco, ME 04072' },
  agreementStartDate: '2026-06-15',
};

describe('ritSigning', () => {
  it('formats signature dates for the PDF date field', () => {
    expect(formatSignatureDate('2026-06-15')).toBe('06/15/2026');
  });

  it('parses PNG data URLs from the signing form', () => {
    const parsed = parseSigningSubmissionBody({
      signatureDate: '2026-06-15',
      initialsPng: `data:image/png;base64,${SAMPLE_PNG.toString('base64')}`,
      signaturePng: `data:image/png;base64,${SAMPLE_PNG.toString('base64')}`,
      consentAccepted: true,
    });
    expect(parsed.signatureDate).toBe('2026-06-15');
    expect(Buffer.isBuffer(parsed.initialsPng)).toBe(true);
    expect(Buffer.isBuffer(parsed.signaturePng)).toBe(true);
  });

  it('builds a signed RIT PDF with embedded signature images', async () => {
    const { outBytes, dateDisplay } = await buildSignedRitAgreementPdf(samplePayload, {
      initialsPng: SAMPLE_PNG,
      signaturePng: SAMPLE_PNG,
      signatureDate: '2026-06-15',
    });

    expect(dateDisplay).toBe('06/15/2026');
    expect(outBytes.byteLength).toBeGreaterThan(10_000);

    const pdf = await PDFDocument.load(outBytes);
    expect(pdf.getPageCount()).toBe(1);

    const doc = await getDocument({ data: new Uint8Array(outBytes) }).promise;
    const page = await doc.getPage(1);
    const text = await page.getTextContent();
    const joined = text.items.map((item) => item.str).join(' ');
    expect(joined).toContain('06/15/2026');
  }, 30000);
});
