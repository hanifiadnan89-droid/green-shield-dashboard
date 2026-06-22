import { google } from 'googleapis';
import { loadGoogleCredentials } from './googleCredentials.js';

const SHEET_ID = process.env.SHEET_ID || '1hneyXzxNqHDM-AfNs5-c1Qp7jqBeHfpKKsYbf_62obk';
const SHEET_NAME = process.env.SHEET_NAME || 'Lead Responses';
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

export async function getLeads() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:O`
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const leads = rows.slice(1).map((row, i) => rowToLead(row, i))
    .filter(lead => lead.deleted !== 'yes');

  return leads;
}

export async function updateLead(rowNumber, updates) {
  if (updates?.replies_last_read_at !== undefined) {
    console.log(`[READ-DIAG] updateLead entry: rowNumber=${rowNumber} replies_last_read_at=${updates.replies_last_read_at}`);
  }
  if (process.env.TEST_MODE === 'true') {
    return { updated: true, testMode: true };
  }
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:O${rowNumber}`
  });
  const currentRow = (existing.data.values || [[]])[0] || [];

  const newRow = COLUMNS.map((col, j) => {
    if (updates[col] !== undefined) return updates[col];
    return currentRow[j] ?? '';
  });

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A${rowNumber}:O${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [newRow] }
    });
    if (updates?.replies_last_read_at !== undefined) {
      console.log(`[READ-DIAG] updateLead success: rowNumber=${rowNumber}`);
    }
  } catch (err) {
    if (updates?.replies_last_read_at !== undefined) {
      console.warn(`[READ-DIAG] updateLead FAILED: rowNumber=${rowNumber} err=${err.message}`);
    }
    throw err;
  }
  return { updated: true };
}

export async function appendLead(lead) {
  if (process.env.TEST_MODE === 'true') {
    return { appended: true, testMode: true };
  }
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const row = COLUMNS.map(col => lead[col] ?? '');
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:O`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  return { appended: true };
}

/** Write replies_last_read_at (column O) for a single row — one API call, no row read. */
export async function writeRepliesLastReadAt(rowNumber, iso) {
  console.log(`[READ-DIAG] writeRepliesLastReadAt entry: rowNumber=${rowNumber} iso=${iso}`);
  if (process.env.TEST_MODE === 'true') return { updated: true, testMode: true };
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!O${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[iso]] },
    });
    console.log(`[READ-DIAG] writeRepliesLastReadAt success: rowNumber=${rowNumber}`);
  } catch (err) {
    console.warn(`[READ-DIAG] writeRepliesLastReadAt FAILED: rowNumber=${rowNumber} err=${err.message}`);
    throw err;
  }
  return { updated: true };
}

export { COLUMNS, SHEET_NAME };
