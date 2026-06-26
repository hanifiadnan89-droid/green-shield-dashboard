/**
 * Ingestion Pipeline — orchestrates the full processing flow for every knowledge source.
 *
 * Steps:
 *  1. Extract text (extractionService)
 *  2. Chunk text (chunkingService)
 *  3. Generate embeddings (embeddingService)
 *  4. Auto-tag + summarize (Claude Haiku)
 *  5. Save everything + mark ready
 *
 * Processing is always async / fire-and-forget from the HTTP layer.
 * Status is polled by the frontend via GET /api/kb/items/:id.
 */

import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { extractContent, extractUrl } from './extractionService.js';
import { chunkText, buildChunkId } from './chunkingService.js';
import { generateEmbeddingsBatch } from '../embeddingService.js';
import {
  createItem, updateItem, saveChunks, saveEmbedding, getItem,
  deleteChunksForItem, deleteEmbeddingsForItem,
} from './knowledgeBaseService.js';

let _anthropic = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return _anthropic;
}

const ALL_TAGS = [
  'Closing', 'Objection Handling', 'Psychology', 'Trust Building',
  'Pricing', 'Value Framing', 'Negotiation', 'Risk Reversal',
  'Guarantees', 'Pest Knowledge', 'Competitor', 'Service Specific',
  'Sales Script', 'Customer Communication', 'Green Shield Internal',
];

// ── Auto-tagging via Claude ───────────────────────────────────────────────────

