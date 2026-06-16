import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  buildSignedAgreementPdf,
  formatSignatureDate,
  getAgreementTypeLabel,
  parseSigningSubmissionBody,
  resolveAgreementType,
} from '../agreementSigning.js';
import { stampSignaturesOnPdf } from '../stampSignaturesOnPdf.js';

const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const samplePayload = {
  lead: { name: 'Jane Doe', email: 'jane@example.com', phone: '207-555-0100' },
  address: { street: '123 Main St', city: 'Saco', state: 'ME', zip: '04072' },
  pricing: { initial: '749', discounted: '150', recurring: '65' },
  agreementStartDate: '2026-06-15',
  bedBugAgreement: { agreementDate: '2026-06-15' },
};

describe('agreementSigning', () => {
  it('resolves agreement types from template metadata', () => {
    expect(resolveAgreementType({ templateName: 'Bed Bug.pdf' })).toBe('bed_bug_insect_triannual');
    expect(resolveAgreementType({ serviceType: 'insect_quarterly' })).toBe('insect_quarterly');
    expect(getAgreementTypeLabel('bed_bug_insect_triannual')).toContain('Bed Bug');
  });

  it('formats signature dates for PDF fields', () => {
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
  });

  it('builds a signed bed bug vector PDF with embedded signature images', async () => {
    const session = {
      token: 'test-token',
      agreementType: 'bed_bug_insect_triannual',
      quotePayload: samplePayload,
      outName: 'Jane_Doe_Bed_Bug_Insect_Triannual.pdf',
    };
    const submission = {
      signatureDate: '2026-06-15',
      initialsPng: SAMPLE_PNG,
      signaturePng: SAMPLE_PNG,
    };

    const { outBytes, dateDisplay } = await buildSignedAgreementPdf(session, submission);
    expect(dateDisplay).toBe('06/15/2026');
    expect(outBytes.byteLength).toBeGreaterThan(10_000);

    const pdf = await PDFDocument.load(outBytes);
    expect(pdf.getPageCount()).toBe(1);
  }, 60000);

  it('builds a signed insect quarterly vector PDF with embedded signature images', async () => {
    const session = {
      token: 'test-token-iq',
      agreementType: 'insect_quarterly',
      quotePayload: {
        lead: samplePayload.lead,
        address: samplePayload.address,
        pricing: samplePayload.pricing,
        agreementStartDate: samplePayload.agreementStartDate,
      },
      outName: 'Jane_Doe_Insect_Quarterly.pdf',
    };
    const submission = {
      signatureDate: '2026-06-15',
      initialsPng: SAMPLE_PNG,
      signaturePng: SAMPLE_PNG,
    };

    const { outBytes, dateDisplay, outName } = await buildSignedAgreementPdf(session, submission);
    expect(dateDisplay).toBe('06/15/2026');
    expect(outName).toBe('Jane_Doe_Insect_Quarterly.pdf');
    expect(outBytes.byteLength).toBeGreaterThan(10_000);

    const pdf = await PDFDocument.load(outBytes);
    expect(pdf.getPageCount()).toBe(1);
  }, 60000);

  it('stamps signatures onto legacy flattened PDF bytes', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([792, 612]);
    const unsigned = await pdfDoc.save();

    const stamped = await stampSignaturesOnPdf(unsigned, {
      initialsPng: SAMPLE_PNG,
      signaturePng: SAMPLE_PNG,
      signatureDate: '06/15/2026',
    });

    expect(stamped.byteLength).toBeGreaterThan(unsigned.byteLength);
  });
});
