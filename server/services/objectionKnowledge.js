import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
} from './embeddingService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_FILE   = path.resolve(__dirname, '../knowledge/objection_assistant_coach.md');
const FEEDBACK_FILE    = path.resolve(__dirname, '../data/objection-feedback.json');
const EMBEDDINGS_FILE  = path.resolve(__dirname, '../data/objection-feedback-embeddings.json');

const MAX_ENTRIES = 500;

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

// ── Feedback storage ──────────────────────────────────────────────────────────

function readFeedback() {
  try {
    if (!existsSync(FEEDBACK_FILE)) return [];
    const raw = readFileSync(FEEDBACK_FILE, 'utf-8').trim();
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function writeFeedback(entries) {
  try {
    writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('[objectionKnowledge] Failed to write feedback file:', err.message);
  }
}

// ── Embedding storage ─────────────────────────────────────────────────────────
// Format: { [feedbackId]: number[] }

let embeddingsCache = null;

function readEmbeddings() {
  if (embeddingsCache) return embeddingsCache;
  try {
    if (!existsSync(EMBEDDINGS_FILE)) {
      embeddingsCache = {};
      return embeddingsCache;
    }
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

// ── Feedback append (async — generates embedding at save time) ────────────────

export async function appendFeedback(entry) {
  const entries = readFeedback();
  const id = `oa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newEntry = { id, timestamp: new Date().toISOString(), ...entry };
  entries.push(newEntry);
  writeFeedback(entries.slice(-MAX_ENTRIES));

  // Generate and persist the embedding immediately so it's ready for retrieval
  if (process.env.OPENAI_API_KEY && entry.repQuestion?.trim()) {
    try {
      const vector = await generateEmbedding(entry.repQuestion);
      saveEmbedding(id, vector);
      console.log(`[objectionKnowledge] Embedding stored for ${id}`);
    } catch (err) {
      console.warn(`[objectionKnowledge] Could not generate embedding for ${id}:`, err.message);
    }
  }

  return id;
}

// ── Filter: entries with a positive training signal ───────────────────────────

function usefulEntries(all) {
  return all.filter(
    (e) =>
      e.feedbackType === 'save_approved' ||
      e.feedbackType === 'thumbs_up' ||
      (e.correction && e.correction.trim()),
  );
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
  const entryWords = new Set(tokenize(`${entry.repQuestion} ${entry.correction || ''}`));
  return queryTokens.filter((t) => entryWords.has(t)).length;
}

export function getRelevantExamples(repQuestion, limit = 4) {
  const all = readFeedback();
  const useful = usefulEntries(all);
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

export async function getRelevantExamplesSemantic(repQuestion, limit = 4) {
  const all    = readFeedback();
  const useful = usefulEntries(all);

  if (!useful.length) {
    console.log('[objectionKnowledge] Semantic search: no useful examples in store');
    return [];
  }

  const embs = readEmbeddings();

  // Lazy backfill: generate embeddings for any useful entries that are missing one
  const needsEmbedding = useful.filter((e) => !embs[e.id] && e.repQuestion?.trim());
  if (needsEmbedding.length > 0) {
    console.log(`[objectionKnowledge] Backfilling embeddings for ${needsEmbedding.length} entr${needsEmbedding.length === 1 ? 'y' : 'ies'}...`);
    try {
      const texts   = needsEmbedding.map((e) => e.repQuestion);
      const vectors = await generateEmbeddingsBatch(texts);
      needsEmbedding.forEach((e, i) => {
        embs[e.id] = vectors[i];
      });
      writeEmbeddings(embs);
      console.log(`[objectionKnowledge] Backfill complete`);
    } catch (err) {
      console.warn('[objectionKnowledge] Backfill failed:', err.message);
    }
  }

  // Only score entries that now have embeddings
  const embeddable = useful.filter((e) => embs[e.id]);
  if (!embeddable.length) {
    console.log('[objectionKnowledge] Semantic search: no embeddings available, falling back to keyword');
    return getRelevantExamples(repQuestion, limit);
  }

  // Generate query embedding
  const queryVec = await generateEmbedding(repQuestion);

  // Score and rank
  const scored = embeddable
    .map((entry) => ({
      entry,
      score: cosineSimilarity(queryVec, embs[entry.id]),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = scored.slice(0, limit);

  // Logging
  console.log(`[objectionKnowledge] Semantic search: ${scored.length} examples searched, ${selected.length} selected`);
  selected.forEach((s, i) => {
    console.log(
      `  [${i + 1}] score=${s.score.toFixed(4)} type=${s.entry.feedbackType}` +
      ` — "${(s.entry.repQuestion || '').slice(0, 60)}"`,
    );
  });

  return selected.map((s) => s.entry);
}

// ── Public entry point: semantic with keyword fallback ────────────────────────

export async function getRelevantExamplesWithFallback(repQuestion, limit = 4) {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[objectionKnowledge] OPENAI_API_KEY not set — using keyword retrieval');
    return getRelevantExamples(repQuestion, limit);
  }

  try {
    return await getRelevantExamplesSemantic(repQuestion, limit);
  } catch (err) {
    console.warn('[objectionKnowledge] Semantic retrieval failed, falling back to keyword:', err.message);
    return getRelevantExamples(repQuestion, limit);
  }
}

// ── Prompt formatting ─────────────────────────────────────────────────────────

export function formatExamplesForPrompt(examples) {
  if (!examples.length) return null;

  const lines = [
    'RELEVANT APPROVED EXAMPLES FROM PAST CALLS (use as style and tone guide — do not copy verbatim):',
  ];

  examples.forEach((e, i) => {
    lines.push('');
    lines.push(`Example ${i + 1}:`);
    lines.push(`  Objection/Situation: "${e.repQuestion}"`);
    if (e.recommendedResponse) lines.push(`  Response: "${e.recommendedResponse}"`);
    if (e.correction)           lines.push(`  Rep correction/note: "${e.correction}"`);
    if (e.feedbackType === 'save_approved') lines.push('  [Marked as approved by rep]');
  });

  return lines.join('\n');
}