async function autoTagAndSummarize(title, text) {
  const preview = text.slice(0, 6000); // Use first ~6K chars for tagging
  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a knowledge classifier for Green Shield Pest Solutions, a pest control sales company.

Analyze this content and return ONLY valid JSON with:
- "title": a clear descriptive title (if the provided title is generic/filename-like, improve it; otherwise keep it)
- "summary": 2–3 sentences describing what this content teaches and why it's valuable for sales reps
- "tags": array of the most relevant tags from ONLY this list: ${JSON.stringify(ALL_TAGS)}
- "keyInsights": array of 3–5 specific, actionable sales insights extracted from this content

Content title: "${title}"

Content (first portion):
${preview}

Return only valid JSON. No markdown, no extra text.`,
      }],
    });

    const raw = response.content[0]?.text?.trim() || '';
    const json = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    return {
      title:       typeof json.title       === 'string' ? json.title.trim()   : title,
      summary:     typeof json.summary     === 'string' ? json.summary.trim() : '',
      autoTags:    Array.isArray(json.tags) ? json.tags.filter(t => ALL_TAGS.includes(t)) : [],
      keyInsights: Array.isArray(json.keyInsights) ? json.keyInsights.slice(0, 5).map(String) : [],
    };
  } catch (err) {
    console.warn('[ingestion] Auto-tag failed:', err.message);
    return { title, summary: '', autoTags: [], keyInsights: [] };
  }
}

// ── Core pipeline ─────────────────────────────────────────────────────────────

async function runPipeline(itemId, extractFn) {
  const setStep = (step, value) => {
    const item = getItem(itemId);
    if (!item) return;
    updateItem(itemId, {
      processingSteps: { ...item.processingSteps, [step]: value },
      status: 'processing',
    });
  };

  try {
    // ── Step 1: Extraction ──
    setStep('extraction', 'processing');
    const { text, wordCount, metadata } = await extractFn();
    const hasContent = text && wordCount > 0 && !text.startsWith('[');
    updateItem(itemId, {
      processingSteps: { ...getItem(itemId)?.processingSteps, extraction: hasContent ? 'done' : 'error' },
      extractedText: text.slice(0, 3000),  // preview
      wordCount,
      ...(metadata.error ? { errorMessage: metadata.error } : {}),
    });

    if (!hasContent) {
      updateItem(itemId, { status: 'error', errorMessage: text });
      return;
    }

    // ── Step 2: Chunking ──
    setStep('chunking', 'processing');
    const chunks = chunkText(text);
    saveChunks(itemId, chunks);
    updateItem(itemId, {
      processingSteps: { ...getItem(itemId)?.processingSteps, chunking: 'done' },
      chunkCount: chunks.length,
    });

    // ── Step 3: Embeddings ──
    if (process.env.OPENAI_API_KEY) {
      setStep('embedding', 'processing');
      try {
        const BATCH_SIZE = 20;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch    = chunks.slice(i, i + BATCH_SIZE);
          const vectors  = await generateEmbeddingsBatch(batch, { endpoint: 'knowledge-base-ingest', module: 'knowledgeBase' });
          for (let j = 0; j < batch.length; j++) {
            saveEmbedding(buildChunkId(itemId, i + j), vectors[j]);
          }
        }
        updateItem(itemId, {
          processingSteps: { ...getItem(itemId)?.processingSteps, embedding: 'done' },
        });
      } catch (embErr) {
        console.warn('[ingestion] Embedding failed:', embErr.message);
        updateItem(itemId, {
          processingSteps: { ...getItem(itemId)?.processingSteps, embedding: 'error' },
        });
      }
    } else {
      updateItem(itemId, {
        processingSteps: { ...getItem(itemId)?.processingSteps, embedding: 'skipped' },
      });
    }

    // ── Step 4: Auto-tagging ──
    setStep('tagging', 'processing');
    const item = getItem(itemId);
    const { title, summary, autoTags, keyInsights } = await autoTagAndSummarize(item?.title || '', text);
    updateItem(itemId, {
      processingSteps: { ...getItem(itemId)?.processingSteps, tagging: 'done' },
      title,
      summary,
      autoTags,
      keyInsights,
    });

    // ── Done ──
    updateItem(itemId, {
      status:      'ready',
      processedAt: new Date().toISOString(),
    });
    console.log(`[ingestion] Item ${itemId} ready — ${chunks.length} chunks, ${wordCount} words, tags: ${autoTags.join(', ')}`);

  } catch (err) {
    console.error('[ingestion] Pipeline error for', itemId, ':', err.message);
    updateItem(itemId, {
      status:       'error',
      errorMessage: err.message,
    });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ingest an uploaded file.
 * Returns the item metadata immediately; processing continues in background.
 */
export function ingestFile(filePath, mimeType, originalName, { title = '' } = {}) {
  const item = createItem({
    title:      title || originalName,
    sourceType: 'file',
    fileName:   originalName,
    mimeType,
    fileSize:   fs.existsSync(filePath) ? fs.statSync(filePath).size : null,
    status:     'processing',
  });

  // Fire-and-forget
  setImmediate(async () => {
    await runPipeline(item.id, () => extractContent(filePath, mimeType, originalName));
    // Clean up temp file after processing
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
  });

  return item;
}

/**
 * Ingest a URL (web page or YouTube video).
 */
export function ingestUrl(url, { title = '' } = {}) {
  const isYoutube = /youtube\.com\/watch|youtu\.be\//.test(url);
  const item = createItem({
    title:      title || url,
    sourceType: isYoutube ? 'youtube' : 'url',
    sourceUrl:  url,
    status:     'processing',
  });

  setImmediate(async () => {
    await runPipeline(item.id, () => extractUrl(url));
  });

  return item;
}

/**
 * Ingest directly entered text.
 */
export function ingestText(text, { title = 'Manual Entry' } = {}) {
  const item = createItem({
    title,
    sourceType: 'text',
    status:     'processing',
  });

  setImmediate(async () => {
    await runPipeline(item.id, async () => ({
      text,
      wordCount: text.trim().split(/\s+/).length,
      metadata:  {},
    }));
  });

  return item;
}

/**
 * Reprocess an existing item — re-runs the full pipeline from extraction.
 * For file items, the original file must still exist on disk.
 */
export async function reprocessItem(itemId, tempFilePath = null) {
  const item = getItem(itemId);
  if (!item) throw new Error(`Item not found: ${itemId}`);

  // Reset state
  deleteChunksForItem(itemId);
  deleteEmbeddingsForItem(itemId);
  updateItem(itemId, {
    status:        'processing',
    errorMessage:  null,
    summary:       null,
    autoTags:      [],
    keyInsights:   [],
    chunkCount:    0,
    processedAt:   null,
    processingSteps: {
      extraction: 'pending', chunking: 'pending', embedding: 'pending', tagging: 'pending',
    },
  });

  if (item.sourceType === 'url' || item.sourceType === 'youtube') {
    setImmediate(() => runPipeline(itemId, () => extractUrl(item.sourceUrl)));
  } else if (item.sourceType === 'text' && item.extractedText) {
    setImmediate(() => runPipeline(itemId, async () => ({
      text: item.extractedText, wordCount: item.wordCount || 0, metadata: {},
    })));
  } else if (tempFilePath) {
    const { mimeType, fileName } = item;
    setImmediate(() => runPipeline(itemId, () => extractContent(tempFilePath, mimeType, fileName)));
  } else {
    updateItem(itemId, { status: 'error', errorMessage: 'Original file no longer available. Re-upload to reprocess.' });
  }

  return getItem(itemId);
}
