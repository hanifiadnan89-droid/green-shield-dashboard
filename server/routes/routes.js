import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAYLOAD_PATH = resolve(__dirname, '../../data/fieldroutes-sample.json');

const router = express.Router();

router.get('/payload', (req, res) => {
  if (!existsSync(PAYLOAD_PATH)) {
    return res.status(404).json({
      error: 'Route payload not found',
      detail: 'Save your FieldRoutes day.php payload to data/fieldroutes-sample.json',
    });
  }
  try {
    const raw = JSON.parse(readFileSync(PAYLOAD_PATH, 'utf8'));
    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse payload', detail: err.message });
  }
});

export default router;
