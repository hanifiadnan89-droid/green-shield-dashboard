import { buildRodentInsectTriannualAgreementPdf } from '../rodentInsectTriannualAgreementPdf.js';
import { tryRenderBedBugAgreementPreviewPng } from '../bedBugAgreementEmailPreview.js';
import {
  buildSigningExpiryDate,
  buildSigningUrl,
  createSigningToken,
  savePreviewPng,
  saveSigningSession,
  saveUnsignedPdf,
} from './storage.js';

export const RIT_AGREEMENT_TYPE = 'rodent_insect_triannual';

function formatSignatureDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) return String(isoDate);
  return `${month}/${day}/${year}`;
}

function decodeDataUrlPng(dataUrl, label) {
  const value = String(dataUrl || '').trim();
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/i.exec(value);
  if (!match) {
    throw Object.assign(new Error(`Invalid ${label} image`), { status: 400 });
  }
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length < 32) {
    throw Object.assign(new Error(`${label} image is empty`), { status: 400 });
  }
  return buffer;
}

export async function buildSignedRitAgreementPdf(quotePayload, {
  initialsPng,
  signaturePng,
  signatureDate,
}) {
  const dateDisplay = formatSignatureDate(signatureDate);
  const { outBytes, outName } = await buildRodentInsectTriannualAgreementPdf(quotePayload, {
    signatures: {
      initialsPng,
      signaturePng,
      signatureDate: dateDisplay,
    },
  });
  return { outBytes, outName, dateDisplay };
}

export async function createRitSigningSession({
  quotePayload,
  lead = {},
  outBytes,
  outName,
  req,
  sentBy = 'dashboard',
}) {
  const token = createSigningToken();
  const createdAt = new Date().toISOString();

  const session = {
    token,
    agreementType: RIT_AGREEMENT_TYPE,
    status: 'pending',
    createdAt,
    expiresAt: buildSigningExpiryDate(createdAt),
    lead: {
      row_number: lead.row_number ?? quotePayload?.lead?.row_number ?? null,
      name: lead.name ?? quotePayload?.lead?.name ?? '',
      email: lead.email ?? quotePayload?.lead?.email ?? '',
      phone: lead.phone ?? quotePayload?.lead?.phone ?? '',
    },
    quotePayload,
    outName,
    sentBy,
    signedAt: null,
    submission: null,
  };

  await saveSigningSession(session);
  await saveUnsignedPdf(token, outBytes);

  const preview = await tryRenderBedBugAgreementPreviewPng(outBytes);
  if (preview.ok) {
    await savePreviewPng(token, preview.pngBuffer);
    session.hasPreview = true;
    await saveSigningSession(session);
  }

  return {
    session,
    signUrl: buildSigningUrl(token, req),
    token,
  };
}

export function parseSigningSubmissionBody(body = {}) {
  const signatureDate = String(body.signatureDate || '').trim();
  if (!signatureDate) {
    throw Object.assign(new Error('Signature date is required'), { status: 400 });
  }

  const initialsPng = decodeDataUrlPng(body.initialsPng, 'initials');
  const signaturePng = decodeDataUrlPng(body.signaturePng, 'signature');

  return {
    signatureDate,
    initialsPng,
    signaturePng,
    typedInitials: String(body.typedInitials || '').trim(),
    typedSignatureName: String(body.typedSignatureName || '').trim(),
    consentAccepted: body.consentAccepted === true,
  };
}

export { formatSignatureDate };
