import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
} from './embeddingService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_FILE  = path.resolve(__dirname, '../knowledge/objection_assistant_coach.md');
const FEEDBACK_FILE   = path.resolve(__dirname, '../data/objection-feedback.json');
const EMBEDDINGS_FILE = path.resolve(__dirname, '../data/objection-feedback-embeddings.json');

const MAX_ENTRIES = 1000;

// ── OA Knowledge ─────────────────────────────────────────────────────────────

let cachedKnowledge = null;

export function loadOAKnowledge() {
  if (cachedKnowledge) return cachedKnowledge;
  try {
    cachedKnowledge = readFileSync(KNOWLEDGE_FILE, 'utf-8').trim();
  } catch {
    cachedKnowledge = '';
  }
  return cachedKnowledge;
}

export function clearOAKnowledgeCache() {
  cachedKnowledge = null;
}

// ── Case / feedback storage ───────────────────────────────────────────────────

function readCases() {
  try {
    if (!existsSync(FEEDBACK_FILE)) return [];
    const raw = readFileSync(FEEDBACK_FILE, 'utf-8').trim();
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function writeCases(entries) {
  try {
    writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('[objectionKnowledge] Failed to write cases file:', err.message);
  }
}

// ── Embedding storage ─────────────────────────────────────────────────────────
// Format: { [caseId]: number[] }  — 1536-dim text-embedding-3-small vectors

let embeddingsCache = null;

function readEmbeddings() {
  if (embeddingsCache) return embeddingsCache;
  try {
    if (!existsSync(EMBEDDINGS_FILE)) { embeddingsCache = {}; return embeddingsCache; }
    embeddingsCache = JSON.parse(readFileSync(EMBEDDINGS_FILE, 'utf-8')) || {};
    return embeddingsCache;
  } catch {
    embeddingsCache = {};
    return embeddingsCache;
  }
}

function writeEmbeddings(embs) {
  embeddingsCache = embs;
  try {
    writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embs), 'utf-8');
  } catch (err) {
    console.error('[objectionKnowledge] Failed to write embeddings file:', err.message);
  }
}

function saveEmbedding(id, vector) {
  const embs = readEmbeddings();
  embs[id] = vector;
  writeEmbeddings(embs);
}

// ── Rich search document ──────────────────────────────────────────────────────
// This is what we embed for each case so semantic retrieval uses full context,
// not just the repQuestion text.

function buildRichSearchDocument(entry) {
  const parts = [];
  if (entry.repQuestion)    parts.push(`OBJECTION: ${entry.repQuestion}`);
  if (entry.customerObjection && entry.customerObjection !== entry.repQuestion) {
    parts.push(`CUSTOMER SAID: ${entry.customerObjection}`);
  }
  const svcType = entry.serviceType
    || entry.propertyContext?.serviceType
    || entry.leadContext?.serviceType
    || null;
  if (svcType)                     parts.push(`SERVICE: ${svcType}`);
  if (entry.outcome)               parts.push(`OUTCOME: ${entry.outcome}`);
  if (entry.outcomeReason)         parts.push(`REASON: ${entry.outcomeReason}`);
  if (entry.whyItWorked)           parts.push(`WHY IT WORKED: ${entry.whyItWorked}`);
  if (entry.correction)            parts.push(`CORRECTION: ${entry.correction}`);
  const resp = entry.repEditedResponse || entry.recommendedResponse;
  if (resp)                        parts.push(`RESPONSE USED: ${resp}`);
  const propType = entry.propertyContext?.propertyType || null;
  if (propType)                    parts.push(`PROPERTY TYPE: ${propType}`);
  const pricing = entry.leadContext?.pricing || entry.propertyContext?.pricing || null;
  if (pricing)                     parts.push(`PRICING: ${pricing}`);
  return parts.join('\n') || (entry.repQuestion || '');
}

// ── Priority scoring ──────────────────────────────────────────────────────────
// Returns a normalised [0, 1] priority weight for re-ranking.
// Returns -1 for entries that should be excluded from retrieval entirely.

// Normalise outcome to lowercase canonical ID (handles old uppercase values).
function normalizeOutcome(outcome) {
  if (!outcome) return null;
  const MAP = {
    'Sold': 'sold', 'Scheduled': 'scheduled', 'Follow Up': 'follow_up',
    'Unknown': 'unknown', 'Lost': 'lost', 'Declined': 'declined',
  };
  return MAP[outcome] ?? outcome.toLowerCase().replace(/\s+/g, '_');
}

