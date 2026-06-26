/**
 * Knowledge Base API routes — /api/kb
 *
 * POST /api/kb/upload         multipart file upload
 * POST /api/kb/url            ingest a URL or YouTube link
 * POST /api/kb/text           ingest directly typed text
 * GET  /api/kb/items          list items (with search/filter)
 * GET  /api/kb/items/:id      get single item
 * PUT  /api/kb/items/:id      update metadata (title, tags, active)
 * DELETE /api/kb/items/:id    delete item + all chunks + embeddings
 * POST /api/kb/items/:id/reprocess   re-run ingestion pipeline
 * GET  /api/kb/search         semantic search
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  listItems, getItem, updateItem, deleteItem,
  searchKnowledgeBase, getChunksForItem,
} from '../services/knowledgeBase/knowledgeBaseService.js';
import { ingestFile, ingestUrl, ingestText, reprocessItem } from '../services/knowledgeBase/ingestionPipeline.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../data/knowledge-uploads');

const router = express.Router();

// ── Multer config ─────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/rtf',
  'application/rtf',
  // Images
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/ogg', 'audio/x-m4a',
  // Video
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/avi',
]);

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'csv', 'xlsx', 'xls', 'pptx', 'ppt',
  'png', 'jpg', 'jpeg', 'webp', 'gif',
  'mp3', 'wav', 'aac', 'm4a', 'flac',
  'mp4', 'mov', 'avi', 'mkv', 'webm',
]);

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (.${ext})`));
    }
  },
});

// ── Upload ────────────────────────────────────────────────────────────────────

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const { title = '' } = req.body;
    const item = ingestFile(req.file.path, req.file.mimetype, req.file.originalname, { title });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── URL ingestion ─────────────────────────────────────────────────────────────

router.post('/url', express.json(), (req, res) => {
  const { url, title = '' } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });

  try {
    new URL(url); // validate
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const item = ingestUrl(url, { title });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Text ingestion ────────────────────────────────────────────────────────────

router.post('/text', express.json(), (req, res) => {
  const { text, title = '' } = req.body || {};
  if (!text || text.trim().length < 20) {
    return res.status(400).json({ error: 'text must be at least 20 characters' });
  }

  try {
    const item = ingestText(text, { title: title || 'Manual Entry' });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List items ────────────────────────────────────────────────────────────────

router.get('/items', (req, res) => {
  const {
    query = '', sourceType = null, status = null, limit = 50, offset = 0,
  } = req.query;
  const tags = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  const items = listItems({
    query, tags, sourceType, status,
    limit: Math.min(Number(limit) || 50, 200),
    offset: Number(offset) || 0,
  });
  res.json({ items });
});

// ── Get single item ───────────────────────────────────────────────────────────

router.get('/items/:id', (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const chunks = getChunksForItem(item.id);
  res.json({ item, chunkCount: chunks.length });
});

// ── Update item ───────────────────────────────────────────────────────────────

const UPDATABLE = ['title', 'tags', 'active'];

router.put('/items/:id', express.json(), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const patch = {};
  for (const field of UPDATABLE) {
    if (field in req.body) patch[field] = req.body[field];
  }

  const updated = updateItem(req.params.id, patch);
  res.json({ item: updated });
});

// ── Delete item ───────────────────────────────────────────────────────────────

router.delete('/items/:id', (req, res) => {
  const deleted = deleteItem(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, id: req.params.id });
});

// ── Reprocess ─────────────────────────────────────────────────────────────────

router.post('/items/:id/reprocess', (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  reprocessItem(req.params.id).catch(err => {
    console.error('[kb] Reprocess error:', err.message);
  });

  res.json({ item: getItem(req.params.id) });
});

// ── Semantic search ───────────────────────────────────────────────────────────

router.get('/search', async (req, res) => {
  const { query = '', limit = 5, sourceType = null } = req.query;
  const tags = req.query.tags ? req.query.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  if (!query.trim()) return res.json({ results: [] });

  try {
    const results = await searchKnowledgeBase(query, {
      limit: Math.min(Number(limit) || 5, 20),
      tags,
      sourceType,
    });
    res.json({
      results: results.map(r => ({
        chunkId:    r.chunkId,
        itemId:     r.itemId,
        chunkText:  r.chunkText,
        similarity: r.similarity,
        item: {
          id:        r.item.id,
          title:     r.item.title,
          sourceType: r.item.sourceType,
          tags:      r.item.tags,
          autoTags:  r.item.autoTags,
        },
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
