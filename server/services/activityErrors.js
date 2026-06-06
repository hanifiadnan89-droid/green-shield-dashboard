import { google } from 'googleapis';
import { loadGoogleCredentials } from './googleCredentials.js';
import { getCompletedRowSet, markCompleted } from './activityErrorCompletions.js';
import { enrichErrorItem } from './parseErrorReason.js';

const ERROR_LIST_SHEET_ID =
  process.env.ERROR_LIST_SHEET_ID
  || '1faT6OQJ1we6RkjfmqQFhcQk9OO5ohoFa4_JkwtoiDH0';
const ERROR_LIST_SHEET_NAME = process.env.ERROR_LIST_SHEET_NAME || 'Action/Error Lists';
const ERROR_LIST_ASSIGNEE = process.env.ERROR_LIST_ASSIGNEE || 'AH';
const ERROR_LIST_HEADER_ROW = parseInt(process.env.ERROR_LIST_HEADER_ROW || '11', 10);
const DEFAULT_STATUS_COLUMN = process.env.ERROR_LIST_STATUS_COLUMN || 'L';

const COL_DATE_ADDED = 0;    // A
const COL_ADDED_BY = 1;      // B
const COL_INITIALS = 2;      // C — Sales Rep
const COL_CUSTOMER_ID = 3;   // D
const COL_CUSTOMER_NAME = 4; // E
const COL_REASON = 5;        // F — Cus Card Tab Error
const COL_NOTES = 6;         // G
const COL_LOSS = 10;         // K

function findHeaderColumn(headerRow, matchers) {
  const header = headerRow.map(cell => (cell ?? '').toString().trim().toLowerCase());
  for (const matcher of matchers) {
    const idx = header.findIndex(name => name.includes(matcher));
    if (idx >= 0) return idx;
  }
  return -1;
}

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
  {
    assignee = ERROR_LIST_ASSIGNEE,
    headerRowNumber = ERROR_LIST_HEADER_ROW,
    completedRowSet = new Set(),
  } = {},
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
  const dateAddressedIdx = findHeaderColumn(headerRow, ['date addressed', 'addressed date']);
  const seen = new Set();
  const items = [];
  const assigneeNorm = (assignee ?? '').toString().trim().toUpperCase();

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i] || [];
    const initials = (row[COL_INITIALS] ?? '').toString().trim();
    if (initials.toUpperCase() !== assigneeNorm) continue;

    const customerId = (row[COL_CUSTOMER_ID] ?? '').toString().trim();
    const customerName = (row[COL_CUSTOMER_NAME] ?? '').toString().trim();
    const reason = (row[COL_REASON] ?? '').toString().trim();
    const notes = (row[COL_NOTES] ?? '').toString().trim();
    if (!customerId && !customerName && !reason && !notes) continue;

    const dashboardStatus = hasStatusHeader
      ? (row[statusColIdx] ?? '').toString().trim()
      : '';
    if (hasStatusHeader && !isOpenDashboardStatus(dashboardStatus)) continue;

    const rowNumber = i + 1;
    if (seen.has(rowNumber) || completedRowSet.has(rowNumber)) continue;
    seen.add(rowNumber);

    items.push(enrichErrorItem({
      id: `error-row-${rowNumber}`,
      rowNumber,
      customerId,
      customerName,
      reason: reason || notes,
      notes,
      dateAdded: (row[COL_DATE_ADDED] ?? '').toString().trim(),
      addedBy: (row[COL_ADDED_BY] ?? '').toString().trim(),
      initials,
      loss: (row[COL_LOSS] ?? '').toString().trim(),
      dateAddressed: dateAddressedIdx >= 0
        ? (row[dateAddressedIdx] ?? '').toString().trim()
        : '',
      dashboardStatus: dashboardStatus || 'open',
    }));
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

