import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { generateIcs } from '../services/icsGenerator.js';
import { appendLog } from '../services/activity.js';
import { updateLead } from '../services/sheets.js';
import {
  buildSignedAgreementPdf,
  getAgreementTypeLabel,
  parseSigningSubmissionBody,
} from '../services/agreementSigning/agreementSigning.js';
import {
  sendSignedAgreementEmails,
} from '../services/agreementSigning/email.js';
import {
  isSigningSessionExpired,
  loadSigningSession,
  readOgCardPng,
  readPreviewPng,
  readSignedPdf,
  readUnsignedPdf,
  listSigningSessions,
  saveSignedPdf,
  saveSubmissionArtifacts,
  updateSigningSession,
  validateSigningSession,
} from '../services/agreementSigning/storage.js';

const publicRouter = Router();
const staffRouter = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function publicSessionView(session) {
  return {
    token: session.token,
    agreementType: session.agreementType,
    status: session.status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    signedAt: session.signedAt,
    customerName: session.lead?.name ?? '',
    hasPreview: Boolean(session.hasPreview),
    hasOgCard: Boolean(session.hasOgCard),
    expired: isSigningSessionExpired(session),
  };
}

function sendSigningAccessError(res, err, fallbackMessage = 'Signing asset not found') {
  if (err?.status === 410) {
    return res.status(410).json({ error: 'Signing link expired' });
  }
  if (err?.status === 404) {
    return res.status(404).json({ error: fallbackMessage });
  }
  return res.status(500).json({ error: 'Signing request failed' });
}

publicRouter.get('/:token', async (req, res) => {
  try {
    const session = await validateSigningSession(req.params.token);
    res.json({ session: publicSessionView(session) });
  } catch (err) {
    sendSigningAccessError(res, err, 'Signing link not found');
  }
});

publicRouter.get('/:token/og-card.png', async (req, res) => {
  try {
    const session = await validateSigningSession(req.params.token, { requireFile: 'ogCardPng' });
    const png = await readOgCardPng(session.token);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(png);
  } catch (err) {
    sendSigningAccessError(res, err, 'OG card not available');
  }
});

publicRouter.get('/:token/preview.png', async (req, res) => {
  try {
    const session = await validateSigningSession(req.params.token, { requireFile: 'previewPng' });
    const png = await readPreviewPng(session.token);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(png);
  } catch (err) {
    sendSigningAccessError(res, err, 'Preview not available');
  }
});

publicRouter.get('/:token/document.pdf', async (req, res) => {
  try {
    const session = await validateSigningSession(req.params.token, { requireFile: 'documentPdf' });

    const bytes = session.status === 'signed'
      ? await readSignedPdf(session.token)
      : await readUnsignedPdf(session.token);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="agreement.pdf"');
    res.send(bytes);
  } catch (err) {
    sendSigningAccessError(res, err, 'Document not available');
  }
});

publicRouter.get('/:token/calendar.ics', async (req, res) => {
  try {
    const session = await validateSigningSession(req.params.token, { requireCalendar: true });
    const ics = generateIcs(session.calendarParams);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="green-shield-appointment.ics"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(ics.content);
  } catch (err) {
    sendSigningAccessError(res, err, 'Calendar not found');
  }
});

publicRouter.post('/:token/submit', submitLimiter, async (req, res) => {
  try {
    const session = await validateSigningSession(req.params.token);
    if (session.status === 'signed') {
      return res.status(409).json({ error: 'This agreement has already been signed' });
    }

    const submission = parseSigningSubmissionBody(req.body);
    if (!submission.consentAccepted) {
      return res.status(400).json({ error: 'Please accept the agreement terms before submitting' });
    }

    const signedAt = new Date().toISOString();
    const { outBytes, outName, dateDisplay } = await buildSignedAgreementPdf(
      session,
      submission,
    );

    const audit = {
      token: session.token,
      agreementType: session.agreementType,
      signedAt,
      signatureDate: submission.signatureDate,
      signatureDateDisplay: dateDisplay,
      typedInitials: submission.typedInitials,
      typedSignatureName: submission.typedSignatureName,
      customerName: session.lead?.name ?? '',
      customerEmail: session.lead?.email ?? '',
      leadRowNumber: session.lead?.row_number ?? null,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    };

    const artifactPaths = await saveSubmissionArtifacts(session.token, {
      audit,
      initialsPng: submission.initialsPng,
      signaturePng: submission.signaturePng,
      signedPdfBytes: outBytes,
    });
    await saveSignedPdf(session.token, outBytes);

    const updated = await updateSigningSession(session.token, {
      status: 'signed',
      signedAt,
      outName,
      submission: {
        ...audit,
        artifactPaths,
      },
    });

    const firstName = (session.lead?.name || '').split(' ')[0] || 'there';
    const agreementLabel = getAgreementTypeLabel(session.agreementType);
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      await sendSignedAgreementEmails({
        customerEmail: session.lead?.email,
        customerFirstName: firstName,
        customerName: session.lead?.name,
        signedFilename: outName,
        signedPdfBytes: outBytes,
        agreementLabel,
      });
    }

    const noteLine = `${agreementLabel} agreement e-signed ${dateDisplay} (${session.token.slice(0, 8)}…)`;
    if (session.lead?.row_number) {
      try {
        const leadPatch = { status: 'agreement_signed' };
        if (process.env.TEST_MODE !== 'true') {
          const { getLeads } = await import('../services/sheets.js');
          const leads = await getLeads();
          const lead = leads.find((l) => l.row_number === session.lead.row_number);
          const existingNotes = lead?.notes ? `${lead.notes}\n` : '';
          leadPatch.notes = `${existingNotes}${noteLine}`.trim();
        }
        await updateLead(session.lead.row_number, leadPatch);
      } catch (err) {
        console.warn('[signing] Lead sheet update failed:', err.message);
      }
    }

    appendLog({
      type: 'agreement_signed',
      action: 'agreement_signed',
      agreementType: session.agreementType,
      token: session.token,
      customerName: session.lead?.name ?? '',
      customerEmail: session.lead?.email ?? '',
      leadRowNumber: session.lead?.row_number ?? null,
      signedAt,
      outName,
    });

    res.json({
      success: true,
      session: publicSessionView(updated),
    });
  } catch (err) {
    console.error('[signing] submit error:', err);
    if (err?.status === 410) {
      return res.status(410).json({ error: 'This signing link has expired' });
    }
    if (err?.status === 404) {
      return res.status(404).json({ error: 'Signing link not found' });
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

staffRouter.get('/sessions', async (req, res) => {
  try {
    const leadRowNumber = req.query.leadRow != null
      ? parseInt(req.query.leadRow, 10)
      : undefined;
    const status = req.query.status || undefined;
    const sessions = await listSigningSessions({ leadRowNumber, status });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

staffRouter.get('/sessions/:token', async (req, res) => {
  try {
    const session = await loadSigningSession(req.params.token);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

staffRouter.get('/sessions/:token/signed.pdf', async (req, res) => {
  try {
    const session = await loadSigningSession(req.params.token);
    if (!session || session.status !== 'signed') {
      return res.status(404).json({ error: 'Signed document not found' });
    }
    const bytes = await readSignedPdf(session.token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(session.outName || 'signed-agreement.pdf')}"`,
    );
    res.send(bytes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { publicRouter as signingPublicRouter, staffRouter as signingStaffRouter };
