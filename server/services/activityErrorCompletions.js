import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(__dirname, '..', 'data', 'activity-error-completions.json');

function ensureFile() {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, '[]', 'utf8');
}

export function readCompletions() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function completionKey(sheetId, rowNumber) {
  return `${sheetId}:${rowNumber}`;
}

export function getCompletedRowSet(sheetId) {
  const set = new Set();
  for (const entry of readCompletions()) {
    if (entry.sheetId === sheetId && entry.rowNumber) {
      set.add(entry.rowNumber);
    }
  }
  return set;
}

export function markCompleted({ sheetId, rowNumber, customerId, reason }) {
  const parsedRow = parseInt(rowNumber, 10);
  if (!sheetId || !Number.isFinite(parsedRow)) {
    throw new Error('Invalid completion payload');
  }

  const completions = readCompletions();
  const key = completionKey(sheetId, parsedRow);
  if (completions.some(entry => completionKey(entry.sheetId, entry.rowNumber) === key)) {
    return { completed: true, rowNumber: parsedRow, alreadyCompleted: true };
  }

  const record = {
    sheetId,
    rowNumber: parsedRow,
    customerId: customerId || null,
    reason: reason || null,
    completedAt: new Date().toISOString(),
  };

  completions.unshift(record);
  fs.writeFileSync(STORE_FILE, JSON.stringify(completions.slice(0, 2000), null, 2), 'utf8');
  return { completed: true, rowNumber: parsedRow, completedAt: record.completedAt };
}
