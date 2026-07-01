import { getGoogleCredentialsDiagnostics } from './googleCredentials.js';
import { getLeads } from './sheets.js';
import { resolveGoogleSheetsConfig } from './integrationResolver.js';

/** @type {{ checkedAt: string | null, ok: boolean, leadCount: number | null, error: string | null, category: string | null, clientEmail: string | null, sheetId: string | null, sheetName: string | null }} */
let lastCheck = {
  checkedAt: null,
  ok: false,
  leadCount: null,
  error: null,
  category: null,
  clientEmail: null,
  sheetId: null,
  sheetName: null,
};

function categorizeSheetsError(err) {
  const msg = err?.message || String(err);
  const code = err?.code || err?.response?.status;

  if (/not configured|GOOGLE_SERVICE_ACCOUNT|missing/i.test(msg)) {
    return { category: 'missing_credentials', error: msg };
  }
  if (/invalid JSON|parse|Unexpected token/i.test(msg)) {
    return { category: 'invalid_json', error: msg };
  }
  if (/client_email|private_key|invalid_shape/i.test(msg)) {
    return { category: 'invalid_credentials', error: msg };
  }
  if (code === 403 || /permission|denied|forbidden/i.test(msg)) {
    return {
      category: 'spreadsheet_permissions',
      error: `${msg} — share the sheet with the service account email as Editor.`,
    };
  }
  if (code === 404 || /not found|Unable to parse range/i.test(msg)) {
    return {
      category: 'incorrect_sheet_id_or_tab',
      error: `${msg} — verify SHEET_ID and SHEET_NAME (tab "Lead Responses").`,
    };
  }
  return { category: 'sheets_api_error', error: msg };
}

export function getSheetsStartupCheck() {
  return { ...lastCheck };
}

export async function runSheetsStartupCheck() {
  const sheetsConfig = resolveGoogleSheetsConfig(null);
  const sheetId = sheetsConfig.leadResponsesSheetId || sheetsConfig.masterLeadSheetId || '(using built-in default)';
  const sheetName = sheetsConfig.sheetName || 'Lead Responses';
  const diag = getGoogleCredentialsDiagnostics();

  if (!diag.ok) {
    lastCheck = {
      checkedAt: new Date().toISOString(),
      ok: false,
      leadCount: null,
      error: diag.message,
      category: diag.status,
      clientEmail: null,
      sheetId: sheetsConfig.leadResponsesSheetId || sheetsConfig.masterLeadSheetId || null,
      sheetName,
    };
    console.error('[sheets] Startup check failed:', diag.status, '—', diag.message);
    return lastCheck;
  }

  const clientEmail = diag.credentials?.client_email || null;
  console.log('[sheets] Service account:', clientEmail || '(unknown)');
  console.log('[sheets] Sheet ID:', sheetsConfig.configured ? 'configured via resolver' : 'using legacy default');
  console.log('[sheets] Sheet tab:', sheetName);

  try {
    const leads = await getLeads();
    lastCheck = {
      checkedAt: new Date().toISOString(),
      ok: true,
      leadCount: leads.length,
      error: null,
      category: null,
      clientEmail,
      sheetId: sheetsConfig.leadResponsesSheetId || sheetsConfig.masterLeadSheetId || 'default',
      sheetName,
    };
    console.log(`[sheets] Startup check OK — ${leads.length} leads loaded from "${sheetName}"`);
    return lastCheck;
  } catch (err) {
    const { category, error } = categorizeSheetsError(err);
    lastCheck = {
      checkedAt: new Date().toISOString(),
      ok: false,
      leadCount: null,
      error,
      category,
      clientEmail,
      sheetId: sheetsConfig.leadResponsesSheetId || sheetsConfig.masterLeadSheetId || 'default',
      sheetName,
    };
    console.error('[sheets] Startup check failed:', category);
    console.error('[sheets]', error);
    if (err?.stack) console.error(err.stack);
    return lastCheck;
  }
}
