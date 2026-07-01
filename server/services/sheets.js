import { google } from 'googleapis';
import { loadGoogleCredentials } from './googleCredentials.js';
import { resolveGoogleSheetsConfig } from './integrationResolver.js';
import {
  assignLeadOwner,
  decorateLeadOwnership,
  updateLeadOwnershipMetadata,
} from './leadOwnership.js';

const LEGACY_SHEET_ID = '1hneyXzxNqHDM-AfNs5-c1Qp7jqBeHfpKKsYbf_62obk';
const SHEET_NAME = 'Lead Responses';
const COLUMNS = ['name', 'reason', 'email', 'notes', 'status', 'sent', 'error', 'stop', 'phone', 'phone_formatted', 'sms_reply', 'email_reply', 'deleted', 'sold', 'replies_last_read_at'];

function getAuth() {
  const credentials = loadGoogleCredentials();
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly'
    ]
  });
}

function rowToLead(row, index) {
  const lead = { row_number: index + 2 };
  COLUMNS.forEach((col, j) => { lead[col] = (row[j] ?? '') + ''; });
  return lead;
}

function parseAppendedRowNumber(updatedRange) {
  const match = typeof updatedRange === 'string'
    ? updatedRange.match(/!A(\d+):/i) || updatedRange.match(/!(?:[A-Z]+)(\d+):/i)
    : null;
  return match ? Number.parseInt(match[1], 10) : null;
}

function resolveSpreadsheetConfig(context) {
  const sheetsConfig = resolveGoogleSheetsConfig(context);
  return {
    spreadsheetId: sheetsConfig.leadResponsesSheetId || sheetsConfig.masterLeadSheetId || LEGACY_SHEET_ID,
    sheetName: sheetsConfig.sheetName || SHEET_NAME,
    source: sheetsConfig.source,
    configured: sheetsConfig.configured,
  };
}

export async function getLeads(context = null) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const { spreadsheetId, sheetName } = resolveSpreadsheetConfig(context);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:O`
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const leads = rows.slice(1).map((row, i) => decorateLeadOwnership(rowToLead(row, i), context))
    .filter(lead => lead.deleted !== 'yes');

  return leads;
}

export async function updateLead(rowNumber, updates, context = null) {
  if (process.env.TEST_MODE === 'true') {
    return { updated: true, testMode: true };
  }
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const { spreadsheetId, sheetName } = resolveSpreadsheetConfig(context);

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}:O${rowNumber}`
  });
  const currentRow = (existing.data.values || [[]])[0] || [];

  const newRow = COLUMNS.map((col, j) => {
    if (updates[col] !== undefined) return updates[col];
    return currentRow[j] ?? '';
  });

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowNumber}:O${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [newRow] }
    });
    updateLeadOwnershipMetadata(rowNumber, context);
  } catch (err) {
    throw err;
  }
  return { updated: true };
}

export async function appendLead(lead, context = null) {
  if (process.env.TEST_MODE === 'true') {
    return { appended: true, testMode: true };
  }
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const { spreadsheetId, sheetName } = resolveSpreadsheetConfig(context);
  const row = COLUMNS.map(col => lead[col] ?? '');
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:O`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  const rowNumber = parseAppendedRowNumber(response?.data?.updates?.updatedRange);
  const ownership = rowNumber ? assignLeadOwner(rowNumber, context, {
    createdBy: context?.userId || 'system',
    updatedBy: context?.userId || 'system',
  }) : null;
  return {
    appended: true,
    row_number: rowNumber,
    ownership,
  };
}

/** Write replies_last_read_at (column O) for a single row — one API call, no row read. */
export async function writeRepliesLastReadAt(rowNumber, iso, context = null) {
  if (process.env.TEST_MODE === 'true') return { updated: true, testMode: true };
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const { spreadsheetId, sheetName } = resolveSpreadsheetConfig(context);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!O${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[iso]] },
  });
  return { updated: true };
}

export { COLUMNS, SHEET_NAME };
