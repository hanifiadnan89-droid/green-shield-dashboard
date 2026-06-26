/**
 * Knowledge Base Service — CRUD, chunk storage, and semantic search
 * for the AI-processed knowledge base.
 *
 * Data files are resolved by knowledgeStorage.js so production can use a
 * persistent Render disk instead of the ephemeral deploy filesystem.
 */

import crypto from 'crypto';
import { generateEmbedding, cosineSimilarity } from '../embeddingService.js';
import { buildChunkId } from './chunkingService.js';
import { readKnowledgeJson, writeKnowledgeJson } from './knowledgeStorage.js';

// ── Items ─────────────────────────────────────────────────────────────────────

export function listItems({ query = '', tags = [], sourceType = null, status = null, limit = 50, offset = 0 } = {}) {
  let items = readKnowledgeJson('items', []);

  if (status)     items = items.filter(i => i.status === status);
  if (sourceType) items = items.filter(i => i.sourceType === sourceType);
  if (tags.length) {
    items = items.filter(i => tags.some(t => (i.tags || []).includes(t) || (i.autoTags || []).includes(t)));
  }
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(i =>
      (i.title || '').toLowerCase().includes(q) ||
      (i.summary || '').toLowerCase().includes(q) ||
      (i.fileName || '').toLowerCase().includes(q) ||
      (i.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (i.autoTags || []).some(t => t.toLowerCase().includes(q)),
    );
  }

  // Newest first
  items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return items.slice(offset, offset + limit);
}

export function getItem(id) {
  const items = readKnowledgeJson('items', []);
  return items.find(i => i.id === id) || null;
}

