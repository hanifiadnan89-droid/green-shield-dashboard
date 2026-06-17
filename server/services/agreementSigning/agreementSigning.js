import { buildBedBugInsectTriannualAgreementPdf } from '../bedBugInsectTriannualAgreementPdf.js';
import { buildRodentInsectTriannualAgreementPdf } from '../rodentInsectTriannualAgreementPdf.js';
import { buildInsectQuarterlyAgreementPdf } from '../insectQuarterlyAgreementPdf.js';
import { isInsectQuarterlyVectorPdfEnabled } from '../insectQuarterlyVectorPdfFlag.js';
import { buildTickMosquitoMonthlyAgreementPdf } from '../tickMosquitoMonthlyAgreementPdf.js';
import { isTickMosquitoMonthlyVectorPdfEnabled } from '../tickMosquitoMonthlyVectorPdfFlag.js';
import { isRodentInsectTriannualVectorPdfEnabled } from '../rodentInsectTriannualVectorPdfFlag.js';
import { BED_BUG_TEMPLATE_FILENAME } from '../quoteDocumentsList.js';
import { tryRenderBedBugAgreementPreviewPng } from '../bedBugAgreementEmailPreview.js';
import { stampSignaturesOnPdf } from './stampSignaturesOnPdf.js';
import {
  buildSigningExpiryDate,
  buildSigningUrl,
  createSigningToken,
  readUnsignedPdf,
  savePreviewPng,
  saveSigningSession,
  saveUnsignedPdf,
} from './storage.js';

export const AGREEMENT_TYPE_LABELS = {
  bed_bug_insect_triannual: 'Bed Bug & Insect Triannual',
  rodent_insect_triannual: 'Rodent & Insect Triannual',
  insect_quarterly: 'Insect Quarterly',
  commercial_bimonthly: 'Commercial Bi-Monthly',
  commercial_monthly: 'Commercial Monthly',
  tick_mosquito_monthly: 'Tick & Mosquito Monthly',
};

const VECTOR_SIGNING_TYPES = new Set([
  'bed_bug_insect_triannual',
  'rodent_insect_triannual',
  'insect_quarterly',
  'tick_mosquito_monthly',
]);

function supportsVectorRebuild(agreementType) {
  if (agreementType === 'bed_bug_insect_triannual') return true;
  if (agreementType === 'rodent_insect_triannual') return isRodentInsectTriannualVectorPdfEnabled();
  if (agreementType === 'insect_quarterly') return isInsectQuarterlyVectorPdfEnabled();
  if (agreementType === 'tick_mosquito_monthly') return isTickMosquitoMonthlyVectorPdfEnabled();
  return false;
}

/** @deprecated Use AGREEMENT_TYPE_LABELS keys — kept for existing sessions/tests. */
export const RIT_AGREEMENT_TYPE = 'rodent_insect_triannual';

export function resolveAgreementType({ templateName, serviceType }) {
  if (templateName === BED_BUG_TEMPLATE_FILENAME) return 'bed_bug_insect_triannual';
  if (serviceType) return serviceType;
  return 'quote';
}

export function getAgreementTypeLabel(agreementType) {
  return AGREEMENT_TYPE_LABELS[agreementType] || 'service';
}

export function formatSignatureDate(isoDate) {
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

async function buildVectorSignedPdf(agreementType, quotePayload, submission) {
  const dateDisplay = formatSignatureDate(submission.signatureDate);
  const signatureOptions = {
    signatures: {
      initialsPng: submission.initialsPng,
      signaturePng: submission.signaturePng,
      signatureDate: dateDisplay,
    },
  };

  if (agreementType === 'bed_bug_insect_triannual') {
    const { outBytes, outName } = await buildBedBugInsectTriannualAgreementPdf(
      quotePayload,
      signatureOptions,
    );
    return { outBytes, outName, dateDisplay };
  }

  if (agreementType === 'rodent_insect_triannual') {
    const { outBytes, outName } = await buildRodentInsectTriannualAgreementPdf(
      quotePayload,
      signatureOptions,
    );
    return { outBytes, outName, dateDisplay };
  }

  if (agreementType === 'insect_quarterly') {
    const { outBytes, outName } = await buildInsectQuarterlyAgreementPdf(
      quotePayload,
      signatureOptions,
    );
    return { outBytes, outName, dateDisplay };
  }

  if (agreementType === 'tick_mosquito_monthly') {
    const { outBytes, outName } = await buildTickMosquitoMonthlyAgreementPdf(
      quotePayload,
      signatureOptions,
    );
    return { outBytes, outName, dateDisplay };
  }

  throw Object.assign(new Error(`Unsupported vector agreement type: ${agreementType}`), { status: 400 });
}

/**
 * Rebuild a signed agreement PDF from the stored quote payload and customer signatures.
 */
export async function buildSignedAgreementPdf(session, submission) {
  const { agreementType, quotePayload, token } = session;
  const dateDisplay = formatSignatureDate(submission.signatureDate);

  if (VECTOR_SIGNING_TYPES.has(agreementType) && supportsVectorRebuild(agreementType)) {
    return buildVectorSignedPdf(agreementType, quotePayload, submission);
  }

  const unsignedBytes = await readUnsignedPdf(token);
  const outBytes = await stampSignaturesOnPdf(unsignedBytes, {
    initialsPng: submission.initialsPng,
    signaturePng: submission.signaturePng,
    signatureDate: dateDisplay,
  });

  const baseName = session.outName || 'agreement.pdf';
  const outName = baseName.replace(/\.pdf$/i, '_signed.pdf');

  return { outBytes, outName, dateDisplay };
}

/** @deprecated Use createAgreementSigningSession */
export const createRitSigningSession = createAgreementSigningSession;

export async function createAgreementSigningSession({
  agreementType,
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
    agreementType,
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

/** @deprecated Use buildSignedAgreementPdf */
export async function buildSignedRitAgreementPdf(quotePayload, submission) {
  return buildVectorSignedPdf('rodent_insect_triannual', quotePayload, submission);
}
