import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SIGNING_ROOT = join(__dirname, '..', '..', 'data', 'agreement-signing');

export const SIGNING_DIRS = {
  sessions: join(SIGNING_ROOT, 'sessions'),
  unsigned: join(SIGNING_ROOT, 'unsigned'),
  signed: join(SIGNING_ROOT, 'signed'),
  previews: join(SIGNING_ROOT, 'previews'),
  submissions: join(SIGNING_ROOT, 'submissions'),
  index: join(SIGNING_ROOT, 'index'),
};

const DEFAULT_TTL_DAYS = parseInt(process.env.AGREEMENT_SIGNING_TTL_DAYS || '30', 10);

export function createSigningToken() {
  return randomBytes(24).toString('hex');
}

export async function ensureSigningDirs() {
  await Promise.all(Object.values(SIGNING_DIRS).map((dir) => fs.mkdir(dir, { recursive: true })));
}

function sessionPath(token) {
  return join(SIGNING_DIRS.sessions, `${token}.json`);
}

function indexPath(token) {
  return join(SIGNING_DIRS.index, `${token}.json`);
}

export function buildSigningExpiryDate(createdAt = new Date(), ttlDays = DEFAULT_TTL_DAYS) {
  const expires = new Date(createdAt);
  expires.setDate(expires.getDate() + ttlDays);
  return expires.toISOString();
}

export function isSigningSessionExpired(session) {
  if (!session?.expiresAt) return false;
  return Date.now() > new Date(session.expiresAt).getTime();
}

/**
 * @param {object} session
 */
export async function saveSigningSession(session) {
  await ensureSigningDirs();
  const payload = JSON.stringify(session, null, 2);
  await fs.writeFile(sessionPath(session.token), payload, 'utf8');
  const indexEntry = {
    token: session.token,
    agreementType: session.agreementType,
    status: session.status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    signedAt: session.signedAt ?? null,
    customerName: session.lead?.name ?? '',
    customerEmail: session.lead?.email ?? '',
    leadRowNumber: session.lead?.row_number ?? null,
    outName: session.outName ?? null,
  };
  await fs.writeFile(indexPath(session.token), JSON.stringify(indexEntry, null, 2), 'utf8');
  return session;
}

export async function loadSigningSession(token) {
  try {
    const raw = await fs.readFile(sessionPath(token), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function updateSigningSession(token, patch) {
  const session = await loadSigningSession(token);
  if (!session) return null;
  const updated = { ...session, ...patch, token: session.token };
  await saveSigningSession(updated);
  return updated;
}

export async function listSigningSessions({ leadRowNumber, status, limit = 100 } = {}) {
  await ensureSigningDirs();
  let files;
  try {
    files = await fs.readdir(SIGNING_DIRS.index);
  } catch {
    return [];
  }

  const sessions = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const entry = JSON.parse(await fs.readFile(join(SIGNING_DIRS.index, file), 'utf8'));
      if (leadRowNumber != null && entry.leadRowNumber !== leadRowNumber) continue;
      if (status && entry.status !== status) continue;
      sessions.push(entry);
    } catch {
      // skip corrupt index entries
    }
  }

  sessions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return sessions.slice(0, limit);
}

export async function saveUnsignedPdf(token, bytes) {
  await ensureSigningDirs();
  const path = join(SIGNING_DIRS.unsigned, `${token}.pdf`);
  await fs.writeFile(path, Buffer.from(bytes));
  return path;
}

export async function saveSignedPdf(token, bytes) {
  await ensureSigningDirs();
  const path = join(SIGNING_DIRS.signed, `${token}.pdf`);
  await fs.writeFile(path, Buffer.from(bytes));
  return path;
}

export async function savePreviewPng(token, bytes) {
  await ensureSigningDirs();
  const path = join(SIGNING_DIRS.previews, `${token}.png`);
  await fs.writeFile(path, Buffer.from(bytes));
  return path;
}

export async function readUnsignedPdf(token) {
  return fs.readFile(join(SIGNING_DIRS.unsigned, `${token}.pdf`));
}

export async function readSignedPdf(token) {
  return fs.readFile(join(SIGNING_DIRS.signed, `${token}.pdf`));
}

export async function readPreviewPng(token) {
  return fs.readFile(join(SIGNING_DIRS.previews, `${token}.png`));
}

/**
 * Persist full submission artifacts for audit / records.
 */
export async function saveSubmissionArtifacts(token, {
  audit,
  initialsPng,
  signaturePng,
  signedPdfBytes,
}) {
  await ensureSigningDirs();
  const dir = join(SIGNING_DIRS.submissions, token);
  await fs.mkdir(dir, { recursive: true });

  const paths = {
    dir,
    audit: join(dir, 'audit.json'),
    initials: join(dir, 'initials.png'),
    signature: join(dir, 'signature.png'),
    signedPdf: join(dir, 'signed.pdf'),
  };

  await Promise.all([
    fs.writeFile(paths.audit, JSON.stringify(audit, null, 2), 'utf8'),
    fs.writeFile(paths.initials, initialsPng),
    fs.writeFile(paths.signature, signaturePng),
    fs.writeFile(paths.signedPdf, Buffer.from(signedPdfBytes)),
  ]);

  return paths;
}

export function publicSigningBaseUrl(req) {
  return (
    process.env.PUBLIC_APP_URL
    || process.env.RENDER_EXTERNAL_URL
    || `${req?.protocol || 'https'}://${req?.get?.('host') || 'localhost:3001'}`
  ).replace(/\/$/, '');
}

export function buildSigningUrl(token, req) {
  return `${publicSigningBaseUrl(req)}/sign/${token}`;
}
