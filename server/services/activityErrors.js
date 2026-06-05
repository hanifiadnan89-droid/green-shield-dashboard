import { google } from 'googleapis';
import { loadGoogleCredentials } from './googleCredentials.js';

const SHEET_ID = process.env.SHEET_ID || '1hneyXzxNqHDM-AfNs5-c1Qp7jqBeHfpKKsYbf_62obk';
const ERROR_LIST_SHEET_NAME = process.env.ERROR_LIST_SHEET_NAME || 'Action/Error Lists';
const ERROR_LIST_ASSIGNEE = process.env.ERROR_LIST_ASSIGNEE || 'AH';
const DEFAULT_STATUS_COLUMN = process.env.ERROR_LIST_STATUS_COLUMN || 'G';

const COL_INITIALS = 2;   // C
const COL_CUSTOMER_ID = 3; // D
const COL_REASON = 5;      // F

export function columnIndexToLetter(index) {
  let n = index;
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export function columnLetterToIndex(letter) {
  const s = (letter || '').toUpperCase();
  let index = 0;
  for (let i = 0; i < s.length; i++) {
    index = index * 26 + (s.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function isOpenDashboardStatus(status) {
  const value = (status ?? '').toString().trim().toLowerCase();
  if (!value) return true;
  if (value === 'complete') return false;
  if (value === 'open' || value === 'not complete') return true;
  return true;
}

export function resolveStatusColumn(headerRow = []) {
  const header = headerRow.map(cell => (cell ?? '').toString().trim().toLowerCase());
  const statusIdx = header.findIndex(name => name === 'dashboard_status');
  if (statusIdx >= 0) {
    return {
      statusColIdx: statusIdx,
      statusColumn: columnIndexToLetter(statusIdx),
    };
  }
  return {
    statusColIdx: columnLetterToIndex(DEFAULT_STATUS_COLUMN),
    statusColumn: DEFAULT_STATUS_COLUMN.toUpperCase(),
  };
}

export function parseErrorListRows(rows, { assignee = ERROR_LIST_ASSIGNEE } = {}) {
  if (!rows?.length) {
    return { items: [], statusColumn: DEFAULT_STATUS_COLUMN.toUpperCase(), statusColIdx: columnLetterToIndex(DEFAULT_STATUS_COLUMN) };
  }

  const { statusColumn, statusColIdx } = resolveStatusColumn(rows[0]);
  const seen = new Set();
  const items = [];
  const assigneeNorm = (assignee ?? '').toString().trim().toUpperCase();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const initials = (row[COL_INITIALS] ?? '').toString().trim();
    if (initials.toUpperCase() !== assigneeNorm) continue;

    const customerId = (row[COL_CUSTOMER_ID] ?? '').toString().trim();
    const reason = (row[COL_REASON] ?? '').toString().trim();
    if (!customerId && !reason) continue;

    const dashboardStatus = (row[statusColIdx] ?? '').toString().trim();
    if (!isOpenDashboardStatus(dashboardStatus)) continue;

    const rowNumber = i + 1;
    if (seen.has(rowNumber)) continue;
    seen.add(rowNumber);

    items.push({
      id: `error-row-${rowNumber}`,
      rowNumber,
      customerId,
      reason,
      label: `${customerId || '—'} — ${reason || '—'}`,
      initials,
      dashboardStatus: dashboardStatus || 'open',
    });
  }

  items.sort((a, b) => a.rowNumber - b.rowNumber);
  return { items, statusColumn, statusColIdx };
}

function getAuth() {
  const credentials = loadGoogleCredentials();
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

async function readErrorListRows() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${ERROR_LIST_SHEET_NAME}'!A:Z`,
  });
  return res.data.values || [];
}

export async function getActivityErrors() {
  const rows = await readErrorListRows();
  const { items, statusColumn } = parseErrorListRows(rows);
  return {
    items,
    count: items.length,
    sheetName: ERROR_LIST_SHEET_NAME,
    assignee: ERROR_LIST_ASSIGNEE,
    statusColumn,
  };
}

export async function completeActivityError(rowNumber) {
  const parsedRow = parseInt(rowNumber, 10);
  if (!Number.isFinite(parsedRow) || parsedRow < 2) {
    throw new Error('Invalid row number');
  }

  if (process.env.TEST_MODE === 'true') {
    return { completed: true, rowNumber: parsedRow, testMode: true };
  }

  const rows = await readErrorListRows();
  const { statusColumn } = resolveStatusColumn(rows[0] || []);
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${ERROR_LIST_SHEET_NAME}'!${statusColumn}${parsedRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['complete']] },
  });

  return { completed: true, rowNumber: parsedRow, dashboardStatus: 'complete' };
}

export {
  ERROR_LIST_SHEET_NAME,
  ERROR_LIST_ASSIGNEE,
};