const OUTCOME_SCORE = {
  'sold':      1.00,
  'scheduled': 0.90,
  'follow_up': 0.60,
  'unknown':   0.45,
  'lost':      0.20, // only included if correction/whyItWorked present
  'declined':  0.20, // same
};

const FEEDBACK_SCORE = {
  'save_approved': 1.00,
  'thumbs_up':     0.70,
  'thumbs_down':   0.20,
  null:            0.40,
  undefined:       0.40,
};

function getPriorityScore(entry) {
  const outNorm = normalizeOutcome(entry.outcome);

  // Exclude lost/declined without any corrective signal — they teach nothing
  if ((outNorm === 'lost' || outNorm === 'declined') &&
      !entry.correction?.trim() && !entry.whyItWorked?.trim()) {
    return -1;
  }

  let score = 0;
  score += (OUTCOME_SCORE[outNorm] ?? 0.45) * 0.50;
  score += (FEEDBACK_SCORE[entry.feedbackType] ?? 0.40) * 0.30;
  if (entry.whyItWorked?.trim())        score += 0.10;
  if (entry.correction?.trim())         score += 0.08;
  if (entry.repEditedResponse?.trim())  score += 0.02;

  return Math.min(score, 1.0);
}

// ── Entry filter ──────────────────────────────────────────────────────────────

function isUsefulEntry(entry) {
  return getPriorityScore(entry) >= 0; // -1 means excluded
}

// ── Append: quick feedback (👍/👎/⭐) ─────────────────────────────────────────

export async function appendFeedback(entry) {
  const cases = readCases();
  const id = `oa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record = { id, timestamp: new Date().toISOString(), recordType: 'feedback', ...entry };
  cases.push(record);
  writeCases(cases.slice(-MAX_ENTRIES));

  if (process.env.OPENAI_API_KEY && entry.repQuestion?.trim()) {
    try {
      const doc    = buildRichSearchDocument(record);
      const vector = await generateEmbedding(doc);
      saveEmbedding(id, vector);
      console.log(`[objectionKnowledge] Embedding stored for feedback ${id}`);
    } catch (err) {
      console.warn(`[objectionKnowledge] Could not embed feedback ${id}:`, err.message);
    }
  }

  return id;
}

// ── Append: full sales case (with outcome tracking) ───────────────────────────

export async function appendCase(entry) {
  const cases = readCases();
  const id = `oa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record = { id, timestamp: new Date().toISOString(), recordType: 'case', ...entry };
  cases.push(record);
  writeCases(cases.slice(-MAX_ENTRIES));

  if (process.env.OPENAI_API_KEY && entry.repQuestion?.trim()) {
    try {
      const doc    = buildRichSearchDocument(record);
      const vector = await generateEmbedding(doc);
      saveEmbedding(id, vector);
      console.log(`[objectionKnowledge] Rich embedding stored for case ${id} (outcome: ${entry.outcome || 'none'})`);
    } catch (err) {
      console.warn(`[objectionKnowledge] Could not embed case ${id}:`, err.message);
    }
  }

  return id;
}

// ── Keyword fallback ──────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'i', 'a', 'an', 'the', 'is', 'it', 'to', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'of', 'and', 'or', 'but', 'my', 'me', 'we', 'you', 'they', 'do', 'not',
  'be', 'can', 'will', 'this', 'that', 'have', 'has', 'had', 'are', 'was', 'were',
  'about', 'just', 'so', 'up', 'out', 'if', 'as', 'need', 'get', 'its', 'our',
  'him', 'her', 'your', 'their', 'been', 'would', 'could', 'should', 'also',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function keywordScore(queryTokens, entry) {
  const entryWords = new Set(tokenize(`${entry.repQuestion} ${entry.correction || ''} ${entry.whyItWorked || ''}`));
  return queryTokens.filter((t) => entryWords.has(t)).length;
}

