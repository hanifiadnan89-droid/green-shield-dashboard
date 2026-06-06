import { google } from 'googleapis';
import { loadGoogleCredentials } from './googleCredentials.js';

const ERROR_LIST_SHEET_ID =
  process.env.ERROR_LIST_SHEET_ID
  || '1faT6OQJ1we6RkjfmqQFhcQk9OO5ohoFa4_JkwtoiDH0';
const ERROR_LIST_SHEET_NAME = process.env.ERROR_LIST_SHEET_NAME || 'Action/Error Lists';
const ERROR_LIST_ASSIGNEE = process.env.ERROR_LIST_ASSIGNEE || 'AH';
const ERROR_LIST_HEADER_ROW = parseInt(process.env.ERROR_LIST_HEADER_ROW || '11', 10);
const DEFAULT_STATUS_COLUMN = process.env.ERROR_LIST_STATUS_COLUMN || 'L';

const COL_INITIALS = 2;   // C — Sales Rep
const COL_CUSTOMER_ID = 3; // D
const COL_REASON = 5;      // F — Cus Card Tab Error

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
      hasStatusHeader: true,
    };
  }
  return {
    statusColIdx: columnLetterToIndex(DEFAULT_STATUS_COLUMN),
    statusColumn: DEFAULT_STATUS_COLUMN.toUpperCase(),
    hasStatusHeader: false,
  };
}

export function parseErrorListRows(
  allRows,
  { assignee = ERROR_LIST_ASSIGNEE, headerRowNumber = ERROR_LIST_HEADER_ROW } = {},
) {
  const empty = {
    items: [],
    statusColumn: DEFAULT_STATUS_COLUMN.toUpperCase(),
    statusColIdx: columnLetterToIndex(DEFAULT_STATUS_COLUMN),
    hasStatusHeader: false,
  };

  if (!allRows?.length) return empty;

  const headerIdx = Math.max(0, headerRowNumber - 1);
  if (headerIdx >= allRows.length) return empty;

  const headerRow = allRows[headerIdx];
  const { statusColumn, statusColIdx, hasStatusHeader } = resolveStatusColumn(headerRow);
  const seen = new Set();
  const items = [];
  const assigneeNorm = (assignee ?? '').toString().trim().toUpperCase();

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i] || [];
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
  return { items, statusColumn, statusColIdx, hasStatusHeader };
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
    spreadsheetId: ERROR_LIST_SHEET_ID,
    range: `'${ERROR_LIST_SHEET_NAME}'!A:Z`,
  });
  return res.data.values || [];
}

export async function getActivityErrors() {
  const rows = await readErrorListRows();
  const { items, statusColumn, hasStatusHeader } = parseErrorListRows(rows);
  return {
    items,
    count: items.length,
    sheetId: ERROR_LIST_SHEET_ID,
    sheetName: ERROR_LIST_SHEET_NAME,
    assignee: ERROR_LIST_ASSIGNEE,
    headerRow: ERROR_LIST_HEADER_ROW,
    statusColumn,
    hasStatusHeader,
  };
}

export async function completeActivityError(rowNumber) {
  const parsedRow = parseInt(rowNumber, 10);
  const minRow = ERROR_LIST_HEADER_ROW + 1;
  if (!Number.isFinite(parsedRow) || parsedRow < minRow) {
    throw new Error('Invalid row number');
  }

  if (process.env.TEST_MODE === 'true') {
    return { completed: true, rowNumber: parsedRow, testMode: true };
  }

  const rows = await readErrorListRows();
  const headerIdx = ERROR_LIST_HEADER_ROW - 1;
  const { statusColumn } = resolveStatusColumn(rows[headerIdx] || []);
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId: ERROR_LIST_SHEET_ID,
    range: `'${ERROR_LIST_SHEET_NAME}'!${statusColumn}${parsedRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['complete']] },
  });

  return { completed: true, rowNumber: parsedRow, dashboardStatus: 'complete' };
}

export {
  ERROR_LIST_SHEET_ID,
  ERROR_LIST_SHEET_NAME,
  ERROR_LIST_ASSIGNEE,
  ERROR_LIST_HEADER_ROW,
};
