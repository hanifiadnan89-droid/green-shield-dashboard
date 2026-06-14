import nodemailer from 'nodemailer';
import { BED_BUG_EMAIL_PREVIEW_MAX_WIDTH_PX } from '../bedBugAgreementEmail.js';

const COMPANY_FOOTER = `
          <p style="color:#555;font-size:13px">
            Green Shield Pest Solutions<br>
            (207) 815-2234 | ahanifi@gshieldpest.com<br>
            11 Eastview Pkwy Unit 106, Saco, ME 04072
          </p>`;

export function buildRitSigningRequestEmailHtml({
  firstName,
  signUrl,
  hasPrepGuide,
  includePreview,
}) {
  const attachmentText = hasPrepGuide
    ? 'your Rodent &amp; Insect Triannual agreement and preparation guide'
    : 'your Rodent &amp; Insect Triannual agreement';

  const previewBlock = includePreview
    ? `
          <div style="margin:0 0 20px;">
            <img
              src="cid:quote-agreement-preview"
              alt="Agreement preview"
              style="width:100%;max-width:${BED_BUG_EMAIL_PREVIEW_MAX_WIDTH_PX}px;height:auto;display:block;border:1px solid #d9d9d9;border-radius:4px;"
            />
          </div>`
    : '';

  return `
        <div style="font-family:Arial,sans-serif;max-width:${BED_BUG_EMAIL_PREVIEW_MAX_WIDTH_PX}px;color:#1a1a1a">
          <p>Hi ${firstName},</p>
          ${previewBlock}
          <p>Please review and sign ${attachmentText} using the secure link below.</p>
          <p style="margin:24px 0;">
            <a href="${signUrl}"
               style="display:inline-block;background:#148A43;color:#fff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px;font-size:16px;">
              Review &amp; Sign Agreement
            </a>
          </p>
          <p style="font-size:14px;color:#555;">
            On the signing page you can add your initials, signature, and date, then submit.
            A signed PDF copy will be emailed to you for your records.
          </p>
          <p style="font-size:13px;color:#777;word-break:break-all;">Or copy this link: ${signUrl}</p>
          <p>If you have any questions, reply here or call <strong>(207) 815-2234</strong>.</p>
          <br>
          ${COMPANY_FOOTER}
        </div>
      `;
}

export function buildRitSigningCompleteEmailHtml({
  firstName,
  forCustomer = true,
  customerName,
}) {
  const greeting = forCustomer
    ? `<p>Hi ${firstName},</p><p>Thank you — your signed Rodent &amp; Insect Triannual agreement is attached.</p>`
    : `<p>${customerName || 'A customer'} has signed their Rodent &amp; Insect Triannual agreement.</p><p>The signed PDF is attached for your records.</p>`;

  return `
        <div style="font-family:Arial,sans-serif;max-width:560px;color:#1a1a1a">
          ${greeting}
          <p>Green Shield Pest Solutions</p>
          <br>
          ${COMPANY_FOOTER}
        </div>
      `;
}

export function getSigningNotifyEmail() {
  return (
    process.env.AGREEMENT_SIGNING_NOTIFY_EMAIL
    || process.env.GMAIL_USER
    || 'ahanifi@gshieldpest.com'
  );
}

export async function sendSigningRequestEmail({
  to,
  firstName,
  signUrl,
  hasPrepGuide,
  previewPngBuffer,
  prepGuideAttachments = [],
}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  const attachments = [...prepGuideAttachments];
  const includePreview = Boolean(previewPngBuffer);
  if (includePreview) {
    attachments.unshift({
      filename: 'agreement-preview.png',
      content: previewPngBuffer,
      cid: 'quote-agreement-preview',
      contentType: 'image/png',
    });
  }

  await transporter.sendMail({
    from: `Green Shield Pest Solutions <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Please Review & Sign Your Green Shield Agreement',
    html: buildRitSigningRequestEmailHtml({ firstName, signUrl, hasPrepGuide, includePreview }),
    attachments,
  });
}

export async function sendSignedAgreementEmails({
  customerEmail,
  customerFirstName,
  customerName,
  signedFilename,
  signedPdfBytes,
}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  const pdfAttachment = {
    filename: signedFilename,
    content: Buffer.from(signedPdfBytes),
    contentType: 'application/pdf',
  };

  const notifyEmail = getSigningNotifyEmail();
  const sends = [];

  if (customerEmail) {
    sends.push(transporter.sendMail({
      from: `Green Shield Pest Solutions <${process.env.GMAIL_USER}>`,
      to: customerEmail,
      subject: 'Your Signed Green Shield Agreement',
      html: buildRitSigningCompleteEmailHtml({
        firstName: customerFirstName,
        forCustomer: true,
      }),
      attachments: [pdfAttachment],
    }));
  }

  sends.push(transporter.sendMail({
    from: `Green Shield Pest Solutions <${process.env.GMAIL_USER}>`,
    to: notifyEmail,
    subject: `Signed agreement received — ${customerName || customerEmail || 'Customer'}`,
    html: buildRitSigningCompleteEmailHtml({
      customerName,
      forCustomer: false,
    }),
    attachments: [pdfAttachment],
  }));

  await Promise.all(sends);
}