export function getRelevantExamples(repQuestion, limit = 4) {
  const all    = readCases();
  const useful = all.filter(isUsefulEntry);
  if (!useful.length) return [];

  const queryTokens = tokenize(repQuestion);
  if (!queryTokens.length) return useful.slice(-limit);

  const scored = useful
    .map((entry) => ({ entry, score: keywordScore(queryTokens, entry) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return (scored.length ? scored.slice(0, limit) : useful.slice(-limit)).map((s) => s.entry || s);
}

// ── Semantic retrieval ────────────────────────────────────────────────────────

export async function getRelevantExamplesSemantic(repQuestion, queryContext = {}, limit = 4) {
  const all    = readCases();
  const useful = all.filter(isUsefulEntry);

  if (!useful.length) {
    console.log('[objectionKnowledge] Semantic search: case store is empty');
    return [];
  }

  const embs = readEmbeddings();

  // Lazy backfill — embed any useful entries missing a vector using rich doc format
  const needsEmbedding = useful.filter((e) => !embs[e.id] && e.repQuestion?.trim());
  if (needsEmbedding.length > 0) {
    console.log(`[objectionKnowledge] Backfilling ${needsEmbedding.length} entries with rich embeddings...`);
    try {
      const docs    = needsEmbedding.map(buildRichSearchDocument);
      const vectors = await generateEmbeddingsBatch(docs);
      needsEmbedding.forEach((e, i) => { embs[e.id] = vectors[i]; });
      writeEmbeddings(embs);
      console.log(`[objectionKnowledge] Backfill complete`);
    } catch (err) {
      console.warn('[objectionKnowledge] Backfill failed:', err.message);
    }
  }

  const embeddable = useful.filter((e) => embs[e.id]);
  if (!embeddable.length) {
    console.log('[objectionKnowledge] No embeddings available — keyword fallback');
    return getRelevantExamples(repQuestion, limit);
  }

  // Build a rich query document so the query embedding is as contextual as the stored ones
  const queryDoc = buildRichSearchDocument({
    repQuestion,
    serviceType:     queryContext.serviceType     || null,
    propertyContext: queryContext,
    leadContext:     { pricing: queryContext.pricing || null },
  });

  const queryVec = await generateEmbedding(queryDoc);

  // Composite score: 65% semantic similarity + 35% outcome/feedback priority
  const scored = embeddable.map((entry) => {
    const cosine   = cosineSimilarity(queryVec, embs[entry.id]);
    const priority = getPriorityScore(entry); // already [0, 1]
    const final    = cosine * 0.65 + priority * 0.35;
    return { entry, cosine, priority, final };
  }).sort((a, b) => b.final - a.final);

  const selected = scored.slice(0, limit);

  console.log(
    `[objectionKnowledge] Semantic search: ${scored.length} entries searched, ${selected.length} selected`,
  );
  selected.forEach((s, i) => {
    console.log(
      `  [${i + 1}] final=${s.final.toFixed(4)} cosine=${s.cosine.toFixed(4)} priority=${s.priority.toFixed(2)}` +
      ` | outcome=${s.entry.outcome || 'N/A'} reason=${s.entry.outcomeReason || 'N/A'}` +
      ` type=${s.entry.feedbackType || 'N/A'} svc=${s.entry.serviceType || s.entry.propertyContext?.serviceType || 'N/A'}` +
      ` | "${(s.entry.repQuestion || '').slice(0, 50)}"`,
    );
  });

  return selected.map((s) => s.entry);
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function getRelevantExamplesWithFallback(repQuestion, queryContext = {}, limit = 4) {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[objectionKnowledge] OPENAI_API_KEY not set — keyword retrieval');
    return getRelevantExamples(repQuestion, limit);
  }
  try {
    return await getRelevantExamplesSemantic(repQuestion, queryContext, limit);
  } catch (err) {
    console.warn('[objectionKnowledge] Semantic retrieval failed, keyword fallback:', err.message);
    return getRelevantExamples(repQuestion, limit);
  }
}

// ── Prompt formatting ─────────────────────────────────────────────────────────

export function formatExamplesForPrompt(examples) {
  if (!examples.length) return null;

  const lines = [
    'RELEVANT PROVEN EXAMPLES FROM PAST CALLS (use as style and strategy guide — do not copy verbatim):',
  ];

  examples.forEach((e, i) => {
    lines.push('');
    lines.push(`Example ${i + 1}:`);
    lines.push(`  Objection/Situation: "${e.repQuestion}"`);
    if (e.serviceType || e.propertyContext?.serviceType) {
      lines.push(`  Service type: ${e.serviceType || e.propertyContext.serviceType}`);
    }
    if (e.outcome) {
      lines.push(`  Outcome: ${e.outcome}${e.outcomeReason ? ` — ${e.outcomeReason}` : ''}`);
    }
    if (e.whyItWorked)         lines.push(`  Why it worked: ${e.whyItWorked}`);
    const resp = e.repEditedResponse || e.recommendedResponse;
    if (resp)                  lines.push(`  Response used: "${resp}"`);
    if (e.correction)          lines.push(`  Correction/note: "${e.correction}"`);
    const outNorm  = normalizeOutcome(e.outcome);
    const isProven = outNorm === 'sold' || outNorm === 'scheduled' || e.feedbackType === 'save_approved';
    if (isProven)              lines.push('  [Proven successful]');
  });

  return lines.join('\n');
}
