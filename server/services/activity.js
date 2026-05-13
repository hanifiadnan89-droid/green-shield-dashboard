import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '..', 'data', 'activity.json');

function ensureFile() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]', 'utf8');
}

export function readLog() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export function appendLog(entry) {
  const log = readLog();
  const newEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    ...entry
  };
  log.unshift(newEntry);
  const trimmed = log.slice(0, 500);
  fs.writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  return newEntry;
}

export function clearLog() {
  fs.writeFileSync(LOG_FILE, '[]', 'utf8');
}
