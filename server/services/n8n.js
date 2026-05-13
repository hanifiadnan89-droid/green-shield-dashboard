const BASE_URL = process.env.N8N_BASE_URL || 'https://leadsales.app.n8n.cloud';
const WEBHOOK_PATH = process.env.N8N_LEAD_WEBHOOK_PATH || '/webhook/lead-response';

export const WORKFLOW_CATALOG = [
  {
    id: 'CSaffl8Ke5nIcLcW',
    name: 'Lead Email Responder',
    description: 'Master workflow: sends templates (AG, NA, RIT, T/M, IQ) via email + SMS, then auto follow-up at 2 and 5 days',
    webhookUrl: `${BASE_URL}${WEBHOOK_PATH}`,
    active: true,
    type: 'webhook',
    canTrigger: true
  },
  {
    id: 'Z1L9diiP8vG8Xwn0',
    name: 'SMS Responder',
    description: 'Handles incoming Twilio SMS replies — marks lead as replied and sets stop=yes automatically',
    webhookUrl: `${BASE_URL}/webhook/85f92afd-4902-4083-b932-fa694217611e`,
    active: true,
    type: 'webhook',
    canTrigger: false
  },
  {
    id: 'soqaI8mHP2iSYAjZ',
    name: 'Auto Reply Detection',
    description: 'IMAP trigger — detects email replies and marks lead as replied + stopped in the sheet',
    active: true,
    type: 'imap',
    canTrigger: false
  },
  {
    id: 'j49h86ws2AWYkCb9',
    name: 'Extractor',
    description: 'Watches the AH sales sheet every minute — auto-imports "Sent Agr" and "No Ans" leads into Lead Responses',
    active: true,
    type: 'sheets_trigger',
    canTrigger: false
  }
];

export async function triggerLeadWebhook(leadData) {
  if (process.env.TEST_MODE === 'true') {
    return {
      success: true,
      testMode: true,
      wouldHaveSent: {
        url: `${BASE_URL}${WEBHOOK_PATH}`,
        payload: leadData
      }
    };
  }

  const url = `${BASE_URL}${WEBHOOK_PATH}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leadData)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n webhook returned ${res.status}: ${text}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const result = contentType.includes('json') ? await res.json() : await res.text();
  return { success: true, result };
}

export async function getWorkflowStatuses() {
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': apiKey }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || [];
  } catch {
    return null;
  }
}