function formatSheetsError(err) {
  const msg = err?.message || 'Failed to read error list sheet';
  const code = err?.code || err?.response?.status;
  const wrapped = new Error(msg);
  wrapped.cause = err;

  if (code === 403 || /permission|forbidden/i.test(msg)) {
    wrapped.message = 'Google Sheets permission denied for the error list workbook.';
    wrapped.hint =
      'Share spreadsheet 01_Leads and Resources with your dashboard service account email as Viewer (read-only is enough). Leads access on a different sheet does not grant access to this workbook.';
    wrapped.code = 'sheets_permission';
    return wrapped;
  }

  if (code === 404 || /not found/i.test(msg)) {
    wrapped.message = 'Error list spreadsheet was not found.';
    wrapped.hint = `Check ERROR_LIST_SHEET_ID (${ERROR_LIST_SHEET_ID}) and that the tab is named "${ERROR_LIST_SHEET_NAME}".`;
    wrapped.code = 'sheets_not_found';
    return wrapped;
  }

  if (/unable to parse range/i.test(msg)) {
    wrapped.message = `Could not read tab "${ERROR_LIST_SHEET_NAME}".`;
    wrapped.hint =
      `Confirm the tab exists in spreadsheet ${ERROR_LIST_SHEET_ID}, or set ERROR_LIST_SHEET_NAME to the exact tab name.`;
    wrapped.code = 'sheets_range';
    return wrapped;
  }

  wrapped.code = 'sheets_error';
  return wrapped;
}

async function listSheetTabNames() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: ERROR_LIST_SHEET_ID,
    fields: 'sheets.properties.title',
  });
  return (meta.data.sheets || [])
    .map(sheet => sheet.properties?.title)
    .filter(Boolean);
}

async function readErrorListRows() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: ERROR_LIST_SHEET_ID,
      range: `'${ERROR_LIST_SHEET_NAME}'!A:Z`,
    });
    return res.data.values || [];
  } catch (err) {
    const formatted = formatSheetsError(err);
    if (formatted.code === 'sheets_range' || formatted.code === 'sheets_not_found') {
      try {
        const tabs = await listSheetTabNames();
        if (tabs.length) {
          formatted.hint += ` Available tabs: ${tabs.join(', ')}.`;
        }
      } catch {
        // ignore secondary failure
      }
    }
    throw formatted;
  }
}

export async function getActivityErrors() {
  const rows = await readErrorListRows();
  const completedRowSet = getCompletedRowSet(ERROR_LIST_SHEET_ID);
  const { items, statusColumn, hasStatusHeader } = parseErrorListRows(rows, { completedRowSet });
  return {
    items,
    count: items.length,
    sheetId: ERROR_LIST_SHEET_ID,
    sheetName: ERROR_LIST_SHEET_NAME,
    assignee: ERROR_LIST_ASSIGNEE,
    headerRow: ERROR_LIST_HEADER_ROW,
    statusColumn,
    hasStatusHeader,
    readOnly: true,
    completionStorage: 'local',
  };
}

export async function completeActivityError(rowNumber) {
  const parsedRow = parseInt(rowNumber, 10);
  const minRow = ERROR_LIST_HEADER_ROW + 1;
  if (!Number.isFinite(parsedRow) || parsedRow < minRow) {
    throw new Error('Invalid row number');
  }

  const rows = await readErrorListRows();
  const completedRowSet = getCompletedRowSet(ERROR_LIST_SHEET_ID);
  const { items } = parseErrorListRows(rows, { completedRowSet });
  const match = items.find(item => item.rowNumber === parsedRow);
  if (!match) {
    throw new Error('Error task not found or already completed');
  }

  // Read-only sheet access — persist completion locally (does not modify Google Sheet).
  return markCompleted({
    sheetId: ERROR_LIST_SHEET_ID,
    rowNumber: parsedRow,
    customerId: match.customerId,
    reason: match.reason,
  });
}

export {
  ERROR_LIST_SHEET_ID,
  ERROR_LIST_SHEET_NAME,
  ERROR_LIST_ASSIGNEE,
  ERROR_LIST_HEADER_ROW,
};
