import { google } from 'googleapis';
import fs from 'fs';

const SHEET_ID = process.env.SHEET_ID || '1hneyXzxNqHDM-AfNs5-c1Qp7jqBeHfpKKsYbf_62obk';
const SHEET_NAME = process.env.SHEET_NAME || 'Lead Responses';
const COLUMNS = ['name', 'email', 'notes', 'status', 'sent', 'error', 'stop', 'phone', 'sms_reply', 'email_reply', 'sold', 'deleted'];

function getAuth() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_FILE, 'utf8'));
  } else {
    throw new Error('No Google credentials configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE in .env');
  }
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
    range: `${SHEET_NAME}!A:L`
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  return rows.slice(1).map((row, i) => rowToLead(row, i))
    .filter(lead => lead.deleted !== 'yes');
}

export async function updateLead(rowNumber, updates) {
  if (process.env.TEST_MODE === 'true') {
    return { updated: true, testMode: true };
  }
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:L${rowNumber}`
  });
  const currentRow = (existing.data.values || [[]])[0] || [];

  const newRow = COLUMNS.map((col, j) => {
    if (updates[col] !== undefined) return updates[col];
    return currentRow[j] ?? '';
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:L${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [newRow] }
  });
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
    range: `${SHEET_NAME}!A:L`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  return { appended: true };
}

export { COLUMNS, SHEET_NAME };
