import { describe, it, expect } from 'vitest';
import { buildBedBugInsectTriannualAgreementPdf } from '../bedBugInsectTriannualAgreementPdf.js';
import { getPlaywrightChromiumDiagnostics } from '../playwrightRuntime.js';
import { renderBedBugAgreementPreviewPng } from '../bedBugAgreementEmailPreview.js';

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

describe('renderBedBugAgreementPreviewPng', () => {
  it('renders first PDF page to a PNG buffer when Chromium is available', async () => {
    const diag = await getPlaywrightChromiumDiagnostics();
    if (!diag.ok) {
      console.warn('[bed-bug-email-preview test] Skipping — Chromium unavailable:', diag.error);
      return;
    }

    const { outBytes } = await buildBedBugInsectTriannualAgreementPdf(samplePayload);
    const pngBuffer = await renderBedBugAgreementPreviewPng(outBytes);

    expect(Buffer.isBuffer(pngBuffer)).toBe(true);
    expect(pngBuffer.length).toBeGreaterThan(10_000);
    expect(pngBuffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }, 90000);
});
