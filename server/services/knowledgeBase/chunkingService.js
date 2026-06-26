/**
 * Chunking Service — splits large text into overlapping semantic chunks
 * suitable for embedding and retrieval.
 *
 * Target: ~400 words per chunk, ~60-word overlap.
 * Respects paragraph and sentence boundaries.
 */

const TARGET_WORDS  = 400;
const OVERLAP_WORDS = 60;

function splitIntoWords(text) {
  return text.split(/\s+/).filter(Boolean);
}

function wordsToText(words) {
  return words.join(' ');
}

// Find the best split point (paragraph, sentence, or word boundary)
// within a window around the target index.
function findSplitPoint(words, targetIdx, windowSize = 20) {
  const start = Math.max(0, targetIdx - windowSize);
  const end   = Math.min(words.length, targetIdx + windowSize);

  // Look for a paragraph boundary (\n\n captured as a word that ends in \n\n)
  for (let i = targetIdx; i >= start; i--) {
    if (words[i].endsWith('\n\n') || words[i].includes('\n\n')) return i + 1;
  }

  // Look for sentence boundary (word ending in . ! ?)
  for (let i = targetIdx; i >= start; i--) {
    if (/[.!?]["']?$/.test(words[i])) return i + 1;
  }

  return targetIdx; // Fall back to exact target
}

/**
 * Split text into overlapping chunks.
 * @param {string} text
 * @param {number} targetWords
 * @param {number} overlapWords
 * @returns {string[]}
 */
export function chunkText(text, targetWords = TARGET_WORDS, overlapWords = OVERLAP_WORDS) {
  if (!text || text.trim().length < 100) return text ? [text.trim()] : [];

  // Preserve paragraph breaks as words
  const normalized = text.replace(/\n\n+/g, ' \n\n ').trim();
  const words = splitIntoWords(normalized);

  if (words.length <= targetWords) return [wordsToText(words)];

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const rawEnd = start + targetWords;
    const end    = rawEnd >= words.length ? words.length : findSplitPoint(words, rawEnd);
    const chunk  = wordsToText(words.slice(start, end)).replace(/ \n\n /g, '\n\n').trim();

    if (chunk) chunks.push(chunk);

    if (end >= words.length) break;
    // Overlap: go back by overlapWords from the end
    start = Math.max(start + 1, end - overlapWords);
  }

  return chunks;
}

/**
 * Build chunk IDs for an item.
 * @param {string} itemId
 * @param {number} index
 * @returns {string}
 */
export function buildChunkId(itemId, index) {
  return `${itemId}_chunk_${index}`;
}

/**
 * Parse a chunk ID back into itemId + index.
 */
export function parseChunkId(chunkId) {
  const match = chunkId.match(/^(.+)_chunk_(\d+)$/);
  if (!match) return { itemId: chunkId, index: 0 };
  return { itemId: match[1], index: parseInt(match[2], 10) };
}
