import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_FILE = path.resolve(__dirname, '../knowledge/objection_assistant_coach.md');
const FEEDBACK_FILE  = path.resolve(__dirname, '../data/objection-feedback.json');

const MAX_ENTRIES = 500;

// ── Knowledge ────────────────────────────────────────────────────────────────

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

// ── Feedback storage ─────────────────────────────────────────────────────────

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

export function appendFeedback(entry) {
  const entries = readFeedback();
  const id = `oa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newEntry = { id, timestamp: new Date().toISOString(), ...entry };
  entries.push(newEntry);
  writeFeedback(entries.slice(-MAX_ENTRIES));
  return id;
}

// ── Relevance retrieval ───────────────────────────────────────────────────────

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

function relevanceScore(queryTokens, entry) {
  const entryWords = new Set(tokenize(`${entry.repQuestion} ${entry.correction || ''}`));
  return queryTokens.filter((t) => entryWords.has(t)).length;
}

export function getRelevantExamples(repQuestion, limit = 4) {
  const all = readFeedback();

  // Only use entries with a positive signal
  const useful = all.filter(
    (e) =>
      e.feedbackType === 'save_approved' ||
      e.feedbackType === 'thumbs_up' ||
      (e.correction && e.correction.trim()),
  );

  if (!useful.length) return [];

  const queryTokens = tokenize(repQuestion);
  if (!queryTokens.length) return useful.slice(-limit); // fall back to most recent

  const scored = useful
    .map((entry) => ({ entry, score: relevanceScore(queryTokens, entry) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // If nothing matches by keyword, return the most recent approved entries
  const results = scored.length ? scored.slice(0, limit) : useful.slice(-limit).map((entry) => ({ entry }));
  return results.map((s) => s.entry);
}

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
    if (e.correction) lines.push(`  Rep correction/note: "${e.correction}"`);
    if (e.feedbackType === 'save_approved') lines.push('  [Marked as approved by rep]');
  });

  return lines.join('\n');
}
