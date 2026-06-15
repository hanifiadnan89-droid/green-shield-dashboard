/** Backward-compatible re-exports — prefer agreementSigning.js for new code. */
export {
  RIT_AGREEMENT_TYPE,
  buildSignedRitAgreementPdf,
  createRitSigningSession,
  createAgreementSigningSession,
  buildSignedAgreementPdf,
  parseSigningSubmissionBody,
  formatSignatureDate,
  resolveAgreementType,
  getAgreementTypeLabel,
} from './agreementSigning.js';
