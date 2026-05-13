import express from 'express';
import { readLog, appendLog, clearLog } from '../services/activity.js';

const router = express.Router();

router.get('/', (req, res) => {
  const log = readLog();
  const limit = parseInt(req.query.limit || '100', 10);
  res.json({ log: log.slice(0, limit), total: log.length });
});

router.post('/', (req, res) => {
  const entry = appendLog(req.body);
  res.json(entry);
});

router.delete('/', (req, res) => {
  clearLog();
  res.json({ cleared: true });
});

export default router;