export function createItem({
  title = '', sourceType, fileName = null, mimeType = null, fileSize = null,
  sourceUrl = null, uploadedFilePath = null, status = 'pending',
}) {
  const id  = `kb-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const item = {
    id,
    title: title || fileName || sourceUrl || 'Untitled',
    sourceType,
    fileName,
    mimeType,
    fileSize,
    sourceUrl,
    uploadedFilePath,
    status,
    processingSteps: {
      extraction: 'pending',
      chunking:   'pending',
      embedding:  'pending',
      tagging:    'pending',
    },
    chunkCount:    0,
    summary:       null,
    tags:          [],
    autoTags:      [],
    extractedText: null,
    wordCount:     0,
    errorMessage:  null,
    uploadedAt:    now,
    updatedAt:     now,
    processedAt:   null,
    active:        true,
  };
  const items = readKnowledgeJson('items', []);
  items.unshift(item);
  writeKnowledgeJson('items', items);
  return item;
}

export function updateItem(id, updates) {
  const items = readKnowledgeJson('items', []);
  const idx   = items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  writeKnowledgeJson('items', items);
  return items[idx];
}

export function deleteItem(id) {
  const items = readKnowledgeJson('items', []);
  const idx   = items.findIndex(i => i.id === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  writeKnowledgeJson('items', items);
  deleteChunksForItem(id);
  deleteEmbeddingsForItem(id);
  return true;
}

// ── Chunks ────────────────────────────────────────────────────────────────────

export function getChunksForItem(itemId) {
  const chunks = readKnowledgeJson('chunks', {});
  return Object.entries(chunks)
    .filter(([, c]) => c.itemId === itemId)
    .sort(([, a], [, b]) => a.index - b.index)
    .map(([id, c]) => ({ id, ...c }));
}

export function saveChunks(itemId, textChunks) {
  const chunks = readKnowledgeJson('chunks', {});
  // Clear existing chunks for this item
  for (const key of Object.keys(chunks)) {
    if (chunks[key].itemId === itemId) delete chunks[key];
  }
  for (let i = 0; i < textChunks.length; i++) {
    const chunkId = buildChunkId(itemId, i);
    chunks[chunkId] = { itemId, index: i, text: textChunks[i] };
  }
  writeKnowledgeJson('chunks', chunks);
}

export function deleteChunksForItem(itemId) {
  const chunks = readKnowledgeJson('chunks', {});
  for (const key of Object.keys(chunks)) {
    if (chunks[key].itemId === itemId) delete chunks[key];
  }
  writeKnowledgeJson('chunks', chunks);
}

// ── Embeddings ────────────────────────────────────────────────────────────────

export function getEmbeddingsForItem(itemId) {
  const allEmbs = readKnowledgeJson('embeddings', {});
  const result = {};
  for (const [chunkId, vec] of Object.entries(allEmbs)) {
    if (chunkId.startsWith(itemId + '_chunk_')) result[chunkId] = vec;
  }
  return result;
}

export function saveEmbedding(chunkId, vector) {
  const embs = readKnowledgeJson('embeddings', {});
  embs[chunkId] = vector;
  writeKnowledgeJson('embeddings', embs);
}

export function deleteEmbeddingsForItem(itemId) {
  const embs = readKnowledgeJson('embeddings', {});
  for (const key of Object.keys(embs)) {
    if (key.startsWith(itemId + '_chunk_')) delete embs[key];
  }
  writeKnowledgeJson('embeddings', embs);
}

// ── Semantic search ───────────────────────────────────────────────────────────

/**
 * Search the knowledge base for chunks relevant to a query.
 *
 * @param {string} query
 * @param {{ limit?: number, tags?: string[], sourceType?: string }} options
 * @returns {Promise<Array<{ chunkId, itemId, chunkText, similarity, item }>>}
 */
export async function searchKnowledgeBase(query, { limit = 5, tags = [], sourceType = null } = {}) {
  if (!process.env.OPENAI_API_KEY) return [];

  const allItems = readKnowledgeJson('items', []).filter(i => i.active && i.status === 'ready');
  if (!allItems.length) return [];

  // Apply item-level filters
  let filteredItems = allItems;
  if (sourceType) filteredItems = filteredItems.filter(i => i.sourceType === sourceType);
  if (tags.length) {
    filteredItems = filteredItems.filter(i =>
      tags.some(t => [...(i.tags || []), ...(i.autoTags || [])].includes(t)),
    );
  }

  const itemIds = new Set(filteredItems.map(i => i.id));
  if (!itemIds.size) return [];

  const allEmbs   = readKnowledgeJson('embeddings', {});
  const allChunks = readKnowledgeJson('chunks', {});

  // Only consider chunks whose items passed the filter
  const candidates = Object.entries(allEmbs).filter(([chunkId]) => {
    const itemId = chunkId.split('_chunk_')[0];
    return itemIds.has(itemId);
  });

  if (!candidates.length) return [];

  try {
    const queryVec = await generateEmbedding(query, { endpoint: 'knowledge-base-search', module: 'knowledgeBase' });

    const scored = candidates.map(([chunkId, vec]) => ({
      chunkId,
      itemId: chunkId.split('_chunk_')[0],
      similarity: cosineSimilarity(queryVec, vec),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);

    // Deduplicate: max 2 chunks per item to ensure breadth
    const seen = {};
    const top  = [];
    for (const s of scored) {
      if (s.similarity < 0.3) break; // below relevance threshold
      if ((seen[s.itemId] || 0) >= 2) continue;
      seen[s.itemId] = (seen[s.itemId] || 0) + 1;
      const chunkData = allChunks[s.chunkId];
      const item = filteredItems.find(i => i.id === s.itemId);
      if (chunkData && item) {
        top.push({ ...s, chunkText: chunkData.text, item });
      }
      if (top.length >= limit) break;
    }

    return top;
  } catch (err) {
    console.warn('[knowledgeBase] Search error:', err.message);
    return [];
  }
}

/**
 * Format search results as a context block for the AI prompt.
 */
export function formatKnowledgeBaseContext(results) {
  if (!results.length) return null;

  const lines = ['KNOWLEDGE BASE (curated sales training library — use as authoritative guidance):'];
  for (const r of results) {
    lines.push('');
    const src = r.item.fileName || r.item.sourceUrl || r.item.title;
    lines.push(`[Source: ${r.item.title || src} | Tags: ${[...(r.item.tags || []), ...(r.item.autoTags || [])].join(', ') || 'General'}]`);
    lines.push(r.chunkText);
  }
  lines.push('');
  lines.push('Use the above to inform tone, strategy, and specific techniques. Never quote verbatim.');
  return lines.join('\n');
}
