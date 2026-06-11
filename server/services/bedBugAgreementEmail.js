/** CID referenced by the inline preview <img> in Bed Bug quote emails. */
export const BED_BUG_EMAIL_PREVIEW_CID = 'bedbug-agreement-preview';

/** Display width for the inline agreement preview in email clients. */
export const BED_BUG_EMAIL_PREVIEW_MAX_WIDTH_PX = 1000;

const COMPANY_FOOTER = `
          <p style="color:#555;font-size:13px">
            Green Shield Pest Solutions<br>
            (207) 815-2234 | ahanifi@gshieldpest.com<br>
            11 Eastview Pkwy Unit 106, Saco, ME 04072
          </p>`;

/**
 * Build HTML for a standard (non–Bed Bug) quote email.
 */
export function buildStandardQuoteEmailHtml({ firstName, hasPrepGuide }) {
  const attachmentText = hasPrepGuide
    ? 'your personalized quote and preparation guide'
    : 'your personalized quote';

  return `
        <div style="font-family:Arial,sans-serif;max-width:560px;color:#1a1a1a">
          <p>Hi ${firstName},</p>
          <p>Please find ${attachmentText} attached to this email.</p>
          <p>If you have any questions, feel free to reply here or give us a call at
             <strong>(207) 815-2234</strong>.</p>
          <p>We look forward to working with you!</p>
          <br>
          ${COMPANY_FOOTER}
        </div>
      `;
}

/**
 * Build HTML for a Bed Bug agreement email, optionally with a large inline preview image.
 */
export function buildBedBugQuoteEmailHtml({ firstName, hasPrepGuide, includePreview }) {
  const attachmentText = hasPrepGuide
    ? 'your Bed Bug agreement and preparation guide'
    : 'your Bed Bug agreement';

  const previewBlock = includePreview
    ? `
          <div style="margin:0 0 24px;">
            <img
              src="cid:${BED_BUG_EMAIL_PREVIEW_CID}"
              alt="Bed Bug Service Agreement preview"
              style="width:100%;max-width:${BED_BUG_EMAIL_PREVIEW_MAX_WIDTH_PX}px;height:auto;display:block;border:1px solid #d9d9d9;border-radius:4px;"
            />
            <p style="margin:12px 0 0;font-size:13px;color:#555;">
              A PDF copy is attached below for download and your records.
            </p>
          </div>`
    : '';

  return `
        <div style="font-family:Arial,sans-serif;max-width:${BED_BUG_EMAIL_PREVIEW_MAX_WIDTH_PX}px;color:#1a1a1a">
          <p>Hi ${firstName},</p>
          ${previewBlock}
          <p>Please find ${attachmentText} attached to this email.</p>
          <p>If you have any questions, feel free to reply here or give us a call at
             <strong>(207) 815-2234</strong>.</p>
          <p>We look forward to working with you!</p>
          <br>
          ${COMPANY_FOOTER}
        </div>
      `;
}

/**
 * Nodemailer inline attachment for the Bed Bug agreement preview image.
 */
export function buildBedBugPreviewInlineAttachment(pngBuffer) {
  return {
    filename: 'bed-bug-agreement-preview.png',
    content: pngBuffer,
    cid: BED_BUG_EMAIL_PREVIEW_CID,
    contentType: 'image/png',
  };
}
