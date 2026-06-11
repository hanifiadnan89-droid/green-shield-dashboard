import { describe, it, expect } from 'vitest';
import {
  BED_BUG_EMAIL_PREVIEW_CID,
  BED_BUG_EMAIL_PREVIEW_MAX_WIDTH_PX,
  buildBedBugPreviewInlineAttachment,
  buildBedBugQuoteEmailHtml,
  buildStandardQuoteEmailHtml,
} from '../bedBugAgreementEmail.js';

describe('bedBugAgreementEmail', () => {
  it('builds standard quote email without inline preview', () => {
    const html = buildStandardQuoteEmailHtml({ firstName: 'Jane', hasPrepGuide: false });
    expect(html).toContain('Hi Jane,');
    expect(html).toContain('your personalized quote');
    expect(html).not.toContain('cid:');
    expect(html).toContain('max-width:560px');
  });

  it('builds Bed Bug email with large inline preview image', () => {
    const html = buildBedBugQuoteEmailHtml({
      firstName: 'Jane',
      hasPrepGuide: false,
      includePreview: true,
    });
    expect(html).toContain(`cid:${BED_BUG_EMAIL_PREVIEW_CID}`);
    expect(html).toContain(`max-width:${BED_BUG_EMAIL_PREVIEW_MAX_WIDTH_PX}px`);
    expect(html).toContain('width:100%');
    expect(html).toContain('Bed Bug Service Agreement preview');
    expect(html).toContain('your Bed Bug agreement');
    expect(html).toContain('PDF copy is attached');
  });

  it('builds Bed Bug email without preview when render fails', () => {
    const html = buildBedBugQuoteEmailHtml({
      firstName: 'Jane',
      hasPrepGuide: true,
      includePreview: false,
    });
    expect(html).not.toContain('cid:');
    expect(html).toContain('your Bed Bug agreement and preparation guide');
  });

  it('builds nodemailer inline attachment with CID', () => {
    const png = Buffer.from('fake-png');
    const attachment = buildBedBugPreviewInlineAttachment(png);
    expect(attachment.filename).toBe('bed-bug-agreement-preview.png');
    expect(attachment.cid).toBe(BED_BUG_EMAIL_PREVIEW_CID);
    expect(attachment.contentType).toBe('image/png');
    expect(attachment.content).toBe(png);
  });
});
